<template>
  <view class="report-container">
    <view class="page-header">
      <view class="header-left" @click="goBack">
        <text>← 返回</text>
      </view>
      <text class="header-title">数据报告</text>
      <view class="header-right"></view>
    </view>

    <view class="date-selector">
      <view class="selector-btn" :class="{ active: dateRange === 'today' }" @click="dateRange = 'today'">
        <text>今日</text>
      </view>
      <view class="selector-btn" :class="{ active: dateRange === 'week' }" @click="dateRange = 'week'">
        <text>本周</text>
      </view>
      <view class="selector-btn" :class="{ active: dateRange === 'month' }" @click="dateRange = 'month'">
        <text>本月</text>
      </view>
    </view>

    <view class="stats-grid">
      <view class="stat-card">
        <text class="stat-icon">👥</text>
        <text class="stat-value">{{ summaryStats.totalService }}</text>
        <text class="stat-label">服务人次</text>
      </view>
      <view class="stat-card">
        <text class="stat-icon">⏱️</text>
        <text class="stat-value">{{ summaryStats.avgResponse }}s</text>
        <text class="stat-label">平均响应</text>
      </view>
      <view class="stat-card">
        <text class="stat-icon">😊</text>
        <text class="stat-value">{{ summaryStats.satisfaction }}%</text>
        <text class="stat-label">满意度</text>
      </view>
      <view class="stat-card">
        <text class="stat-icon">🔥</text>
        <text class="stat-value">{{ summaryStats.hotQuestions }}</text>
        <text class="stat-label">热门问答</text>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">情感趋势分析</text>
      </view>
      <view class="emotion-chart">
        <view class="chart-bars">
          <view class="chart-bar" v-for="(item, index) in weeklyReports" :key="index">
            <view class="bar-group">
              <view class="bar-item positive" :style="{ height: `${item.emotionTrend.positive}rpx` }">
                <text class="bar-tooltip">{{ item.emotionTrend.positive }}%</text>
              </view>
              <view class="bar-item neutral" :style="{ height: `${item.emotionTrend.neutral}rpx` }">
                <text class="bar-tooltip">{{ item.emotionTrend.neutral }}%</text>
              </view>
              <view class="bar-item negative" :style="{ height: `${item.emotionTrend.negative}rpx` }">
                <text class="bar-tooltip">{{ item.emotionTrend.negative }}%</text>
              </view>
            </view>
            <text class="bar-label">{{ formatDate(item.date) }}</text>
          </view>
        </view>
        <view class="chart-legend">
          <view class="legend-item">
            <view class="legend-dot positive"></view>
            <text>正面</text>
          </view>
          <view class="legend-item">
            <view class="legend-dot neutral"></view>
            <text>中性</text>
          </view>
          <view class="legend-item">
            <view class="legend-dot negative"></view>
            <text>负面</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">热门问答 TOP10</text>
      </view>
      <view class="hot-list">
        <view class="hot-item" v-for="(item, index) in hotQuestions" :key="index">
          <view class="hot-rank" :class="{ top: index < 3 }">{{ index + 1 }}</view>
          <view class="hot-content">
            <text class="hot-question">{{ item.question }}</text>
            <text class="hot-count">被询问 {{ item.count }} 次</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">服务建议</text>
      </view>
      <view class="suggestions">
        <view class="suggestion-item" v-for="(suggestion, index) in suggestions" :key="index">
          <view class="suggestion-icon">{{ suggestion.icon }}</view>
          <view class="suggestion-content">
            <text class="suggestion-title">{{ suggestion.title }}</text>
            <text class="suggestion-desc">{{ suggestion.desc }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { VisitorReport, DashboardData } from '@/types'
import { mockWeeklyReports, mockDashboardData } from '@/data/mock'

const dateRange = ref('week')
const weeklyReports = ref<VisitorReport[]>(mockWeeklyReports)
const dashboardData = ref<DashboardData>(mockDashboardData)

const suggestions = [
  { icon: '📈', title: '提升热门问答响应', desc: '建议针对"景区开放时间"和"门票价格"等高频问题优化回答内容' },
  { icon: '🎯', title: '优化语音交互', desc: '部分游客反馈语音识别准确率有待提升，建议优化语音模型' },
  { icon: '🌿', title: '增加景点介绍', desc: '游客对自然风光类景点关注度较高，建议丰富相关知识库内容' },
  { icon: '⏰', title: '缩短响应时间', desc: '当前平均响应时间2.3秒，建议优化接口性能' }
]

const summaryStats = computed(() => {
  const reports = weeklyReports.value
  const totalService = reports.reduce((sum, item) => sum + item.serviceCount, 0)
  const avgSatisfaction = Math.round(reports.reduce((sum, item) => sum + item.satisfaction, 0) / reports.length)
  
  return {
    totalService: dateRange.value === 'today' ? mockDashboardData.todayServiceCount : totalService,
    avgResponse: mockDashboardData.avgResponseTime,
    satisfaction: dateRange.value === 'today' ? mockDashboardData.satisfactionRate : avgSatisfaction,
    hotQuestions: mockDashboardData.hotQuestions.length
  }
})

const hotQuestions = computed(() => {
  return mockDashboardData.hotQuestions
})

const goBack = () => {
  uni.navigateBack()
}

const formatDate = (date: string) => {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style lang="scss" scoped>
.report-container {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: $spacing-xl;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-base $spacing-lg;
  background: #fffdf5;
  box-shadow: $shadow-sm;
}

.header-left {
  padding: $spacing-sm;
  
  text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
}

.header-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.header-right {
  width: 100rpx;
}

.date-selector {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-base;
  background: #fffdf5;
  border-top: 2rpx solid $bg-gray;
}

.selector-btn {
  flex: 1;
  text-align: center;
  padding: $spacing-sm;
  background: $bg-gray;
  border-radius: $border-radius;
  
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-base;
  padding: $spacing-base;
}

.stat-card {
  background: #fffdf5;
  border-radius: $border-radius-lg;
  padding: $spacing-base;
  text-align: center;
  box-shadow: $shadow-sm;
}

.stat-icon {
  display: block;
  font-size: 40rpx;
  margin-bottom: $spacing-xs;
}

.stat-value {
  display: block;
  font-size: $font-size-xxl;
  font-weight: 700;
  color: $primary-color;
  margin-bottom: $spacing-xs;
}

.stat-label {
  font-size: $font-size-xs;
  color: $text-light;
}

.section {
  background: #fffdf5;
  margin: $spacing-base;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-sm;
}

.section-header {
  margin-bottom: $spacing-base;
}

.section-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.emotion-chart {
  padding: $spacing-base 0;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 300rpx;
}

.chart-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-group {
  display: flex;
  align-items: flex-end;
  gap: 4rpx;
  height: 240rpx;
}

.bar-item {
  width: 16rpx;
  border-radius: $border-radius;
  position: relative;
  
  &.positive {
    background: $success-color;
  }
  
  &.neutral {
    background: $warning-color;
  }
  
  &.negative {
    background: $error-color;
  }
  
  .bar-tooltip {
    display: none;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(80, 65, 40, 0.8);
    padding: $spacing-xs;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    color: #fff;
    white-space: nowrap;
  }
  
  &:hover .bar-tooltip {
    display: block;
  }
}

.bar-label {
  font-size: $font-size-xs;
  color: $text-light;
  margin-top: $spacing-sm;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: $spacing-lg;
  margin-top: $spacing-base;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  
  text {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
}

.legend-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  
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

.hot-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.hot-item {
  display: flex;
  gap: $spacing-base;
  padding: $spacing-sm;
  background: $bg-gray;
  border-radius: $border-radius;
}

.hot-rank {
  width: 40rpx;
  height: 40rpx;
  background: $bg-gray;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  text {
    font-size: $font-size-xs;
    color: $text-secondary;
    font-weight: 600;
  }
  
  &.top {
    background: $primary-color;
    
    text {
      color: #fff;
    }
  }
}

.hot-content {
  flex: 1;
}

.hot-question {
  display: block;
  font-size: $font-size-sm;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.hot-count {
  font-size: $font-size-xs;
  color: $text-light;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.suggestion-item {
  display: flex;
  gap: $spacing-base;
  padding: $spacing-base;
  background: rgba(139, 115, 85, 0.05);
  border-radius: $border-radius-lg;
}

.suggestion-icon {
  font-size: 40rpx;
  flex-shrink: 0;
}

.suggestion-content {
  flex: 1;
}

.suggestion-title {
  display: block;
  font-size: $font-size-base;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.suggestion-desc {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;
}
</style>
