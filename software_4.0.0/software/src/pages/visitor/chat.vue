<template>
  <view class="chat-container">
    <view class="left-panel">
      <view class="panel-header">
        <text class="panel-title">AI导游 - 小乐</text>
        <view class="online-status">
          <view class="status-dot"></view>
          <text>在线服务</text>
        </view>
      </view>
      
      <view class="avatar-section">
        <SimpleAvatar2D ref="avatarRef" />
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
import type { AvatarConfig, ChatMessage, Spot } from '@/types'
import { mockAvatars } from '@/data/mock'
import { aiResponder } from '@/utils/aiResponder-doubao'
import { getSafeImageUrl } from '@/utils/imageConfig'
import { ttsEngine } from '@/utils/ttsEngine'
import SimpleAvatar2D from '@/components/SimpleAvatar2D.vue'

const chatStore = useChatStore()
const currentAvatar = ref<AvatarConfig>(mockAvatars[0])
const avatarRef = ref()
const inputRef = ref()

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
  isPreparing.value = true
  if (avatarRef.value) {
    avatarRef.value.startSpeaking()
  }

  try {
    // 3. 后台获取 AI 回复（有图走多模态，无图走文本）
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

    if (avatarRef.value) {
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
  // 跳转到地图页面
  uni.navigateTo({ url: '/pages/visitor/location' })
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

.chat-container {
  display: flex;
  height: 100vh;
  background: #f7f2e3;
  font-family: $font-body;
  line-height: 1.4;
  
  @media screen and (max-width: 768px) {
    flex-direction: column;
  }
}

.left-panel {
  width: 280rpx;
  background: linear-gradient(180deg, #c4a45a 0%, #9a7630 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx 24rpx;
  
  @media screen and (max-width: 768px) {
    width: 100%;
    padding: 24rpx;
  }
}

.panel-header {
  text-align: center;
  margin-bottom: 24rpx;
  
  .panel-title {
    display: block;
    font-size: 32rpx;
    color: #fff;
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
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.8);
  }
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  background: #52c41a;
  border-radius: 50%;
}

.avatar-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.avatar-footer {
  margin-top: 16rpx;
}

.avatar-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}

.action-btn-wrapper {
  margin-top: 24rpx;
  width: 100%;
}

.voice-btn {
  width: 100%;
  height: 80rpx;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  
  .btn-icon {
    font-size: 36rpx;
  }
  
  .btn-text {
    font-size: 26rpx;
    color: #fff;
    font-family: $font-body;
    letter-spacing: 2rpx;
    white-space: nowrap;
  }
  
  &:active {
    background: rgba(255, 255, 255, 0.3);
  }
}

.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  margin: 16rpx 16rpx 16rpx 24rpx;  /* 左边距加大，拉开与数字人面板的间距 */
  border-radius: 24rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.08);
  min-height: 0;

  @media screen and (max-width: 768px) {
    margin: 8rpx;
    flex: none;
    flex-grow: 1;
  }
}

.chat-header {
  padding: 20rpx 28rpx;
  border-bottom: 2rpx solid #f0f0f0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }

  .header-title-group {
    display: flex;
    flex-direction: column;
    gap: 2rpx;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 20rpx;
  }
}

.title-icon {
  font-size: 36rpx;
}

.title-text {
  font-size: 38rpx;
  color: #333;
  font-family: $font-plaque;
  letter-spacing: 4rpx;
}

.subtitle {
  font-size: 20rpx;
  color: #bbb;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 32rpx;
}

.toggle-switch {
  display: flex;
  align-items: center;
  padding: 8rpx 20rpx;
  background: #f0f0f0;
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
    font-size: 24rpx;
    color: #666;
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
    font-size: 22rpx;
    color: #52c41a;
    font-family: $font-nav;
  }
}

.connection-dot {
  width: 10rpx;
  height: 10rpx;
  background: #52c41a;
  border-radius: 50%;
}

.map-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(139, 115, 85, 0.4);
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.92);
  }
}

.map-btn-text {
  font-size: 30rpx;
  color: #f5f0e6;
  font-family: $font-body;
  letter-spacing: 2rpx;
  font-weight: normal;
  line-height: 1;
}

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
      background: linear-gradient(135deg, #c4a45a 0%, #9a7630 100%);
      
      text {
        color: #fff;
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
    background: #f0f0f0;
  }
}

.message-content {
  display: flex;
  flex-direction: column;
  max-width: 70%;
  margin: 0 16rpx;
}

.message-bubble {
  background: #f5f5f5;
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);

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
    color: #333;
    line-height: 1.4;
    font-family: $font-body;
  }

  .user-message & {
    border-radius: 24rpx 8rpx 24rpx 24rpx;
  }
}

.message-time {
  font-size: 22rpx;
  color: #999;
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
  font-size: 26rpx;
  color: #999;
}

.loading-dots {
  display: flex;
  gap: 12rpx;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  background: #c4a45a;
  border-radius: 50%;
  animation: loading 1.4s infinite ease-in-out both;
  
  &:nth-child(1) { animation-delay: -0.32s; }
  &:nth-child(2) { animation-delay: -0.16s; }
}

@keyframes loading {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.typing-cursor {
  display: inline;
  font-size: 28rpx;
  color: #c4a45a;
  margin-left: 4rpx;
  animation: blink 1s infinite;
}

.chat-input-area {
  display: flex;
  flex-direction: column;
  padding: 0 24rpx 20rpx;
  border-top: 2rpx solid #f0f0f0;
  flex-shrink: 0;
}

/* 图片预览条 */
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
  border: 2rpx solid #eee;

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

/* 输入行 */
.input-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  position: relative;
}

/* 📷 拍照操作菜单 */
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
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: calc(env(safe-area-inset-bottom) + 16rpx);
  overflow: hidden;
}

.action-item {
  padding: 36rpx 0;
  text-align: center;
  font-size: 32rpx;
  color: #333;
  border-bottom: 1rpx solid #f0f0f0;
  transition: background 0.15s;

  &:active { background: #f5f5f5 }
}

.action-cancel {
  padding: 28rpx 0;
  text-align: center;
  font-size: 30rpx;
  color: #999;
  border-top: 10rpx solid #f5f5f5;
  transition: background 0.15s;

  &:active { background: #f5f5f5 }
}

.voice-input-area {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-top: 2rpx solid #f0f0f0;
  flex-shrink: 0;
}

.voice-hold-btn {
  flex: 1;
  height: 80rpx;
  background: linear-gradient(135deg, #c4a45a 0%, #9a7630 100%);
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  user-select: none;
  -webkit-user-select: none;

  text {
    font-size: 26rpx;
    color: #fff;
    font-family: $font-body;
    letter-spacing: 4rpx;
    white-space: nowrap;
  }
  
  &.recording {
    background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%);
    transform: scale(0.97);
  }
  
  &:active {
    transform: scale(0.97);
  }
}

.chat-input {
  flex: 1;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 40rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
  font-family: $font-body;
  line-height: 1.4;
}

.input-actions {
  display: flex;
  gap: 16rpx;
}

.action-icon-btn {
  width: 72rpx;
  height: 72rpx;
  background: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: 32rpx;
  }
}

.send-btn {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #c4a45a 0%, #9a7630 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: 36rpx;
    color: #fff;
  }
}

.right-panel {
  width: 320rpx;
  background: #fff;
  margin: 16rpx 16rpx 16rpx 0;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  
  @media screen and (max-width: 768px) {
    display: none;
  }
}

.right-panel .panel-header {
  padding: 24rpx;
  border-bottom: 2rpx solid #f0f0f0;
  
  .panel-title {
    font-size: 30rpx;
  }
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  padding: 20rpx;
}

.quick-action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.action-icon-box {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .icon {
    font-size: 36rpx;
  }
  
  &.location {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
  
  &.weather {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  }
  
  &.food {
    background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  }
  
  &.route {
    background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
  }
}

.action-name {
  font-size: 22rpx;
  color: #666;
}

.section-divider {
  padding: 16rpx 20rpx;
  border-top: 2rpx solid #f0f0f0;
}

.section-divider .section-title {
  font-size: 26rpx;
  color: #333;
}

.hot-spots-list {
  padding: 0 20rpx;
}

.hot-spot-item {
  display: flex;
  gap: 12rpx;
  padding: 12rpx 0;
  
  &:not(:last-child) {
    border-bottom: 2rpx solid #f5f5f5;
  }
}

.spot-thumb {
  width: 64rpx;
  height: 64rpx;
  border-radius: 12rpx;
}

.spot-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.spot-name {
  font-size: 26rpx;
  color: #333;
}

.spot-tag {
  font-size: 20rpx;
  color: #999;
}

.recommendations-list {
  padding: 12rpx 20rpx;
}

.recommendation-item {
  display: flex;
  gap: 12rpx;
  padding: 12rpx 0;
  
  &:not(:last-child) {
    border-bottom: 2rpx solid #f5f5f5;
  }
}

.rec-icon {
  font-size: 32rpx;
}

.rec-content {
  flex: 1;
}

.rec-title {
  display: block;
  font-size: 24rpx;
  color: #333;
}

.rec-desc {
  font-size: 20rpx;
  color: #999;
}

.banner-section {
  position: relative;
  margin: 16rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

.banner-img {
  width: 100%;
  height: 160rpx;
}

.banner-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16rpx;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
}

.banner-title {
  display: block;
  font-size: 26rpx;
  color: #fff;
}

.banner-subtitle {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.8);
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
