<template>
  <view class="profile-page">
    <view class="profile-header">
      <text class="page-title">我的</text>
    </view>

    <!-- 未登录 -->
    <view class="guest-card" v-if="!userStore.isLoggedIn">
      <view class="avatar-placeholder"><text>👤</text></view>
      <text class="guest-name">未登录</text>
      <text class="guest-tip">登录后可保存资料，获得按年龄定制的安全游览路线（如年长游客尽量避开桥梁与陡坡）</text>
      <view class="btn-row">
        <button class="btn-primary" @click="goLogin">登 录</button>
        <button class="btn-outline" @click="goRegister">注 册</button>
      </view>
    </view>

    <!-- 已登录 -->
    <view class="user-card" v-else>
      <view class="avatar-placeholder"><text>👤</text></view>
      <text class="user-name">{{ userStore.user?.nickname || '游客' }}</text>
      <view class="info-list">
        <view class="info-item">
          <text class="info-label">手机号</text>
          <text class="info-value">{{ maskPhone(userStore.user?.phone) }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">年龄</text>
          <text class="info-value">{{ userStore.user?.age != null ? userStore.user.age + ' 岁' : '未填写' }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">性别</text>
          <text class="info-value">{{ genderText(userStore.user?.gender) }}</text>
        </view>
      </view>
      <button class="btn-logout" @click="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const goLogin = () => uni.navigateTo({ url: '/pages/visitor/login?from=profile' })
const goRegister = () => uni.navigateTo({ url: '/pages/visitor/register?from=profile' })

const maskPhone = (p?: string) =>
  p ? p.slice(0, 3) + '****' + p.slice(-4) : ''

const genderText = (g?: string | null) =>
  g === 'male' ? '男' : g === 'female' ? '女' : g === 'other' ? '不愿透露' : '未填写'

const handleLogout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        await userStore.logout()
        uni.showToast({ title: '已退出登录', icon: 'none' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 140rpx;
}
.profile-header {
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  padding: calc(env(safe-area-inset-top) + 40rpx) 40rpx 60rpx;
}
.page-title {
  font-size: 44rpx;
  font-weight: 700;
  color: #fff;
}
.guest-card,
.user-card {
  margin: 40rpx;
  background: $bg-white;
  border-radius: $border-radius-xl;
  padding: 48rpx 36rpx 40rpx;
  box-shadow: $shadow-lg;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.avatar-placeholder {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: $bg-gray;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72rpx;
  margin-bottom: 24rpx;
}
.guest-name,
.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
}
.guest-tip {
  font-size: 24rpx;
  color: $text-secondary;
  text-align: center;
  margin: 16rpx 0 36rpx;
  line-height: 1.5;
}
.btn-row {
  display: flex;
  gap: 24rpx;
  width: 100%;
}
.btn-primary {
  flex: 1;
  height: 84rpx;
  border: none;
  border-radius: $border-radius-lg;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  color: #fff;
  font-size: 30rpx;
  &::after {
    border: none;
  }
}
.btn-outline {
  flex: 1;
  height: 84rpx;
  border: 2rpx solid $primary-color;
  border-radius: $border-radius-lg;
  background: transparent;
  color: $primary-color;
  font-size: 30rpx;
  &::after {
    border: none;
  }
}
.info-list {
  width: 100%;
  margin-top: 32rpx;
}
.info-item {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 2rpx solid $border-color;
}
.info-item:last-child {
  border-bottom: none;
}
.info-label {
  font-size: 28rpx;
  color: $text-secondary;
}
.info-value {
  font-size: 28rpx;
  color: $text-primary;
}
.btn-logout {
  width: 100%;
  height: 84rpx;
  margin-top: 44rpx;
  border: 2rpx solid $error-color;
  border-radius: $border-radius-lg;
  background: transparent;
  color: $error-color;
  font-size: 30rpx;
  &::after {
    border: none;
  }
}
</style>
