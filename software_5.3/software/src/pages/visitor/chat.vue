<template>
  <view class="chat-container">
    <view class="left-panel" v-show="!isMobile || mobileAvatarVisible">
      <view class="panel-header">
        <text class="panel-title">{{ currentLang === 'zh' ? 'AI导游 - ' + activeAvatarConfig.name : 'AI Guide - ' + activeAvatarConfig.name }}</text>
        <view class="online-status">
          <view class="status-dot"></view>
          <text>{{ currentLang === 'zh' ? '在线服务' : 'Online Service' }}</text>
        </view>
      </view>

      <view class="avatar-section">
        <view class="avatar-stage">
          <Avatar3D ref="avatarRef" :vertical-offset-ratio="1/4" :full-body-fit="true" :disable-zoom="true" :model-path="activeAvatarConfig.vrm_path" :model-scale="activeAvatarConfig.model_scale" :model-rotation-y="activeAvatarConfig.rotation_y" :name="activeAvatarConfig.name" class="chat-avatar-3d" />
        </view>
        <view class="avatar-footer">
          <text class="avatar-label">{{ currentLang === 'zh' ? '3D虚拟导游 | 支持语音交互' : '3D Virtual Guide | Voice Interaction' }}</text>
        </view>
      </view>

      <view class="action-btn-wrapper">
        <button class="voice-btn" @click="toggleVoiceMode">
          <text class="btn-text">{{ currentLang === 'zh' ? (isVoiceMode ? '文字输入' : '语音聊天') : (isVoiceMode ? 'Text Input' : 'Voice Chat') }}</text>
        </button>
      </view>
    </view>

    <view class="center-panel">
      <view class="panel-header chat-header">
        <view class="header-left">
          <view class="mobile-avatar-toggle" @click="toggleMobileAvatar">
            <text>{{ mobileAvatarVisible ? '◀' : '▶' }}</text>
          </view>
          <view class="header-title-group">
            <text class="title-text">{{ currentLang === 'zh' ? '智能对话' : 'Smart Chat' }}</text>
          </view>
        </view>
        <view class="header-right">
          <view class="ar-btn" @click="goToAR">
            <text class="ar-btn-text">AR</text>
          </view>
          <view class="toggle-switch" :class="{ active: voiceEnabled }" @click="toggleVoiceEnabled">
            <text class="toggle-label">{{ currentLang === 'zh' ? '语音播报' : 'Voice Broadcast' }}</text>
          </view>
          <view class="connection-status">
            <view class="connection-dot"></view>
            <text>{{ currentLang === 'zh' ? '在线' : 'Connected' }}</text>
          </view>
        </view>
      </view>

      <scroll-view
        class="chat-messages"
        scroll-y
        :scroll-top="scrollTop"
        :scroll-with-animation="true"
        @scrolltolower="loadMore"
      >
        <!-- 已完成的对话消息 -->
        <view
          class="message-item"
          v-for="msg in messages"
          :key="msg.id"
          :class="{ 'user-message': msg.isUser }"
        >
          <image
            v-if="!msg.isUser"
            class="msg-avatar"
            :src="currentAvatar?.avatarUrl || '/static/avatars/default.png'"
            mode="aspectFill"
          />
          <view class="message-content">
            <view class="message-bubble">
              <image v-if="msg.type === 'image' && msg.imageUrl" class="msg-image" :src="msg.imageUrl" mode="aspectFill" />
              <text>{{ msg.content }}</text>
            </view>
            <text class="message-time">{{ formatTime(msg.timestamp) }}</text>
          </view>
          <image
            v-if="msg.isUser"
            class="msg-avatar user-avatar"
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23C8973F'/%3E%3Ctext x='50' y='68' font-size='42' text-anchor='middle' fill='white' font-family='sans-serif'%3E%E6%88%91%3C/text%3E%3C/svg%3E"
            mode="aspectFill"
          />
        </view>

        <!-- 逐字打字中的 AI 消息 -->
        <view v-if="isTyping" class="message-item">
          <image
            class="msg-avatar"
            :src="currentAvatar?.avatarUrl || '/static/avatars/default.png'"
            mode="aspectFill"
          />
          <view class="message-content">
            <view class="message-bubble">
              <text>{{ typingContent }}</text>
              <text class="typing-cursor">|</text>
            </view>
          </view>
        </view>

        <!-- 加载指示器：等待 AI + TTS 同时就绪 -->
        <view v-if="isPreparing" class="loading-indicator">
          <view class="loading-dots">
            <view class="dot"></view>
            <view class="dot"></view>
            <view class="dot"></view>
          </view>
          <text class="loading-text">{{ currentLang === 'zh' ? activeAvatarConfig.name + '正在思考...' : activeAvatarConfig.name + ' is thinking...' }}</text>
        </view>
      </scroll-view>

      <!-- 图片预览（两种输入模式共享） -->
      <view v-if="uploadedImages.length" class="image-preview-bar">
        <view class="preview-thumb" v-for="(img, i) in uploadedImages" :key="i">
          <image class="preview-img" :src="img" mode="aspectFill" />
          <view class="preview-remove" @click="removeImage(i)">✕</view>
        </view>
      </view>

      <!-- 文字输入模式 -->
      <view v-show="!isVoiceMode" class="chat-input-area">
        <!-- 猜你想问胶囊标签（首页专用，60秒轮换，可横向滑动） -->
        <scroll-view
          class="suggest-wrap"
          :class="{ 'suggest-fading': suggestFading }"
          scroll-x
          :show-scrollbar="false"
          :scroll-anchoring="true"
        >
          <view class="suggest-inner">
            <view
              v-for="(q, idx) in suggestList"
              :key="'sg-' + idx"
              class="suggest-pill"
              @click="onSuggestClick(q)"
            >{{ q }}</view>
          </view>
        </scroll-view>
        <view class="input-row">
          <input 
            ref="inputRef"
            class="chat-input" 
            v-model="inputMessage"
            :placeholder="currentLang === 'zh' ? '请输入您的问题' : 'Enter your question...'"
            :adjust-position="true"
            @confirm="sendText"
          />
          <view class="input-actions">
            <view class="action-icon-btn" @click="toggleImageMenu">
              <image src="/static/camera-icon.png" />
              <transition name="image-menu">
                <view v-if="showImageMenu" class="image-menu-popover" @click.stop="">
                  <view class="menu-item" @click="pickCamera"><image src="/static/camera-icon.png" /><text>{{ currentLang === 'zh' ? '拍照' : 'Camera' }}</text></view>
                  <view class="menu-item" @click="pickGallery"><image src="/static/gallery-icon.png" /><text>{{ currentLang === 'zh' ? '从相册选择' : 'Album' }}</text></view>
                </view>
              </transition>
            </view>
            <view class="action-divider"></view>
            <view class="send-btn" @click="sendMessage">
              <text>➤</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 语音输入模式 -->
      <view class="voice-input-area" :style="{ display: isVoiceMode ? 'flex' : 'none' }">
        <view 
          class="voice-hold-btn" 
          :class="{ recording: isRecording }"
          @pointerdown.prevent="startVoiceRecord"
          @pointerup.prevent="stopVoiceRecord"
        >
          <text v-if="!isRecording">{{ currentLang === 'zh' ? '按住说话' : 'Hold to Speak' }}</text>
          <text v-else>{{ currentLang === 'zh' ? '正在听...' : 'Listening...' }}</text>
        </view>
        <view class="action-icon-btn" @click="toggleImageMenu">
          <image src="/static/camera-icon.png" />
        </view>
      </view>
    </view>
  </view>

  <!-- ====== WebRTC 实时拍照取景器 ====== -->
  <view v-if="showCamera" class="camera-overlay">
    <view class="camera-header">
        <view class="camera-close" @click="stopCamera">
          <text>✕</text>
        </view>
        <text class="camera-title">{{ currentLang === 'zh' ? '拍照' : 'Camera' }}</text>
        <view class="camera-flip" @click="flipCamera">
          <text>🔄</text>
        </view>
      </view>
    <view class="camera-viewport" id="camera-viewport"></view>
    <view class="camera-footer">
      <view class="camera-capture-btn" @click="capturePhoto">
        <view class="capture-ring">
          <view class="capture-dot"></view>
        </view>
      </view>
    </view>
  </view>

  <!-- ====== 相机菜单透明遮罩：点击外部任意地方关闭菜单 ====== -->
  <view v-if="showImageMenu" class="image-menu-mask" @click="closeImageMenu"></view>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, watch, onMounted, onUnmounted } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import type { AvatarConfig, ChatMessage, Spot } from '@/types'
import { mockAvatars } from '@/data/mock'
import { aiResponder } from '@/utils/aiResponder-doubao'
import { getSafeImageUrl } from '@/utils/imageConfig'
import { ttsEngine } from '@/utils/ttsEngine'
import Avatar3D from '@/components/Avatar3D.vue'
import { useChatQaRotation } from '@/data/qa-bank'
import { currentLang, t } from '@/i18n'

const chatStore = useChatStore()
const userStore = useUserStore()
const currentAvatar = ref<AvatarConfig>(mockAvatars[0])
const avatarRef = ref()
const inputRef = ref()

// D5：当前启用的数字人形象配置（从后端获取，控制 VRM 模型路径/缩放/旋转/音色/名字）
const activeAvatarConfig = ref<{
  vrm_path: string
  model_scale: number
  rotation_y: number
  voice_type: string
  name: string
}>({ vrm_path: '', model_scale: 3.25, rotation_y: 0, voice_type: 'zh-CN-XiaoxiaoNeural', name: '小乐' })

// 响应式布局：移动端(<768px)默认折叠数字人区，通过顶部按钮控制显隐
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 768)
const mobileAvatarVisible = ref(false)
function toggleMobileAvatar() {
  mobileAvatarVisible.value = !mobileAvatarVisible.value
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768
  })
}

// 直接使用 store 的 messages（Pinia store 的 ref 在组件中自动解包，无需 .value）
const messages = chatStore.messages
const inputMessage = ref('')
const isVoiceMode = ref(false)
const voiceEnabled = ref(true)
const scrollTop = ref(0)

// 等待回复状态（AI思考 + TTS合成期间显示 loading）
const isPreparing = ref(false)
// 逐字打字状态
const isTyping = ref(false)
const typingContent = ref('')

// 语音输入状态
const isRecording = ref(false)
const recognitionText = ref('')

// 用于中断上一轮未完成的 sendText
let sendGeneration = 0

// 图片上传
const uploadedImages = ref<string[]>([])
const showImageMenu = ref(false)

function toggleImageMenu() { showImageMenu.value = !showImageMenu.value }
function closeImageMenu() { showImageMenu.value = false }

// ====== WebRTC 拍照 — 纯原生 DOM 实现（绕过 UniApp video 组件兼容问题）======
const showCamera = ref(false)
const cameraStream = ref<MediaStream | null>(null)
let nativeVideo: HTMLVideoElement | null = null

function mountCamera(stream: MediaStream) {
  // 等待 overlay DOM 渲染
  nextTick(() => {
    setTimeout(() => {
      const container = document.getElementById('camera-viewport')
      if (!container) return
      // 移除旧 video
      if (nativeVideo) { nativeVideo.remove(); nativeVideo = null }
      // 创建原生 video，不加任何 UniApp/Vue 绑定
      nativeVideo = document.createElement('video')
      nativeVideo.id = 'cam-vid'
      nativeVideo.autoplay = true
      nativeVideo.muted = true
      nativeVideo.playsInline = true
      nativeVideo.setAttribute('playsinline', '')
      nativeVideo.setAttribute('webkit-playsinline', '')
      nativeVideo.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        object-fit: cover; background: #000;
        z-index: 1;
      `
      nativeVideo.srcObject = stream
      container.appendChild(nativeVideo)
      nativeVideo.play().catch(e => console.warn('play fail:', e))
    }, 200)
  })
}

function unmountCamera() {
  if (nativeVideo) { nativeVideo.remove(); nativeVideo = null }
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(t => t.stop())
    cameraStream.value = null
  }
  showCamera.value = false
}

async function pickCamera() {
  closeImageMenu()
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    })
    cameraStream.value = stream
    showCamera.value = true
    mountCamera(stream)
  } catch (e) {
    console.warn('摄像头不可用，降级文件选择:', e)
    await fallbackPickCamera()
  }
}

// 切换前后摄像头
let facingFront = false
function flipCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(t => t.stop())
    cameraStream.value = null
  }
  facingFront = !facingFront
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: facingFront ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(stream => {
    cameraStream.value = stream
    mountCamera(stream)
  }).catch(() => {})
}

function capturePhoto() {
  const vid = nativeVideo || document.getElementById('cam-vid') as HTMLVideoElement
  if (!vid || !vid.videoWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = vid.videoWidth
  canvas.height = vid.videoHeight
  canvas.getContext('2d')?.drawImage(vid, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  compressImage(dataUrl).then(c => { if (c) uploadedImages.value.push(c) })
  unmountCamera()
}

function stopCamera() { unmountCamera() }

async function fallbackPickCamera() {
  try {
    const res = await uni.chooseImage({ count: 1, sourceType: ['camera'], sizeType: ['compressed'] })
    if (res.tempFilePaths[0]) {
      const c = await compressImage(res.tempFilePaths[0])
      if (c) uploadedImages.value.push(c)
    }
  } catch (_) {}
}

async function pickGallery() {
  closeImageMenu()
  try {
    const res = await uni.chooseImage({ count: 3, sourceType: ['album'], sizeType: ['compressed'] })
    for (const path of res.tempFilePaths.slice(0, 3)) {
      if (path) {
        const compressed = await compressImage(path)
        if (compressed) uploadedImages.value.push(compressed)
      }
    }
  } catch (_) {}
}

function removeImage(i: number) { uploadedImages.value.splice(i, 1) }

/** 压缩图片：限制最大宽度 800px，质量 0.8 */
function compressImage(src: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const maxWidth = 800
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)
      // 转 base64，质量 0.8
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      resolve(dataUrl)
    }
    img.onerror = () => resolve(src) // 失败返回原图
    img.src = src
  })
}

const hotSpots = ref<Spot[]>([
  { id: 'lingshan', name: currentLang.value === 'zh' ? '灵山胜境' : 'Lingshan Scenic Area', description: currentLang.value === 'zh' ? '佛教文化旅游胜地' : 'Buddhist Cultural Tourist Attraction', imageUrl: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=Lingshan%20Grand%20Buddha%20scenic%20area%20magnificent%20Buddha%20statue%20peaceful%20atmosphere&image_size=landscape_4_3'), duration: 180, order: 1 },
  { id: 'dahua', name: currentLang.value === 'zh' ? '拈花湾' : 'Nianhuawan', description: currentLang.value === 'zh' ? '禅意小镇，心灵栖息地' : 'Zen Town, Spiritual Retreat', imageUrl: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=Zen%20garden%20town%20Japanese%20style%20peaceful%20meditation%20garden&image_size=landscape_4_3'), duration: 120, order: 2 },
  { id: 'xihu', name: currentLang.value === 'zh' ? '杭州西湖' : 'West Lake', description: currentLang.value === 'zh' ? '人间天堂' : 'Paradise on Earth', imageUrl: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=West%20Lake%20Hangzhou%20beautiful%20scenery%20traditional%20pagoda%20willow%20trees&image_size=landscape_4_3'), duration: 240, order: 3 },
  { id: 'qiantang', name: currentLang.value === 'zh' ? '钱塘江' : 'Qiantang River', description: currentLang.value === 'zh' ? '天下第一潮' : 'World\'s Largest Tide', imageUrl: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=Qiantang%20River%20tide%20spectacular%20waves%20nature%20power&image_size=landscape_4_3'), duration: 90, order: 4 }
])

const recommendations = ref([
  { icon: '🌸', title: currentLang.value === 'zh' ? '春季赏花推荐' : 'Spring Flower Guide', desc: currentLang.value === 'zh' ? '樱花、桃花、油菜花最佳观赏时间' : 'Best time to see cherry blossoms, peach blossoms & rapeseed flowers', action: 'spring' },
  { icon: '☀️', title: currentLang.value === 'zh' ? '夏日避暑胜地' : 'Summer Cool Destinations', desc: currentLang.value === 'zh' ? '清凉一夏的纳凉好去处' : 'Great places to beat the summer heat', action: 'summer' }
])

// 监听消息变化，自动滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    setTimeout(() => {
      scrollTop.value = Date.now()
    }, 50)
  })
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const sendText = async () => {
  const hasImages = uploadedImages.value.length > 0
  if (!inputMessage.value.trim() && !hasImages) return
  const userMessage = inputMessage.value.trim() || (currentLang.value === 'zh' ? '请帮我看看这张图片' : 'Please analyze this image')
  inputMessage.value = ''
  const images = [...uploadedImages.value]
  uploadedImages.value = []
  closeImageMenu()

  // 立刻把光标拉回输入框
  focusInput()

  // 中断上一轮 + 生成计数
  const gen = ++sendGeneration
  ttsEngine.stop()
  // 安全保障：确保语音播报已开启（防止旧缓存或异常状态导致静音）
  if (!voiceEnabled.value) voiceEnabled.value = true

  // 保存上一轮已显示的文字，追加省略号后入 store
  if (isTyping.value && typingContent.value.trim()) {
    chatStore.addMessage({
      userId: 'ai',
      content: typingContent.value + '...',
      type: 'text',
      isUser: false,
      timestamp: new Date().toISOString(),
      emotion: 'neutral'
    })
  }
  isTyping.value = false
  typingContent.value = ''

  // 1. 用户消息立刻显示
  chatStore.addMessage({
    userId: 'visitor',
    content: images.length ? `[图片] ${userMessage}` : userMessage,
    type: images.length ? 'image' : 'text',
    isUser: true,
    timestamp: new Date().toISOString(),
    imageUrl: images[0] || undefined
  })
  scrollToBottom()

  // 2. 显示 loading（等 AI 回复 + 可能等 TTS 合成）
  //    3D 数字人思考态：表情回归自然，不张嘴（原 2D 版在此处会一直抖嘴，3D 版更自然）
  isPreparing.value = true
  if (avatarRef.value) {
    avatarRef.value.setExpression('neutral')
  }

  try {
    // 3. 后台获取 AI 回复（有图走多模态，无图走文本）
    // 登录用户的年龄画像带入系统提示词（年长游客→无障碍路线指引）
    aiResponder.setUserProfile({ age: userStore.user?.age, lang: currentLang.value as 'zh' | 'en' })
    let fullText = ''
    let emotion: 'positive' | 'neutral' | 'negative' = 'positive'

    if (images.length > 0) {
      await aiResponder.getResponseStreamWithImages(userMessage, images, {
        onChunk: (chunk: string) => {
          fullText += chunk
        },
        onDone: (result) => {
          fullText = result.answer
          emotion = result.emotion
        },
        onError: () => {
          if (!fullText) fullText = currentLang.value === 'zh' ? '抱歉，我暂时无法识别这张图片，请稍后再试~' : 'Sorry, I cannot recognize this image. Please try again later.'
        }
      })
    } else {
      await aiResponder.getResponseStream(userMessage, {
        onChunk: (chunk: string) => {
          fullText += chunk
        },
        onDone: (result) => {
          fullText = result.answer
          emotion = result.emotion
        },
        onError: () => {
          if (!fullText) fullText = currentLang.value === 'zh' ? '抱歉，我暂时无法回答，请稍后再试~' : 'Sorry, I cannot answer right now. Please try again later.'
        }
      })
    }

    // 如果在等 AI 回复期间有新消息，放弃本轮
    if (gen !== sendGeneration) return

    // 4. 语音播报 → 后台合成
    let audioData: ArrayBuffer | null = null
    if (voiceEnabled.value) {
      try {
        audioData = await ttsEngine.synthesize(fullText)
      } catch (e) {
        console.error('[TTS] 合成失败:', e)
      }
    }

    // 5. 文字显示 → 逐字打字
    isPreparing.value = false
    isTyping.value = true
    typingContent.value = ''

    // 【3D 数字人联动】根据 AI 情绪驱动表情 + 用文本驱动伪口型
    // 表情在说话开始前设置，确保整个说话期间情绪可见
    if (avatarRef.value) {
      avatarRef.value.setEmotion(emotion)
      avatarRef.value.speakText(fullText)
    }

    // 语音播报开启 → 播放语音
    if (audioData && audioData.byteLength > 0) {
      ttsEngine.play(audioData)
    }

    const chars = fullText.split('')
    for (let i = 0; i < chars.length; i++) {
      if (gen !== sendGeneration) break  // 新消息发来了，中断
      typingContent.value += chars[i]
      scrollToBottom()
      await new Promise(r => setTimeout(r, 50))
    }

    if (gen !== sendGeneration) return  // 被中断，不写入 store

    // 6. 打字完成 → 加入 store
    isTyping.value = false
    typingContent.value = ''
    chatStore.addMessage({
      userId: 'ai',
      content: fullText,
      type: 'text',
      isUser: false,
      timestamp: new Date().toISOString(),
      emotion: emotion
    })
    scrollToBottom()

    // 对话结束后的状态恢复由 Avatar3D 内部 animate 循环自动处理：
    // 当 textEnded && !audioDriving 时触发 stopSpeaking()，
    // 实现口型渐变收口（200ms）+ 表情回归 neutral（250ms 三级过渡）
    // 此处不再手动调用 stopSpeaking()，避免在 TTS 音频仍在播放时过早收口

    // 【对话日志上报】将对话记录和情感标签发送到后端，供管理端情感分析报告使用
    try {
      await fetch('/api/chat/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: userMessage, answer: fullText, emotion, category: '对话' })
      })
    } catch (_) {}
  } catch (err) {
    if (gen !== sendGeneration) return
    console.error('发送失败:', err)
    isPreparing.value = false
    isTyping.value = false
    typingContent.value = ''
    chatStore.addMessage({
      userId: 'ai',
      content: currentLang.value === 'zh' ? '抱歉，我暂时无法回答，请稍后再试~' : 'Sorry, I cannot answer right now. Please try again later.',
      type: 'text',
      isUser: false,
      timestamp: new Date().toISOString(),
      emotion: 'neutral'
    })
    ttsEngine.stop()
    if (avatarRef.value) {
      avatarRef.value.stopSpeaking()
    }
    scrollToBottom()
  }
}

const isLoading = computed(() => isPreparing.value)

const sendMessage = () => {
  if (isVoiceMode.value) return
  sendText()
  focusInput()
}

const toggleVoiceMode = () => {
  isVoiceMode.value = !isVoiceMode.value
  // 切到语音模式：立即停止当前语音和打字输出
  if (isVoiceMode.value) {
    ttsEngine.stop()
    sendGeneration++
    isTyping.value = false
    typingContent.value = ''
    isPreparing.value = false
    if (avatarRef.value) {
      avatarRef.value.stopSpeaking()
    }
  }
  // 切回文字模式：自动聚焦
  if (!isVoiceMode.value) {
    nextTick(() => {
      focusInput()
    })
  }
}

// 统一聚焦文字输入框
const focusInput = () => {
  nextTick(() => {
    // UniApp H5 中 input 会被编译成 uni-input 组件，找它内部的真实 input
    setTimeout(() => {
      const el: HTMLInputElement | null = document.querySelector('.chat-input input')
        || document.querySelector('.chat-input')
        || (document.querySelector('.chat-input-area input') as HTMLInputElement)
      if (el) {
        el.focus()
        el.click()
      }
    }, 150)
  })
}

// 切回文字模式自动聚焦
watch(isVoiceMode, (val) => {
  if (!val) {
    nextTick(() => focusInput())
  }
})

// ====== 浏览器语音识别 ======
let speechRecognition: any = null

const createRecognition = () => {
  // #ifdef H5
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognition) {
        uni.showToast({ title: currentLang.value === 'zh' ? '当前浏览器不支持语音识别' : 'Speech recognition not supported', icon: 'none' })
        return null
      }
  const rec = new SpeechRecognition()
  rec.lang = currentLang.value === 'zh' ? 'zh-CN' : 'en-US'
  rec.interimResults = true
  rec.onresult = (event: any) => {
    let finalText = ''
    let interimText = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        finalText += result[0].transcript
      } else {
        interimText += result[0].transcript
      }
    }
    recognitionText.value = finalText + interimText
  }
  rec.onerror = (event: any) => {
    console.error('语音识别错误:', event.error)
    if (event.error === 'not-allowed') {
      uni.showToast({ title: currentLang.value === 'zh' ? '请授权麦克风权限' : 'Please grant microphone permission', icon: 'none' })
    }
    // 'no-speech' 或 'aborted' 是正常结束，不提示
    isRecording.value = false
    voiceEnabled.value = true
  }
  rec.onend = () => {
    // 识别自然结束，发送已识别的文字
    isRecording.value = false
    voiceEnabled.value = true
    const text = recognitionText.value.trim()
    if (text) {
      recognitionText.value = ''
      inputMessage.value = text
      nextTick(() => sendText())
    }
  }
  return rec
  // #endif
  // #ifndef H5
  return null
  // #endif
}

const startVoiceRecord = () => {
  if (isRecording.value) return
  // 按下即停：立即中断上一轮的文字打字和语音播报
  ttsEngine.stop()
  sendGeneration++
  isTyping.value = false
  typingContent.value = ''
  isPreparing.value = false
  if (avatarRef.value) {
    avatarRef.value.stopSpeaking()
  }
  // 每次创建新的识别实例（避免复用导致的问题）
  speechRecognition = createRecognition()
  if (!speechRecognition) {
    toggleVoiceMode()
    return
  }
  try {
    recognitionText.value = ''
    speechRecognition.start()
    isRecording.value = true
  } catch (e) {
    console.error('语音启动失败:', e)
  }
}

const stopVoiceRecord = () => {
  if (!isRecording.value || !speechRecognition) return
  isRecording.value = false
  try {
    speechRecognition.stop()
  } catch (_) {}
  // 文字由 onend 回调发送，这里不做重复处理
}

const toggleVoiceEnabled = () => {
  voiceEnabled.value = !voiceEnabled.value
  if (!voiceEnabled.value) {
    ttsEngine.stop()
  }
}

const actionClick = (action: string) => {
  switch (action) {
    case 'location':
      inputMessage.value = currentLang.value === 'zh' ? '附近有什么景点？' : 'What attractions are nearby?'
      break
    case 'weather':
      inputMessage.value = currentLang.value === 'zh' ? '今天天气怎么样？' : 'What is the weather like today?'
      break
    case 'food':
      inputMessage.value = currentLang.value === 'zh' ? '有什么美食推荐？' : 'What food recommendations do you have?'
      break
    case 'route':
      inputMessage.value = currentLang.value === 'zh' ? '推荐一下游览路线' : 'Recommend a tour route'
      break
    case 'spring':
      inputMessage.value = currentLang.value === 'zh' ? '春季赏花推荐' : 'Spring flower recommendations'
      break
    case 'summer':
      inputMessage.value = currentLang.value === 'zh' ? '夏日避暑胜地' : 'Summer cool destinations'
      break
  }
  // 自动发送
  nextTick(() => sendText())
}

const goToSpot = (spotId: string) => {
  const spotNamesZh: Record<string, string> = { lingshan: '灵山胜境', dahua: '拈花湾', xihu: '杭州西湖', qiantang: '钱塘江' }
  const spotNamesEn: Record<string, string> = { lingshan: 'Lingshan Scenic Area', dahua: 'Nianhuawan', xihu: 'West Lake', qiantang: 'Qiantang River' }
  const prefix = currentLang.value === 'zh' ? '介绍一下' : 'Tell me about '
  inputMessage.value = prefix + (currentLang.value === 'zh' ? spotNamesZh[spotId] : spotNamesEn[spotId])
  nextTick(() => sendText())
}

const goToAR = () => {
  uni.navigateTo({ url: '/pages/visitor/ar' })
}

const loadMore = () => {
}

// ====== 猜你想问模块（首页胶囊标签 + 60秒轮换） ======
const {
  displayed: suggestList,
  fading: suggestFading,
} = useChatQaRotation()

// 点击胶囊：填充输入框并自动发送
let suggestClickTimer: ReturnType<typeof setTimeout> | null = null
const onSuggestClick = (q: string) => {
  if (suggestClickTimer) return  // 防抖：200ms 内只响应一次
  suggestClickTimer = setTimeout(() => { suggestClickTimer = null }, 200)
  inputMessage.value = q
  nextTick(() => sendText())
}


watch(() => messages.length, (newLen, oldLen) => {
  // 预留钩子：后续可接入提问偏好统计
}, { immediate: false })

// 语言切换时推荐词的刷新已由 useChatQaRotation 内部的 watch(currentLang) 处理，
// 此处无需额外逻辑，避免重复触发。

// D5：获取当前启用的数字人形象配置（页面可见时自动刷新，确保管理后台切换后即时生效）
async function fetchActiveAvatar() {
  try {
    const res = await fetch('/api/avatars/active', { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    if (data && data.avatar) {
      const newConfig = {
        vrm_path: data.avatar.vrm_path || '',
        model_scale: data.avatar.model_scale || 3.25,
        rotation_y: data.avatar.rotation_y || 0,
        voice_type: data.avatar.voice_type || 'zh-CN-XiaoxiaoNeural',
        name: data.avatar.name || '小乐',
      }
      // 仅在配置实际变化时更新，避免不必要的模型重载
      // name 变化也需更新（切换数字人时名字跟随刷新；模型重载由 Avatar3D 内部 watch(modelPath) 控制）
      const cur = activeAvatarConfig.value
      if (cur.vrm_path !== newConfig.vrm_path ||
          cur.model_scale !== newConfig.model_scale ||
          cur.rotation_y !== newConfig.rotation_y ||
          cur.name !== newConfig.name) {
        activeAvatarConfig.value = newConfig
      }
    }
  } catch (e) {
    // 静默失败，不影响页面其他功能
  }
}

// 浏览器标签页切换回来时重新获取数字人配置
function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    fetchActiveAvatar()
  }
}

onMounted(() => {
  // 页面加载时确保语言状态正确
  // D5：获取当前启用的数字人形象配置
  fetchActiveAvatar()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

// UniApp 页面加载完成时设置浏览器标签页标题
onLoad(() => {
  // H5 端 nextTick 确保 DOM 就绪后再改 title，避免被框架覆盖
  nextTick(() => {
    document.title = '在线AI数字人导览'
  })
})

// UniApp 页面重新显示时（tabbar 切换回来）刷新数字人配置
onShow(() => {
  fetchActiveAvatar()
  // 设置浏览器标签页标题为"在线AI数字人导览"
  nextTick(() => {
    document.title = '在线AI数字人导览'
  })
})

onUnmounted(() => {
  ttsEngine.stop()
  stopCamera()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style lang="scss" scoped>
@import "@/styles/variables.scss";

/* ====== 布局容器：两栏（桌面）/纵向（移动端），中性背景 ====== */
.chat-container {
  display: flex;
  /* 减去底部 tabBar 高度（uni-app 的 --window-bottom 变量，含安全区），
     使外层容器恰好填满可视区、整页不产生纵向滚动；内部 chat-messages 仍可滚动。
     dvh 适配移动端地址栏伸缩，不支持时回退到上一行 vh */
  height: calc(100vh - var(--window-bottom, 50px));
  height: calc(100dvh - var(--window-bottom, 50px));
  overflow: hidden;
  box-sizing: border-box;
  background: #F5F7FA;
  font-family: $font-serif;
  line-height: 1.5;

  /* 响应式断点 - 移动端(<768px)：纵向布局，数字人区可折叠 */
  @media screen and (max-width: 767px) {
    flex-direction: column;
  }
}

/* ====== 左侧 3D 数字人区域：宽度 30%(±2%)，黄色 #FFD700 背景 ====== */
.left-panel {
  width: 26%;
  min-width: 24%;
  max-width: 28%;
  /* 与右侧对话区等高：去掉固定/最大高度，靠 flex 的 align-items:stretch 撑满，
     外边距与 .center-panel 一致（上下 16rpx），使两者高度完全相同；背景改白 */
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 24rpx;
  margin: 16rpx 4rpx 16rpx 16rpx;
  border-radius: 16rpx;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 0;
  overflow: hidden;
  z-index: 2;

  /* 移动端：折叠时占满宽度，高度收窄 */
  @media screen and (max-width: 767px) {
    width: 100%;
    max-width: 100%;
    min-height: 320px;
    max-height: 50vh;
    margin: 8rpx;
  }
}

/* 移动端背景板保护：确保数字人在窄屏下完整显示，不被压缩 */
@media screen and (max-width: 767px) {
  .avatar-stage {
    /* 移动端给背景板最小高度，保证3D数字人画布有足够空间 */
    min-height: 240px;
    /* 宽度限制为面板内宽的 90%，居中显示 */
    width: 90%;
    margin: 0 auto;
  }
}

/* 超窄屏（iPhone SE 等 <375px）进一步保护 */
@media screen and (max-width: 374px) {
  .avatar-stage {
    min-height: 200px;
    width: 96%;
  }
}

.panel-header {
  text-align: center;
  margin-bottom: 24rpx;

  .panel-title {
    display: block;
    font-size: 32rpx;
    color: #2b2b2b;
    margin-bottom: 12rpx;
    font-family: $font-serif;
    letter-spacing: 4rpx;
  }
}

.online-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;

  text {
    font-size: 28rpx;
    color: rgba(43, 43, 43, 0.7);
    font-family: $font-serif;
  }
}

.status-dot {
  width: 14rpx;
  height: 14rpx;
  background: #52c41a;
  border-radius: 50%;
}

.avatar-section {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
}

/* 背景板：与数字人画布像素级重合的统一容器，双重居中锚点。
   宽度 100% 填满 .avatar-section，高度自动撑开（flex:1），
   通过 inset:0 + margin:auto 实现稳定居中，不依赖 transform。 */
.avatar-stage {
  position: relative;
  flex: 1 1 0%;
  width: 100%;
  min-height: 0;
  border-radius: 24rpx;
  /* 视觉融合：渐变背景 + 阴影 + 微边框，使数字人融入背景板 */
  background: radial-gradient(ellipse at 50% 55%, rgba(167,139,250,0.12) 0%, rgba(167,139,250,0.04) 50%, transparent 82%);
  box-shadow:
    0 4rpx 40rpx rgba(0,0,0,0.06),
    inset 0 0 30rpx rgba(255,255,255,0.04);
  border: 1rpx solid rgba(167,139,250,0.12);
  overflow: hidden;
  transition: box-shadow 0.4s ease;
}

.chat-avatar-3d {
  /* 完全填满 .avatar-stage，数字人画布几何中心 = 背景板几何中心，
     实现水平+垂直双重精确居中；移除原 margin-top:-20% 负边距技巧，
     改用绝对定位填满背景板，避免溢出和裁切异常。 */
  position: absolute;
  inset: 0;
  margin: auto;
  width: 100%;
  height: 100%;
}

.avatar-footer {
  margin-top: 16rpx;
}

.avatar-label {
  font-size: 28rpx;
  color: rgba(43, 43, 43, 0.6);
}

.action-btn-wrapper {
  margin-top: auto;
  width: 100%;
  flex-shrink: 0;
  padding-top: 16rpx;
}

.voice-btn {
  width: 100%;
  height: 88rpx;
  background: rgba(0, 0, 0, 0.04);
  border: 1rpx solid rgba(0, 0, 0, 0.08);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;

  .btn-icon {
    font-size: 36rpx;
  }

  .btn-text {
    font-size: 28rpx;
    color: #2b2b2b;
    font-family: $font-serif;
    letter-spacing: 2rpx;
    white-space: nowrap;
    /* 中心展开底线效果：必须 inline-block 才能让伪元素的绝对定位宽度生效 */
    display: inline-block;
    position: relative;
    text-decoration: none;
    /* line-height 收紧到 1，让盒子高度=字号，底线距离可控 */
    line-height: 1;

    &::after {
      content: '';
      position: absolute;
      width: 0;
      height: 2px;
      /* bottom: -3px 让底线在文字字形下方约 3px 处展开（隔文字一点点距离） */
      bottom: -3px;
      left: 50%;
      background-color: #3b82f6;
      transition: all 0.3s ease;
    }
  }

  /* hover 触发器在按钮上：悬停按钮任意位置即展开底线 */
  &:hover .btn-text::after {
    width: 100%;
    left: 0;
  }

  &:active {
    background: rgba(0, 0, 0, 0.08);
  }
}

/* 移动端折叠按钮：仅在 <768px 显示，桌面端隐藏 */
.mobile-avatar-toggle {
  display: none;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  background: #E4E7ED;
  border-radius: 12rpx;
  cursor: pointer;
  flex-shrink: 0;

  text {
    font-size: 28rpx;
    color: #606266;
  }

  &:active {
    background: #d3d6db;
  }

  @media screen and (max-width: 767px) {
    display: flex;
  }
}

/* ====== 右侧聊天画布：纯白 #FFFFFF 背景，阴影分层 ====== */
.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  margin: 16rpx 16rpx 16rpx 8rpx;
  border-radius: 16rpx;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 0;
  overflow: hidden;

  @media screen and (max-width: 767px) {
    margin: 8rpx;
    flex: none;
    flex-grow: 1;
  }
}

/* ====== 聊天头部：中性色调，简约 ====== */
.chat-header {
  padding: 24rpx 32rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16rpx;
  }

  .header-title-group {
    display: flex;
    flex-direction: column;
    gap: 2rpx;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 24rpx;
  }
}

.title-text {
  font-size: 38rpx;
  color: #303133;
  font-family: $font-serif;
  letter-spacing: 4rpx;
}

.toggle-switch {
  display: flex;
  align-items: center;
  padding: 12rpx 24rpx;
  background: #F5F7FA;
  border-radius: 36rpx;
  cursor: pointer;
  transition: all 0.3s;

  &.active {
    background: #52c41a;

    .toggle-label {
      color: #fff;
    }
  }

  .toggle-label {
    font-size: 28rpx;
    color: #606266;
    white-space: nowrap;
    font-family: $font-serif;
    letter-spacing: 2rpx;
  }
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8rpx;

  text {
    font-size: 28rpx;
    color: #52c41a;
    font-family: $font-serif;
  }
}

.connection-dot {
  width: 12rpx;
  height: 12rpx;
  background: #52c41a;
  border-radius: 50%;
}

.ar-btn {
  min-width: 88rpx;
  padding: 12rpx 24rpx;
  border-radius: 12rpx;
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(106, 17, 203, 0.4);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.95);
  }
}

.ar-btn-text {
  font-size: 28rpx;
  font-weight: 500;
  color: #fff;
  letter-spacing: 2rpx;
}

/* ====== 消息列表：虚拟滚动由 scroll-view 原生支持 ====== */
.chat-messages {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 24rpx;
  box-sizing: border-box;
}

.message-item {
  display: flex;
  margin-bottom: 24rpx;

  &.user-message {
    justify-content: flex-end;

    .message-bubble {
      background: #E4E7ED;

      text {
        color: #303133;
      }
    }

    .message-content {
      align-items: flex-end;
    }
  }
}

.msg-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  flex-shrink: 0;

  &.user-avatar {
    background: #E4E7ED;
  }
}

.message-content {
  display: flex;
  flex-direction: column;
  max-width: 70%;
  margin: 0 16rpx;
}

/* ====== 消息气泡：圆角，与背景清晰分离 ====== */
.message-bubble {
  background: #F5F7FA;
  padding: 20rpx 28rpx;
  border-radius: 24rpx;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  .msg-image {
    display: block;
    width: 260rpx;
    height: 260rpx;
    border-radius: 16rpx;
    margin-bottom: 12rpx;
    object-fit: cover;
  }

  text {
    font-size: 28rpx;
    color: #303133;
    line-height: 1.5;
    font-family: $font-serif;
  }

  .user-message & {
    border-radius: 24rpx 8rpx 24rpx 24rpx;
  }
}

.message-time {
  font-size: 22rpx;
  color: #909399;
  margin-top: 8rpx;
  font-family: $font-serif;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  gap: 20rpx;
}

.loading-text {
  font-size: 28rpx;
  color: #909399;
  font-family: $font-serif;
}

.loading-dots {
  display: flex;
  gap: 12rpx;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  background: #909399;
  border-radius: 50%;
  animation: loading 1.4s infinite ease-in-out both;

  &:nth-child(1) { animation-delay: -0.32s; }
  &:nth-child(2) { animation-delay: -0.16s; }
}

@keyframes loading {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.typing-cursor {
  display: inline;
  font-size: 28rpx;
  color: #909399;
  margin-left: 4rpx;
  animation: blink 1s infinite;
}

/* ====== 输入区：简约，触控友好 ====== */
.chat-input-area {
  display: flex;
  flex-direction: column;
  padding: 0 24rpx 20rpx;
  border-top: 1rpx solid #E4E7ED;
  flex-shrink: 0;
}

.image-preview-bar {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 0;
  overflow-x: auto;
}

.preview-thumb {
  position: relative;
  width: 100rpx;
  height: 100rpx;
  border-radius: 16rpx;
  overflow: hidden;
  flex-shrink: 0;
  border: 1rpx solid #E4E7ED;

  .preview-img {
    width: 100%;
    height: 100%;
  }

  .preview-remove {
    position: absolute;
    top: -4rpx;
    right: -4rpx;
    width: 36rpx;
    height: 36rpx;
    background: rgba(0,0,0,0.55);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    color: #fff;
    z-index: 2;
  }
}

.input-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  position: relative;
  padding: 8rpx 12rpx;
  background: #F5F7FA;
  border: 2rpx solid #CDD0D6;
  border-radius: 20rpx;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus-within {
    border-color: #4080ff;
    box-shadow: 0 0 0 2rpx rgba(64, 128, 255, 0.12);
  }
}

.image-menu-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  background: transparent;
}

/* ====== 相机菜单过渡动画：淡入 + 轻微上移，淡出 + 下移 ====== */
.image-menu-enter-active,
.image-menu-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.image-menu-enter-from,
.image-menu-leave-to {
  opacity: 0;
  transform: translateY(12rpx);
}

.image-menu-popover {
  position: absolute;
  bottom: calc(100% + 8rpx);
  right: 0;
  background: #FFFFFF;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.15);
  padding: 8rpx 0;
  z-index: 100;
  min-width: 320rpx;
  overflow: hidden;

  .menu-item {
    padding: 18rpx 28rpx;
    font-size: 26rpx;
    color: #303133;
    white-space: nowrap;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    gap: 12rpx;

    image {
      width: 32rpx;
      height: 32rpx;
      flex-shrink: 0;
    }

    &:active {
      background: #F5F7FA;
    }
  }
}

.voice-input-area {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-top: 1rpx solid #E4E7ED;
  flex-shrink: 0;
}

.voice-hold-btn {
  flex: 1;
  min-height: 88rpx;
  background: #F5F7FA;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  user-select: none;
  -webkit-user-select: none;

  text {
    font-size: 28rpx;
    color: #303133;
    font-family: $font-serif;
    letter-spacing: 4rpx;
    white-space: nowrap;
  }

  &.recording {
    background: #ff4d4f;
    transform: scale(0.97);

    text {
      color: #fff;
    }
  }

  &:active {
    transform: scale(0.97);
  }
}

.chat-input {
  flex: 1;
  height: 64rpx;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0 24rpx;
  font-size: 28rpx;
  font-family: $font-serif;
  line-height: 1.5;
  color: #303133;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.action-icon-btn {
  width: 64rpx;
  height: 64rpx;
  min-width: 32px;
  min-height: 32px;
  background: #F5F7FA;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  /* 相机按钮往右上角微移：视觉上与发送按钮更协调 */
  transform: translate(2rpx, -3rpx);

  text {
    font-size: 28rpx;
  }
  image {
    width: 60%;
    height: 60%;
  }
}

/* 相机按钮与发送按钮之间的短竖线分隔 */
.action-divider {
  width: 2rpx;
  height: 32rpx;
  background: #d8d8d8;
  flex-shrink: 0;
}

.send-btn {
  width: 64rpx;
  height: 64rpx;
  min-width: 32px;
  min-height: 32px;
  background: transparent;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: 32rpx;
    color: #2b2b2b;
  }

  &:active {
    opacity: 0.6;
  }
}

/* ====== WebRTC 实时拍照取景器 ====== */
.camera-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.camera-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 16rpx) 32rpx 16rpx;
  z-index: 10;

  .camera-title { font-size: 34rpx; color: #fff }
  .camera-close, .camera-flip {
    width: 72rpx; height: 72rpx;
    display: flex; align-items: center; justify-content: center;
    font-size: 36rpx; color: #fff;
  }
}

.camera-viewport {
  flex: 1;
  width: 100%;
  position: relative;
  background: #000;
  overflow: hidden;
}

.camera-footer {
  padding: 40rpx 0 calc(env(safe-area-inset-bottom) + 40rpx);
  display: flex;
  justify-content: center;
  z-index: 10;
}

.camera-capture-btn {
  width: 120rpx;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  .capture-ring {
    width: 100%;
    height: 100%;
    border: 6rpx solid rgba(255,255,255,0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .capture-dot {
    width: 80rpx;
    height: 80rpx;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.15s;
  }

  &:active .capture-dot { transform: scale(0.85) }
}

/* 隐藏 UniApp 导航栏返回按钮 */
::v-deep .uni-page-head,
::v-deep .uni-navbar,
::v-deep .uni-page-head-btn {
  display: none !important;
}

/* ====== 猜你想问胶囊标签（首页专用，单行不换行，边框与输入框统一） ====== */
.suggest-wrap {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 12rpx 16rpx;
  margin-bottom: 12rpx;
  transition: opacity 0.2s ease;
  white-space: nowrap;

  &.suggest-fading {
    opacity: 0;
  }
}

.suggest-inner {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0 10rpx;
}
.suggest-pill {
  display: inline-flex;
  align-items: center;
  background: #FFFFFF;        /* 纯白底色，与输入框底色保持一致 */
  border: 2rpx solid #CDD0D6; /* 与输入框边框完全一致：2px实线同色 */
  border-radius: 20rpx;      /* 与输入框圆角尺寸统一 */
  padding: 6rpx 12rpx;      /* 上下6rpx，左右12rpx */
  font-size: 24rpx;
  color: #303133;
  font-family: $font-serif;
  white-space: nowrap;        /* 文字不自动换行 */
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;           /* 禁止收缩，固定尺寸 */

  &:hover {
    background: #F5F7FA;    /* 底色小幅变浅 */
    border-color: #B0B3B8;  /* 边框轻微加深 */
    /* 无放大、无阴影 */
  }

  &:active {
    background: #E8EAED;
  }
}

/* 隐藏 UniApp 导航栏返回按钮 */
::v-deep .uni-page-head,
::v-deep .uni-navbar,
::v-deep .uni-page-head-btn {
  display: none !important;
}
</style>
