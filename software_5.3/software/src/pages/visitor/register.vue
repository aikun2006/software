<template>
  <view class="auth-page">
    <view class="back-btn" @click="goBack"><image class="back-icon" src="/static/icons/back.png" mode="aspectFit" /></view>

    <view class="auth-card">
      <text class="auth-title">{{ currentLang === 'zh' ? '注册账号' : 'Register' }}</text>
      <text class="auth-sub">{{ currentLang === 'zh' ? '完善信息，获得更贴心的游览路线' : 'Complete your profile for personalized routes' }}</text>

      <view class="form-item">
        <text class="label">{{ currentLang === 'zh' ? '手机号' : 'Mobile Number' }}</text>
        <input class="input reg-phone-input" v-model="form.phone" type="number" :placeholder="currentLang === 'zh' ? '请输入手机号' : 'Enter mobile number'" maxlength="11" @confirm="onPhoneConfirm" />
      </view>

      <view class="form-item">
        <text class="label">{{ currentLang === 'zh' ? '登录密码' : 'Password' }}</text>
        <input class="input reg-password-input" v-model="form.password" type="password" :placeholder="currentLang === 'zh' ? '至少 6 位' : 'At least 6 characters'" @confirm="onPasswordConfirm" />
      </view>

      <view class="form-item">
        <text class="label">{{ currentLang === 'zh' ? '确认密码' : 'Confirm Password' }}</text>
        <input class="input reg-confirm-input" v-model="form.confirm" type="password" :placeholder="currentLang === 'zh' ? '再次输入密码' : 'Confirm password'" @confirm="onConfirmConfirm" />
      </view>

      <view class="form-item">
        <text class="label">{{ currentLang === 'zh' ? '年龄' : 'Age' }}</text>
        <input class="input reg-age-input" v-model="form.age" type="number" :placeholder="currentLang === 'zh' ? '用于安全路线推荐' : 'For safe route recommendation'" @confirm="onAgeConfirm" />
      </view>

      <view class="form-item">
        <text class="label">{{ currentLang === 'zh' ? '昵称（选填）' : 'Nickname (optional)' }}</text>
        <input class="input reg-nickname-input" v-model="form.nickname" :placeholder="currentLang === 'zh' ? '不填默认“游客+手机后4位”' : 'Visitor + last 4 digits of phone'" @confirm="onNicknameConfirm" />
      </view>

      <view class="form-item">
        <text class="label">{{ currentLang === 'zh' ? '性别（选填）' : 'Gender (optional)' }}</text>
        <view class="gender-row">
          <view class="gender-opt" :class="{ active: form.gender === 'male' }" @click="form.gender = 'male'"><text>{{ currentLang === 'zh' ? '男' : 'Male' }}</text></view>
          <view class="gender-opt" :class="{ active: form.gender === 'female' }" @click="form.gender = 'female'"><text>{{ currentLang === 'zh' ? '女' : 'Female' }}</text></view>
          <view class="gender-opt" :class="{ active: form.gender === 'other' }" @click="form.gender = 'other'"><text>{{ currentLang === 'zh' ? '不愿透露' : 'Prefer not to say' }}</text></view>
        </view>
      </view>

      <button class="submit-btn" :disabled="loading" @click="handleRegister">
        {{ loading ? (currentLang === 'zh' ? '注册中...' : 'Registering...') : (currentLang === 'zh' ? '注 册' : 'Register') }}
      </button>

      <view class="switch-link" @click="goLogin">{{ currentLang === 'zh' ? '已有账号？去登录' : 'Already have an account? Login Now' }}</view>
    </view>

    <SlideVerify v-if="slideVisible" @verified="onSlideVerified" @close="slideVisible = false" />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import SlideVerify from '@/components/SlideVerify.vue'
import { currentLang } from '@/i18n'

const userStore = useUserStore()
const form = reactive({
  phone: '',
  password: '',
  confirm: '',
  age: '',
  nickname: '',
  gender: ''
})
const loading = ref(false)
const slideVisible = ref(false)

const from = ref('profile')

onLoad((options: any) => {
  if (options?.from) from.value = options.from
})

// 注册成功后回到来源页：景点详情 / 地图 / "我的"
const goToSource = () => {
  // 从景点详情页跳来注册的，详情页仍在导航栈中，直接返回即可
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
const goLogin = () => uni.redirectTo({ url: '/pages/visitor/login?from=' + from.value })

// 表单校验通过后弹出滑动验证
const handleRegister = () => {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    uni.showToast({ title: currentLang.value === 'zh' ? '手机号格式不正确' : 'Invalid mobile number', icon: 'none' }); return
  }
  if (form.password.length < 6) {
    uni.showToast({ title: currentLang.value === 'zh' ? '密码至少 6 位' : 'Password must be at least 6 characters', icon: 'none' }); return
  }
  if (form.password !== form.confirm) {
    uni.showToast({ title: currentLang.value === 'zh' ? '两次密码不一致' : 'Passwords do not match', icon: 'none' }); return
  }
  if (form.age !== '') {
    const age = Number(form.age)
    if (isNaN(age) || age < 1 || age > 120) {
      uni.showToast({ title: currentLang.value === 'zh' ? '年龄范围不合法' : 'Invalid age range', icon: 'none' }); return
    }
  }
  slideVisible.value = true
}

// ====== 回车键顺序聚焦 + 提交 ======
const focusField = (className: string) => {
  nextTick(() => {
    setTimeout(() => {
      const el = (document.querySelector(`.${className} input`) as HTMLInputElement)
        || (document.querySelector(`.${className}`) as HTMLInputElement)
      if (el) { el.focus(); el.click() }
    }, 50)
  })
}
const onPhoneConfirm = () => focusField('reg-password-input')
const onPasswordConfirm = () => focusField('reg-confirm-input')
const onConfirmConfirm = () => focusField('reg-age-input')
const onAgeConfirm = () => focusField('reg-nickname-input')
// 昵称为最后一个字段（性别为点击选择不参与），回车触发注册
const onNicknameConfirm = () => handleRegister()

// 滑动验证通过，执行注册
const onSlideVerified = async () => {
  slideVisible.value = false
  let age: number | null = null
  if (form.age !== '') age = Number(form.age)
  loading.value = true
  try {
    await userStore.register({
      phone: form.phone,
      password: form.password,
      age,
      nickname: form.nickname || undefined,
      gender: form.gender || undefined
    })
    uni.showToast({ title: currentLang.value === 'zh' ? '注册成功，已自动登录' : 'Registration successful, logged in automatically', icon: 'success' })
    setTimeout(() => goToSource(), 800)
  } catch (e: any) {
    uni.showToast({ title: e.message || (currentLang.value === 'zh' ? '注册失败' : 'Registration failed'), icon: 'none' })
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
    width: 44rpx;
    height: 44rpx;
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
.gender-row {
  display: flex;
  gap: 20rpx;
}
.gender-opt {
  flex: 1;
  height: 72rpx;
  border: 2rpx solid $border-color;
  border-radius: $border-radius;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: $text-secondary;
  &.active {
    background: $primary-color;
    border-color: $primary-color;
    color: #fff;
  }
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
