/**
 * ARQaBridge —— AR 交互问答桥接
 *
 * 职责：
 *   1. 组合【当前画面 + 知识库上下文 + 用户问题】调用 AI 问答接口
 *   2. 支持流式回调（onChunk / onDone / onError）
 *   3. 支持中断当前问答（stop）
 *   4. 资源回收：destroy 时中断请求并注销资源
 *
 * 依赖：
 *   - ARKnowledgeLinker 提供景点知识库上下文
 *   - aiScheduler.getQAProvider().scenic_qa_ai() 提供流式问答能力
 *   - StreamCallbacks 复用 @/utils/aiResponder-doubao 中的类型定义
 */

import { aiScheduler } from '@/ai/AIScheduler'
import type { StreamCallbacks } from '@/utils/aiResponder-doubao'
import { ARKnowledgeLinker } from './ARKnowledgeLinker'
import { ARExitManager } from './ARExitManager'
import type { ResourceHandle } from './types'

export class ARQaBridge {
  private linker: ARKnowledgeLinker
  private exitManager: ARExitManager | null

  /** 当前请求的中断控制器 */
  private abortController: AbortController | null = null
  /** 是否已取消（回调包装用，防止取消后仍触发回调） */
  private cancelled = false
  /** 已注册的请求资源句柄 ID 集合 */
  private requestHandleIds: Set<string> = new Set()

  constructor(linker: ARKnowledgeLinker, exitManager?: ARExitManager) {
    this.linker = linker
    this.exitManager = exitManager ?? null
  }

  /**
   * 发起一次 AR 问答请求。
   *
   * 组合策略：
   *   - 有 spotId 时：先通过 ARKnowledgeLinker 获取知识库上下文
   *   - 有 imageBase64 时：传入当前画面
   *   - 始终传入用户问题
   *
   * @param question 用户问题
   * @param spotId 当前识别到的景点 ID（可为 null）
   * @param imageBase64 当前画面 base64（可为 null）
   * @param callbacks 流式回调
   */
  async ask(
    question: string,
    spotId: string | null,
    imageBase64: string | null,
    callbacks: StreamCallbacks
  ): Promise<void> {
    // 中断已有请求
    this.stop()

    this.cancelled = false
    this.abortController = new AbortController()

    // 注册请求资源句柄
    const reqId = `ar-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.requestHandleIds.add(reqId)
    this.exitManager?.register({
      type: 'request',
      id: reqId,
      dispose: () => {
        this.cancelled = true
        this.abortController?.abort()
      }
    })

    // 包装回调：取消后不转发，防止旧请求污染 UI
    const wrappedCallbacks: StreamCallbacks = {
      onChunk: (text: string) => {
        if (this.cancelled) return
        callbacks.onChunk(text)
      },
      onDone: (result) => {
        if (this.cancelled) return
        callbacks.onDone(result)
      },
      onError: (err) => {
        if (this.cancelled) return
        callbacks.onError?.(err)
      }
    }

    try {
      // 构建知识库上下文
      let context = ''
      if (spotId) {
        context = this.linker.buildContextForAI(spotId)
      }

      // 调用 AI 调度层的问答接口
      const provider = aiScheduler.getQAProvider()
      await provider.scenic_qa_ai(question, context, imageBase64, wrappedCallbacks)
    } catch (err) {
      // 主动中断不算错误
      if (this.abortController?.signal.aborted) {
        return
      }
      wrappedCallbacks.onError?.(err as Error)
    } finally {
      this.abortController = null
      // 注销请求资源
      if (this.exitManager && this.requestHandleIds.has(reqId)) {
        this.exitManager.unregister(reqId)
      }
      this.requestHandleIds.delete(reqId)
    }
  }

  /**
   * 中断当前问答请求。
   * 触发 AbortController.abort()，并标记取消状态。
   */
  stop(): void {
    this.cancelled = true
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * 销毁桥接器，清理所有资源。
   * 中断当前请求 + 注销所有资源句柄。
   */
  destroy(): void {
    this.stop()
    // 注销所有残留的请求资源句柄
    for (const id of this.requestHandleIds) {
      this.exitManager?.unregister(id)
    }
    this.requestHandleIds.clear()
  }

  /** 当前是否有进行中的问答请求 */
  isBusy(): boolean {
    return this.abortController !== null
  }
}
