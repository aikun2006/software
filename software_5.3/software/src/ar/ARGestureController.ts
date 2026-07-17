/**
 * ARGestureController —— AR 手势交互控制器
 *
 * 职责：
 *   1. 监听 touch 事件实现手势识别（单指拖拽、双指捏合、双指旋转、双击、长按）
 *   2. 单指拖拽：平移 AR 叠加卡片位置
 *   3. 双指捏合：缩放卡片大小
 *   4. 双指旋转：旋转卡片角度
 *   5. 双击：重置卡片位置和大小
 *   6. 长按：触发触觉反馈 navigator.vibrate(50)
 *   7. 平滑过渡：所有变换使用 CSS transition
 *
 * 优化目的：
 *   - 移动端 AR 叠加卡片需要直观的手势交互（拖、捏、转），
 *     原生 touch 事件比第三方手势库体积更小、可控性更强。
 *   - 长按触觉反馈增强操作确认感，符合移动端交互习惯。
 *
 * 可选注入 ARExitManager：detach 时自动注销所有监听。
 */

import { ARExitManager } from './ARExitManager'

/** 手势类型 */
export type GestureType = 'pan' | 'pinch' | 'rotate' | 'doubleTap' | 'longPress'

/** 手势事件 */
export interface GestureEvent {
  /** 手势类型 */
  type: GestureType
  /** 平移 X 增量（像素） */
  deltaX: number
  /** 平移 Y 增量（像素） */
  deltaY: number
  /** 缩放比例（相对上次的倍数，1 表示无变化） */
  scale: number
  /** 旋转角度增量（度） */
  rotation: number
  /** 手势中心 X 坐标（相对于绑定元素） */
  centerX: number
  /** 手势中心 Y 坐标（相对于绑定元素） */
  centerY: number
}

/** 变换状态 */
export interface TransformState {
  /** X 方向平移（像素） */
  translateX: number
  /** Y 方向平移（像素） */
  translateY: number
  /** 缩放比例（1 为原始大小） */
  scale: number
  /** 旋转角度（度） */
  rotation: number
}

/** 长按触发延时（毫秒） */
const LONG_PRESS_DELAY = 500

/** 双击间隔阈值（毫秒） */
const DOUBLE_TAP_INTERVAL = 300

/** 长按移动容差（像素，超过则取消长按） */
const LONG_PRESS_MOVE_TOLERANCE = 10

export class ARGestureController {
  /** 绑定的 DOM 元素 */
  private element: HTMLElement | null = null
  /** 外部资源回收管理器（可选） */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 ID */
  private handleId: string | null = null

  /** 手势回调列表 */
  private callbacks: Array<(event: GestureEvent) => void> = []

  /** 当前变换状态 */
  private transform: TransformState = {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotation: 0
  }

  /** 手势状态跟踪 */
  /** 当前触点数 */
  private touchCount = 0
  /** 单指拖拽起始坐标 */
  private panStartX = 0
  private panStartY = 0
  /** 上一次拖拽位置（用于计算增量） */
  private panLastX = 0
  private panLastY = 0
  /** 是否正在拖拽 */
  private isPanning = false

  /** 双指初始距离（用于计算缩放） */
  private pinchStartDistance = 0
  /** 双指上一次距离 */
  private pinchLastDistance = 0
  /** 是否正在捏合 */
  private isPinching = false

  /** 双指初始角度（用于计算旋转） */
  private rotateStartAngle = 0
  /** 双指上一次角度 */
  private rotateLastAngle = 0
  /** 是否正在旋转 */
  private isRotating = false

  /** 长按定时器 ID */
  private longPressTimer: ReturnType<typeof setTimeout> | null = null
  /** 长按起始坐标 */
  private longPressStartX = 0
  private longPressStartY = 0

  /** 上次单击时间戳（用于双击检测） */
  private lastTapTime = 0

  /** 绑定的 touch 事件处理函数引用（用于解绑） */
  private boundTouchStart: (e: TouchEvent) => void
  private boundTouchMove: (e: TouchEvent) => void
  private boundTouchEnd: (e: TouchEvent) => void

  constructor(exitManager?: ARExitManager) {
    this.exitManager = exitManager ?? null
    // 箭头函数绑定 this，确保解绑时引用一致
    this.boundTouchStart = this.onTouchStart.bind(this)
    this.boundTouchMove = this.onTouchMove.bind(this)
    this.boundTouchEnd = this.onTouchEnd.bind(this)
  }

  /**
   * 绑定手势监听到指定 DOM 元素。
   * @param element 目标元素
   */
  attach(element: HTMLElement): void {
    this.detach()
    this.element = element

    // passive: false 以便在需要时调用 preventDefault 阻止默认滚动
    element.addEventListener('touchstart', this.boundTouchStart, { passive: false })
    element.addEventListener('touchmove', this.boundTouchMove, { passive: false })
    element.addEventListener('touchend', this.boundTouchEnd, { passive: false })
    element.addEventListener('touchcancel', this.boundTouchEnd, { passive: false })

    // 注册资源句柄
    if (this.exitManager) {
      this.handleId = `ar-gesture-${Date.now()}`
      this.exitManager.register({
        type: 'cache',
        id: this.handleId,
        dispose: () => this.detach()
      })
    }
  }

  /**
   * 解绑手势监听。
   */
  detach(): void {
    if (this.element) {
      this.element.removeEventListener('touchstart', this.boundTouchStart)
      this.element.removeEventListener('touchmove', this.boundTouchMove)
      this.element.removeEventListener('touchend', this.boundTouchEnd)
      this.element.removeEventListener('touchcancel', this.boundTouchEnd)
      this.element = null
    }
    this.clearLongPressTimer()
    this.resetGestureState()
    if (this.exitManager && this.handleId) {
      this.exitManager.unregister(this.handleId)
    }
    this.handleId = null
  }

  /**
   * 注册手势回调。
   * @returns 取消注册的函数
   */
  onGesture(callback: (event: GestureEvent) => void): () => void {
    this.callbacks.push(callback)
    return () => {
      const idx = this.callbacks.indexOf(callback)
      if (idx >= 0) {
        this.callbacks.splice(idx, 1)
      }
    }
  }

  /**
   * 获取当前变换状态。
   */
  getTransform(): TransformState {
    return { ...this.transform }
  }

  /**
   * 手动设置变换状态（用于外部重置或动画还原）。
   */
  setTransform(state: Partial<TransformState>): void {
    this.transform = { ...this.transform, ...state }
  }

  /**
   * 重置变换状态到初始值。
   */
  resetTransform(): void {
    this.transform = {
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotation: 0
    }
  }

  /**
   * 将变换状态应用为 CSS transform 字符串。
   *
   * 平滑过渡原理：使用 CSS transition 实现动画，
   * transition 属性需由外部元素预设（或在此设置）。
   *
   * @param transition 是否启用过渡动画
   */
  applyToElement(el: HTMLElement, transition: boolean = true): void {
    const { translateX, translateY, scale, rotation } = this.transform
    el.style.transform =
      `translate(${translateX}px, ${translateY}px) ` +
      `scale(${scale}) ` +
      `rotate(${rotation}deg)`
    if (transition) {
      el.style.transition = 'transform 0.2s ease-out'
    } else {
      el.style.transition = 'none'
    }
  }

  /**
   * 检查触摸目标是否为交互按钮（跳过手势处理以避免干扰点击）。
   * 修复：按钮点击被手势控制器的 preventDefault/doubleTap 检测拦截导致 click 事件不触发。
   */
  private isInteractiveTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false
    // 检查目标及其祖先是否为按钮、链接或标记了 data-button 的元素
    return !!target.closest('button, a, [data-button], [role="button"]')
  }

  /**
   * touchstart 事件处理。
   * 根据触点数量初始化不同手势。
   * 修复：触摸目标为按钮时跳过手势处理，确保 click 事件不被拦截。
   */
  private onTouchStart(e: TouchEvent): void {
    // 如果触摸目标是按钮等交互元素，跳过手势处理，避免干扰 click 事件
    if (this.isInteractiveTarget(e.target)) {
      return
    }

    const touches = e.touches
    this.touchCount = touches.length

    if (touches.length === 1) {
      // 单指：可能是拖拽、双击或长按
      const touch = touches[0]
      const rect = this.element!.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      // 检测双击
      const now = Date.now()
      if (now - this.lastTapTime < DOUBLE_TAP_INTERVAL) {
        // 双击触发：重置变换
        this.emitGesture({
          type: 'doubleTap',
          deltaX: 0,
          deltaY: 0,
          scale: 1,
          rotation: 0,
          centerX: x,
          centerY: y
        })
        this.resetTransform()
        this.lastTapTime = 0
        e.preventDefault()
        return
      }
      this.lastTapTime = now

      // 初始化拖拽
      this.panStartX = x
      this.panStartY = y
      this.panLastX = x
      this.panLastY = y

      // 初始化长按检测
      this.longPressStartX = x
      this.longPressStartY = y
      this.startLongPressTimer(x, y)
    } else if (touches.length === 2) {
      // 双指：捏合 + 旋转
      this.clearLongPressTimer()
      this.isPanning = false

      const rect = this.element!.getBoundingClientRect()
      const t0 = touches[0]
      const t1 = touches[1]
      const x0 = t0.clientX - rect.left
      const y0 = t0.clientY - rect.top
      const x1 = t1.clientX - rect.left
      const y1 = t1.clientY - rect.top

      // 初始距离
      this.pinchStartDistance = this.distance(x0, y0, x1, y1)
      this.pinchLastDistance = this.pinchStartDistance

      // 初始角度（atan2 返回弧度，转为度）
      this.rotateStartAngle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
      this.rotateLastAngle = this.rotateStartAngle

      this.isPinching = true
      this.isRotating = true
    }
  }

  /**
   * touchmove 事件处理。
   * 根据当前手势类型计算增量并触发回调。
   * 修复：触摸目标为按钮时跳过手势处理。
   */
  private onTouchMove(e: TouchEvent): void {
    // 如果触摸目标是按钮等交互元素，跳过手势处理
    if (this.isInteractiveTarget(e.target)) {
      return
    }

    const touches = e.touches

    if (touches.length === 1 && this.touchCount === 1) {
      const touch = touches[0]
      const rect = this.element!.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      // 长按移动检测：超过容差则取消长按
      const moveDist = Math.sqrt(
        Math.pow(x - this.longPressStartX, 2) +
        Math.pow(y - this.longPressStartY, 2)
      )
      if (moveDist > LONG_PRESS_MOVE_TOLERANCE) {
        this.clearLongPressTimer()
      }

      if (this.longPressTimer === null && !this.isPanning) {
        // 长按已取消，开始拖拽
        this.isPanning = true
      }

      if (this.isPanning) {
        const deltaX = x - this.panLastX
        const deltaY = y - this.panLastY

        // 累积变换
        this.transform.translateX += deltaX
        this.transform.translateY += deltaY

        this.emitGesture({
          type: 'pan',
          deltaX,
          deltaY,
          scale: 1,
          rotation: 0,
          centerX: x,
          centerY: y
        })

        this.panLastX = x
        this.panLastY = y
        e.preventDefault()
      }
    } else if (touches.length === 2) {
      const rect = this.element!.getBoundingClientRect()
      const t0 = touches[0]
      const t1 = touches[1]
      const x0 = t0.clientX - rect.left
      const y0 = t0.clientY - rect.top
      const x1 = t1.clientX - rect.left
      const y1 = t1.clientY - rect.top

      // 手势中心点
      const centerX = (x0 + x1) / 2
      const centerY = (y0 + y1) / 2

      // 捏合缩放
      if (this.isPinching) {
        const currentDistance = this.distance(x0, y0, x1, y1)
        if (this.pinchLastDistance > 0) {
          const scaleRatio = currentDistance / this.pinchLastDistance
          this.transform.scale *= scaleRatio
          // 限制缩放范围（0.5 ~ 3.0）
          this.transform.scale = Math.max(0.5, Math.min(3.0, this.transform.scale))

          this.emitGesture({
            type: 'pinch',
            deltaX: 0,
            deltaY: 0,
            scale: scaleRatio,
            rotation: 0,
            centerX,
            centerY
          })
        }
        this.pinchLastDistance = currentDistance
      }

      // 旋转
      if (this.isRotating) {
        const currentAngle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
        let rotationDelta = currentAngle - this.rotateLastAngle
        // 处理角度跳变（-180 → 180）
        if (rotationDelta > 180) rotationDelta -= 360
        if (rotationDelta < -180) rotationDelta += 360

        this.transform.rotation += rotationDelta

        this.emitGesture({
          type: 'rotate',
          deltaX: 0,
          deltaY: 0,
          scale: 1,
          rotation: rotationDelta,
          centerX,
          centerY
        })

        this.rotateLastAngle = currentAngle
      }

      e.preventDefault()
    }
  }

  /**
   * touchend 事件处理。
   * 清理手势状态。
   */
  private onTouchEnd(e: TouchEvent): void {
    this.clearLongPressTimer()

    // 如果从双指变单指，重置双指状态
    if (e.touches.length === 1) {
      this.isPinching = false
      this.isRotating = false
      // 更新单指起点为剩余手指位置
      const touch = e.touches[0]
      const rect = this.element!.getBoundingClientRect()
      this.panLastX = touch.clientX - rect.left
      this.panLastY = touch.clientY - rect.top
      this.touchCount = 1
    } else if (e.touches.length === 0) {
      this.touchCount = 0
      this.isPanning = false
      this.isPinching = false
      this.isRotating = false
    }
  }

  /**
   * 启动长按定时器。
   * 触发后发送 longPress 手势并震动反馈。
   */
  private startLongPressTimer(x: number, y: number): void {
    this.clearLongPressTimer()
    this.longPressTimer = setTimeout(() => {
      // 长按触发
      this.emitGesture({
        type: 'longPress',
        deltaX: 0,
        deltaY: 0,
        scale: 1,
        rotation: 0,
        centerX: x,
        centerY: y
      })
      // 触觉反馈（支持的设备震动 50ms）
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(50)
        } catch {
          // 忽略不支持震动的设备
        }
      }
    }, LONG_PRESS_DELAY)
  }

  /** 清除长按定时器 */
  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  /** 重置手势状态 */
  private resetGestureState(): void {
    this.touchCount = 0
    this.isPanning = false
    this.isPinching = false
    this.isRotating = false
  }

  /** 计算两点间距离 */
  private distance(x0: number, y0: number, x1: number, y1: number): number {
    return Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0))
  }

  /** 触发手势回调 */
  private emitGesture(event: GestureEvent): void {
    for (const cb of this.callbacks) {
      try {
        cb(event)
      } catch (e) {
        console.warn('[ARGestureController] 手势回调异常:', e)
      }
    }
  }
}
