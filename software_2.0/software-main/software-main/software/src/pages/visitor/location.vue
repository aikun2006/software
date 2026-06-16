<template>
  <view class="location-container">
    <view class="header">
      <view class="header-left" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="header-title">位置追踪</text>
      <view class="header-right"></view>
    </view>

    <view class="content">
      <view class="current-location card">
        <view class="location-header">
          <text class="location-icon">📍</text>
          <text class="location-title">当前位置</text>
        </view>
        <view class="location-info" v-if="currentLocation">
          <view class="info-row">
            <text class="info-label">纬度</text>
            <text class="info-value">{{ currentLocation.latitude.toFixed(6) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">经度</text>
            <text class="info-value">{{ currentLocation.longitude.toFixed(6) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">精度</text>
            <text class="info-value">{{ currentLocation.accuracy.toFixed(0) }}米</text>
          </view>
          <view class="info-row">
            <text class="info-label">时间</text>
            <text class="info-value">{{ formatTime(currentLocation.timestamp) }}</text>
          </view>
        </view>
        <view class="location-info empty" v-else>
          <text class="empty-text">点击按钮获取位置</text>
        </view>
        <view class="location-actions">
          <view class="action-btn refresh" @click="getLocation" :disabled="loading">
            <text>{{ loading ? '获取中...' : '刷新位置' }}</text>
          </view>
        </view>
      </view>

      <view class="tracking-section card">
        <view class="tracking-header">
          <text class="tracking-icon">🚶</text>
          <text class="tracking-title">轨迹追踪</text>
        </view>
        
        <view class="tracking-status" v-if="isTracking">
          <view class="status-badge" :class="{ active: !isPaused, paused: isPaused }">
            <view class="status-dot" :class="{ pulse: !isPaused }"></view>
            <text>{{ isPaused ? '已暂停' : '正在追踪' }}</text>
          </view>
          
          <view class="tracking-stats">
            <view class="stat-item">
              <text class="stat-value">{{ trackDistance }}</text>
              <text class="stat-label">距离</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ trackPoints }}</text>
              <text class="stat-label">记录点</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ trackDuration }}</text>
              <text class="stat-label">时长</text>
            </view>
          </view>

          <view class="tracking-status-details" v-if="isTracking">
            <view class="status-detail">
              <text class="detail-label">电量</text>
              <view class="battery-bar">
                <view class="battery-fill" :style="{ width: batteryLevel + '%' }" :class="{ low: batteryLevel < 20 }"></view>
              </view>
              <text class="detail-value">{{ batteryLevel }}%</text>
            </view>
            <view class="status-detail">
              <text class="detail-label">GPS精度</text>
              <text class="detail-value">{{ gpsAccuracy.toFixed(0) }}米</text>
            </view>
          </view>
        </view>
        
        <view class="tracking-status" v-else>
          <view class="status-badge">
            <view class="status-dot inactive"></view>
            <text>未开始</text>
          </view>
        </view>
        
        <view class="tracking-actions">
          <view v-if="!isTracking" class="action-btn start" @click="startTracking">
            <text>开始追踪</text>
          </view>
          <view v-else class="action-buttons">
            <view class="action-btn" :class="isPaused ? 'resume' : 'pause'" @click="togglePause">
              <text>{{ isPaused ? '继续' : '暂停' }}</text>
            </view>
            <view class="action-btn stop" @click="stopTracking">
              <text>停止</text>
            </view>
          </view>
        </view>
      </view>

      <view class="history-section card">
        <view class="history-header">
          <text class="history-icon">📜</text>
          <text class="history-title">历史记录</text>
        </view>
        <scroll-view class="history-list" scroll-y>
          <view class="history-item" v-for="track in historyTracks" :key="track.id" @click="showTrackDetail(track)">
            <view class="track-info">
              <text class="track-date">{{ formatDate(track.startTime) }}</text>
              <text class="track-time">{{ formatTime(track.startTime) }} - {{ formatTime(track.endTime || track.startTime) }}</text>
            </view>
            <view class="track-stats">
              <text class="track-stat">{{ formatDistance(track.distance) }}</text>
              <text class="track-stat">{{ track.points.length }}个点</text>
            </view>
            <view class="track-arrow">›</view>
          </view>
          <view class="empty-history" v-if="historyTracks.length === 0">
            <text class="empty-icon">📭</text>
            <text class="empty-text">暂无历史记录</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="showDetail" class="modal-overlay" @click="closeDetail">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">轨迹详情</text>
          <view class="modal-close" @click="closeDetail">✕</view>
        </view>
        <scroll-view class="modal-body" scroll-y v-if="selectedTrack">
          <view class="detail-stats">
            <view class="detail-stat">
              <text class="detail-value">{{ formatDistance(selectedTrack.distance) }}</text>
              <text class="detail-label">总距离</text>
            </view>
            <view class="detail-stat">
              <text class="detail-value">{{ selectedTrack.points.length }}</text>
              <text class="detail-label">记录点</text>
            </view>
            <view class="detail-stat">
              <text class="detail-value">{{ getTrackDuration(selectedTrack) }}</text>
              <text class="detail-label">用时</text>
            </view>
          </view>
          <view class="detail-section" v-if="selectedTrack.pauseCount > 0">
            <view class="pause-info">
              <text class="pause-label">暂停次数</text>
              <text class="pause-value">{{ selectedTrack.pauseCount }}次</text>
            </view>
            <view class="pause-info">
              <text class="pause-label">总暂停时间</text>
              <text class="pause-value">{{ formatDuration(Math.floor(selectedTrack.totalPauseTime / 1000)) }}</text>
            </view>
          </view>
          <view class="detail-section">
            <text class="section-title">轨迹点</text>
            <view class="point-list">
              <view class="point-item" v-for="(point, index) in selectedTrack.points.slice(0, 20)" :key="point.id">
                <view class="point-index">{{ index + 1 }}</view>
                <view class="point-info">
                  <text class="point-coord">{{ point.latitude.toFixed(6) }}, {{ point.longitude.toFixed(6) }}</text>
                  <text class="point-time">{{ formatTime(point.timestamp) }}</text>
                </view>
              </view>
            </view>
            <text v-if="selectedTrack.points.length > 20" class="more-text">还有 {{ selectedTrack.points.length - 20 }} 个点...</text>
          </view>
        </scroll-view>
        <view class="modal-footer">
          <view class="modal-btn" @click="closeDetail">关闭</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { locationService, type LocationPoint, type LocationTrack, type TrackingStatus } from '@/utils/location'

const currentLocation = ref<LocationPoint | null>(null)
const loading = ref(false)
const isTracking = ref(false)
const isPaused = ref(false)
const historyTracks = ref<LocationTrack[]>([])
const selectedTrack = ref<LocationTrack | null>(null)
const showDetail = ref(false)
const trackDistance = ref('0米')
const trackPoints = ref('0')
const trackDuration = ref('00:00:00')
const batteryLevel = ref(100)
const gpsAccuracy = ref(0)

let durationTimer: number | null = null
let statusTimer: number | null = null

onMounted(() => {
  loadHistory()
  checkTrackingStatus()
  startStatusUpdate()
})

onUnmounted(() => {
  if (durationTimer) clearInterval(durationTimer)
  if (statusTimer) clearInterval(statusTimer)
})

const goBack = () => {
  uni.navigateBack()
}

const getLocation = async () => {
  loading.value = true
  try {
    const location = await locationService.getCurrentPosition()
    currentLocation.value = location
    uni.showToast({ title: '获取位置成功', icon: 'success' })
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '获取位置失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const startTracking = () => {
  try {
    locationService.startTracking()
    isTracking.value = true
    isPaused.value = false
    startDurationTimer()
    uni.showToast({ title: '开始追踪', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: '启动失败', icon: 'none' })
  }
}

const stopTracking = () => {
  const track = locationService.stopTracking()
  if (track) {
    historyTracks.value.unshift(track)
  }
  isTracking.value = false
  isPaused.value = false
  stopDurationTimer()
  trackDistance.value = '0米'
  trackPoints.value = '0'
  trackDuration.value = '00:00:00'
  loadHistory()
  uni.showToast({ title: '已保存轨迹', icon: 'success' })
}

const togglePause = () => {
  if (isPaused.value) {
    locationService.resumeTracking()
    isPaused.value = false
    startDurationTimer()
  } else {
    locationService.pauseTracking()
    isPaused.value = true
    stopDurationTimer()
  }
}

const checkTrackingStatus = () => {
  const status = locationService.getTrackingStatus()
  isTracking.value = status.isTracking
  isPaused.value = status.isPaused
  updateStatusDisplay(status)
  
  if (status.isTracking && !status.isPaused) {
    startDurationTimer()
  }
}

const startStatusUpdate = () => {
  statusTimer = window.setInterval(() => {
    const status = locationService.getTrackingStatus()
    updateStatusDisplay(status)
  }, 2000)
}

const updateStatusDisplay = (status: TrackingStatus) => {
  batteryLevel.value = status.batteryLevel || 100
  gpsAccuracy.value = status.gpsAccuracy || 0
  
  if (status.isTracking) {
    trackDistance.value = status.trackDistance
    trackPoints.value = status.trackPoints.toString()
    trackDuration.value = status.trackDuration
  }
}

const startDurationTimer = () => {
  durationTimer = window.setInterval(() => {
    const status = locationService.getTrackingStatus()
    if (status.isTracking && !status.isPaused) {
      trackDistance.value = status.trackDistance
      trackPoints.value = status.trackPoints.toString()
      trackDuration.value = status.trackDuration
    }
  }, 1000)
}

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

const loadHistory = () => {
  historyTracks.value = locationService.getSavedTracks()
}

const showTrackDetail = (track: LocationTrack) => {
  selectedTrack.value = track
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  selectedTrack.value = null
}

const formatTime = (timestamp: string): string => {
  return locationService.formatTime(timestamp)
}

const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

const formatDistance = (meters: number): string => {
  return locationService.formatDistance(meters)
}

const getTrackDuration = (track: LocationTrack): string => {
  const start = new Date(track.startTime).getTime()
  const end = track.endTime ? new Date(track.endTime).getTime() : Date.now()
  const actualDuration = end - start - (track.totalPauseTime || 0)
  const seconds = Math.floor(actualDuration / 1000)
  return formatDuration(seconds)
}
</script>

<style lang="scss" scoped>
.location-container {
  min-height: 100vh;
  background: $bg-color;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-base $spacing-lg;
  background: #fff;
  box-shadow: $shadow-sm;
}

.header-left, .header-right {
  width: 60rpx;
}

.back-icon {
  font-size: 40rpx;
  color: $text-secondary;
}

.header-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.content {
  flex: 1;
  padding: $spacing-base;
  overflow-y: auto;
}

.card {
  background: #fff;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-base;
  box-shadow: $shadow-sm;
}

.location-header, .tracking-header, .history-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-base;
}

.location-icon, .tracking-icon, .history-icon {
  font-size: 36rpx;
}

.location-title, .tracking-title, .history-title {
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
}

.location-info {
  margin-bottom: $spacing-base;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $bg-gray;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.info-value {
  font-size: $font-size-sm;
  color: $text-primary;
  font-weight: 500;
}

.empty-text {
  font-size: $font-size-sm;
  color: $text-light;
  text-align: center;
  padding: $spacing-lg 0;
}

.location-actions {
  display: flex;
  gap: $spacing-sm;
}

.action-btn {
  flex: 1;
  padding: $spacing-base;
  background: $primary-color;
  color: #fff;
  text-align: center;
  border-radius: $border-radius;
  font-size: $font-size-base;
  transition: all 0.2s;

  &.refresh {
    background: $info-color;
  }

  &.start {
    background: $success-color;
  }

  &.pause {
    background: $warning-color;
  }

  &.resume {
    background: $success-color;
  }

  &.stop {
    background: $error-color;
  }

  &:active {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.action-buttons {
  display: flex;
  gap: $spacing-sm;
  width: 100%;
}

.action-buttons .action-btn {
  flex: 1;
}

.tracking-status {
  margin-bottom: $spacing-base;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: 100rpx;
  margin-bottom: $spacing-base;

  &.active {
    background: rgba($success-color, 0.1);
    color: $success-color;
  }

  &.paused {
    background: rgba($warning-color, 0.1);
    color: $warning-color;
  }
}

.status-dot {
  width: 16rpx;
  height: 16rpx;
  background: $text-light;
  border-radius: 50%;

  &.inactive {
    background: $text-light;
  }

  &.pulse {
    background: $success-color;
    animation: pulse 1.5s infinite;
  }

  .status-badge.paused & {
    background: $warning-color;
    animation: none;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.tracking-stats {
  display: flex;
  justify-content: space-around;
  padding: $spacing-base 0;
  background: $bg-color;
  border-radius: $border-radius;
  margin-bottom: $spacing-base;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: $font-size-xl;
  font-weight: 700;
  color: $primary-color;
}

.stat-label {
  font-size: $font-size-xs;
  color: $text-secondary;
  margin-top: $spacing-xs;
}

.tracking-status-details {
  display: flex;
  gap: $spacing-lg;
  padding: $spacing-sm 0;
}

.status-detail {
  flex: 1;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.detail-label {
  font-size: $font-size-xs;
  color: $text-secondary;
}

.detail-value {
  font-size: $font-size-xs;
  color: $text-primary;
}

.battery-bar {
  flex: 1;
  height: 12rpx;
  background: $bg-gray;
  border-radius: 6rpx;
  overflow: hidden;
}

.battery-fill {
  height: 100%;
  background: $success-color;
  border-radius: 6rpx;
  transition: width 0.3s ease;

  &.low {
    background: $error-color;
  }
}

.history-list {
  max-height: 500rpx;
}

.history-item {
  display: flex;
  align-items: center;
  padding: $spacing-base 0;
  border-bottom: 1rpx solid $bg-gray;

  &:last-child {
    border-bottom: none;
  }
}

.track-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.track-date {
  font-size: $font-size-sm;
  color: $text-primary;
  font-weight: 500;
}

.track-time {
  font-size: $font-size-xs;
  color: $text-light;
  margin-top: $spacing-xs;
}

.track-stats {
  display: flex;
  gap: $spacing-base;
  margin-right: $spacing-sm;
}

.track-stat {
  font-size: $font-size-xs;
  color: $text-secondary;
}

.track-arrow {
  font-size: 32rpx;
  color: $text-light;
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xl 0;
}

.empty-icon {
  font-size: 60rpx;
  margin-bottom: $spacing-base;
}

.modal-overlay {
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

.modal-content {
  width: 100%;
  max-height: 80vh;
  background: #fff;
  border-radius: $border-radius-xl $border-radius-xl 0 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-lg;
  border-bottom: 1rpx solid $bg-gray;
}

.modal-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.modal-close {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: $text-secondary;
}

.modal-body {
  flex: 1;
  padding: $spacing-lg;
  overflow-y: auto;
}

.detail-stats {
  display: flex;
  justify-content: space-around;
  padding: $spacing-lg;
  background: $bg-color;
  border-radius: $border-radius-lg;
  margin-bottom: $spacing-lg;
}

.detail-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.detail-value {
  font-size: $font-size-xxl;
  font-weight: 700;
  color: $primary-color;
}

.detail-label {
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-top: $spacing-xs;
}

.pause-info {
  display: flex;
  justify-content: space-between;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $bg-gray;
}

.pause-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.pause-value {
  font-size: $font-size-sm;
  color: $text-primary;
}

.detail-section {
  margin-bottom: $spacing-lg;
}

.section-title {
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-base;
  display: block;
}

.point-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.point-item {
  display: flex;
  align-items: center;
  gap: $spacing-base;
  padding: $spacing-sm;
  background: $bg-color;
  border-radius: $border-radius;
}

.point-index {
  width: 48rpx;
  height: 48rpx;
  background: $primary-color;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-sm;
  font-weight: 600;
  flex-shrink: 0;
}

.point-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.point-coord {
  font-size: $font-size-sm;
  color: $text-primary;
}

.point-time {
  font-size: $font-size-xs;
  color: $text-light;
  margin-top: $spacing-xs;
}

.more-text {
  font-size: $font-size-sm;
  color: $text-light;
  text-align: center;
  display: block;
  padding: $spacing-base 0;
}

.modal-footer {
  padding: $spacing-lg;
  border-top: 1rpx solid $bg-gray;
}

.modal-btn {
  padding: $spacing-base;
  background: $primary-color;
  color: #fff;
  text-align: center;
  border-radius: $border-radius;
  font-size: $font-size-base;
}
</style>
