<template>
  <view class="dashboard-container">
    <view class="dashboard-header">
      <view class="header-left">
        <text class="header-title">数据大屏</text>
        <text class="header-subtitle">实时数据监控中心</text>
      </view>
      <view class="header-right">
        <view class="live-badge" :class="{ active: polling }">
          <view class="live-dot"></view>
          <text>{{ polling ? '实时' : '已暂停' }}</text>
        </view>
        <view class="refresh-btn" @click="refreshData">
          <text>🔄</text>
        </view>
        <text class="update-time">更新于 {{ currentTime }}</text>
      </view>
    </view>

    <!-- 核心指标卡片 -->
    <view class="main-stats">
      <view class="main-stat-card">
        <view class="stat-header">
          <text class="stat-icon">👥</text>
          <text class="stat-badge">今日</text>
        </view>
        <text class="stat-value">{{ dashboardData?.todayServiceCount || 0 }}</text>
        <text class="stat-label">今日服务人次</text>
      </view>
      <view class="main-stat-card">
        <view class="stat-header">
          <text class="stat-icon">📊</text>
          <text class="stat-badge">本周</text>
        </view>
        <text class="stat-value">{{ dashboardData?.weeklyServiceCount || 0 }}</text>
        <text class="stat-label">本周累计</text>
      </view>
      <view class="main-stat-card">
        <view class="stat-header">
          <text class="stat-icon">😊</text>
          <text class="stat-badge">满意度</text>
        </view>
        <text class="stat-value">{{ dashboardData?.satisfactionRate || 0 }}%</text>
        <text class="stat-label">游客满意度</text>
      </view>
      <view class="main-stat-card">
        <view class="stat-header">
          <text class="stat-icon">💬</text>
          <text class="stat-badge">总计</text>
        </view>
        <text class="stat-value">{{ dashboardData?.totalChats || 0 }}</text>
        <text class="stat-label">对话总数</text>
      </view>
    </view>

    <!-- 辅助指标 -->
    <view class="stats-row">
      <view class="mini-stat">
        <text class="mini-value">{{ dashboardData?.avgResponseTime || 0 }}s</text>
        <text class="mini-label">平均响应</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value">{{ dashboardData?.reviewCount || 0 }}</text>
        <text class="mini-label">景点评价</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value">{{ dashboardData?.avgRating || 0 }}</text>
        <text class="mini-label">平均评分</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value">{{ dashboardData?.knowledgeBase?.total || 0 }}</text>
        <text class="mini-label">知识条目</text>
      </view>
    </view>

    <!-- 情感分布 -->
    <view class="stats-row">
      <view class="mini-stat">
        <text class="mini-value positive">{{ emotionStats.positive }}%</text>
        <text class="mini-label">正面情绪</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value neutral">{{ emotionStats.neutral }}%</text>
        <text class="mini-label">中性情绪</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value negative">{{ emotionStats.negative }}%</text>
        <text class="mini-label">负面情绪</text>
      </view>
      <view class="mini-stat">
        <text class="mini-value">{{ emotionTotal }}</text>
        <text class="mini-label">情感样本</text>
      </view>
    </view>

    <view class="charts-row">
      <!-- 服务趋势 -->
      <view class="chart-section">
        <view class="section-title-row">
          <text class="section-title">📈 近7天服务趋势</text>
        </view>
        <view class="line-chart">
          <view class="chart-grid">
            <view class="grid-line" v-for="i in 5" :key="i"></view>
          </view>
          <view class="chart-line" v-if="serviceTrend.length > 0">
            <view 
              class="chart-point" 
              v-for="(point, index) in serviceTrend" 
              :key="index"
              :style="{ 
                left: `${(index / Math.max(serviceTrend.length - 1, 1)) * 100}%`, 
                bottom: `${(point.count / maxService) * 100}%` 
              }"
            >
              <view class="point-dot"></view>
              <text class="point-value">{{ point.count }}</text>
            </view>
            <view class="trend-line-container">
              <view class="trend-line-fill" :style="trendLineStyle"></view>
            </view>
          </view>
          <view v-else class="chart-empty">
            <text>暂无数据</text>
          </view>
          <view class="chart-x-axis">
            <text class="axis-label" v-for="point in serviceTrend" :key="point.date">{{ formatDate(point.date) }}</text>
          </view>
        </view>
      </view>

      <!-- 情感分布饼图 -->
      <view class="chart-section">
        <view class="section-title-row">
          <text class="section-title">🎨 情感分布</text>
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
      <!-- 热门问答 -->
      <view class="hot-section">
        <view class="section-title-row">
          <text class="section-title">🔥 热门问答 TOP10</text>
        </view>
        <view class="hot-questions-list">
          <view class="hot-item" v-for="(item, index) in dashboardData?.hotQuestions" :key="index">
            <view class="hot-rank" :class="{ top: index < 3 }">{{ index + 1 }}</view>
            <text class="hot-question">{{ item.question }}</text>
            <text class="hot-count">{{ item.count }}次</text>
          </view>
          <view v-if="!dashboardData?.hotQuestions?.length" class="empty-tip">
            <text>暂无数据</text>
          </view>
        </view>
      </view>

      <!-- 热门景点 -->
      <view class="routes-section">
        <view class="section-title-row">
          <text class="section-title">🏆 热门景点 TOP5</text>
        </view>
        <view class="routes-list">
          <view class="route-item" v-for="(route, index) in dashboardData?.topSpots" :key="index">
            <view class="route-bar">
              <view class="bar-fill" :style="{ width: `${(route.count / maxSpot) * 100}%` }"></view>
            </view>
            <view class="route-info">
              <text class="route-name">{{ route.spot_id }}</text>
              <text class="route-count">{{ route.count }} 条评价</text>
            </view>
          </view>
          <view v-if="!dashboardData?.topSpots?.length" class="empty-tip">
            <text>暂无评价数据</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 知识库状态 -->
    <view class="kb-section" v-if="dashboardData?.knowledgeBase">
      <view class="section-title-row">
        <text class="section-title">📚 知识库状态</text>
      </view>
      <view class="kb-info">
        <view class="kb-item">
          <text class="kb-label">总条目</text>
          <text class="kb-value">{{ dashboardData.knowledgeBase.total }}</text>
        </view>
        <view class="kb-item">
          <text class="kb-label">最近更新</text>
          <text class="kb-value">{{ formatDateTime(dashboardData.knowledgeBase.lastUpdated) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAdminToken } from '@/api/ai'

interface DashboardData {
  todayServiceCount: number
  weeklyServiceCount: number
  totalChats: number
  reviewCount: number
  avgRating: number
  satisfactionRate: number
  avgResponseTime: number
  emotionDistribution: { positive: number; neutral: number; negative: number }
  emotionCounts: { positive: number; neutral: number; negative: number }
  serviceTrend: { date: string; count: number }[]
  hotQuestions: { question: string; count: number }[]
  topSpots: { spot_id: string; count: number }[]
  knowledgeBase: { total: number; lastUpdated: string | null }
  timestamp: string
}

const dashboardData = ref<DashboardData | null>(null)
const currentTime = ref('')
const polling = ref(true)
let pollTimer: number | null = null
let clockTimer: number | null = null

const serviceTrend = computed(() => dashboardData.value?.serviceTrend || [])

const maxService = computed(() => {
  const arr = serviceTrend.value
  if (arr.length === 0) return 1
  return Math.max(...arr.map(p => p.count), 1)
})

const maxSpot = computed(() => {
  if (!dashboardData.value?.topSpots?.length) return 1
  return Math.max(...dashboardData.value.topSpots.map(r => r.count), 1)
})

const emotionStats = computed(() => {
  if (!dashboardData.value) return { positive: 0, neutral: 0, negative: 0 }
  return dashboardData.value.emotionDistribution
})

const emotionTotal = computed(() => {
  if (!dashboardData.value?.emotionCounts) return 0
  const c = dashboardData.value.emotionCounts
  return c.positive + c.neutral + c.negative
})

const pieStyle = computed(() => {
  const stats = emotionStats.value
  const positive = stats.positive
  const neutral = stats.neutral
  return {
    background: `conic-gradient(
      #52c41a 0deg ${positive * 3.6}deg,
      #faad14 ${positive * 3.6}deg ${(positive + neutral) * 3.6}deg,
      #ff4d4f ${(positive + neutral) * 3.6}deg 360deg
    )`
  }
})

// 趋势折线（用 SVG path 模拟，这里简化为点的连线样式）
const trendLineStyle = computed(() => {
  const arr = serviceTrend.value
  if (arr.length < 2) return {}
  const maxVal = maxService.value
  const points = arr.map((p, i) => ({
    x: (i / Math.max(arr.length - 1, 1)) * 100,
    y: 100 - (p.count / maxVal) * 100
  }))
  return {
    'background': `linear-gradient(to right, transparent, transparent)`,
  }
})

const updateTime = () => {
  const now = new Date()
  currentTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

const fetchDashboard = async () => {
  try {
    const res = await fetch('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${getAdminToken()}` }
    })
    if (!res.ok) {
      if (res.status === 401) {
        polling.value = false
        uni.showToast({ title: '请先登录管理员', icon: 'none' })
      }
      return
    }
    const data = await res.json()
    dashboardData.value = data
    updateTime()
  } catch (e) {
    console.error('数据大屏加载失败:', e)
  }
}

const refreshData = () => {
  fetchDashboard()
  uni.showToast({ title: '数据已刷新', icon: 'success' })
}

const startPolling = () => {
  polling.value = true
  if (pollTimer) clearInterval(pollTimer)
  // 每30秒轮询
  pollTimer = setInterval(fetchDashboard, 30000) as unknown as number
}

const stopPolling = () => {
  polling.value = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '无'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

onMounted(() => {
  fetchDashboard()
  updateTime()
  clockTimer = setInterval(updateTime, 1000) as unknown as number
  startPolling()
})

onUnmounted(() => {
  stopPolling()
  if (clockTimer) clearInterval(clockTimer)
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
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: $spacing-xs;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 4rpx 12rpx;
  background: rgba(255, 77, 79, 0.1);
  border-radius: 100rpx;
  text {
    font-size: $font-size-xs;
    color: $error-color;
  }
  &.active {
    background: rgba(82, 196, 26, 0.15);
    text { color: $success-color; }
    .live-dot {
      background: $success-color;
      animation: pulse 1.5s infinite;
    }
  }
}

.live-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #ccc;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}

.refresh-btn {
  width: 64rpx;
  height: 64rpx;
  background: rgba(200, 185, 150, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-xs;
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
  font-size: 60rpx;
  font-weight: 700;
  color: #4a3a2a;
  margin-bottom: $spacing-xs;
}

.stat-label {
  font-size: $font-size-sm;
  color: rgba(74, 58, 42, 0.7);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-sm;
  margin-bottom: $spacing-base;
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
  &.positive { color: $success-color; }
  &.neutral { color: $warning-color; }
  &.negative { color: $error-color; }
}

.mini-label {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.6);
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
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

.chart-empty {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(74, 58, 42, 0.4);
  font-size: $font-size-sm;
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
  &.positive { background: $success-color; }
  &.neutral { background: $warning-color; }
  &.negative { background: $error-color; }
}

.bottom-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-base;
  margin-bottom: $spacing-lg;
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
  padding: $spacing-sm;
  background: rgba(255, 255, 255, 0.4);
  border-radius: $border-radius;
}

.hot-rank {
  width: 40rpx;
  height: 40rpx;
  background: rgba(200, 185, 150, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.7);
  font-weight: 600;
  &.top {
    background: $primary-color;
    color: #fff;
  }
}

.hot-question {
  flex: 1;
  font-size: $font-size-sm;
  color: #4a3a2a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-count {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.6);
  flex-shrink: 0;
}

.routes-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.route-item {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.route-bar {
  height: 20rpx;
  background: rgba(200, 185, 150, 0.2);
  border-radius: 10rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, #d4a574);
  border-radius: 10rpx;
  transition: width 0.5s ease;
}

.route-info {
  display: flex;
  justify-content: space-between;
}

.route-name {
  font-size: $font-size-sm;
  color: #4a3a2a;
  font-weight: 500;
}

.route-count {
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.6);
}

.empty-tip {
  padding: 40rpx;
  text-align: center;
  color: rgba(74, 58, 42, 0.4);
  font-size: $font-size-sm;
}

.kb-section {
  background: rgba(200, 185, 150, 0.15);
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
}

.kb-info {
  display: flex;
  gap: $spacing-lg;
}

.kb-item {
  flex: 1;
  text-align: center;
}

.kb-label {
  display: block;
  font-size: $font-size-xs;
  color: rgba(74, 58, 42, 0.6);
  margin-bottom: $spacing-xs;
}

.kb-value {
  font-size: $font-size-lg;
  font-weight: 600;
  color: #4a3a2a;
}
</style>
