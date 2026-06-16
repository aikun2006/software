<template>
  <view class="avatar-container">
    <view class="avatar-wrapper" :class="{ speaking: isSpeaking, idle: !isSpeaking }">
      <view class="avatar-3d-container">
        <canvas 
          ref="canvasRef" 
          class="avatar-canvas" 
          :class="{ 'avatar-loading': isLoading && !modelLoaded }"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        ></canvas>
        
        <view class="loading-overlay" v-if="isLoading && !modelLoaded">
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
          <view v-if="showPerformanceInfo" class="performance-info">
            <text class="perf-text">{{ currentStage }}</text>
          </view>
        </view>
        
        <view class="error-overlay" v-else-if="hasError">
          <view class="error-icon">😅</view>
          <text class="error-text">{{ errorMessage }}</text>
          <view class="retry-btn" @click="retryLoad">重试</view>
        </view>
        
        <view class="avatar-glow" :class="{ active: modelLoaded && !hasError }"></view>
      </view>
      
      <view class="avatar-status" v-if="isSpeaking && modelLoaded">
        <view class="wave"></view>
        <view class="wave" style="animation-delay: 0.1s"></view>
        <view class="wave" style="animation-delay: 0.2s"></view>
      </view>
      
      <view class="breathing-indicator" :class="{ active: isBreathing && modelLoaded }"></view>
    </view>
    
    <view class="avatar-controls" v-if="showControls && modelLoaded">
      <view class="control-btn" v-for="expr in expressions" :key="expr.id" :class="{ active: currentExpression === expr.id }" @click="setExpression(expr.id)">
        <text class="btn-icon">{{ expr.icon }}</text>
        <text class="btn-label">{{ expr.name }}</text>
      </view>
    </view>
    
    <view class="expression-label" v-if="showExpressionLabel && modelLoaded">
      <text>{{ currentExpressionName }}</text>
    </view>
    
    <view v-if="showPerformanceInfo && modelLoaded" class="performance-panel">
      <view class="perf-item">
        <text class="perf-label">总耗时</text>
        <text class="perf-value">{{ initTime }}ms</text>
      </view>
      <view class="perf-item">
        <text class="perf-label">帧率</text>
        <text class="perf-value">{{ currentFrameRate }} FPS</text>
      </view>
      <view class="perf-item">
        <text class="perf-label">加载</text>
        <text class="perf-value">{{ loadTime }}ms</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { deepProfiler } from '@/utils/deepPerformanceProfiler'
import { modelCache } from '@/utils/modelCache'
import { tieredLoader, createVRMLoadTask } from '@/utils/tieredResourceLoader'
import { shaderPrecompiler } from '@/utils/shaderPrecompiler'
import { modelWorkerManager } from '@/utils/modelWorker'
import { createScene, loadVRMModel } from '@/utils/threeEngine.js'
import { VRM_TEMPLATE_CONFIG } from '@/utils/vrmModelConfig'

interface Expression {
  id: string
  name: string
  icon: string
}

const props = withDefaults(defineProps<{
  modelUrl?: string
  showControls?: boolean
  showExpressionLabel?: boolean
  showPerformanceInfo?: boolean
  autoLoad?: boolean
}>(), {
  modelUrl: '/static/avatars/guide_avatar.vrm',
  showControls: false,
  showExpressionLabel: false,
  showPerformanceInfo: false,
  autoLoad: true
})

const emit = defineEmits<{
  (e: 'expressionChange', expression: string): void
  (e: 'modelLoad', success: boolean, metrics?: any): void
  (e: 'performanceUpdate', metrics: any): void
  (e: 'initComplete', report: any): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const currentExpression = ref('neutral')
const isSpeaking = ref(false)
const isBreathing = ref(true)
const isLoading = ref(false)
const hasError = ref(false)
const modelLoaded = ref(false)
const loadProgress = ref(0)
const loadingStatus = ref('准备中...')
const currentStage = ref('')
const errorMessage = ref('加载失败')
const currentFrameRate = ref(60)
const loadTime = ref(0)
const initTime = ref(0)

const performanceLevel = computed(() => {
  const nav = navigator as any
  const memory = nav.deviceMemory || 4
  const cores = navigator.hardwareConcurrency || 4
  
  if (memory >= 8 && cores >= 8) return 'high'
  if (memory >= 4 && cores >= 4) return 'medium'
  return 'low'
})

let scene: any = null
let camera: any = null
let renderer: any = null
let vrm: any = null
let animationId: number | null = null
let blinkTimer: number | null = null
let breathingTimer: number | null = null
let mixers: any[] = []
let mouseDown = false
let previousMousePosition = { x: 0, y: 0 }
let targetRotation = 0
let currentRotation = 0
let needsRender = true
let isAnimating = false
let animationFrameTimeout: number | null = null
let isInitialized = false
let lastFrameTime = 0
let frameCount = 0

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

const progressOffset = computed(() => {
  const circumference = 2 * Math.PI * 45
  return circumference - (loadProgress.value / 100) * circumference
})

const currentExpressionName = computed(() => {
  const expr = expressions.find(e => e.id === currentExpression.value)
  return expr?.name || '自然'
})

const getQualitySettings = () => {
  const level = performanceLevel.value
  
  switch (level) {
    case 'high':
      return {
        antialias: true,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        shadowQuality: 'high',
        animationFrameRate: 60
      }
    case 'medium':
      return {
        antialias: true,
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        shadowQuality: 'medium',
        animationFrameRate: 45
      }
    case 'low':
    default:
      return {
        antialias: false,
        pixelRatio: Math.min(window.devicePixelRatio, 1),
        shadowQuality: 'low',
        animationFrameRate: 30
      }
  }
}

const initScene = async () => {
  if (!canvasRef.value || isInitialized) return
  
  const canvas = canvasRef.value
  const container = canvas.parentElement
  if (!container) return
  
  const width = container.clientWidth || 360
  const height = container.clientHeight || 480
  const quality = getQualitySettings()
  
  try {
    const result = await deepProfiler.profileStage('init-scene', '场景初始化', '初始化Three.js渲染场景', async () => {
      return createScene(canvas, width, height, quality.pixelRatio, quality.antialias)
    })
    
    scene = result.scene
    camera = result.camera
    renderer = result.renderer
    
    lastFrameTime = performance.now()
    isInitialized = true
    startRendering()
    
  } catch (error) {
    console.error('Failed to initialize scene:', error)
    hasError.value = true
    errorMessage.value = `场景初始化失败: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

const startRendering = () => {
  const quality = getQualitySettings()
  const targetFrameTime = 1000 / quality.animationFrameRate
  
  const animate = () => {
    animationId = requestAnimationFrame(animate)
    
    const now = performance.now()
    const deltaTime = now - lastFrameTime
    frameCount++
    
    if (now - lastFrameTime >= 1000) {
      currentFrameRate.value = Math.round((frameCount * 1000) / (now - lastFrameTime))
      frameCount = 0
      lastFrameTime = now
    }
    
    if (deltaTime >= targetFrameTime && needsRender) {
      renderFrame(deltaTime / 1000)
      lastFrameTime = now
      needsRender = isAnimating || mouseDown
    }
  }
  
  animationId = requestAnimationFrame(animate)
}

const renderFrame = (delta: number) => {
  if (!renderer || !scene || !camera) return
  
  if (vrm) {
    currentRotation += (targetRotation - currentRotation) * 0.1
    vrm.scene.rotation.y = currentRotation
    
    if (isSpeaking.value) {
      vrm.scene.position.y = Math.sin(Date.now() * 0.01) * 0.02
    } else {
      vrm.scene.position.y = Math.sin(Date.now() * 0.005) * 0.01
    }
    
    if (mixers.length > 0) {
      mixers.forEach(mixer => mixer.update(delta))
    }
    
    if (vrm.expressionManager) {
      applyExpression()
    }
  }
  
  renderer.render(scene, camera)
}

const setNeedsRender = () => {
  needsRender = true
  if (animationFrameTimeout) {
    clearTimeout(animationFrameTimeout)
  }
  
  animationFrameTimeout = window.setTimeout(() => {
    if (!isAnimating && !mouseDown) {
      needsRender = false
    }
  }, 2000)
}

const loadVRM = async (url: string) => {
  try {
    const startTime = performance.now()
    
    const cached = modelCache.get(url)
    if (cached) {
      deepProfiler.recordStage('cache-hit', '缓存命中', true, 0, 100)
      loadingStatus.value = '加载缓存...'
      currentStage.value = '缓存命中'
      loadProgress.value = 80
      
      vrm = cached.vrm
      
      if (scene && vrm.scene) {
        scene.add(vrm.scene)
      }
      
      loadProgress.value = 100
      loadingStatus.value = '加载完成'
      
      const endTime = performance.now()
      loadTime.value = Math.round(endTime - startTime)
      initTime.value = loadTime.value
      
      setTimeout(() => {
        modelLoaded.value = true
        isLoading.value = false
        emitPerformanceReport()
      }, 100)
      return
    }
    
    loadingStatus.value = '加载模型...'
    currentStage.value = '下载模型'
    loadProgress.value = 20
    
    let arrayBuffer: ArrayBuffer
    
    await deepProfiler.profileStage('download-model', '模型下载', '从服务器下载VRM模型文件', async () => {
      const task = createVRMLoadTask('vrm-main', url, 'critical', {
        onProgress: (progress: number) => {
          loadProgress.value = 20 + Math.floor(progress * 0.2)
        },
        onComplete: (data: ArrayBuffer, taskId: string) => {
          arrayBuffer = data
        },
        onError: (error: Error, taskId: string) => {
          throw error
        }
      })
      
      tieredLoader.addTask(task)
      
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (tieredLoader.hasResource('vrm-main')) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 50)
      })
    })
    
    loadProgress.value = 40
    currentStage.value = '解析模型'
    loadingStatus.value = '解析模型...'
    
    const parseResult = await deepProfiler.profileStage('parse-model', '模型解析', '解析VRM模型数据', async () => {
      const workerResult = await modelWorkerManager.parseModel(arrayBuffer)
      const scale = performanceLevel.value === 'low' ? 1.2 : VRM_TEMPLATE_CONFIG.scale
      return await loadVRMModel(arrayBuffer, scale)
    })
    
    vrm = parseResult
    
    loadProgress.value = 70
    currentStage.value = '初始化模型'
    loadingStatus.value = '初始化模型...'
    
    await deepProfiler.profileStage('init-model', '模型初始化', '将模型添加到场景并设置动画', async () => {
      scene.add(vrm.scene)
      
      const AnimationMixer = window.AnimationMixer
      const AnimationClip = window.AnimationClip
      
      if (vrm.animation && AnimationMixer) {
        const mixer = new AnimationMixer(vrm.scene)
        const clip = AnimationClip.findByName(vrm.animation, 'Idle') || vrm.animation.clip
        if (clip) {
          const action = mixer.clipAction(clip)
          action.play()
          mixers.push(mixer)
        }
      }
    })
    
    modelCache.set(url, vrm, arrayBuffer.byteLength)
    
    loadProgress.value = 90
    currentStage.value = '准备就绪'
    loadingStatus.value = '准备就绪...'
    
    const endTime = performance.now()
    loadTime.value = Math.round(endTime - startTime)
    initTime.value = loadTime.value
    
    setTimeout(() => {
      loadProgress.value = 100
      loadingStatus.value = '加载完成'
      modelLoaded.value = true
      isLoading.value = false
      emitPerformanceReport()
    }, 300)
    
  } catch (error) {
    console.error('Failed to load VRM:', error)
    hasError.value = true
    isLoading.value = false
    errorMessage.value = `模型加载失败: ${error instanceof Error ? error.message : 'Unknown error'}`
    emit('modelLoad', false, { error })
  }
}

const emitPerformanceReport = () => {
  const deepReport = deepProfiler.getReport()
  const cacheStats = modelCache.getStats()
  const shaderStats = shaderPrecompiler.getCompilationStats()
  
  const report = {
    initTime: initTime.value,
    loadTime: loadTime.value,
    frameRate: currentFrameRate.value,
    deviceLevel: performanceLevel.value,
    cacheHit: cacheStats.hits > 0,
    deepReport,
    cacheStats,
    shaderStats,
    timestamp: Date.now()
  }
  
  emit('modelLoad', true, report)
  emit('initComplete', deepReport)
  emit('performanceUpdate', report)
}

const applyExpression = () => {
  if (!vrm?.expressionManager) return
  
  const expressionWeights: Record<string, number> = {
    neutral: 0,
    happy: 0,
    smile: 0,
    surprised: 0,
    thinking: 0,
    sad: 0,
    angry: 0,
    sleepy: 0,
    blink: 0
  }
  
  expressionWeights[currentExpression.value] = 1
  
  Object.keys(expressionWeights).forEach(name => {
    const expr = vrm.expressionManager.getExpression(name)
    if (expr) {
      expr.setValue(expressionWeights[name])
    }
  })
  
  vrm.expressionManager.update()
  setNeedsRender()
}

const setExpression = (expr: string) => {
  if (isLoading.value && !modelLoaded.value) return
  
  currentExpression.value = expr
  emit('expressionChange', expr)
  setNeedsRender()
  
  if (expr === 'surprised') {
    setTimeout(() => {
      if (currentExpression.value === 'surprised') {
        setExpression('neutral')
      }
    }, 3000)
  }
}

const startBlinking = () => {
  blinkTimer = window.setInterval(() => {
    if (!isLoading.value && !hasError.value && modelLoaded.value && vrm?.expressionManager) {
      const blinkExpr = vrm.expressionManager.getExpression('blink')
      if (blinkExpr) {
        blinkExpr.setValue(1)
        setNeedsRender()
        setTimeout(() => {
          blinkExpr.setValue(0)
          setNeedsRender()
        }, 200)
      }
    }
  }, 4000)
}

const startBreathing = () => {
  breathingTimer = window.setInterval(() => {
    if (modelLoaded.value) {
      isBreathing.value = !isBreathing.value
    }
  }, 2000)
}

const startSpeaking = () => {
  isSpeaking.value = true
  isBreathing.value = false
  isAnimating = true
  setNeedsRender()
}

const stopSpeaking = () => {
  isSpeaking.value = false
  isBreathing.value = true
  isAnimating = false
}

const setEmotion = (emotion: 'positive' | 'neutral' | 'negative') => {
  switch (emotion) {
    case 'positive': setExpression('happy'); break
    case 'negative': setExpression('sad'); break
    default: setExpression('neutral')
  }
}

const onTouchStart = (e: TouchEvent) => {
  mouseDown = true
  previousMousePosition = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY
  }
  isAnimating = true
  setNeedsRender()
}

const onTouchMove = (e: TouchEvent) => {
  if (!mouseDown || !vrm) return
  
  const deltaX = e.touches[0].clientX - previousMousePosition.x
  targetRotation += deltaX * 0.01
  previousMousePosition = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY
  }
  setNeedsRender()
}

const onTouchEnd = () => {
  mouseDown = false
  setTimeout(() => {
    isAnimating = false
  }, 300)
}

const retryLoad = () => {
  hasError.value = false
  isLoading.value = true
  loadProgress.value = 0
  isInitialized = false
  
  if (scene) {
    if (vrm && vrm.scene) {
      scene.remove(vrm.scene)
    }
    vrm = null
    mixers.forEach(mixer => mixer.stopAllAction())
    mixers = []
  }
  
  deepProfiler.reset()
  
  initScene()
  
  if (props.autoLoad) {
    loadVRM(props.modelUrl)
  }
}

const handleResize = () => {
  if (!canvasRef.value || !camera || !renderer) return
  
  const container = canvasRef.value.parentElement
  if (!container) return
  
  const width = container.clientWidth
  const height = container.clientHeight
  
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  setNeedsRender()
}

watch(currentExpression, () => {
  applyExpression()
})

onMounted(async () => {
  deepProfiler.start()
  
  await deepProfiler.profileStage('total-init', '总初始化', '完整初始化流程', async () => {
    await deepProfiler.profileStage('preload-shaders', 'Shader预加载', '预编译WebGL着色器程序', async () => {
      shaderPrecompiler.schedulePrecompile()
    })
    
    await deepProfiler.profileStage('wait-three', '等待Three.js', '等待CDN加载Three.js库', async () => {
      const waitThree = () => {
        return new Promise<void>((resolve) => {
          if (window.THREE) {
            resolve()
          } else {
            window.addEventListener('three-ready', () => resolve(), { once: true })
            setTimeout(resolve, 5000)
          }
        })
      }
      await waitThree()
    })
    
    await nextTick()
    
    await initScene()
    
    if (props.autoLoad && isInitialized) {
      await loadVRM(props.modelUrl)
    }
    
    startBlinking()
    startBreathing()
    
    window.addEventListener('resize', handleResize)
  })
  
  const report = deepProfiler.getReport()
  initTime.value = Math.round(report.totalInitializationTime)
  emit('initComplete', report)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (blinkTimer) {
    clearInterval(blinkTimer)
  }
  if (breathingTimer) {
    clearInterval(breathingTimer)
  }
  if (animationFrameTimeout) {
    clearTimeout(animationFrameTimeout)
  }
  window.removeEventListener('resize', handleResize)
  
  if (vrm) {
    vrm.dispose()
    vrm = null
  }
  
  if (renderer) {
    renderer.dispose()
  }
  
  mixers.forEach(mixer => mixer.stopAllAction())
  mixers = []
  
  modelWorkerManager.dispose()
  
  isInitialized = false
})

defineExpose({ 
  setExpression, 
  startSpeaking, 
  stopSpeaking, 
  setEmotion,
  loadModel: loadVRM,
  getInitReport: () => deepProfiler.getReport(),
  getCacheStats: () => modelCache.getStats(),
  getShaderStats: () => shaderPrecompiler.getCompilationStats(),
  runBenchmark: (testFn: () => Promise<void>, config?: any) => deepProfiler.runBenchmark(testFn, config),
  retryLoad
})
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

.avatar-canvas {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
  transition: all 0.3s ease;

  &.avatar-loading {
    opacity: 0.8;
  }
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
  margin-bottom: 8rpx;
}

.performance-info {
  background: rgba(147, 112, 219, 0.1);
  padding: 8rpx 16rpx;
  border-radius: 12rpx;
}

.perf-text {
  font-size: 20rpx;
  color: #666;
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
  max-width: 160rpx;
  text-align: center;
  word-break: break-all;
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

.performance-panel {
  display: flex;
  gap: 24rpx;
  margin-top: 12rpx;
  padding: 12rpx 20rpx;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 16rpx;
}

.perf-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.perf-label {
  font-size: 20rpx;
  color: #999;
}

.perf-value {
  font-size: 24rpx;
  font-weight: 600;
  color: #333;
}
</style>
