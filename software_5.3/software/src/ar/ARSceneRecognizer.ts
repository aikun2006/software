/**
 * ARSceneRecognizer —— 场景识别协调器
 *
 * 职责：
 *   1. 启动定时识别循环，周期性截帧并调用 AI 场景识别
 *   2. 节流：上次识别未完成时不发起新请求
 *   3. 结果稳定性：连续 2 次识别到同一景点才确认，避免闪烁
 *   4. 离线模式：无网络时使用本地景点图片特征匹配（简单色彩直方图 + 关键词降级）
 *
 * 依赖：
 *   - ARCameraComposer 提供截帧能力
 *   - ARKnowledgeLinker 提供景点数据（离线匹配用）
 *   - aiScheduler.getRecognitionProvider().scene_recognition_ai() 提供在线识别
 */

import { aiScheduler } from '@/ai/AIScheduler'
import { spots, getSpotById } from '@/data/spots'
import { ARCameraComposer, RECOGNITION_INTERVAL } from './ARCameraComposer'
import { ARKnowledgeLinker } from './ARKnowledgeLinker'
import { ARExitManager } from './ARExitManager'
import { ARFeatureMatcher } from './ARFeatureMatcher'
import type { ImageFeature as AdvancedImageFeature, MatchResult } from './ARFeatureMatcher'
import type { ARRecognitionResult, ResourceHandle, ARTrackingState } from './types'

/** 识别循环间隔（毫秒），不低于帧率控制间隔 */
const RECOGNIZE_LOOP_INTERVAL = Math.max(RECOGNITION_INTERVAL, 2500)

/** P1.2优化：高跟踪质量时的快速识别间隔（毫秒） */
const FAST_RECOGNIZE_INTERVAL = 1500

/** P1.2优化：触发快速识别的跟踪质量阈值 */
const FAST_RECOGNIZE_QUALITY_THRESHOLD = 0.8

/** 连续确认次数阈值（避免闪烁） */
const CONFIRM_THRESHOLD = 2

export class ARSceneRecognizer {
  private composer: ARCameraComposer
  private linker: ARKnowledgeLinker
  private exitManager: ARExitManager | null

  /** 识别循环定时器 ID */
  private timerId: ReturnType<typeof setTimeout> | null = null
  /** 是否正在执行识别（节流标志） */
  private isRecognizing = false
  /** P1.2优化：识别回调引用（用于递归setTimeout） */
  private recognitionCallback: ((result: ARRecognitionResult | null) => void) | null = null
  /** P1.2优化：已预加载知识的景点集合（避免重复预加载） */
  private preloadedSpots: Set<string> = new Set()

  /** 上一次识别到的景点 ID（用于稳定性判断） */
  private lastSpotId: string | null = null
  /** 连续识别到同一景点的次数 */
  private consecutiveCount = 0
  /** 最近一次确认的结果（离线降级时复用） */
  private lastConfirmedResult: ARRecognitionResult | null = null

  /** 多尺度特征匹配器 */
  private featureMatcher: ARFeatureMatcher
  /** 本地景点图片特征缓存（spotId -> AdvancedImageFeature[]，多张参考图） */
  private spotImageFeatures: Map<string, AdvancedImageFeature[]> = new Map()
  /** 本地特征是否已预加载 */
  private featuresPreloaded = false
  /** AR 跟踪状态（用于增强跟踪稳定性） */
  private trackingState: ARTrackingState = {
    spotId: null,
    lastSeenTimestamp: 0,
    consecutiveMatches: 0,
    trackingQuality: 0
  }

  /** 定时器资源句柄 ID */
  private timerHandleId: string | null = null

  constructor(
    composer: ARCameraComposer,
    linker: ARKnowledgeLinker,
    exitManager?: ARExitManager
  ) {
    this.composer = composer
    this.linker = linker
    this.exitManager = exitManager ?? null
    this.featureMatcher = new ARFeatureMatcher()
  }

  /**
   * 启动定时识别循环。
   * P1.2优化：使用递归setTimeout替代setInterval，支持动态间隔
   *   - 跟踪质量≥0.8时：间隔降至1.5秒（快速确认）
   *   - 跟踪质量<0.8时：间隔恢复默认2.5秒
   * @param callback 识别结果回调（稳定性确认后触发，传入 null 表示本次未确认）
   */
  startRecognizing(callback: (result: ARRecognitionResult | null) => void): void {
    if (this.timerId !== null) {
      // 已在运行
      return
    }

    this.recognitionCallback = callback

    // 注册定时器资源
    this.timerHandleId = `ar-timer-${Date.now()}`
    this.exitManager?.register({
      type: 'timer',
      id: this.timerHandleId,
      dispose: () => this.stopRecognizing()
    })

    // 预加载本地景点图片特征（用于离线匹配）
    if (!this.featuresPreloaded) {
      this.preloadSpotFeatures().catch(() => {
        // 预加载失败不影响在线识别
      })
    }

    // 立即执行一次识别，然后通过递归setTimeout动态调度
    this.scheduleNextRecognition(0)
  }

  /**
   * P1.2优化：动态调度下一次识别
   * 根据当前跟踪质量自适应间隔：
   *   - trackingQuality ≥ 0.8 → 1500ms（跟踪稳定，加快确认）
   *   - trackingQuality < 0.8 → 默认间隔（首次识别或跟踪丢失）
   */
  private scheduleNextRecognition(delay?: number): void {
    // 计算动态间隔
    const interval = delay !== undefined ? delay : (
      this.trackingState.trackingQuality >= FAST_RECOGNIZE_QUALITY_THRESHOLD
        ? FAST_RECOGNIZE_INTERVAL
        : RECOGNIZE_LOOP_INTERVAL
    )

    this.timerId = setTimeout(async () => {
      if (!this.recognitionCallback) return
      await this.doRecognize(this.recognitionCallback)
      // 递归调度下一次（如果未被停止）
      if (this.timerId !== null) {
        this.scheduleNextRecognition()
      }
    }, interval)
  }

  /**
   * 停止识别循环。
   */
  stopRecognizing(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
    this.isRecognizing = false
    this.recognitionCallback = null

    if (this.exitManager && this.timerHandleId) {
      this.exitManager.unregister(this.timerHandleId)
    }
    this.timerHandleId = null
  }

  /**
   * 执行一次识别流程。
   * 节流：上次未完成则跳过。
   */
  private async doRecognize(
    callback: (result: ARRecognitionResult | null) => void
  ): Promise<void> {
    // 节流：上次识别未完成
    if (this.isRecognizing) {
      return
    }
    this.isRecognizing = true

    try {
      // 截取当前帧
      const imageBase64 = this.composer.captureFrame()
      if (!imageBase64) {
        // 帧率控制跳过
        this.isRecognizing = false
        return
      }

      let result: ARRecognitionResult | null = null

      // 在线 / 离线分流
      if (this.isOnline()) {
        try {
          result = await this.recognizeOnline(imageBase64)
        } catch (err) {
          console.warn('[ARSceneRecognizer] 在线识别失败，降级离线:', err)
          result = await this.recognizeOffline(imageBase64)
        }
      } else {
        result = await this.recognizeOffline(imageBase64)
      }

      // 稳定性判断：连续 2 次同一景点才确认
      if (result && result.spotId) {
        if (result.spotId === this.lastSpotId) {
          this.consecutiveCount++
        } else {
          this.lastSpotId = result.spotId
          this.consecutiveCount = 1
        }

        // 跟踪稳定性增强：
        // 1. 连续 3 次以上确认同一景点 → 跳过 CONFIRM_THRESHOLD 检查，立即确认（提高确认速度）
        // 2. 上次识别在 5 秒内且同一景点 → 确认阈值降为 1（快速恢复跟踪）
        const now = Date.now()
        const isSameAsTracked = this.trackingState.spotId === result.spotId
        const withinRecentWindow = now - this.trackingState.lastSeenTimestamp < 5000
        const skipThresholdCheck = this.trackingState.consecutiveMatches >= 3
        const fastConfirmThreshold =
          (isSameAsTracked && withinRecentWindow) ? 1 : CONFIRM_THRESHOLD

        if (skipThresholdCheck || this.consecutiveCount >= fastConfirmThreshold) {
          this.lastConfirmedResult = result
          // 更新跟踪状态
          this.trackingState.spotId = result.spotId
          this.trackingState.lastSeenTimestamp = now
          this.trackingState.consecutiveMatches++
          this.trackingState.trackingQuality = Math.min(
            1,
            this.trackingState.consecutiveMatches / 5
          )
          // P1.2优化：首次确认景点后预加载知识数据（下次识别无需等数据）
          this.preloadSpotKnowledge(result.spotId)
          callback(result)
        } else {
          // 首次识别到，暂不确认
          callback(null)
        }
      } else {
        // 无识别结果，重置稳定性计数
        this.lastSpotId = null
        this.consecutiveCount = 0
        // 跟踪丢失：重置连续匹配计数但保留 spotId 以便快速恢复
        this.trackingState.consecutiveMatches = 0
        this.trackingState.trackingQuality = 0
        callback(null)
      }
    } catch (err) {
      console.error('[ARSceneRecognizer] 识别异常:', err)
      callback(null)
    } finally {
      this.isRecognizing = false
    }
  }

  /**
   * 在线识别：调用 AI 调度层的场景识别接口。
   */
  private async recognizeOnline(imageBase64: string): Promise<ARRecognitionResult | null> {
    const provider = aiScheduler.getRecognitionProvider()
    const res = await provider.scene_recognition_ai(imageBase64)

    if (!res || !res.spot_id) {
      return null
    }

    return {
      spotId: res.spot_id,
      spotName: res.spot_name ?? '',
      confidence: typeof res.confidence === 'number' ? res.confidence : 0,
      description: res.description ?? '',
      timestamp: Date.now()
    }
  }

  /**
   * 离线识别：本地景点图片特征匹配。
   *
   * 策略：
   *   1. 使用多尺度特征匹配器计算当前帧的高级特征（色彩 + 亮度直方图 + 边缘方向直方图）
   *   2. 通过加权距离与预加载的景点特征库匹配
   *   3. 匹配器内部根据当前亮度动态调整阈值（暗环境收紧、亮环境放宽）
   *   4. 匹配失败则降级返回上次缓存结果
   */
  private async recognizeOffline(imageBase64: string): Promise<ARRecognitionResult | null> {
    // 计算当前帧的高级特征（多尺度：色彩 + 亮度直方图 + 边缘方向直方图）
    const frameFeature = await this.featureMatcher
      .computeFeatureFromBase64(imageBase64)
      .catch(() => null)
    if (!frameFeature) {
      // 无法计算特征，降级返回上次结果
      return this.fallbackOffline()
    }

    // 使用多参考图特征匹配器进行加权距离匹配
    // matchMultiple() 对每个景点的多张参考图取最小距离，提升不同角度/光线下的识别准确率
    const matchResult: MatchResult = this.featureMatcher.matchMultiple(
      frameFeature,
      this.spotImageFeatures
    )

    // 匹配成功（spotId 非空表示距离小于动态阈值）
    if (matchResult.spotId) {
      const spot = getSpotById(matchResult.spotId)
      if (spot) {
        return {
          spotId: spot.id,
          spotName: spot.name,
          confidence: matchResult.confidence,
          description: spot.desc,
          timestamp: Date.now()
        }
      }
    }

    // 高级特征匹配失败，降级返回上次缓存结果
    return this.fallbackOffline()
  }

  /**
   * 离线降级：返回上次确认的结果（降低置信度）。
   * 若无缓存则返回 null。
   */
  private fallbackOffline(): ARRecognitionResult | null {
    if (this.lastConfirmedResult) {
      return {
        ...this.lastConfirmedResult,
        confidence: this.lastConfirmedResult.confidence * 0.5,
        timestamp: Date.now()
      }
    }
    return null
  }

  /**
   * 预加载所有景点的全部图片特征（多尺度：色彩 + 亮度直方图 + 边缘方向直方图 + ORB）。
   * 在 startRecognizing 时异步触发，不阻塞主流程。
   *
   * 多图加载策略：
   *   - 加载每个景点的所有参考图片（最多3张），构建多角度特征库
   *   - 每张图片独立计算特征，存入 spotImageFeatures[spotId] 数组
   *   - 单张图片加载失败不影响其他图片
   */
  private async preloadSpotFeatures(): Promise<void> {
    const tasks: Promise<void>[] = []

    for (const spot of spots) {
      if (spot.images && spot.images.length > 0) {
        const spotId = spot.id
        const imgFeatures: AdvancedImageFeature[] = []
        this.spotImageFeatures.set(spotId, imgFeatures)

        for (const imgSrc of spot.images) {
          tasks.push(
            this.featureMatcher.computeFeature(imgSrc).then(feature => {
              imgFeatures.push(feature)
            }).catch(() => {
              // 单张图片加载失败不影响其他
            })
          )
        }
      }
    }

    await Promise.all(tasks)
    this.featuresPreloaded = true
  }

  /**
   * P1.2优化：预加载景点知识数据
   * 首次识别到景点后，预加载该景点的完整知识库内容到缓存
   * 下次识别到同一景点时，问答响应可直接使用缓存数据，无需重新查询
   */
  private preloadSpotKnowledge(spotId: string): void {
    if (this.preloadedSpots.has(spotId)) return
    this.preloadedSpots.add(spotId)
    // linkSpot为同步方法，内部使用可选链+空值合并，不会抛异常
    // 调用一次即填充缓存，后续问答可直接命中缓存
    try {
      this.linker.linkSpot(spotId)
    } catch {
      // 预加载失败时移除标记，允许下次重试
      this.preloadedSpots.delete(spotId)
    }
  }

  /** 判断当前是否联网 */
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine
  }

  /** 获取最近一次确认的识别结果 */
  getLastResult(): ARRecognitionResult | null {
    return this.lastConfirmedResult
  }

  /**
   * 获取当前跟踪状态（用于外部 UI 反馈跟踪质量与连续匹配情况）。
   * 返回副本以防止外部直接修改内部状态。
   */
  getTrackingState(): ARTrackingState {
    return { ...this.trackingState }
  }
}
