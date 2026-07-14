<template>
  <view class="ar-page">
    <!-- 摄像头容器（全屏，AR模块在此挂载video和叠加层） -->
    <view id="ar-camera-container" class="camera-container"></view>

    <!-- 顶部栏 -->
    <view class="top-bar">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="top-title">{{ currentLang === 'zh' ? 'AR实景识别' : 'AR Recognition' }}</text>
      <view class="model-switcher">
        <picker
          mode="selector"
          :range="recognitionModelNames"
          @change="onModelChange('recognition', $event)"
          class="model-picker"
        >
          <view class="picker-display">
            <text class="picker-label">{{ currentLang === 'zh' ? '识别' : 'Recognize' }}</text>
            <text class="picker-value">{{ currentRecognitionModelName }}</text>
          </view>
        </picker>
        <picker
          mode="selector"
          :range="qaModelNames"
          @change="onModelChange('qa', $event)"
          class="model-picker"
        >
          <view class="picker-display">
            <text class="picker-label">{{ currentLang === 'zh' ? '问答' : 'Q&A' }}</text>
            <text class="picker-value">{{ currentQaModelName }}</text>
          </view>
        </picker>
        <picker
          mode="selector"
          :range="ttsModelNames"
          @change="onModelChange('tts', $event)"
          class="model-picker"
        >
          <view class="picker-display">
            <text class="picker-label">{{ currentLang === 'zh' ? '语音' : 'Voice' }}</text>
            <text class="picker-value">{{ currentTtsModelName }}</text>
          </view>
        </picker>
      </view>
      <view class="perf-toggle" @click="showPerfMonitor = !showPerfMonitor">
        <text class="perf-score" :class="{ good: healthScore >= 70, warn: healthScore >= 40 && healthScore < 70, bad: healthScore < 40 }">{{ healthScore }}</text>
      </view>
    </view>

    <!-- 状态提示 -->
    <view class="status-tip" v-if="showStatusTip">
      <text class="status-text">{{ statusText }}</text>
    </view>

    <!-- 问答回答面板 -->
    <view class="qa-panel" v-if="qaAnswer || isWaitingAnswer">
      <view class="qa-panel-header">
        <text class="qa-panel-title">{{ currentLang === 'zh' ? 'AI回答' : 'AI Answer' }}</text>
        <view class="qa-panel-close" @click="clearAnswer">
          <text class="close-icon">×</text>
        </view>
      </view>
      <scroll-view class="qa-scroll" scroll-y>
        <text class="qa-answer-text" v-if="qaAnswer">{{ qaAnswer }}</text>
        <view class="qa-loading" v-else>
          <view class="loading-dot"></view>
          <view class="loading-dot"></view>
          <view class="loading-dot"></view>
        </view>
      </scroll-view>
    </view>

    <!-- AI增强工具栏 -->
    <view class="ai-enhance-bar" v-if="currentSpot">
      <view class="ai-btn" :class="{ active: aiEnhancePanel === 'smart', error: aiEnhancePanel === 'smart' && aiErrorState }" @click="triggerSmartRecognize">
        <text class="ai-btn-icon">🔍</text>
        <text class="ai-btn-label">{{ currentLang === 'zh' ? '智能识别' : 'Smart' }}</text>
        <view class="ai-btn-loading" v-if="isSmartRecognizing"></view>
      </view>
      <view class="ai-btn" :class="{ active: aiEnhancePanel === 'scene', error: aiEnhancePanel === 'scene' && aiErrorState }" @click="triggerSceneUnderstand">
        <text class="ai-btn-icon">🎨</text>
        <text class="ai-btn-label">{{ currentLang === 'zh' ? '场景生成' : 'Scene' }}</text>
        <view class="ai-btn-loading" v-if="isGeneratingScene"></view>
      </view>
      <view class="ai-btn" :class="{ active: aiEnhancePanel === 'intent', error: aiEnhancePanel === 'intent' && aiErrorState }" @click="triggerIntentPredict">
        <text class="ai-btn-icon">🧠</text>
        <text class="ai-btn-label">{{ currentLang === 'zh' ? '意图预测' : 'Intent' }}</text>
        <view class="ai-btn-loading" v-if="isPredictingIntent"></view>
      </view>
      <view class="ai-net-status" v-if="!isOnline">
        <text class="net-dot"></text>
      </view>
    </view>

    <!-- AI增强结果面板 -->
    <view class="ai-panel" v-if="aiEnhancePanel !== 'none'">
      <view class="ai-panel-header">
        <text class="ai-panel-title">
          {{ aiEnhancePanel === 'smart' ? (currentLang === 'zh' ? '智能识别结果' : 'Smart Recognition')
           : aiEnhancePanel === 'scene' ? (currentLang === 'zh' ? '场景内容' : 'Scene Content')
           : (currentLang === 'zh' ? '意图预测' : 'Intent Prediction') }}
        </text>
        <text class="ai-cache-badge" v-if="aiCachedResult">{{ currentLang === 'zh' ? '缓存' : 'Cached' }}</text>
        <view class="ai-panel-close" @click="closeAiPanel">
          <text class="close-icon">×</text>
        </view>
      </view>
      <scroll-view class="ai-panel-scroll" scroll-y>
        <!-- 错误状态 + 重试按钮 -->
        <view class="ai-error-state" v-if="aiErrorState">
          <text class="ai-error-icon">⚠</text>
          <text class="ai-error-msg">{{ aiErrorState }}</text>
          <view class="ai-retry-btn" @click="retryAiAction">
            <text class="ai-retry-text">{{ currentLang === 'zh' ? '重试' : 'Retry' }}</text>
          </view>
        </view>
        <!-- 骨架屏加载（AI分析中） -->
        <view class="ai-skeleton" v-else-if="(aiEnhancePanel === 'smart' && isSmartRecognizing) || (aiEnhancePanel === 'scene' && isGeneratingScene) || (aiEnhancePanel === 'intent' && isPredictingIntent)">
          <view class="skeleton-line skeleton-wide"></view>
          <view class="skeleton-line"></view>
          <view class="skeleton-line skeleton-short"></view>
          <view class="skeleton-line skeleton-wide"></view>
          <view class="skeleton-line"></view>
          <view class="ai-loading">
            <view class="loading-dot"></view>
            <view class="loading-dot"></view>
            <view class="loading-dot"></view>
            <text class="ai-loading-text">{{ currentLang === 'zh' ? 'AI分析中...' : 'AI analyzing...' }}</text>
          </view>
        </view>
        <!-- 智能识别结果 -->
        <view v-else-if="aiEnhancePanel === 'smart' && smartRecognizeResult" class="ai-panel-body">
          <view class="ai-section" v-if="smartRecognizeResult.scene_summary">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '场景描述' : 'Scene' }}</text>
            <text class="ai-section-text">{{ smartRecognizeResult.scene_summary }}</text>
          </view>
          <view class="ai-section" v-for="(obj, i) in smartRecognizeResult.objects" :key="i">
            <text class="ai-section-label">{{ obj.name }} ({{ obj.type }})</text>
            <text class="ai-section-text">{{ obj.description }}</text>
            <text class="ai-section-sub" v-if="obj.knowledge">{{ obj.knowledge }}</text>
          </view>
          <view class="ai-section" v-if="smartRecognizeResult.recommended_actions?.length">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '推荐动作' : 'Actions' }}</text>
            <view class="ai-tags">
              <text class="ai-tag" v-for="(act, i) in smartRecognizeResult.recommended_actions" :key="i">{{ act }}</text>
            </view>
          </view>
        </view>
        <!-- 场景内容生成结果 -->
        <view v-else-if="aiEnhancePanel === 'scene' && sceneContent" class="ai-panel-body">
          <view class="ai-section" v-if="sceneContent.narration">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '解说文案' : 'Narration' }}</text>
            <text class="ai-section-text">{{ sceneContent.narration }}</text>
          </view>
          <view class="ai-section" v-if="sceneContent.cultural_context">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '文化背景' : 'Culture' }}</text>
            <text class="ai-section-text">{{ sceneContent.cultural_context }}</text>
          </view>
          <view class="ai-section" v-if="sceneContent.recommended_route">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '推荐路线' : 'Route' }}</text>
            <text class="ai-section-text">{{ sceneContent.recommended_route }}</text>
          </view>
          <view class="ai-section" v-if="sceneContent.interaction_suggestions?.length">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '互动建议' : 'Suggestions' }}</text>
            <view class="ai-tags">
              <text class="ai-tag" v-for="(s, i) in sceneContent.interaction_suggestions" :key="i">{{ s }}</text>
            </view>
          </view>
        </view>
        <!-- 意图预测结果 -->
        <view v-else-if="aiEnhancePanel === 'intent' && intentPrediction" class="ai-panel-body">
          <view class="ai-section">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '预测意图' : 'Intent' }}</text>
            <text class="ai-section-text">{{ intentPrediction.predicted_intent }}</text>
            <text class="ai-section-sub">{{ currentLang === 'zh' ? '置信度' : 'Confidence' }}: {{ (intentPrediction.confidence * 100).toFixed(0) }}%</text>
          </view>
          <view class="ai-section" v-if="intentPrediction.personalized_tip">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '个性化提示' : 'Tip' }}</text>
            <text class="ai-section-text">{{ intentPrediction.personalized_tip }}</text>
          </view>
          <view class="ai-section" v-if="intentPrediction.suggestions?.length">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '推荐建议' : 'Suggestions' }}</text>
            <view class="suggestion-list">
              <view class="suggestion-item" v-for="(s, i) in intentPrediction.suggestions" :key="i" @click="executeSuggestion(s)">
                <text class="suggestion-icon">{{ s.type === 'guide' ? '🎧' : s.type === 'navigate' ? '🧭' : s.type === 'qa' ? '💬' : '📷' }}</text>
                <view class="suggestion-content">
                  <text class="suggestion-title">{{ s.title }}</text>
                  <text class="suggestion-action">{{ s.action }}</text>
                </view>
                <text class="suggestion-arrow">›</text>
              </view>
            </view>
          </view>
          <view class="ai-section" v-if="intentPrediction.next_spot">
            <text class="ai-section-label">{{ currentLang === 'zh' ? '推荐下一景点' : 'Next Spot' }}</text>
            <text class="ai-section-text">{{ intentPrediction.next_spot }}</text>
          </view>
        </view>
        <!-- 空状态 -->
        <view class="ai-empty-state" v-else>
          <text class="ai-empty-text">{{ currentLang === 'zh' ? '暂无数据' : 'No data' }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 底部栏 -->
    <view class="bottom-bar">
      <input
        class="qa-input"
        v-model="qaInput"
        :placeholder="currentSpot ? (currentLang === 'zh' ? `问问关于${currentSpot.spotName}的问题...` : `Ask about ${currentSpot.spotName}...`) : (currentLang === 'zh' ? '先识别景点再提问...' : 'Recognize a spot first...')"
        confirm-type="send"
        @confirm="sendQuestion"
      />
      <view class="action-btn" :class="{ active: isPlayingTTS }" @click="toggleTTS">
        <text class="btn-icon">{{ isPlayingTTS ? '⏹' : '🔊' }}</text>
      </view>
      <view class="action-btn capture-btn" @click="captureAndRecognize">
        <text class="btn-icon">📸</text>
      </view>
    </view>

    <!-- 权限引导遮罩层 -->
    <view class="permission-mask" v-if="showPermissionGuide">
      <view class="permission-card">
        <text class="permission-icon">📷</text>
        <text class="permission-title">{{ currentLang === 'zh' ? '开启AR实景识别' : 'Start AR Recognition' }}</text>
        <text class="permission-desc">
          {{ currentLang === 'zh' ? '本功能需要使用您的摄像头权限，用于实时识别您面前的景点并提供智能导览服务。您的画面数据仅用于本次识别，不会被保存。' : 'This feature requires camera access to recognize scenic spots in real time and provide smart guidance. Your camera data is used only for this session and is never saved.' }}
        </text>
        <view class="permission-btn" @click="startAR">
          <text class="permission-btn-text">{{ currentLang === 'zh' ? '开启AR' : 'Start AR' }}</text>
        </view>
        <view class="permission-deny" @click="goBack">
          <text class="deny-text">{{ currentLang === 'zh' ? '暂不使用' : 'Not Now' }}</text>
        </view>
      </view>
    </view>

    <!-- 错误提示 -->
    <view class="error-toast" v-if="errorMessage" @click="errorMessage = ''">
      <text class="error-text">{{ errorMessage }}</text>
    </view>

    <!-- 拍照闪屏效果 -->
    <view class="flash-overlay" v-if="showFlash"></view>

    <!-- 性能监控浮层 -->
    <view class="perf-monitor" v-if="showPerfMonitor">
      <view class="perf-header">
        <text class="perf-title">{{ currentLang === 'zh' ? 'AR性能监控' : 'AR Performance' }}</text>
        <view class="perf-close" @click="showPerfMonitor = false">
          <text class="perf-close-icon">×</text>
        </view>
      </view>
      <view class="perf-grid">
        <view class="perf-item">
          <text class="perf-label">FPS</text>
          <text class="perf-value" :class="{ warn: perfMetrics.fps < 20 }">{{ perfMetrics.fps.toFixed(1) }}</text>
        </view>
        <view class="perf-item">
          <text class="perf-label">{{ currentLang === 'zh' ? '识别延迟' : 'Latency' }}</text>
          <text class="perf-value" :class="{ warn: perfMetrics.recognitionLatency > 3000 }">{{ perfMetrics.recognitionLatency.toFixed(0) }}ms</text>
        </view>
        <view class="perf-item">
          <text class="perf-label">{{ currentLang === 'zh' ? '内存' : 'Memory' }}</text>
          <text class="perf-value" :class="{ warn: perfMetrics.memoryUsage > 200 }">{{ perfMetrics.memoryUsage.toFixed(0) }}MB</text>
        </view>
        <view class="perf-item">
          <text class="perf-label">{{ currentLang === 'zh' ? '成功率' : 'Success' }}</text>
          <text class="perf-value" :class="{ warn: perfMetrics.requestSuccessRate < 0.8 }">{{ (perfMetrics.requestSuccessRate * 100).toFixed(0) }}%</text>
        </view>
        <view class="perf-item">
          <text class="perf-label">{{ currentLang === 'zh' ? '健康分' : 'Health' }}</text>
          <text class="perf-value" :class="{ warn: healthScore < 50 }">{{ healthScore }}</text>
        </view>
        <view class="perf-item">
          <text class="perf-label">{{ currentLang === 'zh' ? '恢复次数' : 'Recovery' }}</text>
          <text class="perf-value">{{ recoveryCount }}</text>
        </view>
      </view>
      <view class="perf-session">
        <text class="session-label">{{ currentLang === 'zh' ? '会话状态:' : 'Session:' }}</text>
        <text class="session-value">{{ sessionState }}</text>
      </view>
    </view>

    <!-- 资源加载进度 -->
    <view class="resource-loading" v-if="resourceProgress > 0 && resourceProgress < 100">
      <view class="loading-bar">
        <view class="loading-fill" :style="{ width: resourceProgress + '%' }"></view>
      </view>
      <text class="loading-text">{{ currentLang === 'zh' ? '资源加载' : 'Loading' }} {{ resourceProgress }}%</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ARCameraComposer } from '@/ar/ARCameraComposer'
import { ARSceneRecognizer } from '@/ar/ARSceneRecognizer'
import { AROverlayRenderer } from '@/ar/AROverlayRenderer'
import { ARKnowledgeLinker } from '@/ar/ARKnowledgeLinker'
import { ARQaBridge } from '@/ar/ARQaBridge'
import { ARExitManager } from '@/ar/ARExitManager'
import { ARDeviceAdapter } from '@/ar/ARDeviceAdapter'
import { ARPerformanceMonitor } from '@/ar/ARPerformanceMonitor'
import { ARResourceLoader } from '@/ar/ARResourceLoader'
import { ARSessionManager } from '@/ar/ARSessionManager'
import { ARWebGLRenderer } from '@/ar/ARWebGLRenderer'
import { ARSmartRecognizer } from '@/ar/ARSmartRecognizer'
import { ARSceneGenerator } from '@/ar/ARSceneGenerator'
import { ARIntentPredictor } from '@/ar/ARIntentPredictor'
import type { SessionState } from '@/ar/ARSessionManager'
import { aiScheduler } from '@/ai/AIScheduler'
import { ttsEngine } from '@/utils/ttsEngine'
import { currentLang } from '@/i18n'
import type { ARRecognitionResult, AROverlayCard, SmartRecognizeResult, SceneContent, IntentPrediction } from '@/ar/types'
import type { AIModelConfig, AIRole } from '@/ai/types'

// ==================== AR 模块实例（非响应式） ====================
let exitManager: ARExitManager
let cameraComposer: ARCameraComposer
let recognizer: ARSceneRecognizer
let overlayRenderer: AROverlayRenderer
let knowledgeLinker: ARKnowledgeLinker
let qaBridge: ARQaBridge
let deviceAdapter: ARDeviceAdapter
let perfMonitor: ARPerformanceMonitor
let resourceLoader: ARResourceLoader
let sessionManager: ARSessionManager
let webglRenderer: ARWebGLRenderer
let smartRecognizer: ARSmartRecognizer
let sceneGenerator: ARSceneGenerator
let intentPredictor: ARIntentPredictor
let perfTimer: ReturnType<typeof setInterval> | null = null

// ==================== 响应式状态 ====================
const arStatus = ref<'idle' | 'loading' | 'recognizing' | 'recognized' | 'error'>('idle')
const currentSpot = ref<ARRecognitionResult | null>(null)
const overlayCards = ref<AROverlayCard[]>([])
const qaAnswer = ref('')
const qaInput = ref('')
const isPlayingTTS = ref(false)
const isWaitingAnswer = ref(false)
const showPermissionGuide = ref(true)
const showFlash = ref(false)
const errorMessage = ref('')
const modelsByRole = ref<Record<AIRole, AIModelConfig[]>>({
  recognition: [],
  qa: [],
  tts: []
})
const selectedModels = ref<Record<AIRole, number | null>>({
  recognition: null,
  qa: null,
  tts: null
})
const healthScore = ref(100)
const perfMetrics = ref({ fps: 0, recognitionLatency: 0, memoryUsage: 0, requestSuccessRate: 1, cpuLoadEstimate: 0 })
const showPerfMonitor = ref(false)
const sessionState = ref<SessionState>('created')
const resourceProgress = ref(0)
const recoveryCount = ref(0)

// ===== AI增强AR功能状态 =====
const smartRecognizeResult = ref<SmartRecognizeResult | null>(null)
const sceneContent = ref<SceneContent | null>(null)
const intentPrediction = ref<IntentPrediction | null>(null)
const isSmartRecognizing = ref(false)
const isGeneratingScene = ref(false)
const isPredictingIntent = ref(false)
const aiEnhancePanel = ref<'none' | 'smart' | 'scene' | 'intent'>('none')
// AI增强错误状态和缓存标识
const aiErrorState = ref<string>('')
const aiCachedResult = ref(false)
const isOnline = ref(navigator.onLine)

// ==================== 计算属性 ====================
const recognitionModelNames = computed(() =>
  modelsByRole.value.recognition.map(m => m.name)
)
const qaModelNames = computed(() =>
  modelsByRole.value.qa.map(m => m.name)
)
const ttsModelNames = computed(() =>
  modelsByRole.value.tts.map(m => m.name)
)
const currentRecognitionModelName = computed(() => {
  const m = modelsByRole.value.recognition.find(m => m.id === selectedModels.value.recognition)
  return m?.name || (currentLang.value === 'zh' ? '未选择' : 'None')
})
const currentQaModelName = computed(() => {
  const m = modelsByRole.value.qa.find(m => m.id === selectedModels.value.qa)
  return m?.name || (currentLang.value === 'zh' ? '未选择' : 'None')
})
const currentTtsModelName = computed(() => {
  const m = modelsByRole.value.tts.find(m => m.id === selectedModels.value.tts)
  return m?.name || (currentLang.value === 'zh' ? '未选择' : 'None')
})

const showStatusTip = computed(() => {
  return arStatus.value === 'loading' || arStatus.value === 'recognizing' || arStatus.value === 'error'
})

const statusText = computed(() => {
  const isZh = currentLang.value === 'zh'
  switch (arStatus.value) {
    case 'loading':
      return isZh ? '正在启动摄像头...' : 'Starting camera...'
    case 'recognizing':
      return currentSpot.value ? '' : (isZh ? '正在识别场景...请将摄像头对准景点' : 'Recognizing... Point camera at a landmark')
    case 'error':
      return errorMessage.value || (isZh ? '识别异常' : 'Recognition error')
    default:
      return ''
  }
})

// ==================== 生命周期 ====================
onMounted(async () => {
  // 初始化所有 AR 模块
  exitManager = new ARExitManager()
  knowledgeLinker = new ARKnowledgeLinker(exitManager)
  cameraComposer = new ARCameraComposer(exitManager)
  // 网络状态监听
  window.addEventListener('online', () => { isOnline.value = true })
  window.addEventListener('offline', () => { isOnline.value = false })

  overlayRenderer = new AROverlayRenderer({
    onTicket: (_spotId: string) => {
      // 购票 → 打开静态HTML购票页
      try {
        const win = window.open('/static/pages/ticket.html')
        if (!win) {
          uni.showToast({
            title: currentLang.value === 'zh' ? '请允许弹窗以打开购票页' : 'Please allow popups',
            icon: 'none',
            duration: 2500
          })
        }
      } catch (err) {
        console.error('[AR] 购票页打开失败:', err)
        uni.showToast({
          title: currentLang.value === 'zh' ? '购票页打开失败' : 'Failed to open ticket page',
          icon: 'none',
          duration: 2500
        })
      }
    },
    onNavigate: (_spotId: string) => {
      // 导航 → 跳转导航页
      navigateWithFeedback('/pages/visitor/navigation')
    },
    onDetail: (spotId: string) => {
      // 详情 → 跳转景点详情页
      navigateWithFeedback(`/pages/visitor/spot-detail?id=${spotId}`)
    },
    onGuide: (spotId: string) => {
      // 导览 → 跳转 AI 对话页，携带景点上下文
      navigateWithFeedback(`/pages/visitor/chat?spotId=${spotId}`)
    }
  })

  recognizer = new ARSceneRecognizer(cameraComposer, knowledgeLinker, exitManager)
  qaBridge = new ARQaBridge(knowledgeLinker, exitManager)

  // 预加载知识库（离线可用）
  knowledgeLinker.preloadAll()

  // 加载 AI 模型列表
  try {
    await aiScheduler.loadModels()
    loadModelsByRole()
  } catch (err) {
    console.warn('[AR页面] AI模型加载失败:', err)
  }

  // 初始化设备适配器
  deviceAdapter = new ARDeviceAdapter()

  // P2.1+P2.2：初始化WebGL 3D叠加渲染器
  webglRenderer = new ARWebGLRenderer()

  // 初始化AI增强AR模块
  smartRecognizer = new ARSmartRecognizer(exitManager)
  sceneGenerator = new ARSceneGenerator(exitManager)
  intentPredictor = new ARIntentPredictor(exitManager)

  // 初始化性能监控器
  perfMonitor = new ARPerformanceMonitor()
  perfMonitor.onAlert((event) => {
    console.warn(`[AR性能预警] ${event.type}:`, event.metrics)
    // FPS过低时自动降低渲染质量
    if (event.type === 'fps' && event.metrics.fps < 15) {
      uni.showToast({ title: currentLang.value === 'zh' ? '性能较低，已降级渲染' : 'Low performance, reduced quality', icon: 'none', duration: 1500 })
    }
  })

  // 初始化资源加载器
  resourceLoader = new ARResourceLoader(exitManager)

  // 初始化会话管理器
  sessionManager = new ARSessionManager()
  sessionManager.onStateChange((state) => {
    sessionState.value = state
    if (state === 'paused') {
      recognizer?.stopRecognizing()
    } else if (state === 'resumed') {
      recognizer?.startRecognizing(handleRecognition)
    }
  })
  sessionManager.onError((error) => {
    console.error('[AR会话异常]', error)
    recoveryCount.value = sessionManager.getRecoveryCount()
    if (recoveryCount.value >= 3) {
      errorMessage.value = currentLang.value === 'zh' ? 'AR功能多次异常，建议重启页面' : 'AR errors detected. Please restart the page.'
      setTimeout(() => { errorMessage.value = '' }, 4000)
    }
  })

  // 注入性能监控到退出管理器
  exitManager.setPerformanceMonitor(perfMonitor)

  // 启动性能监控
  perfMonitor.start()

  // 启动会话
  sessionManager.start()

  // 预加载景点图片资源（异步，不阻塞）
  resourceLoader.preloadSpotImages([]).then(() => {
    resourceProgress.value = 100
  }).catch(() => {})

  // 定时更新资源加载进度
  const resTimer = setInterval(() => {
    try {
      const progress = resourceLoader?.getLoadProgress()
      if (!progress) {
        clearInterval(resTimer)
        return
      }
      resourceProgress.value = progress.percentage
      if (progress.percentage >= 100 || progress.total === 0) {
        clearInterval(resTimer)
      }
    } catch {
      clearInterval(resTimer)
    }
  }, 300)

  // 定时更新性能指标显示 + P2.3光照同步
  perfTimer = setInterval(() => {
    const metrics = perfMonitor.getMetrics()
    perfMetrics.value = metrics
    healthScore.value = perfMonitor.getHealthScore()
    // P2.3：每2秒同步光照估计到WebGL场景
    if (webglRenderer && cameraComposer) {
      const lightEstimate = cameraComposer.getLightEstimate()
      webglRenderer.updateLighting(lightEstimate)
    }
  }, 2000)
})

onUnmounted(async () => {
  // 停止性能监控
  perfMonitor?.stop()
  // 销毁会话
  sessionManager?.destroy()
  // 清理资源加载器缓存
  resourceLoader?.clearCache()
  // 清除性能定时器
  if (perfTimer) clearInterval(perfTimer)
  // 停止识别循环
  recognizer?.stopRecognizing()
  // 中断问答请求
  qaBridge?.destroy()
  // 销毁AI增强模块
  smartRecognizer?.destroy()
  sceneGenerator?.destroy()
  intentPredictor?.destroy()
  // 停止摄像头
  cameraComposer?.stop()
  // 清理叠加层DOM
  overlayRenderer?.unmount()
  // P2.1：清理WebGL 3D渲染器
  webglRenderer?.unmount()
  // 停止语音播放
  ttsEngine.stop()
  // 回收所有AR资源（500ms超时保护）
  await exitManager?.disposeAll()
  // 清理AI调度器（销毁所有Provider）
  aiScheduler.destroyAll()
})

// ==================== 核心方法 ====================

/**
 * 启动AR：请求摄像头权限 → 挂载叠加层 → 启动识别循环
 */
const startAR = async () => {
  showPermissionGuide.value = false
  arStatus.value = 'loading'

  try {
    // 检查摄像头支持
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前环境不支持摄像头访问，请确保使用HTTPS环境')
    }

    // 挂载DOM叠加层（标签层和卡片层）
    overlayRenderer.mount('ar-camera-container')
    overlayRenderer.enableGesture()

    // P2.1+P2.2：挂载WebGL 3D叠加层（在video和DOM标签之间）
    webglRenderer.mount('ar-camera-container')

    // 启动摄像头流（getUserMedia + 挂载video元素）
    await cameraComposer.start('ar-camera-container')

    // 启动定时识别循环
    arStatus.value = 'recognizing'
    recognizer.startRecognizing(handleRecognition)
  } catch (err) {
    const msg = (err as Error).message || ''
    const isZh = currentLang.value === 'zh'
    if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
      errorMessage.value = isZh ? '摄像头权限被拒绝，请在浏览器设置中允许访问后重试' : 'Camera permission denied. Please allow access in browser settings.'
    } else if (msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
      errorMessage.value = isZh ? '未检测到摄像头设备' : 'No camera device found'
    } else if (msg.includes('NotReadable') || msg.includes('TrackStartError')) {
      errorMessage.value = isZh ? '摄像头被其他应用占用，请关闭后重试' : 'Camera is in use by another app. Please close and retry.'
    } else {
      errorMessage.value = msg || (isZh ? '摄像头启动失败' : 'Camera startup failed')
    }
    arStatus.value = 'error'
    showPermissionGuide.value = true
    setTimeout(() => { errorMessage.value = '' }, 4000)
  }
}

/**
 * AI增强场景a：智能物体识别
 * 捕获当前画面，发送到AI视觉模型识别画面中的物体和景观元素。
 */
const triggerSmartRecognize = async () => {
  if (isSmartRecognizing.value) return
  const isZh = currentLang.value === 'zh'
  if (!isOnline.value) {
    aiErrorState.value = isZh ? '网络未连接，请检查网络后重试' : 'No network connection'
    aiEnhancePanel.value = 'smart'
    return
  }
  aiErrorState.value = ''
  aiCachedResult.value = false
  try {
    const frame = cameraComposer?.captureFrame()
    if (!frame) {
      aiErrorState.value = isZh ? '画面捕获失败，请稍后重试' : 'Frame capture failed'
      aiEnhancePanel.value = 'smart'
      return
    }
    // 去除 data:image/jpeg;base64, 前缀
    const imageBase64 = frame.replace(/^data:image\/\w+;base64,/, '')
    isSmartRecognizing.value = true
    aiEnhancePanel.value = 'smart'
    const result = await smartRecognizer.recognize({
      imageBase64,
      spotId: currentSpot.value?.spotId
    })
    smartRecognizeResult.value = result
    aiCachedResult.value = smartRecognizer?.wasFromCache() || false
    // 记录用户行为
    intentPredictor?.recordBehavior('smart_recognize', currentSpot.value?.spotId)
  } catch (err) {
    console.error('[AR] 智能识别失败:', err)
    const msg = (err as Error).message
    if (msg.includes('CIRCUIT_OPEN') || msg.includes('503')) {
      aiErrorState.value = isZh ? 'AI服务暂时不可用，正在自动恢复中' : 'AI service temporarily unavailable'
    } else if (msg.includes('RATE_LIMITED') || msg.includes('429')) {
      aiErrorState.value = isZh ? '调用过于频繁，请稍后重试' : 'Too many requests, please wait'
    } else {
      aiErrorState.value = isZh ? '智能识别失败，请重试' : 'Smart recognize failed, please retry'
    }
  } finally {
    isSmartRecognizing.value = false
  }
}

/**
 * AI增强场景b：场景理解与内容生成
 * 基于当前场景生成AR虚拟内容（解说文案、亮点、路线、建议）。
 */
const triggerSceneUnderstand = async () => {
  if (isGeneratingScene.value) return
  const isZh = currentLang.value === 'zh'
  if (!isOnline.value) {
    aiErrorState.value = isZh ? '网络未连接，请检查网络后重试' : 'No network connection'
    aiEnhancePanel.value = 'scene'
    return
  }
  aiErrorState.value = ''
  aiCachedResult.value = false
  try {
    isGeneratingScene.value = true
    aiEnhancePanel.value = 'scene'
    const result = await sceneGenerator.generate({
      spotId: currentSpot.value?.spotId,
      sceneDescription: currentSpot.value?.description || '',
      userPreference: isZh ? '景区导览' : 'scenic tour'
    })
    sceneContent.value = result
    intentPredictor?.recordBehavior('scene_understand', currentSpot.value?.spotId)
  } catch (err) {
    console.error('[AR] 场景理解失败:', err)
    const msg = (err as Error).message
    if (msg.includes('CIRCUIT_OPEN') || msg.includes('503')) {
      aiErrorState.value = isZh ? 'AI服务暂时不可用，正在自动恢复中' : 'AI service temporarily unavailable'
    } else if (msg.includes('RATE_LIMITED') || msg.includes('429')) {
      aiErrorState.value = isZh ? '调用过于频繁，请稍后重试' : 'Too many requests, please wait'
    } else {
      aiErrorState.value = isZh ? '场景理解失败，请重试' : 'Scene understand failed, please retry'
    }
  } finally {
    isGeneratingScene.value = false
  }
}

/**
 * AI增强场景c：用户意图预测
 * 分析用户行为模式，预测意图并提供个性化建议。
 */
const triggerIntentPredict = async () => {
  if (isPredictingIntent.value) return
  const isZh = currentLang.value === 'zh'
  if (!isOnline.value) {
    aiErrorState.value = isZh ? '网络未连接，请检查网络后重试' : 'No network connection'
    aiEnhancePanel.value = 'intent'
    return
  }
  aiErrorState.value = ''
  aiCachedResult.value = false
  try {
    isPredictingIntent.value = true
    aiEnhancePanel.value = 'intent'
    const result = await intentPredictor.predict({
      currentSpot: currentSpot.value?.spotName || ''
    })
    intentPrediction.value = result
    intentPredictor.recordBehavior('intent_predict', currentSpot.value?.spotId)
  } catch (err) {
    console.error('[AR] 意图预测失败:', err)
    const msg = (err as Error).message
    if (msg.includes('CIRCUIT_OPEN') || msg.includes('503')) {
      aiErrorState.value = isZh ? 'AI服务暂时不可用，正在自动恢复中' : 'AI service temporarily unavailable'
    } else if (msg.includes('RATE_LIMITED') || msg.includes('429')) {
      aiErrorState.value = isZh ? '调用过于频繁，请稍后重试' : 'Too many requests, please wait'
    } else {
      aiErrorState.value = isZh ? '意图预测失败，请重试' : 'Intent predict failed, please retry'
    }
  } finally {
    isPredictingIntent.value = false
  }
}

/** 关闭AI增强面板 */
const closeAiPanel = () => {
  aiEnhancePanel.value = 'none'
  aiErrorState.value = ''
}

/** 重试当前AI增强功能 */
const retryAiAction = () => {
  aiErrorState.value = ''
  if (aiEnhancePanel.value === 'smart') {
    triggerSmartRecognize()
  } else if (aiEnhancePanel.value === 'scene') {
    triggerSceneUnderstand()
  } else if (aiEnhancePanel.value === 'intent') {
    triggerIntentPredict()
  }
}

/** 执行意图预测建议的动作 */
const executeSuggestion = (suggestion: { type: string; action: string }) => {
  if (suggestion.type === 'guide') {
    navigateWithFeedback(`/pages/visitor/chat?spotId=${currentSpot.value?.spotId || ''}`)
  } else if (suggestion.type === 'navigate') {
    navigateWithFeedback('/pages/visitor/navigation')
  } else if (suggestion.type === 'qa') {
    // 聚焦到问答输入框
    const input = document.querySelector('.qa-input') as HTMLInputElement
    input?.focus()
  }
  intentPredictor?.recordBehavior(suggestion.type, currentSpot.value?.spotId, suggestion.action)
}

/**
 * 识别结果回调（由ARSceneRecognizer在稳定性确认后调用）
 */
const handleRecognition = (result: ARRecognitionResult | null) => {
  perfMonitor?.recordRecognitionStart()
  if (!result) {
    // 本次未确认识别结果，保持当前状态
    return
  }

  // 识别到景点
  arStatus.value = 'recognized'
  currentSpot.value = result

  // 记录用户行为（供意图预测使用）
  intentPredictor?.recordBehavior('view', result.spotId, result.spotName)

  // 联动知识库（缓存景点完整信息）并获取完整描述
  const knowledgeCtx = knowledgeLinker.linkSpot(result.spotId)

  // 计算叠加标签位置（画面中心偏上）
  const container = document.getElementById('ar-camera-container')
  const rect = container?.getBoundingClientRect()
  const x = rect ? rect.width / 2 : window.innerWidth / 2
  const y = rect ? rect.height / 2 : window.innerHeight / 2

  // 构建叠加卡片数据（携带完整描述供展开卡片展示）
  const isZh = currentLang.value === 'zh'
  const card: AROverlayCard = {
    id: `card-${result.spotId}-${result.timestamp}`,
    spotId: result.spotId,
    spotName: result.spotName,
    shortDesc: result.description || (isZh ? '点击查看详情' : 'Tap for details'),
    fullDesc: knowledgeCtx?.fullDesc || result.description,
    confidence: result.confidence,
    x,
    y,
    visible: true
  }

  overlayCards.value = [card]
  // 渲染DOM悬浮标签（点击标签会自动展开完整卡片）
  overlayRenderer.render([card])

  // P2.1+P2.2：在3D空间中放置锚点标记（发光柱体+旋转光环）
  webglRenderer.addAnchor(result, x, y)

  // P2.3：同步光照估计到WebGL场景
  const lightEstimate = cameraComposer.getLightEstimate()
  webglRenderer.updateLighting(lightEstimate)

  perfMonitor?.recordRecognitionEnd()
}

/**
 * 发送问答请求
 */
const sendQuestion = async () => {
  const question = qaInput.value.trim()
  if (!question) return

  // 记录用户行为（供意图预测使用）
  intentPredictor?.recordBehavior('ask', currentSpot.value?.spotId, question.slice(0, 50))

  if (isWaitingAnswer.value) {
    // 已有请求进行中，先中断
    qaBridge.stop()
  }

  // 清空回答区域
  qaAnswer.value = ''
  isWaitingAnswer.value = true

  // 获取当前画面（可能因节流返回空串，此时不传图片）
  const imageBase64 = cameraComposer?.captureFrame() || null

  // 获取当前识别到的景点ID
  const spotId = currentSpot.value?.spotId ?? null

  try {
    await qaBridge.ask(question, spotId, imageBase64, {
      onChunk: (text: string) => {
        qaAnswer.value += text
      },
      onDone: (result) => {
        // 流式已拼接完毕，若为空则用最终结果兜底
        if (!qaAnswer.value && result.answer) {
          qaAnswer.value = result.answer
        }
        isWaitingAnswer.value = false
        perfMonitor?.recordRequestSuccess(true)
      },
      onError: (err: Error) => {
        isWaitingAnswer.value = false
        perfMonitor?.recordRequestSuccess(false)
        if (!qaAnswer.value) {
          errorMessage.value = currentLang.value === 'zh' ? `问答失败: ${err.message}` : `Q&A failed: ${err.message}`
          setTimeout(() => { errorMessage.value = '' }, 3000)
        }
      }
    })
  } catch (err) {
    isWaitingAnswer.value = false
    errorMessage.value = currentLang.value === 'zh' ? `请求异常: ${(err as Error).message}` : `Request error: ${(err as Error).message}`
    setTimeout(() => { errorMessage.value = '' }, 3000)
  }

  // 清空输入框
  qaInput.value = ''
}

/**
 * 切换语音播报
 */
const toggleTTS = async () => {
  // 正在播放 → 停止
  if (isPlayingTTS.value) {
    ttsEngine.stop()
    isPlayingTTS.value = false
    return
  }

  // 无内容可播放
  if (!qaAnswer.value) {
    errorMessage.value = currentLang.value === 'zh' ? '没有可播放的回答内容' : 'No content to play'
    setTimeout(() => { errorMessage.value = '' }, 2000)
    return
  }

  isPlayingTTS.value = true

  try {
    // 优先使用AI调度层的TTS Provider（受模型切换控制）
    const provider = aiScheduler.getTTSProvider()
    const audioBuffer = await provider.voice_tts(qaAnswer.value)
    ttsEngine.play(audioBuffer)
  } catch (err) {
    console.warn('[AR页面] TTS Provider调用失败，降级到本地TTS代理:', err)
    try {
      // 降级：使用ttsEngine内置的代理合成
      const audio = await ttsEngine.synthesize(qaAnswer.value)
      ttsEngine.play(audio)
    } catch (e) {
      isPlayingTTS.value = false
      errorMessage.value = currentLang.value === 'zh' ? '语音合成失败，请稍后重试' : 'Speech synthesis failed. Please try again later.'
      setTimeout(() => { errorMessage.value = '' }, 3000)
    }
  }
}

/**
 * 拍照识别（手动截帧 + 视觉反馈）
 */
const captureAndRecognize = () => {
  // 闪屏效果
  showFlash.value = true
  setTimeout(() => { showFlash.value = false }, 200)

  // 尝试截取当前帧
  const frame = cameraComposer?.captureFrame()
  if (frame) {
    // 截帧成功，识别循环会在下次迭代中使用
    uni.showToast({ title: currentLang.value === 'zh' ? '画面已捕获' : 'Frame captured', icon: 'success', duration: 1000 })
  } else {
    uni.showToast({ title: currentLang.value === 'zh' ? '请稍候再试' : 'Please try again', icon: 'none', duration: 1000 })
  }
}

/**
 * 切换AI模型
 */
const onModelChange = (role: AIRole, e: { detail: { value: number } }) => {
  const index = e.detail.value
  const models = modelsByRole.value[role]
  const model = models[index]
  if (!model) return

  try {
    aiScheduler.switchModel(role, model.id)
    selectedModels.value[role] = model.id
    uni.showToast({
      title: currentLang.value === 'zh' ? `${roleText(role)}已切换到${model.name}` : `${roleText(role)} switched to ${model.name}`,
      icon: 'none',
      duration: 1500
    })
  } catch (err) {
    uni.showToast({ title: currentLang.value === 'zh' ? '模型切换失败' : 'Model switch failed', icon: 'none' })
  }
}

/**
 * 清空问答区域
 */
const clearAnswer = () => {
  qaAnswer.value = ''
  isWaitingAnswer.value = false
  qaBridge?.stop()
}

/**
 * 返回上一页
 */
const goBack = () => {
  uni.navigateBack({ delta: 1 })
}

/**
 * 带加载状态和错误反馈的页面导航
 * 修复：原 navigateTo 无错误处理，导航失败时用户无感知。
 * 优化：添加 loading 提示、成功/失败 toast、异常捕获。
 */
const navigateWithFeedback = (url: string) => {
  const isZh = currentLang.value === 'zh'
  uni.showLoading({ title: isZh ? '跳转中...' : 'Loading...', mask: true })
  try {
    uni.navigateTo({
      url,
      success: () => {
        uni.hideLoading()
      },
      fail: (err) => {
        uni.hideLoading()
        console.error('[AR] 页面跳转失败:', err, 'URL:', url)
        uni.showToast({
          title: isZh ? '页面跳转失败，请重试' : 'Navigation failed. Please retry.',
          icon: 'none',
          duration: 2500
        })
      },
      complete: () => {
        // 兜底：确保 loading 一定被关闭
        setTimeout(() => uni.hideLoading(), 3000)
      }
    })
  } catch (err) {
    uni.hideLoading()
    console.error('[AR] 导航异常:', err)
    uni.showToast({
      title: isZh ? '导航异常，请重试' : 'Navigation error. Please retry.',
      icon: 'none',
      duration: 2500
    })
  }
}

// ==================== 辅助方法 ====================

/**
 * 加载按角色分组的模型列表并初始化选中状态
 */
const loadModelsByRole = () => {
  const recognition = aiScheduler.getModels('recognition')
  const qa = aiScheduler.getModels('qa')
  const tts = aiScheduler.getModels('tts')

  modelsByRole.value = { recognition, qa, tts }

  // 初始化选中模型ID（取各角色首个可用模型作为UI默认值）
  selectedModels.value = {
    recognition: recognition[0]?.id ?? null,
    qa: qa[0]?.id ?? null,
    tts: tts[0]?.id ?? null
  }
}

/**
 * 角色中文文本
 */
const roleText = (role: AIRole): string => {
  const isZh = currentLang.value === 'zh'
  switch (role) {
    case 'recognition': return isZh ? '识别模型' : 'Recognition'
    case 'qa': return isZh ? '问答模型' : 'Q&A'
    case 'tts': return isZh ? '语音模型' : 'Voice'
  }
}
</script>

<style lang="scss" scoped>
.ar-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

/* ===== 摄像头容器 ===== */
.camera-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* ===== 顶部栏 ===== */
.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 0 12px;
  padding-top: env(safe-area-inset-top, 0px);
  height: calc(56px + env(safe-area-inset-top, 0px));
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 100%);
}

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  flex-shrink: 0;

  .back-icon {
    color: #fff;
    font-size: 24px;
    font-weight: bold;
    line-height: 1;
  }
}

.top-title {
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  margin-left: 8px;
  flex-shrink: 0;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.model-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.model-picker {
  flex-shrink: 0;
}

.picker-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 8px;
  padding: 4px 8px;
  min-width: 52px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  .picker-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 10px;
    line-height: 1.2;
  }

  .picker-value {
    color: #fff;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.3;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* ===== 状态提示 ===== */
.status-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 50;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 12px;
  padding: 12px 24px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  .status-text {
    color: #fff;
    font-size: 14px;
    text-align: center;
  }
}

/* ===== 问答回答面板 ===== */
.qa-panel {
  position: absolute;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  left: 12px;
  right: 12px;
  z-index: 90;
  max-height: 240px;
  background: rgba(20, 20, 24, 0.88);
  border-radius: 14px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.qa-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  .qa-panel-title {
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 600;
  }

  .qa-panel-close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);

    .close-icon {
      color: rgba(255, 255, 255, 0.8);
      font-size: 16px;
      line-height: 1;
    }
  }
}

.qa-scroll {
  max-height: 180px;
  padding: 10px 14px;
}

.qa-answer-text {
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  line-height: 1.6;
}

.qa-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;

  .loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    animation: ar-bounce 1.2s infinite ease-in-out;

    &:nth-child(2) {
      animation-delay: 0.15s;
    }
    &:nth-child(3) {
      animation-delay: 0.3s;
    }
  }
}

@keyframes ar-bounce {
  0%, 60%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  30% {
    transform: scale(1.2);
    opacity: 1;
  }
}

/* ===== 底部栏 ===== */
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
}

.qa-input {
  flex: 1;
  height: 40px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 0 16px;
  color: #fff;
  font-size: 14px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
}

.action-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  flex-shrink: 0;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: all 0.2s;

  &:active {
    transform: scale(0.92);
    background: rgba(255, 255, 255, 0.25);
  }

  &.active {
    background: rgba(255, 107, 53, 0.7);
    border-color: rgba(255, 107, 53, 0.9);
  }

  .btn-icon {
    font-size: 20px;
    line-height: 1;
  }
}

.capture-btn {
  background: rgba(255, 255, 255, 0.25);
}

/* ===== 权限引导遮罩 ===== */
.permission-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.permission-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36px 28px;
  margin: 0 32px;
  max-width: 340px;
  background: rgba(30, 30, 36, 0.9);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);

  .permission-icon {
    font-size: 56px;
    margin-bottom: 16px;
  }

  .permission-title {
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 12px;
  }

  .permission-desc {
    color: rgba(255, 255, 255, 0.65);
    font-size: 14px;
    line-height: 1.6;
    text-align: center;
    margin-bottom: 28px;
  }

  .permission-btn {
    width: 100%;
    height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
    border-radius: 23px;
    margin-bottom: 12px;
    box-shadow: 0 4px 16px rgba(255, 107, 53, 0.3);

    &:active {
      opacity: 0.88;
    }

    .permission-btn-text {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .permission-deny {
    padding: 8px 20px;

    .deny-text {
      color: rgba(255, 255, 255, 0.4);
      font-size: 13px;
    }
  }
}

/* ===== 错误提示 ===== */
.error-toast {
  position: absolute;
  top: calc(70px + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  max-width: 80%;
  background: rgba(220, 38, 38, 0.9);
  border-radius: 10px;
  padding: 8px 16px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  .error-text {
    color: #fff;
    font-size: 13px;
    text-align: center;
  }
}

/* ===== 拍照闪屏 ===== */
.flash-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 500;
  background: #fff;
  animation: ar-flash 0.2s ease-out;
}

@keyframes ar-flash {
  0% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
  }
}

/* ===== 性能监控开关 ===== */
.perf-toggle {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: 4px;

  .perf-score {
    color: #fff;
    font-size: 13px;
    font-weight: 700;

    &.good { color: #52c41a; }
    &.warn { color: #faad14; }
    &.bad { color: #ff4d4f; }
  }
}

/* ===== 性能监控浮层 ===== */
.perf-monitor {
  position: absolute;
  top: calc(60px + env(safe-area-inset-top, 0px));
  right: 12px;
  z-index: 150;
  width: 200px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 12px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px;
}

.perf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  .perf-title {
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 600;
  }

  .perf-close {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);

    .perf-close-icon {
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      line-height: 1;
    }
  }
}

.perf-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.perf-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 6px 4px;

  .perf-label {
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    line-height: 1.2;
  }

  .perf-value {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;

    &.warn {
      color: #ff4d4f;
    }
  }
}

.perf-session {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);

  .session-label {
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
  }

  .session-value {
    color: #52c41a;
    font-size: 11px;
    font-weight: 600;
  }
}

/* ===== 资源加载进度 ===== */
.resource-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 80;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  padding: 16px 24px;
  min-width: 200px;
  text-align: center;

  .loading-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 8px;

    .loading-fill {
      height: 100%;
      background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
  }

  .loading-text {
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
  }
}

/* ===== AI增强工具栏 ===== */
.ai-enhance-bar {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 15;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 24px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.ai-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 14px;
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  position: relative;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;

  &.active {
    background: rgba(255, 107, 53, 0.3);
  }

  &.error {
    background: rgba(244, 67, 54, 0.25);
  }

  .ai-btn-icon {
    font-size: 20px;
    line-height: 1.2;
  }

  .ai-btn-label {
    font-size: 10px;
    color: #fff;
    margin-top: 2px;
    white-space: nowrap;
  }

  .ai-btn-loading {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff6b35;
    animation: ai-pulse 0.8s ease-in-out infinite;
  }
}

@keyframes ai-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* 网络状态指示器 */
.ai-net-status {
  display: flex;
  align-items: center;
  padding: 2px 6px;

  .net-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f44336;
    animation: net-blink 1s ease-in-out infinite;
  }
}

@keyframes net-blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* ===== AI增强结果面板 ===== */
.ai-panel {
  position: absolute;
  bottom: 130px;
  left: 12px;
  right: 12px;
  max-height: 45vh;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 14px;
  z-index: 16;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ai-panel-slide-up 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@keyframes ai-panel-slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);

  .ai-panel-title {
    font-size: 15px;
    font-weight: 600;
    color: #222;
  }

  .ai-panel-close {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;

    .close-icon {
      font-size: 16px;
      color: #666;
    }
  }
}

.ai-panel-scroll {
  flex: 1;
  padding: 12px 16px;
  max-height: 35vh;
}

.ai-panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-section {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .ai-section-label {
    font-size: 13px;
    font-weight: 600;
    color: #ff6b35;
  }

  .ai-section-text {
    font-size: 14px;
    color: #444;
    line-height: 1.6;
  }

  .ai-section-sub {
    font-size: 12px;
    color: #888;
    line-height: 1.5;
    margin-top: 2px;
  }
}

.ai-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;

  .ai-tag {
    padding: 4px 10px;
    background: rgba(255, 107, 53, 0.1);
    color: #ff6b35;
    font-size: 12px;
    border-radius: 12px;
  }
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(74, 144, 217, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: rgba(74, 144, 217, 0.15);
  }

  .suggestion-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .suggestion-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .suggestion-title {
      font-size: 14px;
      font-weight: 500;
      color: #222;
    }

    .suggestion-action {
      font-size: 12px;
      color: #888;
    }
  }

  .suggestion-arrow {
    font-size: 18px;
    color: #ccc;
    flex-shrink: 0;
  }
}

.ai-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 0;

  .loading-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff6b35;
    animation: ai-dot-bounce 0.6s ease-in-out infinite;

    &:nth-child(2) { animation-delay: 0.15s; }
    &:nth-child(3) { animation-delay: 0.3s; }
  }

  .ai-loading-text {
    font-size: 13px;
    color: #888;
    margin-left: 6px;
  }
}

@keyframes ai-dot-bounce {
  0%, 100% { transform: scale(0.8); opacity: 0.4; }
  50% { transform: scale(1.2); opacity: 1; }
}

/* ===== 缓存标识 ===== */
.ai-cache-badge {
  font-size: 10px;
  color: #4CAF50;
  background: rgba(76, 175, 80, 0.12);
  padding: 2px 8px;
  border-radius: 8px;
  margin-left: auto;
  margin-right: 8px;
}

/* ===== 骨架屏加载 ===== */
.ai-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;

  .skeleton-line {
    height: 14px;
    border-radius: 7px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }

  .skeleton-wide { width: 100%; }
  .skeleton-short { width: 60%; }

  .ai-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 0;
    margin-top: 4px;
  }
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== 错误状态 + 重试按钮 ===== */
.ai-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  gap: 12px;

  .ai-error-icon {
    font-size: 32px;
    color: #ff6b35;
  }

  .ai-error-msg {
    font-size: 14px;
    color: #666;
    text-align: center;
    line-height: 1.5;
  }

  .ai-retry-btn {
    padding: 8px 24px;
    background: linear-gradient(135deg, #ff6b35, #ff8855);
    border-radius: 20px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.1s;

    &:active {
      transform: scale(0.95);
    }

    .ai-retry-text {
      color: #fff;
      font-size: 14px;
      font-weight: 500;
    }
  }
}

/* ===== 空状态 ===== */
.ai-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;

  .ai-empty-text {
    font-size: 14px;
    color: #999;
  }
}
</style>
