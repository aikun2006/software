<template>
  <view class="dashboard-container">
    <view class="dashboard-header">
      <view class="header-left">
        <text class="header-title">数据大屏</text>
        <text class="header-subtitle">实时数据监控中心</text>
      </view>
      <view class="header-right">
        <view class="refresh-btn" @click="refreshData">
          <text>🔄</text>
        </view>
        <text class="update-time">更新于 {{ currentTime }}</text>
      </view>
    </view>

    <view class="main-stats">
      <view class="main-stat-card">
        <view class="stat-header">
          <text class="stat-icon">👥</text>
          <text class="stat-badge">今日</text>
        </view>
        <text class="stat-value">{{ dashboardData?.todayServiceCount || 0 }}</text>
        <text class="stat-label">服务人次</text>
        <view class="stat-trend up">
          <text>↑ 12.5%</text>
        </view>
      </view>
      <view class="main-stat-card">
        <view class="stat-header">
          <text class="stat-icon">📊</text>
          <text class="stat-badge">本周</text>
        </view>
        <text class="stat-value">{{ dashboardData?.weeklyServiceCount || 0 }}</text>
        <text class="stat-label">累计服务</text>
        <view class="stat-trend up">
          <text>↑ 8.3%</text>
        </view>
      </view>
    </view>

    <view class="stats-row">
      <view class="mini-stat">
        <text class="mini-value">{{ dashboardData?.avgResponseTime || 0 }}s</text>
        <text class="mini-label">平均响应</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value">{{ dashboardData?.satisfactionRate || 0 }}%</text>
        <text class="mini-label">满意度</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value">{{ emotionStats.positive }}%</text>
        <text class="mini-label">正面情绪</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value">{{ emotionStats.negative }}%</text>
        <text class="mini-label">负面情绪</text>
      </view>
    </view>

    <view class="charts-row">
      <view class="chart-section">
        <view class="section-title-row">
          <text class="section-title">服务趋势</text>
          <view class="time-tabs">
            <text class="time-tab active">日</text>
            <text class="time-tab">周</text>
            <text class="time-tab">月</text>
          </view>
        </view>
        <view class="line-chart">
          <view class="chart-grid">
            <view class="grid-line" v-for="i in 5" :key="i"></view>
          </view>
          <view class="chart-line">
            <view 
              class="chart-point" 
              v-for="(point, index) in serviceTrend" 
              :key="index"
              :style="{ 
                left: `${index * 16.67}%`, 
                bottom: `${(point / maxService) * 100}%` 
              }"
            >
              <view class="point-dot"></view>
              <text class="point-value">{{ point }}</text>
            </view>
          </view>
          <view class="chart-x-axis">
            <text class="axis-label" v-for="day in weekDays" :key="day">{{ day }}</text>
          </view>
        </view>
      </view>

      <view class="chart-section">
        <view class="section-title-row">
          <text class="section-title">情绪分布</text>
        </view>
        <view class="pie-chart">
          <view class="pie-container">
            <view class="pie" :style="pieStyle"></view>
            <view class="pie-center">
              <text class="pie-value">{{ emotionStats.positive }}%</text>
              <text class="pie-label">正面</text>
            </view>
          </view>
          <view class="pie-legend">
            <view class="legend-item">
              <view class="legend-color positive"></view>
              <text>正面 {{ emotionStats.positive }}%</text>
            </view>
            <view class="legend-item">
              <view class="legend-color neutral"></view>
              <text>中性 {{ emotionStats.neutral }}%</text>
            </view>
            <view class="legend-item">
              <view class="legend-color negative"></view>
              <text>负面 {{ emotionStats.negative }}%</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="bottom-section">
      <view class="hot-section">
        <view class="section-title-row">
          <text class="section-title">热门问答</text>
        </view>
        <view class="hot-questions-list">
          <view class="hot-item" v-for="(item, index) in dashboardData?.hotQuestions" :key="index">
            <view class="hot-rank" :class="{ top: index < 3 }">{{ index + 1 }}</view>
            <text class="hot-question">{{ item.question }}</text>
            <text class="hot-count">{{ item.count }}</text>
          </view>
        </view>
      </view>

      <view class="routes-section">
        <view class="section-title-row">
          <text class="section-title">热门路线</text>
        </view>
        <view class="routes-list">
          <view class="route-item" v-for="(route, index) in dashboardData?.topRoutes" :key="index">
            <view class="route-bar">
              <view class="bar-fill" :style="{ width: `${(route.count / maxRoute) * 100}%` }"></view>
            </view>
            <view class="route-info">
              <text class="route-name">{{ route.name }}</text>
              <text class="route-count">{{ route.count }} 次</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { DashboardData } from '@/types'
import { mockDashboardData } from '@/data/mock'

const dashboardData = ref<DashboardData | null>(null)
const currentTime = ref('')
let timer: number | null = null

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const serviceTrend = [180, 210, 195, 230, 256, 312, 285]

const maxService = computed(() => Math.max(...serviceTrend))
const maxRoute = computed(() => {
  if (!dashboardData.value) return 1
  return Math.max(...dashboardData.value.topRoutes.map(r => r.count))
})

const emotionStats = computed(() => {
  if (!dashboardData.value) {
    return { positive: 0, neutral: 0, negative: 0 }
  }
  return dashboardData.value.emotionDistribution
})

const pieStyle = computed(() => {
  const stats = emotionStats.value
  const positive = stats.positive
  const neutral = stats.neutral
  const negative = stats.negative
  
  return {
    background: `conic-gradient(
      #52c41a 0deg ${positive * 3.6}deg,
      #faad14 ${positive * 3.6}deg ${(positive + neutral) * 3.6}deg,
      #ff4d4f ${(positive + neutral) * 3.6}deg 360deg
    )`
  }
})

const updateTime = () => {
  const now = new Date()
  currentTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

const refreshData = () => {
  dashboardData.value = { ...mockDashboardData }
  updateTime()
  uni.showToast({ title: '数据已刷新', icon: 'success' })
}

onMounted(() => {
  dashboardData.value = mockDashboardData
  updateTime()
  timer = setInterval(updateTime, 1000) as unknown as number
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style lang="scss" scoped>
.dashboard-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f7f2e3 0%, #e8dcc0 100%);
  padding: $spacing-lg;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: $spacing-lg;
}

.header-title {
  display: block;
  font-size: $font-size-title;
  font-weight: 700;
  color: #4a3a2a;
  margin-bottom: $spacing-xs;
}

.header-subtitle {
  font-size: $font-size-base;
  color: rgba(74, 58, 42, 0.7);
}

.header-right {
  text-align: right;
}

.refresh-btn {
  width: 64rpx;
  height: 64rpx;
  background: rgba(200, 185, 150, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-sm;
  
  text {
    font-size: 28rpx;
  }
}

.update-time {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.6);
}

.main-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-base;
  margin-bottom: $spacing-lg;
}

.main-stat-card {
  background: linear-gradient(135deg, rgba(139, 115, 85, 0.2) 0%, rgba(139, 115, 85, 0.05) 100%);
  border: 2rpx solid rgba(139, 115, 85, 0.3);
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.stat-icon {
  font-size: 32rpx;
}

.stat-badge {
  padding: $spacing-xs $spacing-sm;
  background: rgba(139, 115, 85, 0.3);
  border-radius: 100rpx;
  font-size: $font-size-xs;
  color: $primary-color;
}

.stat-value {
  display: block;
  font-size: 72rpx;
  font-weight: 700;
  color: #4a3a2a;
  margin-bottom: $spacing-xs;
}

.stat-label {
  font-size: $font-size-sm;
  color: rgba(74, 58, 42, 0.7);
  margin-bottom: $spacing-xs;
}

.stat-trend {
  display: inline-block;
  padding: $spacing-xs $spacing-sm;
  border-radius: $border-radius;
  font-size: $font-size-xs;
  
  &.up {
    background: rgba(82, 196, 26, 0.2);
    color: $success-color;
  }
  
  &.down {
    background: rgba(255, 77, 79, 0.2);
    color: $error-color;
  }
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-sm;
  margin-bottom: $spacing-lg;
}

.mini-stat {
  background: rgba(200, 185, 150, 0.15);
  border-radius: $border-radius;
  padding: $spacing-base;
  text-align: center;
}

.mini-value {
  display: block;
  font-size: $font-size-xl;
  font-weight: 600;
  color: #4a3a2a;
  margin-bottom: $spacing-xs;
}

.mini-label {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.6);
}

.charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: $spacing-base;
  margin-bottom: $spacing-lg;
}

.chart-section {
  background: rgba(200, 185, 150, 0.15);
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-base;
}

.section-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: #4a3a2a;
}

.time-tabs {
  display: flex;
  gap: $spacing-xs;
}

.time-tab {
  padding: $spacing-xs $spacing-sm;
  background: rgba(200, 185, 150, 0.25);
  border-radius: $border-radius;
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.7);
  
  &.active {
    background: rgba(139, 115, 85, 0.3);
    color: $primary-color;
  }
}

.line-chart {
  position: relative;
  height: 280rpx;
}

.chart-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 40rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.grid-line {
  height: 2rpx;
  background: rgba(200, 185, 150, 0.25);
}

.chart-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 40rpx;
}

.chart-point {
  position: absolute;
  transform: translate(-50%, 50%);
}

.point-dot {
  width: 16rpx;
  height: 16rpx;
  background: $primary-color;
  border-radius: 50%;
  border: 4rpx solid rgba(139, 115, 85, 0.3);
}

.point-value {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.7);
  white-space: nowrap;
}

.chart-x-axis {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
}

.axis-label {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.5);
}

.pie-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pie-container {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  margin-bottom: $spacing-base;
}

.pie {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.pie-center {
  position: absolute;
  top: 25%;
  left: 25%;
  width: 50%;
  height: 50%;
  background: #f7f2e3;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.pie-value {
  font-size: $font-size-xl;
  font-weight: 700;
  color: #4a3a2a;
}

.pie-label {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.6);
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  
  text {
    font-size: $font-size-sm;
    color: rgba(74, 58, 42, 0.8);
  }
}

.legend-color {
  width: 24rpx;
  height: 24rpx;
  border-radius: $border-radius;
  
  &.positive {
    background: $success-color;
  }
  
  &.neutral {
    background: $warning-color;
  }
  
  &.negative {
    background: $error-color;
  }
}

.bottom-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-base;
}

.hot-section, .routes-section {
  background: rgba(200, 185, 150, 0.15);
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
}

.hot-questions-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.hot-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.hot-rank {
  width: 36rpx;
  height: 36rpx;
  background: rgba(200, 185, 150, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: $font-size-xs;
    color: rgba(74, 58, 42, 0.7);
    font-weight: 600;
  }
  
  &.top {
    background: $primary-color;
    
    text {
      color: #fff;
    }
  }
}

.hot-question {
  flex: 1;
  font-size: $font-size-sm;
  color: rgba(74, 58, 42, 0.85);
}

.hot-count {
  font-size: $font-size-sm;
  color: rgba(74, 58, 42, 0.5);
}

.routes-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.route-item {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.route-bar {
  height: 12rpx;
  background: rgba(200, 185, 150, 0.25);
  border-radius: 100rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, #c9b890);
  border-radius: 100rpx;
  transition: width $transition-slow;
}

.route-info {
  display: flex;
  justify-content: space-between;
}

.route-name {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.8);
}

.route-count {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.5);
}
</style>
