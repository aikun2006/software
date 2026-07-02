<template>
  <view class="sv-mask" @click="onClose">
    <view class="sv-card" @click.stop>
      <view class="sv-head">
        <text class="sv-title">安全验证</text>
        <text class="sv-close" @click="onClose">×</text>
      </view>
      <text class="sv-desc">请按住滑块，拖动到最右侧完成验证</text>

      <view class="sv-track" ref="trackRef">
        <view class="sv-fill" :style="{ width: fillWidth + 'px' }"></view>
        <text class="sv-tip" :class="{ ok: isVerified }">{{ tipText }}</text>
        <view
          class="sv-slider"
          ref="sliderRef"
          :class="{ dragging: isDragging, ok: isVerified }"
          :style="{ transform: `translateX(${sliderLeft}px)` }"
        >
          <text class="sv-slider-icon">{{ isVerified ? '✓' : '→' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const emit = defineEmits<{ (e: 'verified'): void; (e: 'close'): void }>()

const isVerified = ref(false)
const isDragging = ref(false)
const sliderLeft = ref(0)
const startX = ref(0)
const maxWidth = ref(0)
const trackRef = ref<any>(null)
const sliderRef = ref<any>(null)

// 实际 DOM 节点（onMounted 后赋值）
let trackEl: HTMLElement | null = null
let sliderEl: HTMLElement | null = null

// uni-app 中 <view ref> 可能返回组件实例（取 $el）或直接是 DOM 节点
const elOf = (r: any): HTMLElement | null => {
  if (!r) return null
  return (r.$el as HTMLElement) || (r as HTMLElement)
}

const sliderW = () => (sliderEl ? sliderEl.getBoundingClientRect().width : 0)

// 填充宽度覆盖滑块左侧区域；未拖动且未验证时不显示
const fillWidth = computed(() => {
  if (!isVerified.value && !isDragging.value) return 0
  return sliderLeft.value + sliderW()
})

const tipText = computed(() => {
  if (isVerified.value) return '验证通过'
  if (isDragging.value) return '继续向右拖动...'
  return '请按住滑块，拖动到底'
})

// 兼容取 clientX（touch / mouse）
const clientXOf = (e: any): number => {
  if (e.touches && e.touches.length) return e.touches[0].clientX
  if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX
  return e.clientX ?? 0
}

// 测量轨道与滑块宽度，计算最大可滑动距离
const measure = () => {
  if (!trackEl || !sliderEl) return
  const tw = trackEl.getBoundingClientRect().width
  const sw = sliderEl.getBoundingClientRect().width
  maxWidth.value = Math.max(0, tw - sw)
}

const onMove = (e: any) => {
  if (!isDragging.value) return
  e.preventDefault?.()
  let dx = clientXOf(e) - startX.value
  if (dx < 0) dx = 0
  if (dx > maxWidth.value) dx = maxWidth.value
  sliderLeft.value = dx
}

const onUp = () => {
  if (!isDragging.value) return
  isDragging.value = false
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onUp)
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
  // 到底（容差 2px）即验证通过，否则回弹
  if (maxWidth.value > 0 && sliderLeft.value >= maxWidth.value - 2) {
    isVerified.value = true
    sliderLeft.value = maxWidth.value
    // 短暂展示绿色“验证通过”后再通知父级
    setTimeout(() => emit('verified'), 400)
  } else {
    sliderLeft.value = 0
  }
}

const onDown = (e: any) => {
  if (isVerified.value) return
  e.preventDefault?.()
  measure()
  isDragging.value = true
  startX.value = clientXOf(e)
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onUp)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

onMounted(async () => {
  await nextTick()
  trackEl = elOf(trackRef.value)
  sliderEl = elOf(sliderRef.value)
  // 原生挂监，绕开 uni-app <view> 事件白名单不可靠的问题
  if (sliderEl) {
    sliderEl.addEventListener('mousedown', onDown as any)
    sliderEl.addEventListener('touchstart', onDown as any, { passive: false } as any)
  }
})

onUnmounted(() => {
  if (sliderEl) {
    sliderEl.removeEventListener('mousedown', onDown as any)
    sliderEl.removeEventListener('touchstart', onDown as any)
  }
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onUp)
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
})

const onClose = () => emit('close')
</script>

<style lang="scss" scoped>
.sv-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8rpx);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sv-card {
  width: 580rpx;
  background: $bg-white;
  border-radius: $border-radius-xl;
  padding: 40rpx 36rpx 44rpx;
  box-shadow: $shadow-lg;
}
.sv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}
.sv-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $text-primary;
}
.sv-close {
  font-size: 44rpx;
  color: $text-secondary;
  line-height: 40rpx;
  padding: 0 8rpx;
}
.sv-desc {
  display: block;
  font-size: 24rpx;
  color: $text-secondary;
  margin-bottom: 32rpx;
}
.sv-track {
  position: relative;
  width: 100%;
  height: 84rpx;
  background: #efe7d6;
  border-radius: 42rpx;
  overflow: hidden;
  border: 2rpx solid #e0d4b8;
  touch-action: none;
}
.sv-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  border-radius: 42rpx 0 0 42rpx;
  transition: width 0.1s;
}
.sv-tip {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: #8a7a5a;
  pointer-events: none;
  z-index: 1;
}
.sv-slider {
  position: absolute;
  left: 0;
  top: 1rpx;
  width: 84rpx;
  height: 78rpx;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.25);
  cursor: grab;
  z-index: 2;
  transition: transform 0.25s ease;
  touch-action: none;
}
.sv-slider.dragging {
  cursor: grabbing;
  transition: none;
}
.sv-slider-icon {
  color: #fff;
  font-size: 38rpx;
  font-weight: bold;
}
.sv-slider.ok {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
}
.sv-tip.ok {
  color: #fff;
}
</style>
