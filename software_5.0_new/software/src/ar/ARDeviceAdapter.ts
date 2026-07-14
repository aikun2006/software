/**
 * ARDeviceAdapter —— 设备性能分级适配器
 *
 * 职责：
 *   1. 检测设备硬件能力（CPU 核心数、设备内存、GPU 渲染能力、屏幕参数）
 *   2. 将设备划分为 high / medium / low 三个等级，作为后续 AR 渲染参数选择依据
 *   3. 根据设备等级动态返回 AR 渲染参数（摄像头分辨率、帧率、截帧宽度、JPEG 质量、识别间隔等）
 *   4. 判断是否应减少动画（低端设备或用户系统设置开启「减少动态效果」时为 true）
 *
 * 优化目的：
 *   - 低端设备若强行使用高清摄像头 + 高帧率，会导致主线程卡顿、发热、识别请求堆积。
 *     通过分级降配，在保证可用性的前提下最大化流畅度。
 *   - 高端设备则可启用 backdrop-filter 模糊、完整动画与更多叠加卡片，提升视觉体验。
 *
 * 可选注入 ARExitManager：销毁时清空缓存的设备配置，避免内存常驻。
 */

import { ARExitManager } from './ARExitManager'

/** 设备性能等级 */
export type DeviceTier = 'high' | 'medium' | 'low'

/** 设备硬件画像 */
export interface DeviceProfile {
  /** 性能等级 */
  tier: DeviceTier
  /** CPU 逻辑核心数（navigator.hardwareConcurrency） */
  cores: number
  /** 设备内存（GB，navigator.deviceMemory，部分浏览器不支持时为 0） */
  memory: number
  /** 屏幕逻辑宽度（CSS 像素） */
  screenWidth: number
  /** 屏幕逻辑高度（CSS 像素） */
  screenHeight: number
  /** 设备像素比（devicePixelRatio） */
  pixelRatio: number
  /** 是否为移动端设备 */
  isMobile: boolean
}

/** 动态 AR 渲染参数 */
export interface AdaptiveARParams {
  /** 摄像头采集分辨率宽 */
  cameraWidth: number
  /** 摄像头采集分辨率高 */
  cameraHeight: number
  /** 目标帧率（fps） */
  targetFps: number
  /** 截帧最大宽度（像素，送往识别前压缩） */
  frameMaxWidth: number
  /** JPEG 压缩质量（0-1） */
  jpegQuality: number
  /** 识别最小间隔（毫秒） */
  recognitionInterval: number
  /** 是否启用 backdrop-filter 毛玻璃效果（低端设备关闭以节省 GPU） */
  enableBackdropFilter: boolean
  /** 是否启用动画（低端设备关闭以减少重绘） */
  enableAnimation: boolean
  /** 同时展示的最大叠加卡片数量 */
  maxOverlayCards: number
}

/**
 * 扩展 Navigator 类型声明。
 *
 * 优化说明：navigator.deviceMemory 为 Chrome 非标准 API，TypeScript DOM 库未声明，
 * 此处通过接口合并补充类型，避免使用 any。
 */
interface DeviceMemoryNavigator extends Navigator {
  /** 设备内存（GB），仅 Chrome 系浏览器支持 */
  deviceMemory?: number
}

export class ARDeviceAdapter {
  /** 缓存的设备画像（同一会话内不重复检测） */
  private profile: DeviceProfile | null = null

  /** 外部资源回收管理器（可选） */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 ID */
  private cacheHandleId: string | null = null

  constructor(exitManager?: ARExitManager) {
    this.exitManager = exitManager ?? null
    this.registerCache()
  }

  /**
   * 获取当前设备配置（带缓存）。
   * 首次调用执行硬件检测，后续直接返回缓存结果。
   */
  getDeviceProfile(): DeviceProfile {
    if (this.profile) {
      return this.profile
    }
    this.profile = this.detectProfile()
    return this.profile
  }

  /**
   * 根据设备等级返回动态渲染参数。
   *
   * 参数选型原理：
   *   - high：1280x720 / 30fps / 800px 截帧 / q=0.7 / 2s 间隔
   *       高端设备 GPU 与 CPU 充裕，可承担高清采集与高频识别。
   *   - medium：960x540 / 24fps / 640px 截帧 / q=0.6 / 3s 间隔
   *       中端设备适度降配，平衡画质与流畅度。
   *   - low：640x480 / 15fps / 480px 截帧 / q=0.5 / 4s 间隔
   *       低端设备优先保活，关闭毛玻璃与动画，降低识别频率以减少请求堆积。
   */
  getAdaptiveParams(): AdaptiveARParams {
    const profile = this.getDeviceProfile()
    switch (profile.tier) {
      case 'high':
        return {
          cameraWidth: 1280,
          cameraHeight: 720,
          targetFps: 30,
          frameMaxWidth: 800,
          jpegQuality: 0.7,
          recognitionInterval: 2000,
          enableBackdropFilter: true,
          enableAnimation: true,
          maxOverlayCards: 5
        }
      case 'medium':
        return {
          cameraWidth: 960,
          cameraHeight: 540,
          targetFps: 24,
          frameMaxWidth: 640,
          jpegQuality: 0.6,
          recognitionInterval: 3000,
          enableBackdropFilter: true,
          enableAnimation: true,
          maxOverlayCards: 3
        }
      case 'low':
      default:
        return {
          cameraWidth: 640,
          cameraHeight: 480,
          targetFps: 15,
          frameMaxWidth: 480,
          jpegQuality: 0.5,
          recognitionInterval: 4000,
          enableBackdropFilter: false,
          enableAnimation: false,
          maxOverlayCards: 2
        }
    }
  }

  /**
   * 判断是否应减少动画。
   *
   * 触发条件：
   *   1. 低端设备（tier === 'low'）
   *   2. 用户系统设置开启「减少动态效果」（prefers-reduced-motion: reduce）
   *
   * 优化目的：减少动画可降低 GPU 重绘压力，同时尊重无障碍偏好。
   */
  shouldReduceMotion(): boolean {
    const profile = this.getDeviceProfile()
    if (profile.tier === 'low') {
      return true
    }
    // 检测用户系统级「减少动态效果」偏好
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      if (mq.matches) {
        return true
      }
    }
    return false
  }

  /**
   * 执行硬件检测并生成设备画像。
   *
   * 分级规则（综合评分）：
   *   - cores >= 8 且 memory >= 4 且非低端标记 → high
   *   - cores >= 4 且 memory >= 2 → medium
   *   - 其他 → low
   *
   * 说明：
   *   - navigator.deviceMemory 仅 Chrome 系支持，缺失时按 0 处理，降级到 cores 判断。
   *   - isMobile 通过 UA 关键字检测，用于辅助决策（移动端更易发热）。
   */
  private detectProfile(): DeviceProfile {
    const nav = navigator as DeviceMemoryNavigator

    // CPU 核心数（无法获取时按 2 估算，偏保守）
    const cores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0
      ? nav.hardwareConcurrency
      : 2

    // 设备内存（GB，仅 Chrome 支持，缺失为 0）
    const memory = typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0
      ? nav.deviceMemory
      : 0

    // 屏幕参数
    const screenWidth = typeof window !== 'undefined' ? window.screen.width : 360
    const screenHeight = typeof window !== 'undefined' ? window.screen.height : 640
    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    // 移动端检测
    const isMobile = this.detectMobile()

    // GPU 渲染能力粗评：通过 WebGL 参数判断（失败时不影响分级，仅作参考）
    const gpuCapable = this.checkGPU()

    // 综合评分分级
    let tier: DeviceTier
    if (cores >= 8 && (memory === 0 || memory >= 4) && gpuCapable) {
      tier = 'high'
    } else if (cores >= 4 && (memory === 0 || memory >= 2)) {
      tier = 'medium'
    } else {
      tier = 'low'
    }

    // 移动端且内存小于 2GB 时强制降一级，避免发热降频
    if (isMobile && memory > 0 && memory < 2 && tier === 'medium') {
      tier = 'low'
    }

    return {
      tier,
      cores,
      memory,
      screenWidth,
      screenHeight,
      pixelRatio,
      isMobile
    }
  }

  /**
   * 检测是否为移动端设备。
   * 通过 UA 关键字匹配，覆盖主流移动平台。
   */
  private detectMobile(): boolean {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    return /Android|iPhone|iPad|iPod|Windows Phone|Mobile|BlackBerry|Opera Mini/i.test(ua)
  }

  /**
   * 粗评 GPU 渲染能力。
   *
   * 实现原理：尝试创建 WebGL 上下文，若成功且支持抗锯齿则认为 GPU 可用。
   * 失败（无 WebGL 支持）时返回 false，可能导致分级降低。
   */
  private checkGPU(): boolean {
    try {
      if (typeof document === 'undefined') return true
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) {
        return false
      }
      // 能获取到 WebGL 上下文即认为 GPU 可用
      return true
    } catch {
      return false
    }
  }

  /** 清空缓存的设备配置 */
  clearCache(): void {
    this.profile = null
  }

  /** 向 ARExitManager 注册缓存资源句柄 */
  private registerCache(): void {
    if (!this.exitManager) return
    this.cacheHandleId = `ar-device-cache-${Date.now()}`
    this.exitManager.register({
      type: 'cache',
      id: this.cacheHandleId,
      dispose: () => this.clearCache()
    })
  }
}
