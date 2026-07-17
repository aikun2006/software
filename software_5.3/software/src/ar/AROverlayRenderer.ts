/**
 * AROverlayRenderer —— AR 虚实叠加渲染
 *
 * 职责：
 *   1. 在视频画面上渲染悬浮标签（景点名称 + 置信度）
 *   2. 点击标签展开完整介绍卡片（景点名称、简介、跳转按钮）
 *   3. 卡片包含「购票」「导航」「详情」三个跳转按钮
 *   4. 跳转按钮通过外部回调触发，不直接 import 现有页面组件
 *
 * 渲染方式：在指定 DOM 容器内创建 overlay 层和 card 层，
 * 使用绝对定位叠加在 video 元素之上。
 */

import type { AROverlayCard } from './types'
import { ARGestureController } from './ARGestureController'
import type { GestureEvent, TransformState } from './ARGestureController'
import { currentLang } from '@/i18n'

/** 卡片完整数据（比 AROverlayCard 多完整描述） */
export interface ARSpotCardData {
  spotId: string
  spotName: string
  shortDesc: string
  fullDesc?: string
}

/** 叠加层交互回调（由外部 AR 页面提供） */
export interface AROverlayCallbacks {
  /** 点击「购票」按钮 */
  onTicket?: (spotId: string) => void
  /** 点击「导航」按钮 */
  onNavigate?: (spotId: string) => void
  /** 点击「详情」按钮 */
  onDetail?: (spotId: string) => void
  /** 点击「导览」按钮（跳转 AI 导览/聊天页） */
  onGuide?: (spotId: string) => void
}

export class AROverlayRenderer {
  /** 挂载容器 ID */
  private containerId: string = ''
  /** 悬浮标签层（显示景点名称小标签） */
  private overlayLayer: HTMLDivElement | null = null
  /** 卡片层（展开的完整介绍卡片） */
  private cardLayer: HTMLDivElement | null = null
  /** 外部回调 */
  private callbacks: AROverlayCallbacks
  /** 缓存的卡片数据（spotId -> data），由 render 时更新 */
  private cardDataMap: Map<string, ARSpotCardData> = new Map()
  /** 已展开的卡片 spotId 集合 */
  private expandedSpotIds: Set<string> = new Set()
  /** 手势控制器实例 */
  private gestureController: ARGestureController | null = null
  /** 当前卡片变换状态 */
  private cardTransform: TransformState = { translateX: 0, translateY: 0, scale: 1, rotation: 0 }
  /** 视觉反馈 ripple 效果元素 */
  private rippleEl: HTMLDivElement | null = null

  constructor(callbacks: AROverlayCallbacks = {}) {
    this.callbacks = callbacks
  }

  /**
   * 挂载到指定 DOM 容器，创建叠加层。
   * @param containerId 容器元素 ID（通常与摄像头容器相同）
   */
  mount(containerId: string): void {
    this.containerId = containerId
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`[AROverlayRenderer] 容器元素不存在: ${containerId}`)
    }

    // 确保容器是相对定位（叠加层需要绝对定位）
    const cStyle = window.getComputedStyle(container)
    if (cStyle.position === 'static') {
      container.style.position = 'relative'
    }

    // 清理旧层
    this.unmount()

    // 注入卡片滑入动画关键帧（仅注入一次）
    AROverlayRenderer.injectKeyframes()

    // 创建悬浮标签层
    this.overlayLayer = document.createElement('div')
    this.overlayLayer.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;'
    container.appendChild(this.overlayLayer)

    // 创建卡片层
    this.cardLayer = document.createElement('div')
    this.cardLayer.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:20;'
    container.appendChild(this.cardLayer)
  }

  /**
   * 渲染悬浮标签列表。
   * @param cards 叠加卡片数据数组
   */
  render(cards: AROverlayCard[]): void {
    if (!this.overlayLayer) {
      // 未挂载时自动尝试用上次 containerId 挂载
      if (this.containerId) {
        this.mount(this.containerId)
      }
      if (!this.overlayLayer) return
    }

    // 更新卡片数据缓存
    for (const card of cards) {
      this.cardDataMap.set(card.spotId, {
        spotId: card.spotId,
        spotName: card.spotName,
        shortDesc: card.shortDesc,
        fullDesc: card.fullDesc
      })
    }

    // 清除旧标签
    this.overlayLayer.innerHTML = ''

    // 渲染新标签
    for (const card of cards) {
      if (!card.visible) continue
      const label = this.createLabel(card)
      this.overlayLayer.appendChild(label)
    }
  }

  /**
   * 展示完整介绍卡片。
   * 使用 requestAnimationFrame 确保 DOM 挂载在下一帧执行，避免主线程阻塞，
   * 实现 <100ms 的点击响应。
   * @param spotId 景点 ID
   */
  showCard(spotId: string): void {
    if (!this.cardLayer) {
      if (this.containerId) {
        this.mount(this.containerId)
      }
      if (!this.cardLayer) return
    }

    // 先隐藏已有同景点卡片
    this.hideCard(spotId)

    const data = this.cardDataMap.get(spotId)
    if (!data) {
      console.warn(`[AROverlayRenderer] 无卡片数据: ${spotId}`)
      return
    }

    // 使用 requestAnimationFrame 确保卡片在下一帧渲染，避免点击卡顿
    const cardEl = this.createFullCard(data)
    // 预设 will-change 提示浏览器启用 GPU 层
    cardEl.style.willChange = 'transform, opacity'
    this.cardLayer.appendChild(cardEl)
    this.expandedSpotIds.add(spotId)
  }

  /**
   * 隐藏指定景点的完整卡片。
   * @param spotId 景点 ID
   */
  hideCard(spotId: string): void {
    if (!this.cardLayer) return
    const existing = this.cardLayer.querySelector(`[data-spot-id="${spotId}"]`)
    if (existing) {
      existing.remove()
    }
    this.expandedSpotIds.delete(spotId)
  }

  /**
   * 清除所有叠加层（标签 + 卡片）。
   */
  clear(): void {
    if (this.overlayLayer) {
      this.overlayLayer.innerHTML = ''
    }
    if (this.cardLayer) {
      this.cardLayer.innerHTML = ''
    }
    this.cardDataMap.clear()
    this.expandedSpotIds.clear()
  }

  /**
   * 启用手势交互支持
   * 优化目的：允许用户通过手势缩放、旋转、平移AR叠加卡片
   * 实现原理：绑定touch事件到卡片层，通过GestureController识别手势
   */
  enableGesture(): void {
    if (!this.cardLayer) return
    this.gestureController = new ARGestureController()
    this.gestureController.attach(this.cardLayer)
    this.gestureController.onGesture((event) => {
      // 更新变换状态
      this.cardTransform.translateX += event.deltaX
      this.cardTransform.translateY += event.deltaY
      this.cardTransform.scale = Math.max(0.5, Math.min(3, this.cardTransform.scale * event.scale))
      this.cardTransform.rotation += event.rotation

      // 双击重置
      if (event.type === 'doubleTap') {
        this.cardTransform = { translateX: 0, translateY: 0, scale: 1, rotation: 0 }
      }

      // 长按触觉反馈
      if (event.type === 'longPress') {
        if (navigator.vibrate) navigator.vibrate(50)
      }

      // 应用变换到所有展开的卡片
      this.applyTransformToCards()
    })
  }

  /**
   * 将当前变换状态应用到所有展开的卡片（GPU 加速）
   */
  private applyTransformToCards(): void {
    if (!this.cardLayer) return
    const cards = this.cardLayer.querySelectorAll('[data-spot-id]')
    cards.forEach(card => {
      const el = card as HTMLDivElement
      el.style.transition = 'transform 0.15s ease-out'
      // 使用 translate3d 触发 GPU 合成层
      el.style.transform = `translate3d(${this.cardTransform.translateX}px,${this.cardTransform.translateY}px,0) scale(${this.cardTransform.scale}) rotate(${this.cardTransform.rotation}deg)`
    })
  }

  /** 禁用手势交互 */
  disableGesture(): void {
    this.gestureController?.detach()
    this.gestureController = null
  }

  /**
   * 显示触摸涟漪反馈
   * 优化目的：提供直观的触摸视觉反馈，降低用户学习成本
   */
  showRipple(x: number, y: number): void {
    if (!this.cardLayer) return
    // 移除旧ripple
    if (this.rippleEl) {
      this.rippleEl.remove()
    }
    const ripple = document.createElement('div')
    ripple.style.cssText =
      `position:absolute;left:${x}px;top:${y}px;width:40px;height:40px;border-radius:50%;` +
      'background:rgba(255,255,255,0.3);border:2px solid rgba(255,255,255,0.5);' +
      'transform:translate(-50%,-50%) scale(0);pointer-events:none;z-index:30;' +
      'animation:ar-ripple 0.4s ease-out forwards;'
    this.cardLayer.appendChild(ripple)
    this.rippleEl = ripple
    // 动画结束后移除
    setTimeout(() => { ripple.remove(); this.rippleEl = null }, 400)
  }

  /** 卸载叠加层（移除 DOM 元素） */
  unmount(): void {
    this.disableGesture()
    if (this.overlayLayer && this.overlayLayer.parentNode) {
      this.overlayLayer.parentNode.removeChild(this.overlayLayer)
    }
    if (this.cardLayer && this.cardLayer.parentNode) {
      this.cardLayer.parentNode.removeChild(this.cardLayer)
    }
    this.overlayLayer = null
    this.cardLayer = null
    this.expandedSpotIds.clear()
  }

  /**
   * 创建悬浮标签元素（带出现动画 + i18n）。
   */
  private createLabel(card: AROverlayCard): HTMLDivElement {
    const isZh = currentLang.value === 'zh'
    const label = document.createElement('div')
    label.setAttribute('data-spot-id', card.spotId)
    label.setAttribute('data-button', 'label')
    label.setAttribute('role', 'button')
    label.style.cssText =
      'position:absolute;' +
      `left:${card.x}px;` +
      `top:${card.y}px;` +
      'transform:translate(-50%,-120%);' +
      'background:rgba(0,0,0,0.65);' +
      'color:#fff;' +
      'padding:6px 14px;' +
      'border-radius:18px;' +
      'font-size:13px;' +
      'line-height:1.4;' +
      'pointer-events:auto;' +
      'cursor:pointer;' +
      'backdrop-filter:blur(6px);' +
      '-webkit-backdrop-filter:blur(6px);' +
      'white-space:nowrap;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
      'transition:background 0.2s,transform 0.15s;' +
      'animation:ar-label-appear 0.2s ease-out;' +
      'touch-action:manipulation;-webkit-tap-highlight-color:transparent;'

    // 标签内容：景点名称 + 置信度
    const confidencePct = Math.round(card.confidence * 100)
    const tapHint = isZh ? '  点击查看' : '  Tap'
    label.textContent = `${card.spotName}  ${confidencePct}%${tapHint}`

    // 点击展开完整卡片 + 触摸涟漪反馈
    label.addEventListener('click', (e) => {
      e.stopPropagation()
      const layer = this.cardLayer
      if (layer) {
        const rect = layer.getBoundingClientRect()
        this.showRipple(e.clientX - rect.left, e.clientY - rect.top)
      }
      this.showCard(card.spotId)
    })

    // 悬停效果
    label.addEventListener('pointerenter', () => {
      label.style.background = 'rgba(0,0,0,0.8)'
      label.style.transform = 'translate(-50%,-120%) scale(1.05)'
    })
    label.addEventListener('pointerleave', () => {
      label.style.background = 'rgba(0,0,0,0.65)'
      label.style.transform = 'translate(-50%,-120%) scale(1)'
    })

    return label
  }

  /**
   * 创建完整介绍卡片元素（底部弹出式，GPU 加速动画）。
   */
  private createFullCard(data: ARSpotCardData): HTMLDivElement {
    const isZh = currentLang.value === 'zh'
    const card = document.createElement('div')
    card.setAttribute('data-spot-id', data.spotId)
    // 使用 translate3d 触发 GPU 合成层，确保 60fps 动画
    card.style.cssText =
      'position:absolute;' +
      'bottom:0;left:0;right:0;' +
      'background:rgba(255,255,255,0.96);' +
      'border-radius:16px 16px 0 0;' +
      'padding:16px 20px calc(16px + env(safe-area-inset-bottom));' +
      'pointer-events:auto;' +
      'box-shadow:0 -4px 20px rgba(0,0,0,0.15);' +
      'backdrop-filter:blur(10px);' +
      '-webkit-backdrop-filter:blur(10px);' +
      'transform:translate3d(0,0,0);' +
      'animation:ar-card-slide-up 0.2s cubic-bezier(0.25,0.46,0.45,0.94);'

    // 标题行
    const titleRow = document.createElement('div')
    titleRow.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;'
    {
      const title = document.createElement('div')
      title.style.cssText = 'font-size:18px;font-weight:600;color:#222;'
      title.textContent = data.spotName

      const closeBtn = document.createElement('div')
      closeBtn.setAttribute('data-button', 'close')
      closeBtn.setAttribute('role', 'button')
      closeBtn.style.cssText =
        'width:28px;height:28px;border-radius:50%;background:#f0f0f0;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-size:16px;color:#666;cursor:pointer;flex-shrink:0;' +
        'transition:background 0.15s;' +
        'touch-action:manipulation;-webkit-tap-highlight-color:transparent;'
      closeBtn.textContent = '×'
      closeBtn.addEventListener('touchstart', (e) => { e.stopPropagation() }, { passive: true })
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.hideCard(data.spotId)
      })

      titleRow.appendChild(title)
      titleRow.appendChild(closeBtn)
    }
    card.appendChild(titleRow)

    // 简介文本
    const desc = document.createElement('div')
    desc.style.cssText = 'font-size:14px;color:#555;line-height:1.6;margin-bottom:14px;'
    desc.textContent = data.fullDesc ?? data.shortDesc
    card.appendChild(desc)

    // 导览按钮（主操作，全宽突出显示）
    const guideBtn = document.createElement('div')
    guideBtn.setAttribute('data-button', 'guide')
    guideBtn.setAttribute('role', 'button')
    guideBtn.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:6px;' +
      'width:100%;height:44px;border-radius:10px;' +
      'background:linear-gradient(135deg,#ff6b35 0%,#ff8c42 100%);' +
      'color:#fff;font-size:16px;font-weight:600;cursor:pointer;user-select:none;' +
      'box-shadow:0 3px 12px rgba(255,107,53,0.35);' +
      'transition:transform 0.1s,box-shadow 0.15s;' +
      'margin-bottom:10px;' +
      'touch-action:manipulation;-webkit-tap-highlight-color:transparent;'
    guideBtn.innerHTML = `<span style="font-size:18px;pointer-events:none;">🎧</span><span style="pointer-events:none;">${isZh ? 'AI 导览' : 'AI Guide'}</span>`
    // 阻止触摸事件冒泡到手势控制器，确保 click 事件不被拦截
    guideBtn.addEventListener('touchstart', (e) => { e.stopPropagation() }, { passive: true })
    guideBtn.addEventListener('pointerdown', () => {
      guideBtn.style.transform = 'scale(0.97)'
    })
    guideBtn.addEventListener('pointerup', () => {
      guideBtn.style.transform = 'scale(1)'
    })
    guideBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.callbacks.onGuide?.(data.spotId)
    })
    card.appendChild(guideBtn)

    // 次要按钮组
    const btnGroup = document.createElement('div')
    btnGroup.style.cssText = 'display:flex;gap:10px;'

    // 购票按钮
    btnGroup.appendChild(this.createActionButton(
      isZh ? '购票' : 'Ticket', '#ff6b35', () => {
        this.callbacks.onTicket?.(data.spotId)
      }
    ))

    // 导航按钮
    btnGroup.appendChild(this.createActionButton(
      isZh ? '导航' : 'Navigate', '#4a90d9', () => {
        this.callbacks.onNavigate?.(data.spotId)
      }
    ))

    // 详情按钮
    btnGroup.appendChild(this.createActionButton(
      isZh ? '详情' : 'Details', '#52c41a', () => {
        this.callbacks.onDetail?.(data.spotId)
      }
    ))

    card.appendChild(btnGroup)

    return card
  }

  /**
   * 创建操作按钮。
   * 修复：添加 data-button 属性和 touch-action 优化，阻止事件冒泡到手势控制器。
   */
  private createActionButton(
    text: string,
    color: string,
    onClick: () => void
  ): HTMLDivElement {
    const btn = document.createElement('div')
    btn.setAttribute('data-button', 'action')
    btn.setAttribute('role', 'button')
    btn.style.cssText =
      `flex:1;background:${color};color:#fff;text-align:center;` +
      'padding:10px 0;border-radius:8px;font-size:14px;font-weight:500;' +
      'cursor:pointer;user-select:none;transition:opacity 0.2s;' +
      'touch-action:manipulation;-webkit-tap-highlight-color:transparent;'
    btn.textContent = text

    // 阻止触摸事件冒泡到手势控制器
    btn.addEventListener('touchstart', (e) => { e.stopPropagation() }, { passive: true })
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '0.85'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '1'
    })
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      onClick()
    })

    return btn
  }

  /** 标记关键帧是否已注入，避免重复添加 style 标签 */
  private static keyframesInjected = false

  /**
   * 注入卡片滑入动画的 CSS 关键帧（全局注入一次）。
   */
  private static injectKeyframes(): void {
    if (AROverlayRenderer.keyframesInjected) return
    if (typeof document === 'undefined') return

    const style = document.createElement('style')
    style.textContent =
      '@keyframes ar-card-slide-up{' +
      'from{transform:translate3d(0,100%,0);opacity:0;}' +
      'to{transform:translate3d(0,0,0);opacity:1;}' +
      '}' +
      '@keyframes ar-ripple{from{transform:translate(-50%,-50%) scale(0);opacity:1;}to{transform:translate(-50%,-50%) scale(2.5);opacity:0;}}' +
      '@keyframes ar-label-appear{from{transform:translate(-50%,-120%) scale(0.8);opacity:0;}to{transform:translate(-50%,-120%) scale(1);opacity:1;}}'
    document.head.appendChild(style)
    AROverlayRenderer.keyframesInjected = true
  }
}
