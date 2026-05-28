<template>
  <view class="avatar-container">
    <view class="avatar-wrapper" :class="{ speaking: isSpeaking, idle: !isSpeaking }">
      <view class="avatar-3d-container">
        <view class="avatar-3d" :class="[currentExpression, { 'avatar-idle': !isSpeaking, 'avatar-loading': isLoading && !imageLoaded }]">
          <view class="avatar-glow" :class="{ active: imageLoaded && !hasError }"></view>
          
          <view class="loading-overlay" v-if="isLoading && !imageLoaded">
            <view class="loading-progress">
              <view class="progress-ring">
                <svg viewBox="0 0 100 100">
                  <circle class="progress-bg" cx="50" cy="50" r="45" />
                  <circle class="progress-bar" cx="50" cy="50" r="45" :style="{ strokeDashoffset: progressOffset }" />
                </svg>
                <text class="progress-text">{{ loadProgress }}%</text>
              </view>
            </view>
            <text class="loading-text">{{ loadingStatus }}</text>
          </view>
          
          <view class="error-overlay" v-else-if="hasError">
            <view class="error-icon">😅</view>
            <text class="error-text">加载失败</text>
            <view class="retry-btn" @click="retryLoad">重试</view>
          </view>
          
          <image 
            class="avatar-image" 
            :class="{ 'image-visible': imageLoaded }"
            :src="currentImageUrl" 
            mode="aspectFit" 
            @load="onImageLoad" 
            @error="onImageError"
            :loading="lazyLoading"
          />
          
          <view class="avatar-skeleton" v-if="!imageLoaded && !hasError && !isInitialLoad">
            <view class="skeleton-avatar"></view>
          </view>
          
          <view class="avatar-overlay"></view>
        </view>
        
        <view class="avatar-shadow" :class="{ active: imageLoaded && !hasError }"></view>
      </view>
      
      <view class="avatar-status" v-if="isSpeaking && imageLoaded">
        <view class="wave"></view>
        <view class="wave" style="animation-delay: 0.1s"></view>
        <view class="wave" style="animation-delay: 0.2s"></view>
      </view>
      
      <view class="breathing-indicator" :class="{ active: isBreathing && imageLoaded }"></view>
    </view>
    
    <view class="avatar-controls" v-if="showControls && imageLoaded">
      <view class="control-btn" v-for="expr in expressions" :key="expr.id" :class="{ active: currentExpression === expr.id }" @click="setExpression(expr.id)">
        <text class="btn-icon">{{ expr.icon }}</text>
        <text class="btn-label">{{ expr.name }}</text>
      </view>
    </view>
    
    <view class="expression-label" v-if="showExpressionLabel && imageLoaded">
      <text>{{ currentExpressionName }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getSafeImageUrl } from '@/utils/imageConfig'

interface Expression {
  id: string
  name: string
  icon: string
}

interface PerformanceMetrics {
  loadStartTime: number
  loadEndTime: number
  imageLoadTime: number
  totalLoadTime: number
  frameRate: number
  cacheHit: boolean
}

const props = withDefaults(defineProps<{
  avatarUrl?: string
  showControls?: boolean
  showExpressionLabel?: boolean
}>(), {
  showControls: false,
  showExpressionLabel: false
})

const emit = defineEmits<{
  (e: 'expressionChange', expression: string): void
  (e: 'imageLoad', success: boolean, metrics: PerformanceMetrics): void
  (e: 'performanceUpdate', metrics: PerformanceMetrics): void
}>()

const currentExpression = ref('neutral')
const isSpeaking = ref(false)
const isBreathing = ref(true)
const isLoading = ref(false)
const hasError = ref(false)
const imageLoaded = ref(false)
const isInitialLoad = ref(true)
const loadProgress = ref(0)
const loadingStatus = ref('准备中...')
const lazyLoading = ref('eager')
const loadedImages = ref<Set<string>>(new Set())
const imageCache = ref<Map<string, string>>(new Map())
const lastLoadTime = ref<number>(0)

let blinkTimer: number | null = null
let breathingTimer: number | null = null
let loadStartTime = 0
let frameCount = 0
let lastFrameTime = 0
let frameRateInterval: number | null = null
const currentFrameRate = ref(60)

const expressions: Expression[] = [
  { id: 'neutral', name: '自然', icon: '😊' },
  { id: 'happy', name: '开心', icon: '😄' },
  { id: 'smile', name: '微笑', icon: '🙂' },
  { id: 'surprised', name: '惊讶', icon: '😮' },
  { id: 'thinking', name: '思考', icon: '🤔' },
  { id: 'sad', name: '难过', icon: '😢' },
  { id: 'angry', name: '生气', icon: '😠' },
  { id: 'sleepy', name: '困倦', icon: '😴' }
]

const avatarImages: Record<string, string> = {
  neutral: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20neutral%20expression%20gentle%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square'),
  happy: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20happy%20big%20smile%20cheerful%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square'),
  smile: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20gentle%20smile%20warm%20friendly%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square'),
  surprised: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20surprised%20eyes%20wide%20open%20curious%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square'),
  thinking: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20thinking%20pensive%20contemplative%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square'),
  sad: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20sad%20expression%20gentle%20tears%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square'),
  angry: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20angry%20expression%20frown%20determined%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square'),
  sleepy: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20sleepy%20tired%20eyes%20closed%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square'),
  blink: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=3D%20anime%20girl%20avatar%20portrait%20silver%20purple%20long%20hair%20red%20hair%20accessory%20eyes%20closed%20relaxed%20soft%20lighting%20Japanese%20anime%20style%20high%20quality%20render&image_size=square')
}

const defaultFallbackImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMTAwYy00NCAwLTgwLTM2LTgwLTgwczM2LTgwIDgwLTgwIDgwIDM2IDgwIDgwLTM2IDgwLTgwIDgwem0tMjAtMzJjLTkuOSAwLTE4LTguMS0xOC0xOHM4LjEtMTggMTgtMTggMTggOC4xIDE4IDE4LTguMSAxOC0xOCAxOHptMCA0OGMtOS45IDAtMTgtOC4xLTE4LTE4czguMS0xOCAxOC0xOCAxOCA4LjEgMTggMTgtOC4xIDE4LTE4IDE4em0yMCAwem0tMjAtMjB6IiBmaWxsPSIjZmZmIi8+PC9zdmc+'

const currentImageUrl = computed(() => {
  if (hasError.value) {
    return defaultFallbackImage
  }
  return avatarImages[currentExpression.value] || avatarImages.neutral
})

const progressOffset = computed(() => {
  const circumference = 2 * Math.PI * 45
  return circumference - (loadProgress.value / 100) * circumference
})

const currentExpressionName = computed(() => {
  const expr = expressions.find(e => e.id === currentExpression.value)
  return expr?.name || '自然'
})

const startPerformanceMonitoring = () => {
  lastFrameTime = performance.now()
  frameCount = 0
  
  const measureFrameRate = () => {
    const now = performance.now()
    frameCount++
    
    if (now - lastFrameTime >= 1000) {
      currentFrameRate.value = Math.round(frameCount * 1000 / (now - lastFrameTime))
      frameCount = 0
      lastFrameTime = now
    }
    
    frameRateInterval = requestAnimationFrame(measureFrameRate) as unknown as number
  }
  
  frameRateInterval = requestAnimationFrame(measureFrameRate) as unknown as number
}

const stopPerformanceMonitoring = () => {
  if (frameRateInterval) {
    cancelAnimationFrame(frameRateInterval)
    frameRateInterval = null
  }
}

const getCachedImage = (url: string): string | null => {
  return imageCache.value.get(url) || null
}

const cacheImage = (url: string, dataUrl: string) => {
  if (imageCache.value.size > 20) {
    const firstKey = imageCache.value.keys().next().value
    if (firstKey) imageCache.value.delete(firstKey)
  }
  imageCache.value.set(url, dataUrl)
}

const preloadImage = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (loadedImages.value.has(url)) {
      resolve(true)
      return
    }
    
    const cached = getCachedImage(url)
    if (cached) {
      loadedImages.value.add(url)
      resolve(true)
      return
    }
    
    const img = new Image()
    img.onload = () => {
      loadedImages.value.add(url)
      resolve(true)
    }
    img.onerror = () => {
      console.warn('Failed to preload:', url)
      resolve(false)
    }
    img.src = url
  })
}

const preloadImages = async () => {
  const urls = Object.values(avatarImages)
  let loaded = 0
  const total = urls.length
  
  for (const url of urls) {
    await preloadImage(url)
    loaded++
    loadProgress.value = Math.round((loaded / total) * 100)
  }
}

const preloadImagesParallel = async () => {
  const urls = Object.values(avatarImages)
  const total = urls.length
  
  const promises = urls.map((url, index) => {
    return new Promise<void>((resolve) => {
      if (loadedImages.value.has(url)) {
        resolve()
        return
      }
      
      const img = new Image()
      img.onload = () => {
        loadedImages.value.add(url)
        loadProgress.value = Math.round(((index + 1) / total) * 100)
        resolve()
      }
      img.onerror = () => {
        console.warn('Failed to preload:', url)
        resolve()
      }
      img.src = url
    })
  })
  
  await Promise.all(promises)
}

const setExpression = async (expr: string) => {
  if (isLoading.value && !imageLoaded.value) return
  
  currentExpression.value = expr
  isLoading.value = true
  hasError.value = false
  emit('expressionChange', expr)
  
  if (expr === 'surprised') {
    setTimeout(() => {
      if (currentExpression.value === 'surprised') {
        setExpression('neutral')
      }
    }, 3000)
  }
  
  const targetUrl = avatarImages[expr] || avatarImages.neutral
  
  if (loadedImages.value.has(targetUrl)) {
    loadProgress.value = 100
    loadingStatus.value = '加载完成'
    await new Promise(r => setTimeout(r, 100))
    imageLoaded.value = true
    isLoading.value = false
    lastLoadTime.value = performance.now()
    emitPerformanceMetrics(true)
  } else {
    isLoading.value = false
    imageLoaded.value = true
    emitPerformanceMetrics(true)
  }
  
  if (expr === 'surprised') {
    setTimeout(() => {
      if (currentExpression.value === 'surprised') {
        setExpression('neutral')
      }
    }, 3000)
  }
}

const onImageLoad = () => {
  const loadEndTime = performance.now()
  const loadTime = loadEndTime - loadStartTime
  
  isLoading.value = false
  hasError.value = false
  imageLoaded.value = true
  isInitialLoad.value = false
  loadedImages.value.add(currentImageUrl.value)
  lastLoadTime.value = loadTime
  
  const metrics: PerformanceMetrics = {
    loadStartTime,
    loadEndTime,
    imageLoadTime: loadTime,
    totalLoadTime: performance.now() - loadStartTime,
    frameRate: currentFrameRate.value,
    cacheHit: false
  }
  
  emit('imageLoad', true, metrics)
  emit('performanceUpdate', metrics)
}

const onImageError = () => {
  isLoading.value = false
  hasError.value = true
  imageLoaded.value = false
  isInitialLoad.value = false
  
  const metrics: PerformanceMetrics = {
    loadStartTime,
    loadEndTime: performance.now(),
    imageLoadTime: performance.now() - loadStartTime,
    totalLoadTime: performance.now() - loadStartTime,
    frameRate: currentFrameRate.value,
    cacheHit: false
  }
  
  emit('imageLoad', false, metrics)
}

const emitPerformanceMetrics = (cacheHit: boolean) => {
  const metrics: PerformanceMetrics = {
    loadStartTime,
    loadEndTime: performance.now(),
    imageLoadTime: lastLoadTime.value,
    totalLoadTime: performance.now() - loadStartTime,
    frameRate: currentFrameRate.value,
    cacheHit
  }
  
  emit('performanceUpdate', metrics)
}

const retryLoad = () => {
  hasError.value = false
  isLoading.value = true
  loadStartTime = performance.now()
  
  const img = new Image()
  img.onload = onImageLoad
  img.onerror = onImageError
  img.src = currentImageUrl.value + '?t=' + Date.now()
}

const startBlinking = () => {
  blinkTimer = window.setInterval(() => {
    if (!isLoading.value && !hasError.value && imageLoaded.value) {
      const original = currentExpression.value
      currentExpression.value = 'blink'
      setTimeout(() => {
        if (currentExpression.value === 'blink') {
          currentExpression.value = original
        }
      }, 200)
    }
  }, 4000)
}

const startBreathing = () => {
  breathingTimer = window.setInterval(() => {
    if (imageLoaded.value) {
      isBreathing.value = !isBreathing.value
    }
  }, 2000)
}

const startSpeaking = () => {
  isSpeaking.value = true
  isBreathing.value = false
}

const stopSpeaking = () => {
  isSpeaking.value = false
  isBreathing.value = true
}

const setEmotion = (emotion: 'positive' | 'neutral' | 'negative') => {
  switch (emotion) {
    case 'positive': setExpression('happy'); break
    case 'negative': setExpression('sad'); break
    default: setExpression('neutral')
  }
}

watch(currentExpression, () => {
  if (loadedImages.value.has(currentImageUrl.value)) {
    isLoading.value = false
    imageLoaded.value = true
  }
})

onMounted(async () => {
  loadStartTime = performance.now()
  loadingStatus.value = '正在初始化...'
  loadProgress.value = 10
  
  startPerformanceMonitoring()
  
  loadingStatus.value = '预加载资源...'
  loadProgress.value = 20
  
  await nextTick()
  
  preloadImagesParallel().then(() => {
    loadProgress.value = 90
    loadingStatus.value = '准备就绪...'
    
    setTimeout(() => {
      loadProgress.value = 100
      loadingStatus.value = '加载完成'
      
      imageLoaded.value = true
      isLoading.value = false
      isInitialLoad.value = false
      lastLoadTime.value = performance.now()
      
      const metrics: PerformanceMetrics = {
        loadStartTime,
        loadEndTime: performance.now(),
        imageLoadTime: performance.now() - loadStartTime,
        totalLoadTime: performance.now() - loadStartTime,
        frameRate: currentFrameRate.value,
        cacheHit: true
      }
      
      emit('imageLoad', true, metrics)
      emit('performanceUpdate', metrics)
    }, 200)
  })
  
  startBlinking()
  startBreathing()
})

onUnmounted(() => {
  if (blinkTimer) clearInterval(blinkTimer)
  if (breathingTimer) clearInterval(breathingTimer)
  stopPerformanceMonitoring()
})

defineExpose({ setExpression, startSpeaking, stopSpeaking, setEmotion, currentFrameRate })
</script>

<style lang="scss" scoped>
.avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.avatar-wrapper {
  position: relative;
  width: 200rpx;
  height: 500rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  transition: transform 0.3s ease;

  &.speaking {
    animation: speakBounce 0.4s ease-in-out infinite;
  }

  &.idle {
    animation: idleSway 4s ease-in-out infinite;
  }
}

@keyframes speakBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6rpx); }
}

@keyframes idleSway {
  0%, 100% { transform: rotate(-1deg) translateX(-2rpx); }
  50% { transform: rotate(1deg) translateX(2rpx); }
}

.avatar-3d-container {
  position: relative;
  width: 180rpx;
  height: 480rpx;
  perspective: 1200rpx;
}

.avatar-3d {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: all 0.3s ease;

  &.avatar-idle {
    animation: avatarRotate 10s ease-in-out infinite;
  }

  &.happy {
    animation: happyBounce 0.8s ease-in-out infinite, avatarRotate 10s ease-in-out infinite;
  }

  &.surprised {
    animation: surpriseScale 0.3s ease-out;
  }

  &.avatar-loading {
    opacity: 0.8;
  }
}

@keyframes avatarRotate {
  0%, 100% { transform: rotateY(0deg) rotateX(0deg); }
  25% { transform: rotateY(3deg) rotateX(1deg); }
  75% { transform: rotateY(-3deg) rotateX(-1deg); }
}

@keyframes happyBounce {
  0%, 100% { transform: translateY(0) rotateY(0deg); }
  25% { transform: translateY(-4rpx) rotateY(2deg); }
  75% { transform: translateY(-4rpx) rotateY(-2deg); }
}

@keyframes surpriseScale {
  0% { transform: scale(0.95); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

.avatar-glow {
  position: absolute;
  top: -30rpx;
  left: -30rpx;
  right: -30rpx;
  bottom: -30rpx;
  background: radial-gradient(ellipse at center top, rgba(147, 112, 219, 0.3) 0%, rgba(64, 128, 255, 0.2) 40%, transparent 70%);
  border-radius: 20rpx;
  pointer-events: none;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.5s ease;

  &.active {
    opacity: 1;
    animation: glowPulse 4s ease-in-out infinite;
  }
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.15), 0 0 80rpx rgba(147, 112, 219, 0.12), inset 0 0 40rpx rgba(255, 255, 255, 0.15);
  object-fit: contain;
  transition: all 0.3s ease;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(245, 247, 250, 0.5) 100%);
  opacity: 0;
  
  &.image-visible {
    opacity: 1;
  }
}

.avatar-skeleton {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skeleton-avatar {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
  background: linear-gradient(90deg, 
    rgba(147, 112, 219, 0.1) 25%, 
    rgba(147, 112, 219, 0.2) 50%, 
    rgba(147, 112, 219, 0.1) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 16rpx;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
  pointer-events: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16rpx;
  z-index: 10;
}

.loading-progress {
  margin-bottom: 16rpx;
}

.progress-ring {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  
  svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  
  .progress-bg {
    fill: none;
    stroke: #e8e8e8;
    stroke-width: 8;
  }
  
  .progress-bar {
    fill: none;
    stroke: #9370db;
    stroke-width: 8;
    stroke-linecap: round;
    stroke-dasharray: 283;
    transition: stroke-dashoffset 0.3s ease;
  }
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20rpx;
  font-weight: 600;
  color: #9370db;
}

.loading-text {
  font-size: 22rpx;
  color: #999;
}

.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16rpx;
  z-index: 10;
}

.error-icon {
  font-size: 56rpx;
}

.error-text {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.retry-btn {
  padding: 8rpx 20rpx;
  background: linear-gradient(135deg, #9370db 0%, #8a5cf6 100%);
  color: #fff;
  border-radius: 20rpx;
  margin-top: 12rpx;
  font-size: 22rpx;

  &:active { opacity: 0.8; }
}

.avatar-shadow {
  position: absolute;
  bottom: -15rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 150rpx;
  height: 35rpx;
  background: radial-gradient(ellipse, rgba(147, 112, 219, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.5s ease;

  &.active {
    opacity: 1;
    animation: shadowPulse 4s ease-in-out infinite;
  }
}

@keyframes shadowPulse {
  0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.5; }
  50% { transform: translateX(-50%) scale(1.15); opacity: 0.3; }
}

.avatar-status {
  position: absolute;
  bottom: 40rpx;
  right: -15rpx;
  display: flex;
  gap: 6rpx;
  align-items: flex-end;
  background: rgba(255, 255, 255, 0.95);
  padding: 10rpx 20rpx;
  border-radius: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(147, 112, 219, 0.2);
  border: 2rpx solid rgba(147, 112, 219, 0.2);
}

.wave {
  width: 12rpx;
  background: linear-gradient(180deg, #9370db, #8a5cf6);
  border-radius: 6rpx;
  animation: wave 0.5s ease-in-out infinite;

  &:nth-child(1) { height: 20rpx; }
  &:nth-child(2) { height: 28rpx; }
  &:nth-child(3) { height: 20rpx; }
}

@keyframes wave {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

.breathing-indicator {
  position: absolute;
  bottom: 20rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 100rpx;
  height: 6rpx;
  background: linear-gradient(90deg, transparent, rgba(147, 112, 219, 0.5), transparent);
  border-radius: 3rpx;
  transition: all 1s ease;
  opacity: 0;

  &.active {
    opacity: 1;
    animation: breathe 2.5s ease-in-out infinite;
  }
}

@keyframes breathe {
  0%, 100% { width: 100rpx; opacity: 0.4; }
  50% { width: 140rpx; opacity: 0.6; }
}

.avatar-controls {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 480rpx;
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 20rpx;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  border-radius: 20rpx;
  transition: all 0.25s ease;
  border: 2rpx solid transparent;
  min-width: 90rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);

  &.active {
    background: linear-gradient(135deg, rgba(147, 112, 219, 0.15) 0%, rgba(147, 112, 219, 0.05) 100%);
    border-color: #9370db;
    transform: translateY(-4rpx);
    box-shadow: 0 8rpx 20rpx rgba(147, 112, 219, 0.2);
  }

  &:active {
    transform: scale(0.95);
  }
}

.btn-icon {
  font-size: 40rpx;
}

.btn-label {
  font-size: 22rpx;
  color: #555;
  margin-top: 6rpx;
}

.expression-label {
  padding: 10rpx 24rpx;
  background: linear-gradient(135deg, rgba(147, 112, 219, 0.9) 0%, rgba(138, 92, 246, 0.9) 100%);
  color: #fff;
  border-radius: 24rpx;
  font-size: 26rpx;
  margin-top: 12rpx;
  box-shadow: 0 4rpx 16rpx rgba(147, 112, 219, 0.3);
}
</style>
