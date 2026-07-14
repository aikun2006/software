/**
 * ARPerformanceMonitor —— AR 性能健康监控器
 *
 * 职责：
 *   1. 实时监控关键性能指标：FPS、识别延迟、内存占用、CPU 负载估算、网络请求成功率
 *   2. 使用 requestAnimationFrame 计算实际渲染帧率
 *   3. 识别延迟通过 recordRecognitionStart / recordRecognitionEnd 配对记录
 *   4. 内存占用优先使用 performance.memory（Chrome），不支持时手动估算
 *   5. 预警机制：FPS<20、识别延迟>3s、内存>200MB、请求成功率<80% 时触发警告回调
 *   6. 健康分数：综合各指标计算 0-100 分，便于 UI 展示总体状态
 *
 * 优化目的：
 *   - 在 AR 运行时实时发现性能瓶颈，避免卡顿积累导致崩溃。
 *   - 通过预警回调让上层模块自适应降级（如降低帧率、减少卡片数量）。
 *
 * 可选注入 ARExitManager：销毁时自动停止监控并清理定时器与回调。
 */

import { ARExitManager } from './ARExitManager'

/** 性能指标快照 */
export interface PerformanceMetrics {
  /** 实际渲染帧率（fps） */
  fps: number
  /** 识别延迟（毫秒，最近一次） */
  recognitionLatency: number
  /** 内存占用（MB） */
  memoryUsage: number
  /** 网络请求成功率（0-1） */
  requestSuccessRate: number
  /** CPU 负载估算（0-1，基于帧间隔波动） */
  cpuLoadEstimate: number
  /** 指标采集时间戳 */
  timestamp: number
}

/** 预警阈值配置 */
export interface AlertConfig {
  /** FPS 下限，低于触发预警（默认 20） */
  fpsThreshold: number
  /** 识别延迟上限（毫秒），超过触发预警（默认 3000） */
  latencyThreshold: number
  /** 内存占用上限（MB），超过触发预警（默认 200） */
  memoryThreshold: number
  /** 请求成功率下限（0-1），低于触发预警（默认 0.8） */
  successRateThreshold: number
}

/** 预警事件类型 */
export type AlertType = 'fps' | 'latency' | 'memory' | 'successRate'

/** 预警事件 */
export interface AlertEvent {
  /** 预警类型 */
  type: AlertType
  /** 当前值 */
  value: number
  /** 阈值 */
  threshold: number
  /** 触发时间戳 */
  timestamp: number
  /** 完整指标快照 */
  metrics: PerformanceMetrics
}

/**
 * 扩展 Performance 类型声明。
 *
 * 优化说明：performance.memory 为 Chrome 非标准 API，TypeScript DOM 库未声明，
 * 通过接口合并补充类型，避免使用 any。
 */
interface MemoryPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

/** 默认预警配置 */
const DEFAULT_ALERT_CONFIG: AlertConfig = {
  fpsThreshold: 20,
  latencyThreshold: 3000,
  memoryThreshold: 200,
  successRateThreshold: 0.8
}

export class ARPerformanceMonitor {
  /** 预警阈值配置 */
  private alertConfig: AlertConfig
  /** 外部资源回收管理器（可选） */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 ID */
  private timerHandleId: string | null = null

  /** 是否正在监控 */
  private running = false
  /** requestAnimationFrame 句柄 */
  private rafId: number | null = null

  /** 帧时间戳队列（用于计算 FPS 与 CPU 负载） */
  private frameTimes: number[] = []
  /** 上一帧时间戳 */
  private lastFrameTime = 0
  /** 当前 FPS（滑动平均） */
  private currentFps = 60

  /** 识别延迟记录：开始时间戳栈 */
  private recognitionStartStack: number[] = []
  /** 最近一次识别延迟（毫秒） */
  private lastLatency = 0
  /** 识别延迟滑动窗口（用于平滑） */
  private latencyWindow: number[] = []

  /** 网络请求统计：成功数 */
  private successCount = 0
  /** 网络请求统计：失败数 */
  private failCount = 0

  /** CPU 负载估算（0-1） */
  private cpuLoad = 0

  /** 预警回调列表 */
  private alertCallbacks: Array<(event: AlertEvent) => void> = []
  /** 已触发的预警类型（去重，避免同一类型连续触发） */
  private activeAlerts: Set<AlertType> = new Set()

  /** 指标采样定时器（定期计算快照并检查预警） */
  private sampleTimerId: ReturnType<typeof setInterval> | null = null
  /** 采样间隔（毫秒） */
  private readonly sampleInterval = 1000

  /** 基准内存占用（启动时的内存，用于手动估算增量） */
  private baselineMemory = 0

  constructor(exitManager?: ARExitManager, alertConfig?: Partial<AlertConfig>) {
    this.exitManager = exitManager ?? null
    this.alertConfig = { ...DEFAULT_ALERT_CONFIG, ...alertConfig }
  }

  /**
   * 启动性能监控。
   * 开始通过 requestAnimationFrame 计算帧率，并启动定时采样。
   */
  start(): void {
    if (this.running) return
    this.running = true

    // 记录基准内存
    this.baselineMemory = this.getMemoryUsage()

    // 启动帧率监控
    this.lastFrameTime = performance.now()
    this.rafId = requestAnimationFrame(this.onFrame)

    // 启动定时采样（每秒计算一次快照并检查预警）
    this.sampleTimerId = setInterval(() => this.sample(), this.sampleInterval)

    // 注册定时器资源
    if (this.exitManager) {
      this.timerHandleId = `ar-perf-timer-${Date.now()}`
      this.exitManager.register({
        type: 'timer',
        id: this.timerHandleId,
        dispose: () => this.stop()
      })
    }
  }

  /**
   * 停止性能监控。
   * 取消 requestAnimationFrame 与定时器。
   */
  stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.sampleTimerId !== null) {
      clearInterval(this.sampleTimerId)
      this.sampleTimerId = null
    }
    if (this.exitManager && this.timerHandleId) {
      this.exitManager.unregister(this.timerHandleId)
    }
    this.timerHandleId = null
  }

  /**
   * 记录一次识别请求开始。
   * 与 recordRecognitionEnd 配对使用，用于计算识别延迟。
   */
  recordRecognitionStart(): void {
    this.recognitionStartStack.push(performance.now())
  }

  /**
   * 记录一次识别请求结束。
   * 计算与最近一次 recordRecognitionStart 的差值作为识别延迟。
   *
   * @param success 本次请求是否成功
   */
  recordRecognitionEnd(success: boolean = true): void {
    const startTime = this.recognitionStartStack.pop()
    if (startTime !== undefined) {
      const latency = performance.now() - startTime
      this.lastLatency = latency
      // 滑动窗口（保留最近 10 次）
      this.latencyWindow.push(latency)
      if (this.latencyWindow.length > 10) {
        this.latencyWindow.shift()
      }
    }
    // 统计成功率
    if (success) {
      this.successCount++
    } else {
      this.failCount++
    }
  }

  /**
   * 记录一次网络请求的成功/失败。
   * 用于统计请求成功率，不影响识别延迟统计。
   *
   * @param success 请求是否成功
   */
  recordRequestSuccess(success: boolean): void {
    if (success) {
      this.successCount++
    } else {
      this.failCount++
    }
  }

  /**
   * 注册预警回调。
   * @returns 取消注册的函数
   */
  onAlert(callback: (event: AlertEvent) => void): () => void {
    this.alertCallbacks.push(callback)
    return () => {
      const idx = this.alertCallbacks.indexOf(callback)
      if (idx >= 0) {
        this.alertCallbacks.splice(idx, 1)
      }
    }
  }

  /**
   * 获取当前指标快照。
   * 返回最新计算的各项指标。
   */
  getMetrics(): PerformanceMetrics {
    return {
      fps: Math.round(this.currentFps),
      recognitionLatency: Math.round(this.getAvgLatency()),
      memoryUsage: Math.round(this.getMemoryUsage()),
      requestSuccessRate: this.getSuccessRate(),
      cpuLoadEstimate: Math.round(this.cpuLoad * 100) / 100,
      timestamp: Date.now()
    }
  }

  /**
   * 计算 AR 健康分数（0-100）。
   *
   * 评分算法：
   *   - FPS 分数（40%）：fps / 60 * 40，上限 40
   *   - 识别延迟分数（25%）：延迟越小越高，超过阈值记 0
   *   - 内存分数（15%）：低于阈值满分，超过按比例扣减
   *   - 成功率分数（20%）：successRate * 20
   *
   * 分数越低表示 AR 运行状态越差，建议上层降级。
   */
  getHealthScore(): number {
    const m = this.getMetrics()

    // FPS 分数（满分 40）
    const fpsScore = Math.min(m.fps / 60, 1) * 40

    // 识别延迟分数（满分 25）
    let latencyScore: number
    if (m.recognitionLatency <= this.alertConfig.latencyThreshold) {
      // 阈值内按比例计分（延迟越低分越高）
      latencyScore = (1 - m.recognitionLatency / this.alertConfig.latencyThreshold) * 25
    } else {
      latencyScore = 0
    }

    // 内存分数（满分 15）
    let memScore: number
    if (m.memoryUsage <= this.alertConfig.memoryThreshold) {
      memScore = (1 - m.memoryUsage / this.alertConfig.memoryThreshold) * 15
    } else {
      memScore = 0
    }

    // 成功率分数（满分 20）
    const successScore = m.requestSuccessRate * 20

    const total = fpsScore + latencyScore + memScore + successScore
    return Math.max(0, Math.min(100, Math.round(total)))
  }

  /**
   * requestAnimationFrame 回调：计算 FPS 与 CPU 负载。
   *
   * FPS 计算原理：
   *   记录最近 1 秒内的帧时间戳，帧数即为 FPS。
   *
   * CPU 负载估算原理：
   *   帧间隔的标准差越大，说明主线程被阻塞越严重（jank），CPU 负载越高。
   *   正常情况下帧间隔应接近 1000/fps，波动小说明负载低。
   */
  private onFrame = (): void => {
    if (!this.running) return

    const now = performance.now()
    this.frameTimes.push(now)

    // 只保留最近 1 秒的帧时间戳
    const cutoff = now - 1000
    while (this.frameTimes.length > 0 && this.frameTimes[0] < cutoff) {
      this.frameTimes.shift()
    }

    // FPS = 1 秒内的帧数
    this.currentFps = this.frameTimes.length

    // CPU 负载估算：基于帧间隔波动
    this.estimateCpuLoad(now)

    this.lastFrameTime = now
    this.rafId = requestAnimationFrame(this.onFrame)
  }

  /**
   * 估算 CPU 负载。
   *
   * 算法：计算最近若干帧间隔的标准差，归一化到 0-1。
   * 间隔波动越大 → jank 越严重 → CPU 负载越高。
   */
  private estimateCpuLoad(now: number): void {
    if (this.frameTimes.length < 4) return

    // 取最近 10 帧的间隔
    const recent = this.frameTimes.slice(-10)
    const intervals: number[] = []
    for (let i = 1; i < recent.length; i++) {
      intervals.push(recent[i] - recent[i - 1])
    }
    if (intervals.length === 0) return

    // 计算平均间隔
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
    // 计算标准差
    const variance = intervals.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / intervals.length
    const stdDev = Math.sqrt(variance)

    // 归一化：标准差 / 平均间隔（值越大负载越高），上限 1
    const ratio = avg > 0 ? stdDev / avg : 0
    this.cpuLoad = Math.min(1, ratio * 2)

    // 闲置时间过长时（页面切到后台），重置负载估算
    if (now - this.lastFrameTime > 500) {
      this.cpuLoad = Math.max(this.cpuLoad, 0.8)
    }
  }

  /**
   * 定时采样：计算快照并检查预警。
   */
  private sample(): void {
    if (!this.running) return

    const metrics = this.getMetrics()
    this.checkAlerts(metrics)
  }

  /**
   * 检查预警条件并触发回调。
   *
   * 去重策略：同一类型的预警在恢复前不重复触发，
   * 恢复后从 activeAlerts 移除，允许下次再次预警。
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const checks: Array<{ type: AlertType; value: number; threshold: number; triggered: boolean }> = [
      {
        type: 'fps',
        value: metrics.fps,
        threshold: this.alertConfig.fpsThreshold,
        triggered: metrics.fps < this.alertConfig.fpsThreshold
      },
      {
        type: 'latency',
        value: metrics.recognitionLatency,
        threshold: this.alertConfig.latencyThreshold,
        triggered: metrics.recognitionLatency > this.alertConfig.latencyThreshold
      },
      {
        type: 'memory',
        value: metrics.memoryUsage,
        threshold: this.alertConfig.memoryThreshold,
        triggered: metrics.memoryUsage > this.alertConfig.memoryThreshold
      },
      {
        type: 'successRate',
        value: metrics.requestSuccessRate,
        threshold: this.alertConfig.successRateThreshold,
        triggered: metrics.requestSuccessRate < this.alertConfig.successRateThreshold
      }
    ]

    for (const check of checks) {
      if (check.triggered && !this.activeAlerts.has(check.type)) {
        // 触发预警
        this.activeAlerts.add(check.type)
        const event: AlertEvent = {
          type: check.type,
          value: check.value,
          threshold: check.threshold,
          timestamp: Date.now(),
          metrics
        }
        for (const cb of this.alertCallbacks) {
          try {
            cb(event)
          } catch (e) {
            console.warn('[ARPerformanceMonitor] 预警回调异常:', e)
          }
        }
      } else if (!check.triggered && this.activeAlerts.has(check.type)) {
        // 恢复：从活跃预警中移除
        this.activeAlerts.delete(check.type)
      }
    }
  }

  /**
   * 获取平均识别延迟（滑动窗口）。
   */
  private getAvgLatency(): number {
    if (this.latencyWindow.length === 0) {
      return this.lastLatency
    }
    return this.latencyWindow.reduce((a, b) => a + b, 0) / this.latencyWindow.length
  }

  /**
   * 获取网络请求成功率。
   * 无请求记录时返回 1（默认正常）。
   */
  private getSuccessRate(): number {
    const total = this.successCount + this.failCount
    if (total === 0) return 1
    return this.successCount / total
  }

  /**
   * 获取内存占用（MB）。
   *
   * 优先使用 performance.memory（Chrome）；
   * 不支持时基于基准内存 + 识别请求次数粗略估算。
   */
  private getMemoryUsage(): number {
    const perf = performance as MemoryPerformance
    if (perf.memory && typeof perf.memory.usedJSHeapSize === 'number') {
      // usedJSHeapSize 单位为字节，转换为 MB
      return perf.memory.usedJSHeapSize / (1024 * 1024)
    }
    // 不支持 performance.memory 时，基于识别请求数粗略估算
    // 每次识别约产生 0.5MB 临时内存（base64 + canvas），上限 150MB
    const estimated = this.baselineMemory + (this.successCount + this.failCount) * 0.5
    return Math.min(estimated, 150)
  }

  /** 重置所有统计计数器 */
  resetCounters(): void {
    this.frameTimes = []
    this.currentFps = 60
    this.recognitionStartStack = []
    this.lastLatency = 0
    this.latencyWindow = []
    this.successCount = 0
    this.failCount = 0
    this.cpuLoad = 0
    this.activeAlerts.clear()
  }
}
