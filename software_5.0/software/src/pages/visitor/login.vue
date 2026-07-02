<template>
  <view class="auth-page">
    <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>

    <view class="auth-card">
      <text class="auth-title">登录</text>
      <text class="auth-sub">欢迎回到灵山导览</text>

      <view class="form-item">
        <text class="label">手机号</text>
        <input class="input" v-model="form.phone" type="number" placeholder="请输入手机号" maxlength="11" />
      </view>

      <view class="form-item">
        <text class="label">密码</text>
        <input class="input" v-model="form.password" type="password" placeholder="请输入密码" />
      </view>

      <button class="submit-btn" :disabled="loading" @click="handleLogin">
        {{ loading ? '登录中...' : '登 录' }}
      </button>

      <view class="switch-link" @click="goRegister">没有账号？去注册</view>
    </view>

    <SlideVerify v-if="slideVisible" @verified="onSlideVerified" @close="slideVisible = false" />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import SlideVerify from '@/components/SlideVerify.vue'

const userStore = useUserStore()
const form = reactive({ phone: '', password: '' })
const loading = ref(false)
const slideVisible = ref(false)

const from = ref('profile')

onLoad((options: any) => {
  if (options?.from) from.value = options.from
})

// 登录成功后回到来源页：景点详情 / 地图 / "我的"
const goToSource = () => {
  // 从景点详情页跳来登录的，详情页仍在导航栈中，直接返回即可
  if (from.value.startsWith('spot:')) {
    if (getCurrentPages().length > 1) {
      uni.navigateBack()
    } else {
      uni.redirectTo({ url: '/pages/visitor/spot-detail?id=' + from.value.slice(5) })
    }
    return
  }
  uni.switchTab({ url: from.value === 'map' ? '/pages/visitor/location' : '/pages/visitor/profile' })
}

const goBack = () => uni.navigateBack()
const goRegister = () => uni.redirectTo({ url: '/pages/visitor/register?from=' + from.value })

// 表单校验通过后弹出滑动验证
const handleLogin = () => {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' }); return
  }
  if (!form.password) {
    uni.showToast({ title: '请输入密码', icon: 'none' }); return
  }
  slideVisible.value = true
}

// 滑动验证通过，执行登录
const onSlideVerified = async () => {
  slideVisible.value = false
  loading.value = true
  try {
    await userStore.login(form.phone, form.password)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => goToSource(), 800)
  } catch (e: any) {
    uni.showToast({ title: e.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.auth-page {
  min-height: 100vh;
  background: $bg-color;
  padding: calc(env(safe-area-inset-top) + 120rpx) 40rpx 60rpx;
}
.back-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 24rpx);
  left: 24rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  .back-icon {
    font-size: 48rpx;
    color: #fff;
    line-height: 44rpx;
    font-weight: 300;
  }
}
.auth-card {
  background: $bg-white;
  border-radius: $border-radius-xl;
  padding: 48rpx 36rpx 40rpx;
  box-shadow: $shadow-lg;
}
.auth-title {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  color: $text-primary;
  text-align: center;
}
.auth-sub {
  display: block;
  font-size: 24rpx;
  color: $text-secondary;
  text-align: center;
  margin-top: 8rpx;
  margin-bottom: 40rpx;
}
.form-item {
  margin-bottom: 28rpx;
}
.label {
  display: block;
  font-size: 26rpx;
  color: $text-secondary;
  margin-bottom: 12rpx;
}
.input {
  width: 100%;
  box-sizing: border-box;
  height: 84rpx;
  background: $bg-gray;
  border: 2rpx solid $border-color;
  border-radius: $border-radius;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: $text-primary;
}
.submit-btn {
  width: 100%;
  height: 88rpx;
  margin-top: 16rpx;
  border: none;
  border-radius: $border-radius-lg;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  &::after {
    border: none;
  }
}
.submit-btn[disabled] {
  opacity: 0.5;
}
.switch-link {
  text-align: center;
  margin-top: 30rpx;
  font-size: 26rpx;
  color: $primary-color;
}
</style>
