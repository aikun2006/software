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
        <DigitalAvatar3D ref="avatarRef" />
        <view class="avatar-footer">
          <text class="avatar-label">3D虚拟导游 | 支持语音交互</text>
        </view>
      </view>
      
      <view class="action-btn-wrapper">
        <button class="voice-btn" @click="startVoiceChat">
          <text class="btn-icon">🎤</text>
          <text class="btn-text">语音聊天</text>
        </button>
      </view>
    </view>

    <view class="center-panel">
      <view class="panel-header chat-header">
        <view class="header-title">
          <text class="title-icon">💬</text>
          <text class="title-text">智能对话</text>
        </view>
        <text class="subtitle">随时向我提问，获取专业的旅游建议</text>
        <view class="header-controls">
          <view class="toggle-switch">
            <view class="toggle-track" :class="{ active: voiceEnabled }" @click="toggleVoiceEnabled">
              <view class="toggle-thumb"></view>
            </view>
            <text class="toggle-label">语音播报</text>
          </view>
          <view class="connection-status">
            <view class="connection-dot"></view>
            <text>服务器已连接</text>
          </view>
        </view>
      </view>

      <scroll-view 
        class="chat-messages" 
        scroll-y 
        :scroll-top="scrollTop"
        @scrolltolower="loadMore"
      >
        <view 
          class="message-item" 
          v-for="(msg, index) in messages" 
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

        <view v-if="isLoading" class="loading-indicator">
          <view class="loading-dots">
            <view class="dot"></view>
            <view class="dot"></view>
            <view class="dot"></view>
          </view>
        </view>
      </scroll-view>

      <view class="chat-input-area">
        <input 
          class="chat-input" 
          v-model="inputMessage"
          placeholder="输入您的问题..."
          :adjust-position="true"
          @confirm="sendText"
        />
        <view class="input-actions">
          <view class="action-icon-btn" @click="toggleVoiceMode">
            <text>{{ isVoiceMode ? '✏️' : '🎙️' }}</text>
          </view>
          <view class="send-btn" @click="sendMessage">
            <text>➤</text>
          </view>
        </view>
      </view>
    </view>

    <view class="right-panel">
      <view class="panel-header">
        <text class="panel-title">快速操作</text>
      </view>
      
      <view class="quick-actions-grid">
        <view class="quick-action-item" @click="actionClick('location')">
          <view class="action-icon-box location">
            <text class="icon">📍</text>
          </view>
          <text class="action-name">附近景点</text>
        </view>
        <view class="quick-action-item" @click="actionClick('weather')">
          <view class="action-icon-box weather">
            <text class="icon">☁️</text>
          </view>
          <text class="action-name">天气查询</text>
        </view>
        <view class="quick-action-item" @click="actionClick('food')">
          <view class="action-icon-box food">
            <text class="icon">🍽️</text>
          </view>
          <text class="action-name">美食推荐</text>
        </view>
        <view class="quick-action-item" @click="actionClick('route')">
          <view class="action-icon-box route">
            <text class="icon">🧭</text>
          </view>
          <text class="action-name">路线规划</text>
        </view>
      </view>

      <view class="section-divider">
        <text class="section-title">热门景点</text>
      </view>
      
      <view class="hot-spots-list">
        <view class="hot-spot-item" v-for="spot in hotSpots" :key="spot.id" @click="goToSpot(spot.id)">
          <image class="spot-thumb" :src="spot.imageUrl" mode="aspectFill" />
          <view class="spot-info">
            <text class="spot-name">{{ spot.name }}</text>
            <text class="spot-tag">{{ spot.description }}</text>
          </view>
        </view>
      </view>

      <view class="section-divider">
        <text class="section-title">智能推荐</text>
      </view>
      
      <view class="recommendations-list">
        <view class="recommendation-item" v-for="rec in recommendations" :key="rec.title" @click="actionClick(rec.action)">
          <view class="rec-icon">{{ rec.icon }}</view>
          <view class="rec-content">
            <text class="rec-title">{{ rec.title }}</text>
            <text class="rec-desc">{{ rec.desc }}</text>
          </view>
        </view>
      </view>

      <view class="banner-section">
        <image class="banner-img" :src="getSafeImageUrl('https://neeko-copilot.bytedance.net/api/text_to_image?prompt=beautiful%20night%20scene%20of%20ancient%20Chinese%20town%20with%20red%20lanterns%20traditional%20architecture%20river%20reflection&image_size=landscape_16_9')" mode="aspectFill" />
        <view class="banner-overlay">
          <text class="banner-title">夜游古镇</text>
          <text class="banner-subtitle">感受千年韵味</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import type { AvatarConfig, ChatMessage, Spot } from '@/types'
import { mockAvatars, mockRoutes } from '@/data/mock'
import { aiResponder } from '@/utils/aiResponder'
import { getSafeImageUrl } from '@/utils/imageConfig'
import DigitalAvatar3D from '@/components/DigitalAvatar3D.vue'

const chatStore = useChatStore()
const currentAvatar = ref<AvatarConfig>(mockAvatars[0])
const avatarRef = ref()

const messages = ref(chatStore.messages)
const isLoading = ref(chatStore.isLoading)
const inputMessage = ref('')
const isVoiceMode = ref(false)
const voiceEnabled = ref(true)
const scrollTop = ref(0)

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

watch(() => chatStore.messages, (newMessages) => {
  messages.value = newMessages
  nextTick(() => {
    scrollTop.value = 99999
  })
}, { deep: true })

watch(() => chatStore.isLoading, (loading) => {
  isLoading.value = loading
})

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const sendText = () => {
  if (!inputMessage.value.trim()) return
  const userMessage = inputMessage.value.trim()
  inputMessage.value = ''
  
  const userMsg: Omit<ChatMessage, 'id'> = {
    userId: 'visitor',
    content: userMessage,
    type: 'text',
    isUser: true,
    timestamp: new Date().toISOString()
  }
  chatStore.addMessage(userMsg)
  
  if (avatarRef.value) {
    avatarRef.value.startSpeaking()
  }
  
  isLoading.value = true
  setTimeout(() => {
    const response = aiResponder.getResponse(userMessage)
    
    if (avatarRef.value) {
      if (response.emotion === 'positive') {
        avatarRef.value.setExpression('happy')
      } else if (response.emotion === 'negative') {
        avatarRef.value.setExpression('surprised')
      } else {
        avatarRef.value.setExpression('smile')
      }
      avatarRef.value.stopSpeaking()
    }
    
    const aiMsg: Omit<ChatMessage, 'id'> = {
      userId: 'ai',
      content: response.answer,
      type: 'text',
      isUser: false,
      timestamp: new Date().toISOString(),
      emotion: response.emotion
    }
    chatStore.addMessage(aiMsg)
    isLoading.value = false
  }, 1000 + Math.random() * 1000)
}

const sendMessage = () => {
  if (isVoiceMode.value) {
    toggleRecording()
  } else {
    sendText()
  }
}

const toggleVoiceMode = () => {
  isVoiceMode.value = !isVoiceMode.value
}

const toggleVoiceEnabled = () => {
  voiceEnabled.value = !voiceEnabled.value
}

const toggleRecording = () => {
  uni.showToast({ title: isVoiceMode.value ? '录音结束' : '开始录音', icon: 'none' })
  isVoiceMode.value = false
}

const startVoiceChat = () => {
  uni.showToast({ title: '语音聊天功能', icon: 'none' })
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
}

const goToSpot = (spotId: string) => {
  inputMessage.value = `介绍一下${spotId === 'lingshan' ? '灵山胜境' : spotId === 'dahua' ? '拈花湾' : spotId === 'xihu' ? '杭州西湖' : '钱塘江'}`
}

const loadMore = () => {
  console.log('Load more messages')
}
</script>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  height: 100vh;
  background: #f0f2f5;
  
  @media screen and (max-width: 768px) {
    flex-direction: column;
  }
}

.left-panel {
  width: 280rpx;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
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
    font-weight: 600;
    color: #fff;
    margin-bottom: 12rpx;
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
    font-size: 28rpx;
    color: #fff;
    font-weight: 500;
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
  margin: 16rpx;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.08);
  
  @media screen and (max-width: 768px) {
    margin: 8rpx;
    flex: none;
    flex-grow: 1;
  }
}

.chat-header {
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid #f0f0f0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.title-icon {
  font-size: 36rpx;
}

.title-text {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

.subtitle {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 16rpx;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 32rpx;
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.toggle-track {
  width: 64rpx;
  height: 36rpx;
  background: #e8e8e8;
  border-radius: 18rpx;
  position: relative;
  transition: background 0.3s;
  
  &.active {
    background: #52c41a;
  }
}

.toggle-thumb {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 28rpx;
  height: 28rpx;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.3s;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
  
  .toggle-track.active & {
    transform: translateX(28rpx);
  }
}

.toggle-label {
  font-size: 24rpx;
  color: #666;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  
  text {
    font-size: 22rpx;
    color: #52c41a;
  }
}

.connection-dot {
  width: 10rpx;
  height: 10rpx;
  background: #52c41a;
  border-radius: 50%;
}

.chat-messages {
  flex: 1;
  padding: 24rpx;
}

.message-item {
  display: flex;
  margin-bottom: 24rpx;
  
  &.user-message {
    justify-content: flex-end;
    
    .message-bubble {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      
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
  
  text {
    font-size: 28rpx;
    color: #333;
    line-height: 1.6;
  }
  
  .user-message & {
    border-radius: 24rpx 8rpx 24rpx 24rpx;
  }
}

.message-time {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.loading-indicator {
  display: flex;
  justify-content: center;
  padding: 24rpx;
}

.loading-dots {
  display: flex;
  gap: 12rpx;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  background: #667eea;
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

.chat-input-area {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-top: 2rpx solid #f0f0f0;
}

.chat-input {
  flex: 1;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 40rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  font-weight: 600;
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
  font-weight: 500;
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
  font-weight: 500;
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
  font-weight: 600;
  color: #fff;
}

.banner-subtitle {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.8);
}
</style>
