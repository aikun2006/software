<template>
  <view class="spots-page">
    <!-- 顶部标题栏 -->
    <view class="spots-header">
      <text class="page-title">灵山景点</text>
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索景点名称 / 简介"
          placeholder-class="ph"
          confirm-type="search"
        />
        <text v-if="keyword" class="search-clear" @click="keyword = ''">✕</text>
      </view>
    </view>

    <!-- 景点卡片列表（一行一个） -->
    <scroll-view class="spots-list" scroll-y :scroll-top="scrollTop">
      <view
        class="spot-card"
        v-for="spot in filteredSpots"
        :key="spot.id"
        @click="openDetail(spot.id)"
      >
        <image class="spot-thumb" :src="spotImage(spot)" mode="aspectFill" />
        <view class="spot-body">
          <view class="spot-title-row">
            <text class="spot-name">{{ spot.name }}</text>
            <text class="spot-tag" :class="spot.tagClass">{{ spot.tag }}</text>
          </view>
          <text class="spot-desc">{{ spot.desc }}</text>
          <view class="spot-meta">
            <text class="meta-item" v-if="spot.distance">📍 {{ spot.distance }}</text>
            <text class="meta-item" v-if="spot.time">⏱ {{ spot.time }}</text>
          </view>
        </view>
        <text class="spot-arrow">›</text>
      </view>

      <view class="empty-tip" v-if="filteredSpots.length === 0">
        <text>没有找到相关景点</text>
      </view>
      <view class="list-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { spots, spotImage, type ScenicSpot } from '@/data/spots'

const keyword = ref('')
const scrollTop = ref(0)

const filteredSpots = computed<ScenicSpot[]>(() => {
  if (!keyword.value.trim()) return spots
  const kw = keyword.value.trim().toLowerCase()
  return spots.filter(
    s => s.name.toLowerCase().includes(kw) || s.desc.toLowerCase().includes(kw)
  )
})

const openDetail = (id: string) => {
  uni.navigateTo({ url: '/pages/visitor/spot-detail?id=' + id })
}
</script>

<style lang="scss" scoped>
.spots-page {
  min-height: 100vh;
  background: $bg-color;
  display: flex;
  flex-direction: column;
}

/* 顶部标题栏 */
.spots-header {
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  padding: calc(env(safe-area-inset-top) + 40rpx) 40rpx 36rpx;
}
.page-title {
  font-size: 44rpx;
  font-weight: 700;
  color: #fff;
  display: block;
  margin-bottom: 24rpx;
}
.search-box {
  display: flex;
  align-items: center;
  background: rgba(255, 253, 245, 0.92);
  border-radius: 40rpx;
  padding: 0 24rpx;
  height: 72rpx;
}
.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
  opacity: 0.6;
}
.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $text-primary;
  height: 72rpx;
}
.ph {
  color: $text-placeholder;
}
.search-clear {
  font-size: 28rpx;
  color: $text-light;
  padding: 0 8rpx;
}

/* 卡片列表 */
.spots-list {
  flex: 1;
  padding: 24rpx 32rpx 0;
}
.spot-card {
  display: flex;
  align-items: center;
  background: $bg-white;
  border-radius: $border-radius-xl;
  box-shadow: $shadow-md;
  margin-bottom: 24rpx;
  padding: 20rpx;
  overflow: hidden;
  &:active {
    transform: scale(0.98);
  }
}
.spot-thumb {
  width: 220rpx;
  height: 220rpx;
  border-radius: $border-radius-lg;
  flex-shrink: 0;
  background: $bg-gray;
}
.spot-body {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}
.spot-title-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}
.spot-name {
  font-size: 34rpx;
  font-weight: 700;
  color: $text-primary;
  margin-right: 16rpx;
}
.spot-tag {
  font-size: 20rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  color: #fff;
  background: $primary-color;
  flex-shrink: 0;
}
/* 复用地图页标签配色 */
.tag-core {
  background: #c0392b;
}
.tag-culture {
  background: #8e44ad;
}
.tag-experience {
  background: #27ae60;
}
.spot-desc {
  font-size: 25rpx;
  color: $text-secondary;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.spot-meta {
  display: flex;
  flex-wrap: wrap;
  margin-top: 14rpx;
}
.meta-item {
  font-size: 22rpx;
  color: $text-light;
  margin-right: 20rpx;
}
.spot-arrow {
  font-size: 40rpx;
  color: $text-placeholder;
  margin-left: 8rpx;
}

.empty-tip {
  text-align: center;
  color: $text-light;
  font-size: 28rpx;
  padding: 80rpx 0;
}
.list-bottom {
  height: 160rpx;
}
</style>
