<template>
  <view class="report-container">
    <view class="page-header">
      <view class="header-left" @click="goBack">
        <text>← 返回</text>
      </view>
      <text class="header-title">游客感受度报告</text>
      <view class="header-right">
        <view class="refresh-btn" @click="fetchReport">
          <text>🔄</text>
        </view>
      </view>
    </view>

    <view v-if="loading" class="loading-state">
      <text>报告生成中...</text>
    </view>

    <template v-else>
      <!-- 概览统计 -->
      <view class="stats-grid">
        <view class="stat-card">
          <text class="stat-icon">👥</text>
          <text class="stat-value">{{ reportData?.total || 0 }}</text>
          <text class="stat-label">总对话数</text>
        </view>
        <view class="stat-card">
          <text class="stat-icon">😊</text>
          <text class="stat-value">{{ reportData?.emotionPercent?.positive || 0 }}%</text>
          <text class="stat-label">正面情绪</text>
        </view>
        <view class="stat-card">
          <text class="stat-icon">😐</text>
          <text class="stat-value">{{ reportData?.emotionPercent?.neutral || 0 }}%</text>
          <text class="stat-label">中性情绪</text>
        </view>
        <view class="stat-card">
          <text class="stat-icon">😟</text>
          <text class="stat-value">{{ reportData?.emotionPercent?.negative || 0 }}%</text>
          <text class="stat-label">负面情绪</text>
        </view>
      </view>

      <!-- 情感分布 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">📊 情感分布详情</text>
        </view>
        <view class="emotion-dist">
          <view class="dist-item">
            <view class="dist-header">
              <text class="dist-name">正面</text>
              <text class="dist-num">{{ reportData?.emotionDist?.positive || 0 }} 条</text>
            </view>
            <view class="dist-bar-wrap">
              <view class="dist-bar positive" :style="{ width: (reportData?.emotionPercent?.positive || 0) + '%' }"></view>
            </view>
            <text class="dist-percent">{{ reportData?.emotionPercent?.positive || 0 }}%</text>
          </view>
          <view class="dist-item">
            <view class="dist-header">
              <text class="dist-name">中性</text>
              <text class="dist-num">{{ reportData?.emotionDist?.neutral || 0 }} 条</text>
            </view>
            <view class="dist-bar-wrap">
              <view class="dist-bar neutral" :style="{ width: (reportData?.emotionPercent?.neutral || 0) + '%' }"></view>
            </view>
            <text class="dist-percent">{{ reportData?.emotionPercent?.neutral || 0 }}%</text>
          </view>
          <view class="dist-item">
            <view class="dist-header">
              <text class="dist-name">负面</text>
              <text class="dist-num">{{ reportData?.emotionDist?.negative || 0 }} 条</text>
            </view>
            <view class="dist-bar-wrap">
              <view class="dist-bar negative" :style="{ width: (reportData?.emotionPercent?.negative || 0) + '%' }"></view>
            </view>
            <text class="dist-percent">{{ reportData?.emotionPercent?.negative || 0 }}%</text>
          </view>
        </view>
      </view>

      <!-- 情感趋势 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">📈 近7天情感趋势</text>
        </view>
        <view class="trend-chart" v-if="dailyChartData.length > 0">
          <view class="trend-bars">
            <view class="trend-bar-col" v-for="item in dailyChartData" :key="item.date">
              <view class="bar-stack">
                <view class="bar-seg positive" :style="{ height: `${item.positive * 2}rpx` }"></view>
                <view class="bar-seg neutral" :style="{ height: `${item.neutral * 2}rpx` }"></view>
                <view class="bar-seg negative" :style="{ height: `${item.negative * 2}rpx` }"></view>
              </view>
              <text class="trend-label">{{ item.label }}</text>
              <text class="trend-total">{{ item.total }}</text>
            </view>
          </view>
          <view class="trend-legend">
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
        <view v-else class="empty-tip">
          <text>暂无趋势数据</text>
        </view>
      </view>

      <!-- 问题分类统计 -->
      <view class="section" v-if="reportData?.categoryStats?.length">
        <view class="section-header">
          <text class="section-title">🎯 问题分类统计</text>
        </view>
        <view class="category-list">
          <view class="category-item" v-for="cat in reportData.categoryStats" :key="cat.category">
            <view class="cat-info">
              <text class="cat-name">{{ cat.category }}</text>
              <text class="cat-count">{{ cat.count }} 条</text>
            </view>
            <view class="cat-bar-wrap">
              <view class="cat-bar" :style="{ width: (cat.count / maxCategoryCount * 100) + '%' }"></view>
            </view>
          </view>
        </view>
      </view>

      <!-- 关注点分析 -->
      <view class="section" v-if="reportData?.hotKeywords?.length">
        <view class="section-header">
          <text class="section-title">🔥 游客关注点 TOP15</text>
        </view>
        <view class="keyword-cloud">
          <view 
            class="keyword-tag" 
            v-for="(kw, idx) in reportData.hotKeywords" 
            :key="kw[0]"
            :class="{ 
              large: idx < 3, 
              medium: idx >= 3 && idx < 8, 
              small: idx >= 8 
            }"
          >
            <text class="kw-name">{{ kw[0] }}</text>
            <text class="kw-count">{{ kw[1] }}</text>
          </view>
        </view>
      </view>

      <!-- 景点评分分析 -->
      <view class="section" v-if="reportData?.spotRatings?.length">
        <view class="section-header">
          <text class="section-title">🏆 景点评分分析</text>
        </view>
        <view class="spot-list">
          <view class="spot-item" v-for="spot in reportData.spotRatings" :key="spot.spot_id">
            <view class="spot-info">
              <text class="spot-name">{{ spot.spot_id }}</text>
              <text class="spot-count">{{ spot.count }} 条评价</text>
            </view>
            <view class="spot-rating" :class="ratingClass(spot.avgRating)">
              <text class="rating-value">{{ spot.avgRating }}</text>
              <text class="rating-star">★</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 负面情绪预警 -->
      <view class="section" v-if="reportData?.negativeLogs?.length">
        <view class="section-header">
          <text class="section-title warning">⚠️ 负面情绪预警</text>
          <text class="section-count">{{ reportData.negativeLogs.length }} 条</text>
        </view>
        <view class="negative-list">
          <view class="negative-item" v-for="(log, index) in reportData.negativeLogs" :key="index">
            <view class="neg-header">
              <text class="neg-tag">游客提问</text>
              <text class="neg-time">{{ formatTime(log.time) }}</text>
            </view>
            <text class="neg-question">{{ log.question }}</text>
            <view class="neg-header">
              <text class="neg-tag ai">AI 回答</text>
            </view>
            <text class="neg-answer">{{ log.answer }}</text>
          </view>
        </view>
      </view>

      <!-- AI 服务建议 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">💡 智能服务建议</text>
        </view>
        <view class="suggestions">
          <view class="suggestion-item" v-for="(suggestion, index) in reportData?.suggestions || []" :key="index">
            <view class="suggestion-icon">{{ suggestion.icon }}</view>
            <view class="suggestion-content">
              <text class="suggestion-title">{{ suggestion.title }}</text>
              <text class="suggestion-desc">{{ suggestion.desc }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 报告生成时间 -->
      <view class="report-footer" v-if="reportData?.generatedAt">
        <text>报告生成于：{{ formatDateTime(reportData.generatedAt) }}</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAdminToken } from '@/api/ai'

interface ReportData {
  total: number
  emotionDist: { positive: number; neutral: number; negative: number }
  emotionPercent: { positive: number; neutral: number; negative: number }
  dailyTrend: Record<string, { positive: number; neutral: number; negative: number; total: number }>
  hotKeywords: [string, number][]
  categoryStats: { category: string; count: number }[]
  negativeLogs: { question: string; answer: string; time: string }[]
  spotRatings: { spot_id: string; avgRating: number; count: number }[]
  suggestions: { icon: string; title: string; desc: string }[]
  generatedAt: string
}

const reportData = ref<ReportData | null>(null)
const loading = ref(false)

const maxCategoryCount = computed(() => {
  if (!reportData.value?.categoryStats?.length) return 1
  return Math.max(...reportData.value.categoryStats.map(c => c.count), 1)
})

// 日趋势数据转换
const dailyChartData = computed(() => {
  if (!reportData.value?.dailyTrend) return []
  const entries = Object.entries(reportData.value.dailyTrend).slice(-7)
  return entries.map(([day, data]) => {
    const d = new Date(day)
    return {
      date: day,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      positive: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0,
      neutral: data.total > 0 ? Math.round((data.neutral / data.total) * 100) : 0,
      negative: data.total > 0 ? Math.round((data.negative / data.total) * 100) : 0,
      total: data.total,
    }
  })
})

const ratingClass = (rating: number): string => {
  if (rating >= 4.5) return 'high'
  if (rating >= 3.5) return 'medium'
  return 'low'
}

const fetchReport = async () => {
  loading.value = true
  try {
    const res = await fetch('/api/admin/report/full', {
      headers: { 'Authorization': `Bearer ${getAdminToken()}` }
    })
    if (!res.ok) {
      if (res.status === 401) {
        uni.showToast({ title: '请先登录管理员', icon: 'none' })
      }
      return
    }
    const data = await res.json()
    reportData.value = data
  } catch (e) {
    console.error('报告加载失败:', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  uni.navigateBack()
}

const formatTime = (timestamp: string) => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const formatDateTime = (timestamp: string) => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

onMounted(() => {
  fetchReport()
})
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

.refresh-btn {
  width: 64rpx;
  height: 64rpx;
  background: $bg-gray;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text {
    font-size: 28rpx;
  }
}

.loading-state {
  padding: 80rpx;
  text-align: center;
  color: $text-secondary;
  font-size: $font-size-base;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-base;
}

.section-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  
  &.warning {
    color: $error-color;
  }
}

.section-count {
  font-size: $font-size-xs;
  color: $text-light;
  padding: 4rpx 12rpx;
  background: rgba(255, 77, 79, 0.1);
  border-radius: 100rpx;
}

// 情感分布
.emotion-dist {
  padding: 20rpx 0;
}

.dist-item {
  margin-bottom: 24rpx;
}

.dist-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.dist-name {
  font-size: $font-size-sm;
  color: $text-primary;
  font-weight: 500;
}

.dist-num {
  font-size: $font-size-xs;
  color: $text-light;
}

.dist-bar-wrap {
  height: 24rpx;
  background: $bg-gray;
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 4rpx;
}

.dist-bar {
  height: 100%;
  border-radius: 12rpx;
  transition: width 0.5s ease;
  
  &.positive {
    background: linear-gradient(90deg, #4caf50, #66bb6a);
  }
  &.neutral {
    background: linear-gradient(90deg, #ff9800, #ffa726);
  }
  &.negative {
    background: linear-gradient(90deg, #f44336, #ef5350);
  }
}

.dist-percent {
  font-size: $font-size-xs;
  color: $text-secondary;
}

// 趋势图
.trend-chart {
  padding: $spacing-base 0;
}

.trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 300rpx;
  gap: $spacing-xs;
}

.trend-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-stack {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 40rpx;
  height: 220rpx;
  justify-content: flex-end;
  border-radius: $border-radius;
  overflow: hidden;
  background: rgba(139, 115, 85, 0.05);
}

.bar-seg {
  width: 100%;
  transition: height 0.5s ease;
  
  &.positive { background: $success-color; }
  &.neutral { background: $warning-color; }
  &.negative { background: $error-color; }
}

.trend-label {
  font-size: $font-size-xs;
  color: $text-light;
  margin-top: $spacing-xs;
}

.trend-total {
  font-size: $font-size-xs;
  color: $text-secondary;
  font-weight: 600;
}

.trend-legend {
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
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  &.positive { background: $success-color; }
  &.neutral { background: $warning-color; }
  &.negative { background: $error-color; }
}

// 分类统计
.category-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.category-item {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.cat-info {
  display: flex;
  justify-content: space-between;
}

.cat-name {
  font-size: $font-size-sm;
  color: $text-primary;
  font-weight: 500;
}

.cat-count {
  font-size: $font-size-xs;
  color: $text-light;
}

.cat-bar-wrap {
  height: 16rpx;
  background: $bg-gray;
  border-radius: 8rpx;
  overflow: hidden;
}

.cat-bar {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, #d4a574);
  border-radius: 8rpx;
  transition: width 0.5s ease;
}

// 关键词云
.keyword-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  padding: $spacing-sm 0;
}

.keyword-tag {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  background: rgba(139, 115, 85, 0.1);
  border-radius: 100rpx;
  transition: all 0.3s;
  
  &.large {
    background: rgba(139, 115, 85, 0.25);
    .kw-name {
      font-size: $font-size-lg;
      font-weight: 600;
      color: $primary-color;
    }
    .kw-count {
      font-size: $font-size-sm;
      color: $primary-color;
    }
  }
  &.medium {
    background: rgba(139, 115, 85, 0.15);
    .kw-name {
      font-size: $font-size-base;
      color: $text-primary;
    }
    .kw-count {
      font-size: $font-size-xs;
      color: $text-secondary;
    }
  }
  &.small {
    .kw-name {
      font-size: $font-size-sm;
      color: $text-secondary;
    }
    .kw-count {
      font-size: $font-size-xs;
      color: $text-light;
    }
  }
}

.kw-name {
  font-weight: 500;
}

.kw-count {
  padding: 2rpx 8rpx;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 100rpx;
}

// 景点评分
.spot-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.spot-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
}

.spot-info {
  flex: 1;
}

.spot-name {
  display: block;
  font-size: $font-size-sm;
  color: $text-primary;
  font-weight: 500;
  margin-bottom: 4rpx;
}

.spot-count {
  font-size: $font-size-xs;
  color: $text-light;
}

.spot-rating {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 4rpx 12rpx;
  border-radius: $border-radius;
  
  &.high {
    background: rgba(82, 196, 26, 0.15);
    .rating-value, .rating-star { color: $success-color; }
  }
  &.medium {
    background: rgba(250, 173, 20, 0.15);
    .rating-value, .rating-star { color: $warning-color; }
  }
  &.low {
    background: rgba(255, 77, 79, 0.15);
    .rating-value, .rating-star { color: $error-color; }
  }
}

.rating-value {
  font-size: $font-size-base;
  font-weight: 700;
}

.rating-star {
  font-size: $font-size-sm;
}

// 负面情绪
.negative-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.negative-item {
  background: #fff5f5;
  border-left: 6rpx solid $error-color;
  border-radius: $border-radius;
  padding: $spacing-base;
}

.neg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.neg-tag {
  padding: 2rpx 10rpx;
  background: rgba(255, 77, 79, 0.15);
  border-radius: 100rpx;
  font-size: $font-size-xs;
  color: $error-color;
  
  &.ai {
    background: rgba(24, 144, 255, 0.15);
    color: #1890ff;
  }
}

.neg-time {
  font-size: $font-size-xs;
  color: $text-placeholder;
}

.neg-question {
  display: block;
  font-size: $font-size-sm;
  color: $text-primary;
  line-height: 1.5;
  margin-bottom: $spacing-sm;
}

.neg-answer {
  display: block;
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;
}

// 服务建议
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
  border-left: 4rpx solid $primary-color;
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

.empty-tip {
  padding: 40rpx;
  text-align: center;
  color: $text-light;
  font-size: $font-size-sm;
}

.report-footer {
  padding: $spacing-lg;
  text-align: center;
  font-size: $font-size-xs;
  color: $text-placeholder;
}
</style>
