/**
 * ARKnowledgeLinker —— AR 知识库联动
 *
 * 职责：
 *   1. 根据景点 ID 从 spots.ts 数据中拉取完整知识库上下文
 *   2. 将知识库内容格式化为 AI 可用的上下文字符串
 *   3. 离线缓存：首次拉取后缓存到内存，离线时仍可使用
 *
 * 依赖说明：
 *   - 只读取 @/data/spots 数据，不修改原数据
 *   - 可选注入 ARExitManager，退出时自动清空缓存
 */

import { spots, getSpotById } from '@/data/spots'
import type { KnowledgeContext, ResourceHandle } from './types'
import { ARExitManager } from './ARExitManager'

export class ARKnowledgeLinker {
  /** 内存缓存：spotId -> KnowledgeContext */
  private cache: Map<string, KnowledgeContext> = new Map()

  /** 外部资源回收管理器（可选） */
  private exitManager: ARExitManager | null = null
  private cacheHandleId: string | null = null

  constructor(exitManager?: ARExitManager) {
    this.exitManager = exitManager ?? null
    this.registerCache()
  }

  /**
   * 根据景点 ID 拉取完整知识库上下文。
   * 首次拉取后缓存到内存，后续直接返回缓存。
   *
   * @param spotId 景点 ID
   * @returns 知识库上下文（景点不存在时返回占位空值）
   */
  linkSpot(spotId: string): KnowledgeContext {
    // 命中缓存
    const cached = this.cache.get(spotId)
    if (cached) {
      return cached
    }

    // 从 spots 数据拉取
    const spot = getSpotById(spotId)
    const ctx: KnowledgeContext = {
      spotId,
      spotName: spot?.name ?? '未知景点',
      fullDesc: spot?.fullDesc ?? spot?.desc ?? '',
      locationInfo: spot?.locationInfo ?? '',
      tips: spot?.tips ?? '',
      time: spot?.time ?? ''
    }

    this.cache.set(spotId, ctx)
    return ctx
  }

  /**
   * 将知识库内容格式化为 AI 可用的上下文字符串。
   * 拼接景点名称、详细介绍、位置信息、游览贴士、推荐游览时间。
   *
   * @param spotId 景点 ID
   * @returns 格式化后的上下文字符串
   */
  buildContextForAI(spotId: string): string {
    const ctx = this.linkSpot(spotId)
    const lines: string[] = [
      `【当前识别景点】${ctx.spotName}`,
      `【详细介绍】${ctx.fullDesc}`,
      `【位置信息】${ctx.locationInfo}`,
      `【游览贴士】${ctx.tips}`
    ]
    if (ctx.time) {
      lines.push(`【推荐游览时间】${ctx.time}`)
    }
    return lines.join('\n')
  }

  /**
   * 批量预加载所有景点的知识库到缓存。
   * 适合在 AR 页面初始化时调用，确保离线时所有景点数据可用。
   */
  preloadAll(): void {
    for (const spot of spots) {
      if (!this.cache.has(spot.id)) {
        this.cache.set(spot.id, {
          spotId: spot.id,
          spotName: spot.name,
          fullDesc: spot.fullDesc ?? spot.desc,
          locationInfo: spot.locationInfo,
          tips: spot.tips,
          time: spot.time ?? ''
        })
      }
    }
  }

  /** 清空内存缓存 */
  clearCache(): void {
    this.cache.clear()
  }

  /** 获取当前缓存数量 */
  getCacheSize(): number {
    return this.cache.size
  }

  /** 向 ARExitManager 注册缓存资源句柄 */
  private registerCache(): void {
    if (!this.exitManager) return
    this.cacheHandleId = `ar-cache-${Date.now()}`
    this.exitManager.register({
      type: 'cache',
      id: this.cacheHandleId,
      dispose: () => this.clearCache()
    })
  }
}
