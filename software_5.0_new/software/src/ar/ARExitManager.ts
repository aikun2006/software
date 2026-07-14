/**
 * ARExitManager —— AR 资源回收管理器
 *
 * 统一注册、追踪、回收 AR 运行期间创建的全部资源：
 *   - 摄像头轨道（camera / stream）
 *   - AI 网络请求（request，通过 AbortController 中断）
 *   - 定时器（timer，识别循环 / 帧率控制）
 *   - 内存缓存（cache，图像帧缓存 / 知识库缓存）
 *
 * 退出 AR 页面时调用 disposeAll()，在 500ms 超时保护下并行释放所有资源，
 * 并返回诊断报告，便于日志排查。
 */

import type { ResourceHandle } from './types'
import { ARPerformanceMonitor } from './ARPerformanceMonitor'
import type { PerformanceMetrics } from './ARPerformanceMonitor'

/** 资源释放诊断报告 */
export interface ARDisposeReport {
  /** 已注册的资源总数 */
  totalCount: number
  /** 按类型统计的数量 */
  byType: Record<string, number>
  /** 已成功释放的资源 ID 列表 */
  disposedIds: string[]
  /** 释放耗时（毫秒） */
  duration: number
  /** 是否因超时被强制清理 */
  forced: boolean
  /** 性能快照（注入性能监控器时存在） */
  performanceSnapshot?: PerformanceMetrics
}

export class ARExitManager {
  /** 已注册的资源句柄映射（id -> handle） */
  private resources: Map<string, ResourceHandle> = new Map()

  /** 当前是否正在执行 disposeAll */
  private disposing = false
  /** 性能监控器实例（可选注入） */
  private performanceMonitor: ARPerformanceMonitor | null = null
  /** 资源泄漏检测：记录注册时间，检查长时间未释放的资源 */
  private registrationTimes: Map<string, number> = new Map()

  /**
   * 注册一个资源句柄。
   * 同一 id 重复注册时会覆盖旧句柄（旧句柄不会被自动 dispose，需调用方自行处理）。
   */
  register(handle: ResourceHandle): void {
    if (this.disposing) {
      // 正在统一回收期间不再接受新注册，直接释放
      try {
        handle.dispose()
      } catch (e) {
        console.warn('[ARExitManager] 回收期间注册的资源释放失败:', e)
      }
      return
    }
    this.resources.set(handle.id, handle)
    this.registrationTimes.set(handle.id, Date.now())
  }

  /** 注销一个资源句柄（仅从注册表中移除，不调用 dispose） */
  unregister(id: string): void {
    this.resources.delete(id)
    this.registrationTimes.delete(id)
  }

  /**
   * 一次性回收所有已注册资源。
   *
   * 执行流程：
   *   1. 并行调用所有资源的 dispose()
   *   2. 设置 500ms 超时保护，超时后强制清空注册表
   *   3. 返回诊断报告
   *
   * @param timeoutMs 超时阈值，默认 500ms
   */
  async disposeAll(timeoutMs: number = 500): Promise<ARDisposeReport> {
    const startTime = Date.now()
    const handles = Array.from(this.resources.values())
    const byType: Record<string, number> = {}
    const disposedIds: string[] = []

    // 按类型统计
    for (const h of handles) {
      byType[h.type] = (byType[h.type] || 0) + 1
    }

    if (handles.length === 0) {
      return {
        totalCount: 0,
        byType,
        disposedIds,
        duration: 0,
        forced: false
      }
    }

    this.disposing = true
    let forced = false

    // 标记已开始释放的资源，防止重复 dispose
    const pendingIds = new Set(handles.map(h => h.id))

    // 释放单个资源的包装函数（捕获异常，避免一个失败影响其他）
    const disposeOne = async (handle: ResourceHandle) => {
      try {
        await handle.dispose()
      } catch (err) {
        console.warn(`[ARExitManager] 资源 ${handle.id} (${handle.type}) 释放失败:`, err)
      }
      disposedIds.push(handle.id)
      pendingIds.delete(handle.id)
    }

    // 并行释放 + 超时保护
    await Promise.race([
      Promise.all(handles.map(disposeOne)),
      new Promise<void>(resolve => {
        window.setTimeout(() => {
          forced = true
          resolve()
        }, timeoutMs)
      })
    ])

    // 超时后强制清空注册表（即使部分 dispose 未完成）
    if (forced && pendingIds.size > 0) {
      console.warn(
        `[ARExitManager] 超时强制清理，${pendingIds.size} 个资源未在 ${timeoutMs}ms 内完成释放:`,
        Array.from(pendingIds)
      )
    }

    // 停止性能监控并获取最终快照
    let performanceSnapshot: PerformanceMetrics | undefined
    if (this.performanceMonitor) {
      this.performanceMonitor.stop()
      performanceSnapshot = this.performanceMonitor.getMetrics()
    }

    this.resources.clear()
    this.registrationTimes.clear()
    this.disposing = false

    return {
      totalCount: handles.length,
      byType,
      disposedIds,
      duration: Date.now() - startTime,
      forced,
      performanceSnapshot
    }
  }

  /** 获取当前已注册的资源数量 */
  getRegisteredCount(): number {
    return this.resources.size
  }

  /** 获取当前已注册的资源类型列表 */
  getRegisteredTypes(): string[] {
    const types = new Set<string>()
    for (const h of this.resources.values()) {
      types.add(h.type)
    }
    return Array.from(types)
  }

  /**
   * 注入性能监控器
   * 优化目的：在资源回收时同步停止性能监控，并输出最终健康报告
   */
  setPerformanceMonitor(monitor: ARPerformanceMonitor): void {
    this.performanceMonitor = monitor
  }

  /**
   * 获取最终性能快照（在 disposeAll 之前调用）
   * 优化目的：记录AR退出时的性能数据，用于后续分析
   */
  getPerformanceSnapshot(): PerformanceMetrics | null {
    return this.performanceMonitor?.getMetrics() ?? null
  }

  /**
   * 检测资源泄漏
   * 优化目的：发现长时间未释放的资源，预警内存泄漏风险
   * @param maxAgeMs 最大存活时间（毫秒），默认30秒
   */
  detectLeaks(maxAgeMs: number = 30000): string[] {
    const now = Date.now()
    const leaked: string[] = []
    for (const [id, regTime] of this.registrationTimes) {
      if (now - regTime > maxAgeMs) {
        leaked.push(id)
      }
    }
    return leaked
  }
}
