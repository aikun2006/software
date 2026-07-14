/**
 * ARSceneGenerator —— AI场景理解与AR内容智能生成
 *
 * 职责：
 *   1. 将当前场景描述/画面发送到后端AI模型
 *   2. 接收AI生成的AR虚拟内容：解说文案、亮点位置、推荐路线、互动建议
 *   3. 支持基于用户偏好的个性化内容生成
 *   4. 支持请求中断和资源回收
 *
 * 使用场景：
 *   - 用户进入新景点时自动生成解说文案
 *   - 根据用户偏好推荐互动内容
 *   - 生成画面亮点标注供AR叠加展示
 */

import type { SceneContent } from './types'
import { ARExitManager } from './ARExitManager'
import type { ResourceHandle } from './types'

/** 请求参数 */
export interface SceneUnderstandParams {
  /** 场景描述文本 */
  sceneDescription?: string
  /** 当前景点 ID */
  spotId?: string
  /** 用户偏好（如"历史文化"、"自然风光"、"祈福"等） */
  userPreference?: string
  /** 当前画面 base64（可选，提供时使用视觉模型） */
  imageBase64?: string
}

/** 响应结构 */
interface SceneUnderstandResponse {
  success: boolean
  result: SceneContent
  raw?: string
  duration_ms?: number
  error?: string
}

export class ARSceneGenerator {
  /** 当前请求的中断控制器 */
  private abortController: AbortController | null = null
  /** 资源管理器 */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 */
  private handleId: string | null = null
  /** 是否正在请求 */
  private loading = false

  constructor(exitManager?: ARExitManager) {
    this.exitManager = exitManager ?? null
    this.handleId = `ar-scene-generator-${Date.now()}`
  }

  /**
   * 发起场景理解请求，生成AR虚拟内容。
   * @param params 场景描述、景点ID、用户偏好、可选图片
   * @returns 生成的AR内容（解说、亮点、路线、建议）
   */
  async generate(params: SceneUnderstandParams): Promise<SceneContent> {
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

    try {
      const res = await fetch('/api/ar/ai/scene-understand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_description: params.sceneDescription || '',
          spot_id: params.spotId || '',
          user_preference: params.userPreference || '',
          image_base64: params.imageBase64 || ''
        }),
        signal: this.abortController.signal
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.error || `场景理解请求失败: HTTP ${res.status}`)
      }

      const data: SceneUnderstandResponse = await res.json()
      if (!data.success) {
        throw new Error(data.error || '场景理解返回失败')
      }

      return data.result
    } catch (err) {
      if (this.abortController?.signal.aborted) {
        return {
          narration: '',
          highlight_points: [],
          recommended_route: '',
          interaction_suggestions: [],
          cultural_context: ''
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

  /** 销毁，清理资源 */
  destroy(): void {
    this.stop()
    if (this.exitManager && this.handleId) {
      this.exitManager.unregister(this.handleId)
    }
  }
}
