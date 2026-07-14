<template>
  <view class="auth-page">
    <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>

    <view class="auth-card">
      <text class="auth-title">{{ isZh ? '找回密码' : 'Reset Password' }}</text>
      <text class="auth-sub">{{ isZh ? '通过手机验证码重置登录密码' : 'Reset your password via SMS code' }}</text>

      <!-- 步骤指示器 -->
      <view class="steps">
        <view class="step" :class="{ active: step >= 1, done: step > 1 }">
          <text class="step-num">{{ step > 1 ? '✓' : '1' }}</text>
          <text class="step-label">{{ isZh ? '验证手机' : 'Verify' }}</text>
        </view>
        <view class="step-line" :class="{ active: step > 1 }"></view>
        <view class="step" :class="{ active: step >= 2, done: step > 2 }">
          <text class="step-num">{{ step > 2 ? '✓' : '2' }}</text>
          <text class="step-label">{{ isZh ? '设置密码' : 'Password' }}</text>
        </view>
        <view class="step-line" :class="{ active: step > 2 }"></view>
        <view class="step" :class="{ active: step >= 3 }">
          <text class="step-num">3</text>
          <text class="step-label">{{ isZh ? '完成' : 'Done' }}</text>
        </view>
      </view>

      <!-- 步骤 1：手机号 + 验证码 -->
      <view v-if="step === 1">
        <view class="form-item">
          <text class="label">{{ isZh ? '手机号' : 'Mobile Number' }}</text>
          <input class="input" v-model="form.phone" type="number" :placeholder="isZh ? '请输入注册手机号' : 'Enter registered mobile number'" maxlength="11" />
        </view>

        <view class="form-item">
          <text class="label">{{ isZh ? '验证码' : 'Verification Code' }}</text>
          <view class="code-row">
            <input class="input code-input" v-model="form.code" type="number" :placeholder="isZh ? '6 位验证码' : '6-digit code'" maxlength="6" />
            <view class="send-btn" :class="{ disabled: countdown > 0 || sendingCode }" @click="handleSendCode">
              <text class="send-btn-text">
                {{ sendingCode ? (isZh ? '发送中' : 'Sending') : (countdown > 0 ? `${countdown}s` : (isZh ? '获取验证码' : 'Send Code')) }}
              </text>
            </view>
          </view>
          <text class="hint-text" v-if="devCode">{{ isZh ? '【开发模式】验证码：' : '[Dev] Code: ' }}{{ devCode }}</text>
        </view>

        <button class="submit-btn" :disabled="verifying" @click="handleVerifyCode">
          {{ verifying ? (isZh ? '验证中...' : 'Verifying...') : (isZh ? '验 证' : 'Verify') }}
        </button>
      </view>

      <!-- 步骤 2：设置新密码 -->
      <view v-else-if="step === 2">
        <view class="form-item">
          <text class="label">{{ isZh ? '新密码' : 'New Password' }}</text>
          <input class="input" v-model="form.newPassword" type="password" :placeholder="isZh ? '至少 6 位' : 'At least 6 characters'" />
        </view>

        <view class="form-item">
          <text class="label">{{ isZh ? '确认新密码' : 'Confirm Password' }}</text>
          <input class="input" v-model="form.confirmPassword" type="password" :placeholder="isZh ? '再次输入新密码' : 'Re-enter new password'" />
        </view>

        <view class="pwd-tips">
          <text class="pwd-tip">{{ isZh ? '🔒 密码安全建议：' : '🔒 Security tips:' }}</text>
          <text class="pwd-tip-item">· {{ isZh ? '至少 6 个字符' : 'At least 6 characters' }}</text>
          <text class="pwd-tip-item">· {{ isZh ? '建议包含字母和数字' : 'Mix letters and numbers' }}</text>
          <text class="pwd-tip-item">· {{ isZh ? '避免使用常见密码' : 'Avoid common passwords' }}</text>
        </view>

        <button class="submit-btn" :disabled="resetting" @click="handleResetPassword">
          {{ resetting ? (isZh ? '重置中...' : 'Resetting...') : (isZh ? '重置密码' : 'Reset Password') }}
        </button>
        <view class="switch-link" @click="backToStep1">{{ isZh ? '返回上一步' : 'Back' }}</view>
      </view>

      <!-- 步骤 3：成功 -->
      <view v-else class="success-view">
        <text class="success-icon">✓</text>
        <text class="success-title">{{ isZh ? '密码重置成功' : 'Password Reset Successful' }}</text>
        <text class="success-desc">{{ isZh ? '请使用新密码登录' : 'Please log in with your new password' }}</text>
        <button class="submit-btn" @click="goLogin">{{ isZh ? '去登录' : 'Log In Now' }}</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue'
import { userApi } from '@/api/user'
import { currentLang } from '@/i18n'

const isZh = computed(() => currentLang.value === 'zh')

const step = ref(1)  // 1=验证手机 2=设置密码 3=完成
const form = reactive({
  phone: '',
  code: '',
  newPassword: '',
  confirmPassword: ''
})

const countdown = ref(0)
const sendingCode = ref(false)
const verifying = ref(false)
const resetting = ref(false)
const devCode = ref('')  // 开发环境返回的验证码
let timer: ReturnType<typeof setInterval> | null = null

const startCountdown = () => {
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (timer) { clearInterval(timer); timer = null }
    }
  }, 1000)
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// 发送验证码
const handleSendCode = async () => {
  if (countdown.value > 0 || sendingCode.value) return
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    uni.showToast({ title: isZh.value ? '手机号格式不正确' : 'Invalid mobile number', icon: 'none' })
    return
  }
  sendingCode.value = true
  try {
    const res = await userApi.sendResetCode({ phone: form.phone })
    devCode.value = res.code || ''
    startCountdown()
    if (res.code) {
      // 开发环境：验证码直接返回，提示用户
      uni.showModal({
        title: isZh.value ? '验证码已发送' : 'Code Sent',
        content: isZh.value
          ? `开发环境验证码：${res.code}\n（生产环境将通过短信发送）`
          : `Dev code: ${res.code}\n(In production, it will be sent via SMS)`,
        showCancel: false
      })
    } else {
      uni.showToast({ title: isZh.value ? '验证码已发送，请注意查收' : 'Code sent, please check your phone', icon: 'success' })
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || (isZh.value ? '发送失败' : 'Failed to send'), icon: 'none' })
  } finally {
    sendingCode.value = false
  }
}

// 验证验证码（前端只做格式校验，真正的校验在重置密码接口里完成）
// 这里点击"验证"只是进入下一步，让用户设置新密码
const handleVerifyCode = () => {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    uni.showToast({ title: isZh.value ? '手机号格式不正确' : 'Invalid mobile number', icon: 'none' })
    return
  }
  if (!/^\d{6}$/.test(form.code)) {
    uni.showToast({ title: isZh.value ? '请输入 6 位验证码' : 'Enter 6-digit code', icon: 'none' })
    return
  }
  verifying.value = true
  // 简单延时，避免按钮闪烁；真正校验在重置时由后端完成
  setTimeout(() => {
    verifying.value = false
    step.value = 2
  }, 300)
}

// 重置密码
const handleResetPassword = async () => {
  if (form.newPassword.length < 6) {
    uni.showToast({ title: isZh.value ? '密码至少 6 位' : 'Password must be at least 6 characters', icon: 'none' })
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    uni.showToast({ title: isZh.value ? '两次密码不一致' : 'Passwords do not match', icon: 'none' })
    return
  }
  resetting.value = true
  try {
    await userApi.resetPassword({
      phone: form.phone,
      code: form.code,
      new_password: form.newPassword
    })
    step.value = 3
    uni.showToast({ title: isZh.value ? '重置成功' : 'Success', icon: 'success' })
  } catch (e: any) {
    const msg = e.message || ''
    // 验证码相关问题回到步骤 1
    if (msg.includes('验证码') || msg.includes('code') || msg.includes('Code') || msg.includes('过期') || msg.includes('expire')) {
      uni.showToast({ title: msg, icon: 'none', duration: 2500 })
      step.value = 1
      devCode.value = ''
      form.code = ''
    } else {
      uni.showToast({ title: msg || (isZh.value ? '重置失败' : 'Failed'), icon: 'none' })
    }
  } finally {
    resetting.value = false
  }
}

const backToStep1 = () => { step.value = 1 }
const goBack = () => uni.navigateBack()
const goLogin = () => uni.redirectTo({ url: '/pages/visitor/login?from=profile' })
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

/* 步骤指示器 */
.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 48rpx;
  padding: 0 20rpx;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.step-num {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $bg-gray;
  color: $text-secondary;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid $border-color;
  transition: all 0.3s;
}
.step-label {
  font-size: 22rpx;
  color: $text-secondary;
}
.step.active .step-num {
  background: $primary-color;
  color: #fff;
  border-color: $primary-color;
}
.step.active .step-label {
  color: $primary-color;
  font-weight: 600;
}
.step.done .step-num {
  background: #4caf50;
  color: #fff;
  border-color: #4caf50;
}
.step-line {
  flex: 1;
  height: 4rpx;
  background: $border-color;
  margin: 0 16rpx;
  margin-bottom: 30rpx;
  transition: background 0.3s;
  &.active {
    background: $primary-color;
  }
}

/* 表单 */
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

/* 验证码输入行 */
.code-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}
.code-input {
  flex: 1;
}
.send-btn {
  flex-shrink: 0;
  height: 84rpx;
  padding: 0 24rpx;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  border-radius: $border-radius;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 180rpx;
  &.disabled {
    opacity: 0.5;
    background: $bg-gray;
    color: $text-secondary;
  }
}
.send-btn-text {
  color: #fff;
  font-size: 24rpx;
  white-space: nowrap;
}
.send-btn.disabled .send-btn-text {
  color: $text-secondary;
}
.hint-text {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #e67e22;
}

/* 密码提示 */
.pwd-tips {
  background: $bg-gray;
  border-radius: $border-radius;
  padding: 20rpx 24rpx;
  margin-bottom: 28rpx;
}
.pwd-tip {
  display: block;
  font-size: 24rpx;
  color: $text-primary;
  font-weight: 600;
  margin-bottom: 8rpx;
}
.pwd-tip-item {
  display: block;
  font-size: 22rpx;
  color: $text-secondary;
  line-height: 1.6;
}

/* 按钮 */
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

/* 成功页 */
.success-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 0;
}
.success-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #4caf50;
  color: #fff;
  font-size: 72rpx;
  line-height: 120rpx;
  text-align: center;
  margin-bottom: 32rpx;
}
.success-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: 12rpx;
}
.success-desc {
  font-size: 26rpx;
  color: $text-secondary;
  margin-bottom: 48rpx;
}

/* 大字版适配：放大表单文字与按钮，保持布局稳定 */
:global(body.large-font-mode) {
  .auth-title { font-size: 56rpx; }
  .auth-sub { font-size: 30rpx; }
  .label { font-size: 32rpx; }
  .input { font-size: 34rpx; height: 96rpx; }
  .send-btn { height: 96rpx; min-width: 200rpx; }
  .send-btn-text { font-size: 28rpx; }
  .submit-btn { font-size: 38rpx; height: 100rpx; }
  .step-num { width: 64rpx; height: 64rpx; font-size: 32rpx; }
  .step-label { font-size: 26rpx; }
  .pwd-tip { font-size: 28rpx; }
  .pwd-tip-item { font-size: 26rpx; }
  .success-title { font-size: 44rpx; }
  .success-desc { font-size: 30rpx; }
  .switch-link { font-size: 30rpx; }
  .hint-text { font-size: 26rpx; }
}
</style>
