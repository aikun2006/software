<template>
  <view class="home-screen" @touchmove.stop.prevent>
    <!-- 沉浸式背景 -->
    <view class="scene-bg">
      <view class="mountain far"></view>
      <view class="mountain mid"></view>
      <view class="mountain near"></view>
      <view class="water"></view>
      <view class="mist m1"></view>
      <view class="mist m2"></view>
      <view class="stars">
        <view class="star" v-for="i in 20" :key="i" :class="'s' + i"></view>
      </view>
      <view class="firefly" v-for="i in 8" :key="'f'+i" :class="'f' + i"></view>
    </view>

    <!-- 数字人区域 -->
    <view class="avatar-area" @click="onAvatarClick">
      <view class="avatar-glow"></view>
      <SimpleAvatar2D ref="avatarRef" :show-controls="false" :show-name="false" class="enlarged-avatar" />
      <view class="click-hint" :class="{ pulse: showHint }">
        <text class="hint-text">点击开始导览</text>
        <view class="hint-arrow">
          <view class="arrow-line"></view>
        </view>
      </view>
    </view>

    <!-- 管理员入口 -->
    <view class="admin-entry" @click="goToAdmin">
      <text class="admin-icon">⚙</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import SimpleAvatar2D from '@/components/SimpleAvatar2D.vue'

const avatarRef = ref()
const showHint = ref(true)

// 语音定时播放
let audioCtx: any = null
let promptTimer: any = null
let firstPlayTimer: any = null
const PROMPT_INTERVAL = 15000 // 每15秒播放一次提示语音
let audioStarted = false

const playPromptAudio = () => {
  try {
    // #ifdef H5
    if (!audioCtx) {
      audioCtx = new Audio('/static/prompt.mp3')
    }
    audioCtx.currentTime = 0
    audioCtx.play().catch(() => {})
    // #endif

    // #ifndef H5
    const innerAudio = uni.createInnerAudioContext()
    innerAudio.src = '/static/prompt.mp3'
    innerAudio.play()
    innerAudio.onEnded(() => {
      innerAudio.destroy()
    })
    innerAudio.onError(() => {
      innerAudio.destroy()
    })
    // #endif
  } catch (e) {
    console.log('Audio play error:', e)
  }
}

const startAudioLoop = () => {
  if (audioStarted) return
  audioStarted = true
  // 首次进入3秒后播放第一次语音提示
  firstPlayTimer = setTimeout(() => {
    playPromptAudio()
  }, 3000)
  // 定时播放
  promptTimer = setInterval(() => {
    playPromptAudio()
  }, PROMPT_INTERVAL)
}

const stopAudioLoop = () => {
  audioStarted = false
  if (firstPlayTimer) {
    clearTimeout(firstPlayTimer)
    firstPlayTimer = null
  }
  if (promptTimer) {
    clearInterval(promptTimer)
    promptTimer = null
  }
  if (audioCtx) {
    audioCtx.pause()
    audioCtx = null
  }
}

const onAvatarClick = () => {
  // 点击后停止语音提示
  stopAudioLoop()
  // 跳转到导览对话页
  uni.switchTab({ url: '/pages/visitor/chat' })
}

const goToAdmin = () => {
  uni.navigateTo({ url: '/pages/admin/login' })
}

onMounted(() => {
  startAudioLoop()
  // 提示文字呼吸动画
  setInterval(() => {
    showHint.value = !showHint.value
  }, 2500)
})

// tabBar 切换：离开首页时停止语音，回到首页时恢复
onHide(() => {
  stopAudioLoop()
})

onShow(() => {
  startAudioLoop()
})

onUnmounted(() => {
  stopAudioLoop()
})
</script>

<style lang="scss" scoped>
/* 全屏禁止滚动 */
.home-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ========== 沉浸式景区背景 ========== */
.scene-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: linear-gradient(175deg, #0a0e27 0%, #1a1f4e 20%, #2d3561 40%, #3d4a7a 60%, #5b6aaf 80%, #8b9fd4 100%);
}

/* 远山 */
.mountain {
  position: absolute;
  bottom: 0;
  border-radius: 50% 50% 0 0;
}
.mountain.far {
  left: -10%;
  width: 70%;
  height: 45%;
  background: linear-gradient(180deg, rgba(45,53,97,0.7) 0%, rgba(30,38,75,0.9) 100%);
  opacity: 0.5;
}
.mountain.mid {
  right: -15%;
  width: 80%;
  height: 40%;
  background: linear-gradient(180deg, rgba(55,65,120,0.6) 0%, rgba(40,48,90,0.85) 100%);
  opacity: 0.6;
}
.mountain.near {
  left: 10%;
  width: 90%;
  height: 32%;
  background: linear-gradient(180deg, rgba(35,42,80,0.8) 0%, rgba(20,25,55,0.95) 100%);
  opacity: 0.75;
}

/* 水面 */
.water {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 15%;
  background: linear-gradient(180deg, rgba(91,106,175,0.4) 0%, rgba(60,75,140,0.6) 50%, rgba(40,50,110,0.8) 100%);
  animation: waterShimmer 6s ease-in-out infinite;
}
@keyframes waterShimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.8; }
}

/* 雾气 */
.mist {
  position: absolute;
  border-radius: 50%;
  filter: blur(60rpx);
  opacity: 0.15;
}
.mist.m1 {
  width: 120%;
  height: 200rpx;
  bottom: 30%;
  left: -10%;
  background: rgba(180, 190, 230, 0.6);
  animation: drift 20s ease-in-out infinite;
}
.mist.m2 {
  width: 100%;
  height: 160rpx;
  bottom: 20%;
  left: 0;
  background: rgba(160, 170, 220, 0.5);
  animation: drift 25s ease-in-out infinite reverse;
}
@keyframes drift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(40rpx); }
}

/* 星星 */
.stars {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
}
.star {
  position: absolute;
  width: 4rpx;
  height: 4rpx;
  background: #fff;
  border-radius: 50%;
  animation: twinkle 3s ease-in-out infinite;
}
@for $i from 1 through 20 {
  .s#{$i} {
    $x: ($i * 37) % 100;
    $y: ($i * 23) % 100;
    $d: ($i * 0.3) + 1;
    left: #{$x}%;
    top: #{$y}%;
    width: #{2 + ($i % 3) * 2}rpx;
    height: #{2 + ($i % 3) * 2}rpx;
    animation-delay: #{$d}s;
  }
}
@keyframes twinkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* 萤火虫 */
.firefly {
  position: absolute;
  width: 8rpx;
  height: 8rpx;
  background: radial-gradient(circle, rgba(255,230,140,0.9) 0%, rgba(255,200,60,0) 70%);
  border-radius: 50%;
  box-shadow: 0 0 12rpx rgba(255,230,140,0.6);
}
@for $i from 1 through 8 {
  .f#{$i} {
    $x: 10 + ($i * 11) % 80;
    $y: 40 + ($i * 9) % 40;
    left: #{$x}%;
    top: #{$y}%;
    animation: firefly#{$i} #{6 + $i * 2}s ease-in-out infinite;
  }
}
@for $i from 1 through 8 {
  @keyframes firefly#{$i} {
    0%, 100% {
      transform: translate(0, 0);
      opacity: 0.3;
    }
    25% {
      transform: translate(#{20 + $i * 5}rpx, #{-15 - $i * 3}rpx);
      opacity: 1;
    }
    50% {
      transform: translate(#{-10 - $i * 3}rpx, #{20 + $i * 4}rpx);
      opacity: 0.6;
    }
    75% {
      transform: translate(#{15 + $i * 4}rpx, #{10 + $i * 2}rpx);
      opacity: 1;
    }
  }
}

/* ========== 数字人区域 ========== */
.avatar-area {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.avatar-glow {
  position: absolute;
  width: 500rpx;
  height: 500rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(167,139,250,0.3) 0%, rgba(167,139,250,0.1) 40%, transparent 70%);
  animation: glowPulse 4s ease-in-out infinite;
  pointer-events: none;
}
@keyframes glowPulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}

/* 放大数字人 */
.enlarged-avatar {
  transform: scale(1.8);
  transform-origin: center center;
}

/* 点击提示 */
.click-hint {
  margin-top: 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.8s ease;
}
.click-hint.pulse {
  animation: hintPulse 2.5s ease-in-out infinite;
}
@keyframes hintPulse {
  0%, 100% { opacity: 0.5; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-8rpx); }
}

.hint-text {
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  letter-spacing: 4rpx;
  text-shadow: 0 2rpx 12rpx rgba(167, 139, 250, 0.5);
}

.hint-arrow {
  margin-top: 12rpx;
}
.arrow-line {
  width: 40rpx;
  height: 4rpx;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 2rpx;
  position: relative;
  animation: arrowBounce 1.5s ease-in-out infinite;
}
@keyframes arrowBounce {
  0%, 100% { transform: scaleX(0.6); opacity: 0.3; }
  50% { transform: scaleX(1); opacity: 0.8; }
}

/* ========== 管理员入口 ========== */
.admin-entry {
  position: fixed;
  top: 60rpx;
  right: 30rpx;
  z-index: 20;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  backdrop-filter: blur(10rpx);
  border: 1rpx solid rgba(255, 255, 255, 0.1);

  .admin-icon {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.3);
  }
}
</style>
