<template>
  <view class="container">
    <view class="header">
      <view class="header-content">
        <text class="title">AI数字人导游</text>
        <text class="subtitle">智能导览，畅游景区</text>
      </view>
      <view class="avatar-section">
        <DigitalAvatar3D ref="avatarRef" :show-controls="true" @expression-change="onExpressionChange" />
        <text class="avatar-name">{{ currentAvatar?.name || '智能导游' }}</text>
      </view>
    </view>

    <view class="quick-actions">
      <view class="action-card" @click="startChat">
        <view class="action-icon chat">
          <text class="icon-text">💬</text>
        </view>
        <text class="action-title">智能问答</text>
        <text class="action-desc">随时为您解答景区疑问</text>
      </view>
      <view class="action-card" @click="goToRoutes">
        <view class="action-icon route">
          <text class="icon-text">🗺️</text>
        </view>
        <text class="action-title">游览路线</text>
        <text class="action-desc">为您推荐专属路线</text>
      </view>
      <view class="action-card" @click="goToLocation">
        <view class="action-icon location">
          <text class="icon-text">📍</text>
        </view>
        <text class="action-title">位置追踪</text>
        <text class="action-desc">记录您的游览轨迹</text>
      </view>
    </view>

    <view class="features">
      <view class="section-title">核心功能</view>
      <view class="feature-list">
        <view class="feature-item">
          <view class="feature-icon">🎙️</view>
          <view class="feature-info">
            <text class="feature-title">语音交互</text>
            <text class="feature-desc">支持语音输入输出</text>
          </view>
        </view>
        <view class="feature-item">
          <view class="feature-icon">🧠</view>
          <view class="feature-info">
            <text class="feature-title">智能问答</text>
            <text class="feature-desc">准确解答景区知识</text>
          </view>
        </view>
        <view class="feature-item">
          <view class="feature-icon">🎭</view>
          <view class="feature-info">
            <text class="feature-title">情感互动</text>
            <text class="feature-desc">表情丰富自然</text>
          </view>
        </view>
        <view class="feature-item">
          <view class="feature-icon">🎯</view>
          <view class="feature-info">
            <text class="feature-title">个性化推荐</text>
            <text class="feature-desc">根据兴趣定制路线</text>
          </view>
        </view>
      </view>
    </view>

    <view class="spotlight">
      <view class="section-title">热门景点</view>
      <scroll-view class="spot-scroll" scroll-x enable-flex>
        <view class="spot-card" v-for="spot in hotSpots" :key="spot.id" @click="showSpotDetail(spot)">
          <image class="spot-img" :src="spot.imageUrl" mode="aspectFill" />
          <view class="spot-info">
            <text class="spot-name">{{ spot.name }}</text>
            <text class="spot-desc">{{ spot.description }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="bottom-btn">
      <button class="btn btn-primary btn-lg btn-block" @click="startChat">
        <text>开始导览</text>
      </button>
    </view>

    <view class="admin-entry" @click="goToAdmin">
      <text>管理员入口</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { AvatarConfig, Spot } from '@/types'
import { mockAvatars, mockRoutes } from '@/data/mock'
import DigitalAvatar3D from '@/components/DigitalAvatar3D.vue'

const currentAvatar = ref<AvatarConfig>(mockAvatars[0])
const avatarRef = ref()

const hotSpots = ref<Spot[]>([
  ...mockRoutes[0].spots.slice(0, 3),
  ...mockRoutes[1].spots.slice(0, 2)
])

const startChat = () => {
  uni.switchTab({ url: '/pages/visitor/chat' })
}

const goToRoutes = () => {
  uni.switchTab({ url: '/pages/visitor/routes' })
}

const goToLocation = () => {
  uni.navigateTo({ url: '/pages/visitor/location' })
}

const showSpotDetail = (spot: Spot) => {
  uni.showModal({
    title: spot.name,
    content: spot.description,
    showCancel: false
  })
}

const goToAdmin = () => {
  uni.navigateTo({ url: '/pages/admin/login' })
}

const onExpressionChange = (expression: string) => {
  console.log('Expression changed:', expression)
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #4080ff 0%, #e8f0ff 30%, #f5f7fa 100%);
  padding: $spacing-lg;
  padding-bottom: 200rpx;
}

.header {
  text-align: center;
  padding: $spacing-xl 0;
}

.header-content {
  margin-bottom: $spacing-xl;
}

.title {
  display: block;
  font-size: $font-size-title;
  font-weight: 700;
  color: #fff;
  margin-bottom: $spacing-sm;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: $font-size-lg;
  color: rgba(255, 255, 255, 0.85);
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-container {
  position: relative;
  margin-bottom: $spacing-base;
}

.avatar-img {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  border: 6rpx solid #fff;
  box-shadow: $shadow-lg;
}

.avatar-status {
  position: absolute;
  bottom: 8rpx;
  right: 8rpx;
  width: 32rpx;
  height: 32rpx;
  background: $success-color;
  border-radius: 50%;
  border: 4rpx solid #fff;
}

.avatar-name {
  font-size: $font-size-lg;
  color: #fff;
  font-weight: 600;
}

.quick-actions {
  display: flex;
  gap: $spacing-base;
  margin-bottom: $spacing-lg;
}

.action-card {
  flex: 1;
  background: #fff;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  text-align: center;
  box-shadow: $shadow-md;
}

.action-icon {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto $spacing-base;
  transition: transform 0.3s ease;
  
  &.chat {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  &.route {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
  
  &.location {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
}

.action-card:active .action-icon {
  transform: scale(0.95);
}

.icon-text {
  font-size: 48rpx;
}

.action-title {
  display: block;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.action-desc {
  font-size: $font-size-sm;
  color: $text-light;
}

.features {
  background: #fff;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-sm;
  margin-bottom: $spacing-lg;
}

.section-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-base;
}

.feature-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-base;
}

.feature-item {
  width: calc(50% - $spacing-sm);
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.feature-icon {
  width: 72rpx;
  height: 72rpx;
  background: $primary-light;
  border-radius: $border-radius;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
}

.feature-info {
  flex: 1;
}

.feature-title {
  display: block;
  font-size: $font-size-base;
  font-weight: 500;
  color: $text-primary;
}

.feature-desc {
  font-size: $font-size-xs;
  color: $text-light;
}

.spotlight {
  margin-bottom: $spacing-lg;
}

.spot-scroll {
  white-space: nowrap;
}

.spot-card {
  display: inline-flex;
  flex-direction: column;
  width: 280rpx;
  background: #fff;
  border-radius: $border-radius-lg;
  overflow: hidden;
  box-shadow: $shadow-sm;
  margin-right: $spacing-base;
  vertical-align: top;
}

.spot-img {
  width: 100%;
  height: 180rpx;
}

.spot-info {
  padding: $spacing-sm;
}

.spot-name {
  display: block;
  font-size: $font-size-sm;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.spot-desc {
  font-size: $font-size-xs;
  color: $text-light;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-entry {
  position: fixed;
  bottom: 180rpx;
  left: 50%;
  transform: translateX(-50%);
  padding: $spacing-sm $spacing-lg;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 100rpx;
  
  text {
    font-size: $font-size-sm;
    color: #fff;
  }
}

.bottom-btn {
  position: fixed;
  bottom: 100rpx;
  left: $spacing-lg;
  right: $spacing-lg;
}
</style>
