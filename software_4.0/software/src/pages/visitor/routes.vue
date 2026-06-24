<template>
  <view class="routes-container">
    <view class="routes-header">
      <text class="header-title">游览路线</text>
      <text class="header-subtitle">选择适合您的游览路线</text>
    </view>

    <view class="interest-selector">
      <view class="selector-title">选择您的兴趣偏好</view>
      <view class="interest-list">
        <view 
          class="interest-item" 
          v-for="interest in interests" 
          :key="interest"
          :class="{ active: selectedInterests.includes(interest) }"
          @click="toggleInterest(interest)"
        >
          <text>{{ interest }}</text>
        </view>
      </view>
      <view v-if="selectedInterests.length > 0" class="recommend-btn" @click="getRecommend">
        <text>获取推荐路线</text>
      </view>
    </view>

    <view class="routes-list">
      <view 
        class="route-card" 
        v-for="route in routes" 
        :key="route.id"
        @click="showRouteDetail(route)"
      >
        <view class="route-header">
          <view class="route-icon">
            <text>{{ getRouteIcon(route.name) }}</text>
          </view>
          <view class="route-info">
            <text class="route-name">{{ route.name }}</text>
            <text class="route-desc">{{ route.description }}</text>
          </view>
        </view>
        <view class="route-meta">
          <view class="meta-item">
            <text class="meta-icon">⏱️</text>
            <text class="meta-value">{{ route.duration }}分钟</text>
          </view>
          <view class="meta-item">
            <text class="meta-icon">📍</text>
            <text class="meta-value">{{ route.distance }}公里</text>
          </view>
          <view class="meta-item">
            <text class="meta-icon">{{ getDifficultyIcon(route.difficulty) }}</text>
            <text class="meta-value">{{ getDifficultyText(route.difficulty) }}</text>
          </view>
        </view>
        <view class="route-tags">
          <view class="tag" v-for="tag in route.suitableFor" :key="tag">
            <text>{{ tag }}</text>
          </view>
        </view>
        <view class="route-spots">
          <text class="spots-title">途经景点</text>
          <view class="spots-list">
            <view class="spot-item" v-for="(spot, index) in route.spots.slice(0, 3)" :key="spot.id">
              <view class="spot-order">{{ index + 1 }}</view>
              <text class="spot-name">{{ spot.name }}</text>
            </view>
            <view v-if="route.spots.length > 3" class="spot-more">
              <text>+{{ route.spots.length - 3 }}个景点</text>
            </view>
          </view>
        </view>
        <view class="route-action" @click.stop="startTour(route)">
          <text>开始游览 →</text>
        </view>
      </view>
    </view>

    <view v-if="showDetail" class="detail-modal" @click="closeDetail">
      <view class="detail-content" @click.stop>
        <view class="detail-header">
          <text class="detail-title">{{ selectedRoute?.name }}</text>
          <view class="close-btn" @click="closeDetail">
            <text>✕</text>
          </view>
        </view>
        <scroll-view class="detail-body" scroll-y>
          <view class="detail-desc">{{ selectedRoute?.description }}</view>
          <view class="detail-meta">
            <view class="detail-meta-item">
              <text class="detail-meta-icon">⏱️</text>
              <text class="detail-meta-value">{{ selectedRoute?.duration }}分钟</text>
            </view>
            <view class="detail-meta-item">
              <text class="detail-meta-icon">📍</text>
              <text class="detail-meta-value">{{ selectedRoute?.distance }}公里</text>
            </view>
            <view class="detail-meta-item">
              <text class="detail-meta-icon">{{ selectedRoute?.difficulty === 'easy' ? '😊' : selectedRoute?.difficulty === 'medium' ? '😐' : '😰' }}</text>
              <text class="detail-meta-value">{{ getDifficultyText(selectedRoute?.difficulty || 'easy') }}</text>
            </view>
          </view>
          <view class="detail-section">
            <text class="detail-section-title">适合人群</text>
            <view class="detail-tags">
              <view class="detail-tag" v-for="tag in selectedRoute?.suitableFor" :key="tag">
                <text>{{ tag }}</text>
              </view>
            </view>
          </view>
          <view class="detail-section">
            <text class="detail-section-title">游览路线</text>
            <view class="detail-spots">
              <view 
                class="detail-spot-item" 
                v-for="(spot, index) in selectedRoute?.spots" 
                :key="spot.id"
              >
                <view class="detail-spot-order">{{ index + 1 }}</view>
                <view class="detail-spot-info">
                  <text class="detail-spot-name">{{ spot.name }}</text>
                  <text class="detail-spot-desc">{{ spot.description }}</text>
                  <text class="detail-spot-time">⏱️ {{ spot.duration }}分钟</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="detail-footer">
          <button class="btn btn-primary btn-lg btn-block" @click="selectedRoute && startTour(selectedRoute)">
            <text>开始游览</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TourRoute } from '@/types'
import { mockRoutes } from '@/data/mock'

const routes = ref<TourRoute[]>(mockRoutes)
const interests = ['历史文化', '自然风光', '亲子活动', '摄影打卡', '徒步登山']
const selectedInterests = ref<string[]>([])
const showDetail = ref(false)
const selectedRoute = ref<TourRoute | null>(null)

const toggleInterest = (interest: string) => {
  const index = selectedInterests.value.indexOf(interest)
  if (index > -1) {
    selectedInterests.value.splice(index, 1)
  } else {
    selectedInterests.value.push(interest)
  }
}

const getRecommend = () => {
  if (selectedInterests.value.length === 0) {
    uni.showToast({ title: '请选择兴趣偏好', icon: 'none' })
    return
  }
  uni.showToast({ title: '已根据您的偏好推荐路线', icon: 'none' })
}

const getRouteIcon = (name: string) => {
  if (name.includes('文化')) return '🏛️'
  if (name.includes('自然')) return '🌿'
  if (name.includes('亲子')) return '👨👩👧👦'
  return '🗺️'
}

const getDifficultyIcon = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return '😊'
    case 'medium': return '😐'
    case 'hard': return '😰'
    default: return '😊'
  }
}

const getDifficultyText = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return '轻松'
    case 'medium': return '中等'
    case 'hard': return '挑战'
    default: return '轻松'
  }
}

const showRouteDetail = (route: TourRoute) => {
  selectedRoute.value = route
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  selectedRoute.value = null
}

const startTour = (route: TourRoute) => {
  if (!route.spots || route.spots.length === 0) return
  const spotIds = route.spots.map(s => s.id).join(',')
  const lastName = route.spots[route.spots.length - 1].name
  const lastId = route.spots[route.spots.length - 1].id
  uni.navigateTo({
    url: `/pages/visitor/navigation?name=${encodeURIComponent(route.name)}&dest=${lastId}&waypoints=${spotIds}`
  })
}
</script>

<style lang="scss" scoped>
.routes-container {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 120rpx;
}

.routes-header {
  background: linear-gradient(135deg, $primary-color 0%, $primary-dark 100%);
  padding: $spacing-xl $spacing-lg;
  text-align: center;
}

.header-title {
  display: block;
  font-size: $font-size-title;
  font-weight: 700;
  color: #fff;
  margin-bottom: $spacing-xs;
}

.header-subtitle {
  font-size: $font-size-base;
  color: rgba(255, 255, 255, 0.8);
}

.interest-selector {
  background: #fff;
  margin: $spacing-base;
  padding: $spacing-base;
  border-radius: $border-radius-lg;
  box-shadow: $shadow-sm;
}

.selector-title {
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-base;
}

.interest-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.interest-item {
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: 100rpx;
  transition: $transition-fast;
  
  text {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
  
  &.active {
    background: $primary-color;
    
    text {
      color: #fff;
    }
  }
}

.recommend-btn {
  margin-top: $spacing-base;
  background: $primary-light;
  padding: $spacing-base;
  border-radius: $border-radius;
  text-align: center;
  
  text {
    font-size: $font-size-base;
    color: $primary-color;
    font-weight: 500;
  }
}

.routes-list {
  padding: 0 $spacing-base;
}

.route-card {
  background: #fff;
  border-radius: $border-radius-lg;
  padding: $spacing-base;
  margin-bottom: $spacing-base;
  box-shadow: $shadow-sm;
}

.route-header {
  display: flex;
  gap: $spacing-base;
  margin-bottom: $spacing-base;
}

.route-icon {
  width: 80rpx;
  height: 80rpx;
  background: $primary-light;
  border-radius: $border-radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: 40rpx;
  }
}

.route-info {
  flex: 1;
}

.route-name {
  display: block;
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.route-desc {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.route-meta {
  display: flex;
  gap: $spacing-lg;
  margin-bottom: $spacing-base;
  padding-bottom: $spacing-base;
  border-bottom: 2rpx solid $bg-gray;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.meta-icon {
  font-size: 24rpx;
}

.meta-value {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.route-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  margin-bottom: $spacing-base;
}

.tag {
  padding: $spacing-xs $spacing-sm;
  background: rgba(196, 164, 90, 0.15);
  border-radius: $border-radius;
  
  text {
    font-size: $font-size-xs;
    color: $primary-color;
  }
}

.route-spots {
  margin-bottom: $spacing-base;
}

.spots-title {
  display: block;
  font-size: $font-size-sm;
  color: $text-light;
  margin-bottom: $spacing-sm;
}

.spots-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.spot-item {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.spot-order {
  width: 36rpx;
  height: 36rpx;
  background: $primary-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: $font-size-xs;
    color: #fff;
  }
}

.spot-name {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.spot-more {
  padding-left: $spacing-xs;
  
  text {
    font-size: $font-size-xs;
    color: $text-light;
  }
}

.route-action {
  text-align: center;
  padding-top: $spacing-base;
  border-top: 2rpx solid $bg-gray;
  
  text {
    font-size: $font-size-base;
    color: $primary-color;
    font-weight: 500;
  }
}

.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.detail-content {
  width: 100%;
  max-height: 85vh;
  background: #fff;
  border-radius: $border-radius-xl $border-radius-xl 0 0;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: $spacing-lg;
  border-bottom: 2rpx solid $bg-gray;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-title {
  font-size: $font-size-xl;
  font-weight: 600;
  color: $text-primary;
}

.close-btn {
  width: 64rpx;
  height: 64rpx;
  background: $bg-gray;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: $font-size-lg;
    color: $text-secondary;
  }
}

.detail-body {
  flex: 1;
  padding: $spacing-lg;
  overflow-y: auto;
}

.detail-desc {
  font-size: $font-size-base;
  color: $text-secondary;
  line-height: 1.6;
  margin-bottom: $spacing-lg;
}

.detail-meta {
  display: flex;
  justify-content: space-around;
  background: $bg-gray;
  padding: $spacing-base;
  border-radius: $border-radius-lg;
  margin-bottom: $spacing-lg;
}

.detail-meta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
}

.detail-meta-icon {
  font-size: 36rpx;
}

.detail-meta-value {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.detail-section {
  margin-bottom: $spacing-lg;
}

.detail-section-title {
  display: block;
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-base;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.detail-tag {
  padding: $spacing-sm $spacing-base;
  background: $primary-light;
  border-radius: 100rpx;
  
  text {
    font-size: $font-size-sm;
    color: $primary-color;
  }
}

.detail-spots {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.detail-spot-item {
  display: flex;
  gap: $spacing-base;
  padding: $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius-lg;
}

.detail-spot-order {
  width: 48rpx;
  height: 48rpx;
  background: $primary-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  text {
    font-size: $font-size-base;
    color: #fff;
    font-weight: 600;
  }
}

.detail-spot-info {
  flex: 1;
}

.detail-spot-name {
  display: block;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.detail-spot-desc {
  display: block;
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
}

.detail-spot-time {
  font-size: $font-size-xs;
  color: $text-light;
}

.detail-footer {
  padding: $spacing-lg;
  border-top: 2rpx solid $bg-gray;
}
</style>
