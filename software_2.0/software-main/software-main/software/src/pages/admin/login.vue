<template>
  <view class="login-container">
    <view class="login-header">
      <view class="logo">
        <text class="logo-icon">🤖</text>
      </view>
      <text class="title">AI导览管理后台</text>
      <text class="subtitle">智能景区导览系统管理中心</text>
    </view>

    <view class="login-form">
      <view class="form-item">
        <view class="form-label">用户名</view>
        <input 
          class="form-input" 
          v-model="username"
          placeholder="请输入用户名"
          type="text"
        />
      </view>

      <view class="form-item">
        <view class="form-label">密码</view>
        <input 
          class="form-input" 
          v-model="password"
          placeholder="请输入密码"
          type="password"
        />
      </view>

      <view class="form-item">
        <view class="checkbox" @click="rememberMe = !rememberMe">
          <view class="checkbox-box" :class="{ checked: rememberMe }">
            <text v-if="rememberMe">✓</text>
          </view>
          <text>记住我</text>
        </view>
      </view>

      <button class="btn btn-primary btn-lg btn-block mt-lg" :disabled="isLoading" @click="handleLogin">
        <text>{{ isLoading ? '登录中...' : '登 录' }}</text>
      </button>

      <view class="tips">
        <text>默认账号：admin / 密码：admin123</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const isLoading = ref(false)

const handleLogin = async () => {
  if (!username.value.trim() || !password.value.trim()) {
    uni.showToast({ title: '请输入用户名和密码', icon: 'none' })
    return
  }

  isLoading.value = true
  
  setTimeout(() => {
    if (username.value === 'admin' && password.value === 'admin123') {
      uni.setStorageSync('token', 'mock-token')
      userStore.isLoggedIn = true
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        uni.navigateTo({ url: '/pages/admin/index' })
      }, 1000)
    } else {
      uni.showToast({ title: '用户名或密码错误', icon: 'none' })
    }
    isLoading.value = false
  }, 500)
}
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $primary-color 0%, $primary-dark 100%);
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-header {
  text-align: center;
  margin-bottom: $spacing-xl;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto $spacing-lg;
}

.logo-icon {
  font-size: 80rpx;
}

.title {
  display: block;
  font-size: $font-size-title;
  font-weight: 700;
  color: #fff;
  margin-bottom: $spacing-sm;
}

.subtitle {
  font-size: $font-size-base;
  color: rgba(255, 255, 255, 0.8);
}

.login-form {
  background: #fff;
  border-radius: $border-radius-xl;
  padding: $spacing-xl;
  box-shadow: $shadow-lg;
}

.form-item {
  margin-bottom: $spacing-lg;
}

.form-label {
  font-size: $font-size-base;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: $spacing-sm;
  display: block;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  padding: 0 $spacing-base;
  font-size: $font-size-base;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  
  text {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

.checkbox-box {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid $border-color;
  border-radius: $border-radius;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: $font-size-xs;
    color: #fff;
  }
  
  &.checked {
    background: $primary-color;
    border-color: $primary-color;
  }
}

.tips {
  text-align: center;
  margin-top: $spacing-lg;
  
  text {
    font-size: $font-size-xs;
    color: $text-light;
  }
}
</style>
