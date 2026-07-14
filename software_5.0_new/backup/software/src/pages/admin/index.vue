<template>
  <view class="admin-container">
    <view class="admin-header">
      <view class="header-top">
        <text class="header-title">管理后台</text>
        <view class="logout-btn" @click="handleLogout">
          <text>退出</text>
        </view>
      </view>
      <view class="header-stats">
        <view class="stat-item">
          <text class="stat-value">{{ dashboardData?.todayServiceCount || 0 }}</text>
          <text class="stat-label">今日服务人次</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ dashboardData?.satisfactionRate || 0 }}%</text>
          <text class="stat-label">满意度</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ dashboardData?.avgResponseTime || 0 }}s</text>
          <text class="stat-label">响应时间</text>
        </view>
      </view>
    </view>

    <view class="menu-grid">
      <view class="menu-item" @click="goTo('/pages/admin/knowledge')">
        <view class="menu-icon knowledge">
          <text>📚</text>
        </view>
        <text class="menu-title">知识库管理</text>
        <text class="menu-desc">管理景区知识文档</text>
      </view>
      <view class="menu-item" @click="goTo('/pages/admin/avatar')">
        <view class="menu-icon avatar">
          <text>🎭</text>
        </view>
        <text class="menu-title">数字人管理</text>
        <text class="menu-desc">配置数字人形象</text>
      </view>
      <view class="menu-item" @click="goTo('/pages/admin/report')">
        <view class="menu-icon report">
          <text>📊</text>
        </view>
        <text class="menu-title">数据报告</text>
        <text class="menu-desc">游客感受度分析</text>
      </view>
      <view class="menu-item" @click="goTo('/pages/admin/dashboard')">
        <view class="menu-icon dashboard">
          <text>🖥️</text>
        </view>
        <text class="menu-title">数据大屏</text>
        <text class="menu-desc">实时数据监控</text>
      </view>
      <view class="menu-item" @click="goTo('/pages/admin/node-editor')">
        <view class="menu-icon node-editor">
          <text>🗺️</text>
        </view>
        <text class="menu-title">路网节点编辑</text>
        <text class="menu-desc">点选/连线景区路网节点</text>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">热门问答</text>
        <text class="section-more" @click="goTo('/pages/admin/report')">查看更多</text>
      </view>
      <view class="hot-list">
        <view class="hot-item" v-for="(item, index) in dashboardData?.hotQuestions" :key="index">
          <view class="hot-rank" :class="{ top: index < 3 }">{{ index + 1 }}</view>
          <text class="hot-question">{{ item.question }}</text>
          <text class="hot-count">{{ item.count }}次</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">满意度趋势</text>
      </view>
      <view class="chart-container">
        <view class="chart-bars">
          <view class="chart-bar" v-for="(item, index) in weeklyReports" :key="index">
            <view class="bar-wrapper">
              <view 
                class="bar-fill" 
                :style="{ height: `${(item.satisfaction / 100) * 200}rpx` }"
              ></view>
            </view>
            <text class="bar-label">{{ formatDate(item.date) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import type { DashboardData, VisitorReport } from '@/types'
import { mockDashboardData, mockWeeklyReports } from '@/data/mock'

const userStore = useUserStore()

const dashboardData = ref<DashboardData | null>(null)
const weeklyReports = ref<VisitorReport[]>([])

onMounted(() => {
  dashboardData.value = mockDashboardData
  weeklyReports.value = mockWeeklyReports
})

const goTo = (url: string) => {
  uni.navigateTo({ url })
}

const formatDate = (date: string) => {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const handleLogout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出管理后台吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.navigateBack()
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.admin-container {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: $spacing-xl;
}

.admin-header {
  background: linear-gradient(135deg, $primary-color 0%, $primary-dark 100%);
  padding: $spacing-lg;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-lg;
}

.header-title {
  font-size: $font-size-xl;
  font-weight: 700;
  color: #fff;
}

.logout-btn {
  padding: $spacing-sm $spacing-base;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $border-radius;
  
  text {
    font-size: $font-size-sm;
    color: #fff;
  }
}

.header-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: rgba(255, 255, 255, 0.15);
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: $font-size-xxl;
  font-weight: 700;
  color: #fff;
}

.stat-label {
  font-size: $font-size-sm;
  color: rgba(255, 255, 255, 0.8);
}

.stat-divider {
  width: 2rpx;
  height: 80rpx;
  background: rgba(255, 255, 255, 0.3);
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-base;
  padding: $spacing-base;
  margin-top: -40rpx;
}

.menu-item {
  background: #fffdf5;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-md;
}

.menu-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: $border-radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-base;
  
  text {
    font-size: 40rpx;
  }
  
  &.knowledge {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  &.avatar {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
  
  &.report {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
  
  &.dashboard {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  }

  &.node-editor {
    background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  }
}

.menu-title {
  display: block;
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.menu-desc {
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-base;
}

.section-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.section-more {
  font-size: $font-size-sm;
  color: $primary-color;
}

.hot-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.hot-item {
  display: flex;
  align-items: center;
  gap: $spacing-base;
}

.hot-rank {
  width: 40rpx;
  height: 40rpx;
  background: $bg-gray;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
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

.hot-question {
  flex: 1;
  font-size: $font-size-sm;
  color: $text-primary;
}

.hot-count {
  font-size: $font-size-xs;
  color: $text-light;
}

.chart-container {
  padding: $spacing-base 0;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 240rpx;
  padding-top: $spacing-base;
}

.chart-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar-wrapper {
  width: 32rpx;
  height: 200rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  background: linear-gradient(180deg, $primary-color 0%, $primary-dark 100%);
  border-radius: $border-radius;
  transition: height $transition-slow;
}

.bar-label {
  font-size: $font-size-xs;
  color: $text-light;
  margin-top: $spacing-sm;
}
</style>
