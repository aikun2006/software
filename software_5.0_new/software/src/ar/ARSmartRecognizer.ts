/**
 * ARSmartRecognizer —— AI智能物体识别与增强信息展示
 *
 * 职责：
 *   1. 将AR场景画面发送到后端AI视觉模型（阿里云百炼 qwen-vl-max）
 *   2. 接收AI识别结果：物体分类、属性信息、文化知识
 *   3. 将识别结果格式化为AR可叠加展示的数据结构
 *   4. 支持请求中断和资源回收
 *
 * 安全说明：
 *   - API密钥保存在后端，前端不接触密钥
 *   - 所有请求通过 /api/ar/ai/smart-recognize 代理
 *   - 后端有审计日志和限流机制
 */

import type { SmartRecognizeResult } from './types'
import { ARExitManager } from './ARExitManager'
import type { ResourceHandle } from './types'

/** 请求参数 */
export interface SmartRecognizeParams {
  /** 当前画面 base64（不含 data:image 前缀） */
  imageBase64: string
  /** 当前识别到的景点 ID（可选，提供上下文） */
  spotId?: string
}

/** 响应结构 */
interface SmartRecognizeResponse {
  success: boolean
  result: SmartRecognizeResult
  raw?: string
  duration_ms?: number
  error?: string
  code?: string
  cached?: boolean
}

export class ARSmartRecognizer {
  /** 当前请求的中断控制器 */
  private abortController: AbortController | null = null
  /** 资源管理器 */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 */
  private handleId: string | null = null
  /** 是否正在请求 */
  private loading = false
  /** 上次结果是否来自缓存 */
  private lastFromCache = false

  constructor(exitManager?: ARExitManager) {
    this.exitManager = exitManager ?? null
    this.handleId = `ar-smart-recognize-${Date.now()}`
  }

  /**
   * 发起智能识别请求。
   * @param params 包含图片base64和可选景点ID
   * @returns 识别结果（物体列表、场景描述、推荐动作）
   */
  async recognize(params: SmartRecognizeParams): Promise<SmartRecognizeResult> {
    // 中断已有请求
    this.stop()

    this.loading = true
    this.lastFromCache = false
    this.abortController = new AbortController()

    // 注册资源句柄
    if (this.exitManager && this.handleId) {
      const handle: ResourceHandle = {
        type: 'request',
        id: this.handleId,
        dispose: () => this.stop()
      }
      this.exitManager.register(handle)
    }

    try {
      const res = await fetch('/api/ar/ai/smart-recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: params.imageBase64,
          spot_id: params.spotId || ''
        }),
        signal: this.abortController.signal
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        // 传递错误码供上层区分处理
        const code = errData.code || `HTTP_${res.status}`
        throw new Error(errData.error || `智能识别请求失败: ${code}`)
      }

      const data: SmartRecognizeResponse = await res.json()
      if (!data.success) {
        throw new Error(data.error || '智能识别返回失败')
      }

      this.lastFromCache = !!data.cached
      return data.result
    } catch (err) {
      // 主动中断不算错误
      if (this.abortController?.signal.aborted) {
        return { objects: [], scene_summary: '', recommended_actions: [] }
      }
      throw err
    } finally {
      this.loading = false
      this.abortController = null
    }
  }

  /** 上次结果是否来自缓存 */
  wasFromCache(): boolean {
    return this.lastFromCache
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

  /** 销毁，清理资源 */
  destroy(): void {
    this.stop()
    if (this.exitManager && this.handleId) {
      this.exitManager.unregister(this.handleId)
    }
  }
}
