<template>
  <view class="chat-container">
    <view class="left-panel" v-show="!isMobile || mobileAvatarVisible">
      <view class="panel-header">
        <text class="panel-title">AI导游 - 小乐</text>
        <view class="online-status">
          <view class="status-dot"></view>
          <text>在线服务</text>
        </view>
      </view>

      <view class="avatar-section">
        <Avatar3D ref="avatarRef" :vertical-offset-ratio="0" :full-body-fit="true" :disable-zoom="true" class="chat-avatar-3d" />
        <view class="avatar-footer">
          <text class="avatar-label">3D虚拟导游 | 支持语音交互</text>
        </view>
      </view>

      <view class="action-btn-wrapper">
        <button class="voice-btn" @click="toggleVoiceMode">
          <text class="btn-icon">{{ isVoiceMode ? '✏️' : '🎤' }}</text>
          <text class="btn-text">{{ isVoiceMode ? '文字输入' : '语音聊天' }}</text>
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
            <text class="title-text">智能对话</text>
          </view>
        </view>
        <view class="header-right">
          <view class="map-btn" @click="goToMap">
            <text class="map-btn-text">地图</text>
          </view>
          <view class="toggle-switch" :class="{ active: voiceEnabled }" @click="toggleVoiceEnabled">
            <text class="toggle-label">语音播报</text>
          </view>
          <view class="connection-status">
            <view class="connection-dot"></view>
            <text>已连接</text>
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
        <!-- 骨架屏：消息列表为空时的渐进式加载占位 -->
        <view v-if="messages.length === 0 && !isTyping" class="skeleton-list">
          <view class="skeleton-item" v-for="n in 4" :key="n">
            <view class="skeleton-avatar"></view>
            <view class="skeleton-bubble">
              <view class="skeleton-line"></view>
              <view class="skeleton-line short"></view>
            </view>
          </view>
        </view>

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
            src="/static/icons/user.png"
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
          <text class="loading-text">小乐正在思考...</text>
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
        <view class="input-row">
          <input 
            ref="inputRef"
            class="chat-input" 
            v-model="inputMessage"
            placeholder="输入您的问题..."
            :adjust-position="true"
            @confirm="sendText"
          />
          <view class="input-actions">
            <view class="action-icon-btn" @click="toggleImageMenu">
              <text>📷</text>
            </view>
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
          <text v-if="!isRecording">按住说话</text>
          <text v-else>正在听...</text>
        </view>
        <view class="action-icon-btn" @click="toggleImageMenu">
          <text>📷</text>
        </view>
      </view>

      <!-- 📷 菜单（拍照/相册选择） -->
      <view v-if="showImageMenu" class="overlay" @click="closeImageMenu">
        <view class="action-sheet" @click.stop="">
          <view class="action-item" @click="pickCamera"><text>📸 拍照</text></view>
          <view class="action-item" @click="pickGallery"><text>🖼️ 从相册选择</text></view>
          <view class="action-cancel" @click="closeImageMenu"><text>取消</text></view>
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
      <text class="camera-title">拍照</text>
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
</template>

<script setup lang="ts">
import { ref, nextTick, computed, watch, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import type { AvatarConfig, ChatMessage, Spot } from '@/types'
import { mockAvatars } from '@/data/mock'
import { aiResponder } from '@/utils/aiResponder-doubao'
import { getSafeImageUrl } from '@/utils/imageConfig'
import { ttsEngine } from '@/utils/ttsEngine'
import Avatar3D from '@/components/Avatar3D.vue'

const chatStore = useChatStore()
const userStore = useUserStore()
const currentAvatar = ref<AvatarConfig>(mockAvatars[0])
const avatarRef = ref()
const inputRef = ref()

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
  { id: 'lingshan', name: '灵山胜境', description: '佛教文化旅游胜地', imageUrl: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=Lingshan%20Grand%20Buddha%20scenic%20area%20magnificent%20Buddha%20statue%20peaceful%20atmosphere&image_size=landscape_4_3'), duration: 180, order: 1 },
  { id: 'dahua', name: '拈花湾', description: '禅意小镇，心灵栖息地', imageUrl: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=Zen%20garden%20town%20Japanese%20style%20peaceful%20meditation%20garden&image_size=landscape_4_3'), duration: 120, order: 2 },
  { id: 'xihu', name: '杭州西湖', description: '人间天堂', imageUrl: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=West%20Lake%20Hangzhou%20beautiful%20scenery%20traditional%20pagoda%20willow%20trees&image_size=landscape_4_3'), duration: 240, order: 3 },
  { id: 'qiantang', name: '钱塘江', description: '天下第一潮', imageUrl: getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=Qiantang%20River%20tide%20spectacular%20waves%20nature%20power&image_size=landscape_4_3'), duration: 90, order: 4 }
])

const recommendations = ref([
  { icon: '🌸', title: '春季赏花推荐', desc: '樱花、桃花、油菜花最佳观赏时间', action: 'spring' },
  { icon: '☀️', title: '夏日避暑胜地', desc: '清凉一夏的纳凉好去处', action: 'summer' }
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
  const userMessage = inputMessage.value.trim() || '请帮我看看这张图片'
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
    aiResponder.setUserProfile({ age: userStore.user?.age })
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
          if (!fullText) fullText = '抱歉，我暂时无法识别这张图片，请稍后再试~'
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
          if (!fullText) fullText = '抱歉，我暂时无法回答，请稍后再试~'
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
      } catch (_) {}
    }

    // 5. 文字显示 → 逐字打字
    isPreparing.value = false
    isTyping.value = true
    typingContent.value = ''

    // 【3D 数字人联动】用文本驱动伪口型，让嘴型与正在播报的内容同步
    if (avatarRef.value) {
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

    // 【3D 数字人联动】根据 AI 情绪驱动表情：positive→开心, negative→难过, neutral→自然
    if (avatarRef.value) {
      avatarRef.value.setEmotion(emotion)
      avatarRef.value.stopSpeaking()
    }
  } catch (err) {
    if (gen !== sendGeneration) return
    console.error('发送失败:', err)
    isPreparing.value = false
    isTyping.value = false
    typingContent.value = ''
    chatStore.addMessage({
      userId: 'ai',
      content: '抱歉，我暂时无法回答，请稍后再试~',
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
    uni.showToast({ title: '当前浏览器不支持语音识别', icon: 'none' })
    return null
  }
  const rec = new SpeechRecognition()
  rec.lang = 'zh-CN'
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
      uni.showToast({ title: '请授权麦克风权限', icon: 'none' })
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
      inputMessage.value = '附近有什么景点？'
      break
    case 'weather':
      inputMessage.value = '今天天气怎么样？'
      break
    case 'food':
      inputMessage.value = '有什么美食推荐？'
      break
    case 'route':
      inputMessage.value = '推荐一下游览路线'
      break
    case 'spring':
      inputMessage.value = '春季赏花推荐'
      break
    case 'summer':
      inputMessage.value = '夏日避暑胜地'
      break
  }
  // 自动发送
  nextTick(() => sendText())
}

const goToSpot = (spotId: string) => {
  inputMessage.value = `介绍一下${spotId === 'lingshan' ? '灵山胜境' : spotId === 'dahua' ? '拈花湾' : spotId === 'xihu' ? '杭州西湖' : '钱塘江'}`
  nextTick(() => sendText())
}

const goToMap = () => {
  // 跳转到地图页面（现为底部 tab，用 switchTab）
  uni.switchTab({ url: '/pages/visitor/location' })
}

const loadMore = () => {
  console.log('Load more messages')
}

onUnmounted(() => {
  ttsEngine.stop()
  stopCamera()
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
  font-family: $font-body;
  line-height: 1.5;

  /* 响应式断点 - 移动端(<768px)：纵向布局，数字人区可折叠 */
  @media screen and (max-width: 767px) {
    flex-direction: column;
  }
}

/* ====== 左侧 3D 数字人区域：宽度 30%(±2%)，黄色 #FFD700 背景 ====== */
.left-panel {
  width: 30%;
  min-width: 28%;
  max-width: 32%;
  /* 与右侧对话区等高：去掉固定/最大高度，靠 flex 的 align-items:stretch 撑满，
     外边距与 .center-panel 一致（上下 16rpx），使两者高度完全相同；背景改白 */
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 24rpx;
  margin: 16rpx 8rpx 16rpx 16rpx;
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

.panel-header {
  text-align: center;
  margin-bottom: 24rpx;

  .panel-title {
    display: block;
    font-size: 32rpx;
    color: #2b2b2b;
    margin-bottom: 12rpx;
    font-family: $font-plaque;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.chat-avatar-3d {
  /* 画布上移 + 向下生长：负 margin-top 把画布顶部上拉，flex:1 让画布向下生长，
     直至刚好停在"3D虚拟导游"页脚文字之上（页脚自带 margin-top 形成一小段间距）。
     画布变长、下边界贴页脚；模型在画布内取景不变（ratio=0 居中），保持全身不裁切。
     注意：画布变长后 fullBodyFit 会按比例放大模型，过大可调小 FIT。 */
  flex: 1 1 0%;
  margin-top: -20%;
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
    font-family: $font-body;
    letter-spacing: 2rpx;
    white-space: nowrap;
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
  margin: 16rpx 16rpx 16rpx 24rpx;
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
  border-bottom: 1rpx solid #E4E7ED;
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
  font-family: $font-plaque;
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
    font-family: $font-nav;
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
    font-family: $font-nav;
  }
}

.connection-dot {
  width: 12rpx;
  height: 12rpx;
  background: #52c41a;
  border-radius: 50%;
}

.map-btn {
  min-width: 88rpx;
  min-height: 88rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  background: #F5F7FA;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.95);
  }
}

.map-btn-text {
  font-size: 28rpx;
  color: #606266;
  font-family: $font-body;
  letter-spacing: 2rpx;
  line-height: 1;
}

/* ====== 消息列表：虚拟滚动由 scroll-view 原生支持 ====== */
.chat-messages {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 24rpx;
  box-sizing: border-box;
}

/* ====== 骨架屏：消息为空时渐进式加载占位 ====== */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  padding: 16rpx 0;
}

.skeleton-item {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
}

.skeleton-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #F5F7FA;
  flex-shrink: 0;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-bubble {
  flex: 1;
  max-width: 60%;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.skeleton-line {
  height: 28rpx;
  background: #F5F7FA;
  border-radius: 8rpx;
  animation: skeleton-pulse 1.5s ease-in-out infinite;

  &.short {
    width: 60%;
  }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
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
    font-family: $font-body;
  }

  .user-message & {
    border-radius: 24rpx 8rpx 24rpx 24rpx;
  }
}

.message-time {
  font-size: 22rpx;
  color: #909399;
  margin-top: 8rpx;
  font-family: $font-decor;
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
}

.overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 800;
  display: flex;
  align-items: flex-end;
}

.action-sheet {
  width: 100%;
  background: #FFFFFF;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: calc(env(safe-area-inset-bottom) + 16rpx);
  overflow: hidden;
}

.action-item {
  padding: 36rpx 0;
  text-align: center;
  font-size: 32rpx;
  color: #303133;
  border-bottom: 1rpx solid #E4E7ED;
  transition: background 0.15s;

  &:active { background: #F5F7FA }
}

.action-cancel {
  padding: 28rpx 0;
  text-align: center;
  font-size: 30rpx;
  color: #909399;
  border-top: 10rpx solid #F5F7FA;
  transition: background 0.15s;

  &:active { background: #F5F7FA }
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
    font-family: $font-body;
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
  height: 88rpx;
  background: #F5F7FA;
  border-radius: 44rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
  font-family: $font-body;
  line-height: 1.5;
  color: #303133;
}

.input-actions {
  display: flex;
  gap: 16rpx;
}

.action-icon-btn {
  width: 88rpx;
  height: 88rpx;
  min-width: 44px;
  min-height: 44px;
  background: #F5F7FA;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: 32rpx;
  }
}

.send-btn {
  width: 88rpx;
  height: 88rpx;
  min-width: 44px;
  min-height: 44px;
  background: #FFD700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: 36rpx;
    color: #2b2b2b;
  }

  &:active {
    transform: scale(0.95);
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
</style>
