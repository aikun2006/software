/**
 * ARResourceLoader —— AR 资源加载器
 *
 * 职责：
 *   1. 预加载景点图片资源（用于离线识别特征提取）
 *   2. 异步加载机制：不阻塞主线程，使用 requestIdleCallback（降级 setTimeout）
 *   3. LOD（Level of Detail）支持：根据设备等级加载不同分辨率图片
 *      - high: 原图
 *      - medium: 缩小到 50%
 *      - low: 缩小到 25%
 *   4. 加载进度回调
 *   5. 加载缓存：已加载的资源不重复加载
 *
 * 优化目的：
 *   - 离线识别需要景点图片特征，提前预加载可避免识别时实时加载导致的延迟。
 *   - 通过 requestIdleCallback 在浏览器空闲时段加载，避免与 AR 渲染竞争主线程。
 *   - LOD 降级：低端设备加载小图，减少内存占用与解码耗时。
 *
 * 可选注入 ARExitManager：销毁时清空图片缓存。
 */

import { spots, getSpotById } from '@/data/spots'
import { ARExitManager } from './ARExitManager'
import type { DeviceTier } from './ARDeviceAdapter'

/** 加载进度信息 */
export interface LoadProgress {
  /** 已加载数量 */
  loaded: number
  /** 总数量 */
  total: number
  /** 百分比（0-100） */
  percentage: number
}

/**
 * requestIdleCallback 类型声明。
 *
 * 优化说明：requestIdleCallback 在部分浏览器（Safari）不支持，
 * 此处声明类型并提供 setTimeout 降级方案。
 */
interface IdleDeadline {
  didTimeout: boolean
  timeRemaining(): number
}
type IdleCallback = (deadline: IdleDeadline) => void

/** LOD 缩放比例映射 */
const LOD_SCALE: Record<DeviceTier, number> = {
  high: 1.0,
  medium: 0.5,
  low: 0.25
}

/** 最大并发加载数（避免同时解码大量图片卡顿） */
const MAX_CONCURRENT = 3

export class ARResourceLoader {
  /** 图片缓存：url -> HTMLImageElement */
  private imageCache: Map<string, HTMLImageElement> = new Map()
  /** 正在加载中的 url 集合（避免重复加载） */
  private loadingUrls: Set<string> = new Set()

  /** 加载进度统计 */
  private loadedCount = 0
  private totalCount = 0

  /** 设备等级（决定 LOD 缩放） */
  private deviceTier: DeviceTier

  /** 外部资源回收管理器（可选） */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 ID */
  private cacheHandleId: string | null = null

  constructor(exitManager?: ARExitManager, deviceTier: DeviceTier = 'high') {
    this.exitManager = exitManager ?? null
    this.deviceTier = deviceTier
    this.registerCache()
  }

  /**
   * 设置设备等级（影响后续加载的 LOD）。
   */
  setDeviceTier(tier: DeviceTier): void {
    this.deviceTier = tier
  }

  /**
   * 预加载图片资源列表。
   *
   * 加载策略：
   *   1. 使用 requestIdleCallback 在浏览器空闲时段调度加载
   *   2. 限制最大并发数 MAX_CONCURRENT，避免主线程卡顿
   *   3. 已缓存的 url 跳过
   *   4. 支持进度回调
   *
   * @param urls 图片 URL 列表
   * @param onProgress 加载进度回调（loaded, total）
   */
  preloadImages(
    urls: string[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    // 过滤掉已缓存和正在加载的 url
    const pending = urls.filter(u => !this.imageCache.has(u) && !this.loadingUrls.has(u))
    if (pending.length === 0) {
      onProgress?.(this.loadedCount, this.totalCount)
      return Promise.resolve()
    }

    this.totalCount += pending.length

    return new Promise<void>(resolve => {
      let completed = 0
      const queue = [...pending]
      let active = 0

      const tryLoadNext = () => {
        // 队列空且无活跃任务 → 全部完成
        if (queue.length === 0 && active === 0) {
          resolve()
          return
        }

        // 控制并发数
        while (active < MAX_CONCURRENT && queue.length > 0) {
          const url = queue.shift()!
          active++
          this.loadingUrls.add(url)

          this.loadImageWithLOD(url)
            .then(() => {
              this.loadedCount++
              onProgress?.(this.loadedCount, this.totalCount)
            })
            .catch(() => {
              // 单张加载失败不影响整体，计入已处理
              this.loadedCount++
              onProgress?.(this.loadedCount, this.totalCount)
            })
            .finally(() => {
              active--
              this.loadingUrls.delete(url)
              completed++
              // 调度下一批
              this.scheduleIdle(tryLoadNext)
            })
        }
      }

      tryLoadNext()
    })
  }

  /**
   * 根据景点 ID 预加载图片。
   * 从 spots 数据中获取每个景点的图片列表并预加载。
   *
   * @param spotIds 景点 ID 列表
   */
  preloadSpotImages(spotIds: string[]): Promise<void> {
    const urls: string[] = []
    for (const id of spotIds) {
      const spot = getSpotById(id)
      if (spot && spot.images && spot.images.length > 0) {
        urls.push(...spot.images)
      }
    }
    return this.preloadImages(urls)
  }

  /**
   * 预加载全部景点图片。
   * 遍历 spots 数组，加载所有景点的首图。
   */
  preloadAllSpotImages(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const urls: string[] = []
    for (const spot of spots) {
      if (spot.images && spot.images.length > 0) {
        urls.push(...spot.images)
      }
    }
    return this.preloadImages(urls, onProgress)
  }

  /**
   * 从缓存获取已加载的图片元素。
   * @param url 图片 URL
   */
  getCachedImage(url: string): HTMLImageElement | null {
    return this.imageCache.get(url) ?? null
  }

  /**
   * 清空所有缓存。
   */
  clearCache(): void {
    this.imageCache.clear()
    this.loadingUrls.clear()
    this.loadedCount = 0
    this.totalCount = 0
  }

  /**
   * 获取当前加载进度。
   */
  getLoadProgress(): LoadProgress {
    const percentage = this.totalCount > 0
      ? Math.round((this.loadedCount / this.totalCount) * 100)
      : 0
    return {
      loaded: this.loadedCount,
      total: this.totalCount,
      percentage
    }
  }

  /**
   * 加载单张图片并应用 LOD 缩放。
   *
   * LOD 实现原理：
   *   - high: 直接加载原图，保留全部细节
   *   - medium / low: 加载后通过 canvas 缩小到 50% / 25%，
   *     并用缩放后的图片替换缓存，减少内存占用
   *
   * @param url 图片 URL
   */
  private loadImageWithLOD(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      if (!url.startsWith('data:') && !url.startsWith('blob:')) {
        img.crossOrigin = 'anonymous'
      }

      img.onload = () => {
        const scale = LOD_SCALE[this.deviceTier]
        if (scale >= 1.0) {
          // 原图，直接缓存
          this.imageCache.set(url, img)
          resolve(img)
        } else {
          // LOD 缩放：通过 canvas 缩小后生成新图片
          const scaled = this.scaleImage(img, scale)
          if (scaled) {
            this.imageCache.set(url, scaled)
            resolve(scaled)
          } else {
            // 缩放失败，降级使用原图
            this.imageCache.set(url, img)
            resolve(img)
          }
        }
      }

      img.onerror = () => reject(new Error(`[ARResourceLoader] 加载失败: ${url}`))
      img.src = url
    })
  }

  /**
   * 通过 canvas 缩放图片。
   *
   * @param img 原始图片
   * @param scale 缩放比例（0-1）
   */
  private scaleImage(img: HTMLImageElement, scale: number): HTMLImageElement | null {
    try {
      const srcW = img.naturalWidth || img.width
      const srcH = img.naturalHeight || img.height
      if (!srcW || !srcH) return null

      const dstW = Math.max(1, Math.floor(srcW * scale))
      const dstH = Math.max(1, Math.floor(srcH * scale))

      const canvas = document.createElement('canvas')
      canvas.width = dstW
      canvas.height = dstH
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      ctx.drawImage(img, 0, 0, dstW, dstH)

      // 转为 dataURL 生成新图片元素
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      const scaled = new Image()
      scaled.src = dataUrl
      // 同步设置尺寸，避免异步加载问题
      scaled.width = dstW
      scaled.height = dstH
      return scaled
    } catch {
      return null
    }
  }

  /**
   * 使用 requestIdleCallback 调度任务（不支持时降级 setTimeout）。
   *
   * 优化目的：在浏览器空闲时段执行加载，避免与 AR 渲染帧竞争主线程。
   *
   * @param task 待执行的任务
   */
  private scheduleIdle(task: () => void): void {
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: IdleCallback, options?: { timeout: number }) => number
    }).requestIdleCallback

    if (typeof ric === 'function') {
      // 设置 200ms 超时，确保即使浏览器持续繁忙也能执行
      ric(() => task(), { timeout: 200 })
    } else {
      // 降级：setTimeout 0，尽快执行但不阻塞当前帧
      window.setTimeout(task, 0)
    }
  }

  /** 向 ARExitManager 注册缓存资源句柄 */
  private registerCache(): void {
    if (!this.exitManager) return
    this.cacheHandleId = `ar-resource-cache-${Date.now()}`
    this.exitManager.register({
      type: 'cache',
      id: this.cacheHandleId,
      dispose: () => this.clearCache()
    })
  }
}
