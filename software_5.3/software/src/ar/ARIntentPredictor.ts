/**
 * ARIntentPredictor —— AI用户意图预测与AR交互优化
 *
 * 职责：
 *   1. 收集用户行为模式（浏览景点、提问历史、停留时间等）
 *   2. 发送到后端AI模型分析用户意图
 *   3. 接收个性化AR交互建议（导览/导航/问答/拍照）
 *   4. 支持定期预测和按需预测
 *
 * 使用场景：
 *   - 用户停留较久时主动推荐下一景点
 *   - 根据提问历史预测用户感兴趣的领域
 *   - 个性化推荐AR交互动作
 */

import type { IntentPrediction } from './types'
import { ARExitManager } from './ARExitManager'
import type { ResourceHandle } from './types'

/** 用户行为记录 */
export interface BehaviorRecord {
  /** 行为类型: view/ask/navigate/like/share */
  action: string
  /** 关联景点ID */
  spotId?: string
  /** 行为详情 */
  detail?: string
  /** 时间戳 */
  timestamp: number
}

/** 请求参数 */
export interface IntentPredictParams {
  /** 用户行为历史（最近20条） */
  behaviorHistory: BehaviorRecord[]
  /** 当前所在景点 */
  currentSpot?: string
  /** 会话时长（秒） */
  sessionDuration?: number
}

/** 响应结构 */
interface IntentPredictResponse {
  success: boolean
  result: IntentPrediction
  raw?: string
  duration_ms?: number
  error?: string
}

export class ARIntentPredictor {
  /** 当前请求的中断控制器 */
  private abortController: AbortController | null = null
  /** 资源管理器 */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 */
  private handleId: string | null = null
  /** 是否正在请求 */
  private loading = false
  /** 行为历史收集器 */
  private behaviorHistory: BehaviorRecord[] = []
  /** 会话开始时间 */
  private sessionStartTime: number = Date.now()

  constructor(exitManager?: ARExitManager) {
    this.exitManager = exitManager ?? null
    this.handleId = `ar-intent-predictor-${Date.now()}`
    this.sessionStartTime = Date.now()
  }

  /**
   * 记录用户行为（供后续意图预测使用）。
   * @param action 行为类型
   * @param spotId 关联景点
   * @param detail 行为详情
   */
  recordBehavior(action: string, spotId?: string, detail?: string): void {
    this.behaviorHistory.push({
      action,
      spotId,
      detail,
      timestamp: Date.now()
    })
    // 保留最近50条
    if (this.behaviorHistory.length > 50) {
      this.behaviorHistory = this.behaviorHistory.slice(-50)
    }
  }

  /**
   * 发起意图预测请求。
   * @param params 可选参数，不传时使用已收集的行为历史
   * @returns 预测结果（意图、置信度、建议列表）
   */
  async predict(params?: IntentPredictParams): Promise<IntentPrediction> {
    this.stop()
    this.loading = true
    this.abortController = new AbortController()

    if (this.exitManager && this.handleId) {
      const handle: ResourceHandle = {
        type: 'request',
        id: this.handleId,
        dispose: () => this.stop()
      }
      this.exitManager.register(handle)
    }

    const history = params?.behaviorHistory || this.behaviorHistory
    const currentSpot = params?.currentSpot || ''
    const sessionDuration = params?.sessionDuration || Math.floor((Date.now() - this.sessionStartTime) / 1000)

    try {
      const res = await fetch('/api/ar/ai/intent-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          behavior_history: history.slice(-20),
          current_spot: currentSpot,
          session_duration: sessionDuration
        }),
        signal: this.abortController.signal
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.error || `意图预测请求失败: HTTP ${res.status}`)
      }

      const data: IntentPredictResponse = await res.json()
      if (!data.success) {
        throw new Error(data.error || '意图预测返回失败')
      }

      return data.result
    } catch (err) {
      if (this.abortController?.signal.aborted) {
        return {
          predicted_intent: '',
          confidence: 0,
          suggestions: [],
          next_spot: '',
          personalized_tip: ''
        }
      }
      throw err
    } finally {
      this.loading = false
      this.abortController = null
    }
  }

  /** 中断当前请求 */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.loading = false
  }

  /** 是否正在请求 */
  isLoading(): boolean {
    return this.loading
  }

  /** 获取已收集的行为历史数量 */
  getBehaviorCount(): number {
    return this.behaviorHistory.length
  }

  /** 清空行为历史 */
  clearHistory(): void {
    this.behaviorHistory = []
    this.sessionStartTime = Date.now()
  }

  /** 销毁，清理资源 */
  destroy(): void {
    this.stop()
    this.clearHistory()
    if (this.exitManager && this.handleId) {
      this.exitManager.unregister(this.handleId)
    }
  }
}
