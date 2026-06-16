<template>
  <view class="avatar-container">
    <view class="avatar-wrapper" :class="{ speaking: isSpeaking }">
      <view class="character" :class="currentExpression">
        <!-- 后发 -->
        <view class="hair-back"></view>
        <!-- 身体 -->
        <view class="body">
          <view class="arm left"></view>
          <view class="arm right"></view>
          <view class="dress">
            <view class="collar-left"></view>
            <view class="collar-right"></view>
            <view class="bow"></view>
          </view>
        </view>
        <!-- 脸 -->
        <view class="face">
          <view class="eye left" :class="{ blink: isBlinking }">
            <view class="pupil"></view>
          </view>
          <view class="eye right" :class="{ blink: isBlinking }">
            <view class="pupil"></view>
          </view>
          <view class="blush left"></view>
          <view class="blush right"></view>
          <view class="mouth-wrap">
            <view class="mouth"></view>
          </view>
        </view>
        <!-- 前发 -->
        <view class="hair-top"><view class="ahoge"></view></view>
        <view class="bangs"></view>
        <view class="hair-side left"></view>
        <view class="hair-side right"></view>
        <!-- 发饰 -->
        <view class="accessory"></view>
      </view>
      <text class="name-tag" v-if="showName">小乐</text>
    </view>
    <view class="controls" v-if="showControls">
      <view class="ctrl" v-for="e in expressions" :key="e.id"
        :class="{ on: currentExpression === e.id }" @click="setExpression(e.id)">
        <text class="c-icon">{{ e.icon }}</text>
        <text class="c-label">{{ e.name }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

withDefaults(defineProps<{ showControls?: boolean; showName?: boolean }>(), { showControls: false, showName: true })
const emit = defineEmits<{ (e: 'expressionChange', v: string): void }>()

const currentExpression = ref('neutral')
const isSpeaking = ref(false)
const isBlinking = ref(false)
const ready = ref(true)

const expressions = [
  { id: 'neutral', name: '自然', icon: '😊' },
  { id: 'happy', name: '开心', icon: '😄' },
  { id: 'surprised', name: '惊讶', icon: '😮' },
  { id: 'sad', name: '难过', icon: '😢' },
  { id: 'thinking', name: '思考', icon: '🤔' },
]

let t: any = null
onMounted(() => { t = setInterval(() => { isBlinking.value = true; setTimeout(() => isBlinking.value = false, 100) }, 3500) })
onUnmounted(() => { if (t) clearInterval(t) })

const setExpression = (e: string) => { currentExpression.value = e; emit('expressionChange', e) }
defineExpose({ setExpression, startSpeaking: () => isSpeaking.value = true, stopSpeaking: () => isSpeaking.value = false, ready })
</script>

<style lang="scss" scoped>
.avatar-container { display: flex; flex-direction: column; align-items: center; }
.avatar-wrapper {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 240rpx; height: 480rpx;
  animation: float 4s ease-in-out infinite;
  &.speaking { animation: speak 0.35s ease-in-out infinite; }
}
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10rpx)} }
@keyframes speak { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14rpx) scale(1.03)} }

.character { position: relative; width: 210rpx; height: 350rpx; }

.hair-back {
  position: absolute; top: 10rpx; left: 50%; transform: translateX(-50%);
  width: 150rpx; height: 140rpx;
  background: radial-gradient(ellipse at 50% 40%, #a78bfa 0%, #7c5cbf 60%, #5a3d9e 100%);
  border-radius: 50%;
}

.body { position: absolute; top: 150rpx; left: 50%; transform: translateX(-50%); width: 120rpx; height: 180rpx; z-index: 1; }
.dress {
  position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  width: 110rpx; height: 170rpx;
  background: linear-gradient(175deg, #f8faff 0%, #e8eef8 30%, #dce4f2 100%);
  border-radius: 35rpx 35rpx 50rpx 50rpx;
  box-shadow: 0 6rpx 16rpx rgba(100,80,160,.08);
}
.arm {
  position: absolute; top: 26rpx; width: 26rpx; height: 80rpx;
  background: linear-gradient(180deg, #f8faff 0%, #e4eaf4 100%);
  border-radius: 14rpx;
  &.left { left: -18rpx; transform: rotate(8deg); }
  &.right { right: -18rpx; transform: rotate(-8deg); }
}
.collar-left, .collar-right {
  position: absolute; top: -6rpx; width: 44rpx; height: 24rpx;
  background: #fff; border: 1.5rpx solid #d8dff0; border-radius: 6rpx 16rpx 4rpx 8rpx;
}
.collar-left { left: 10rpx; transform: rotate(-6deg); }
.collar-right { right: 10rpx; transform: rotate(6deg); border-radius: 16rpx 6rpx 8rpx 4rpx; }
.bow {
  position: absolute; top: 6rpx; left: 50%; transform: translateX(-50%);
  width: 20rpx; height: 20rpx; background: #f4728a; border-radius: 50%;
  box-shadow: 0 2rpx 6rpx rgba(244,114,138,.25);
  &::before, &::after {
    content: ''; position: absolute; top: 6rpx; width: 18rpx; height: 24rpx;
    background: #f4728a; border-radius: 50%;
  }
  &::before { left: -10rpx; transform: rotate(-20deg); }
  &::after { right: -10rpx; transform: rotate(20deg); }
}

.face {
  position: absolute; top: 38rpx; left: 50%; transform: translateX(-50%);
  width: 130rpx; height: 120rpx;
  background: linear-gradient(170deg, #fff5ea 0%, #ffe4cc 50%, #fcd5b0 100%);
  border-radius: 50%;
  z-index: 2;
  box-shadow: inset 0 6rpx 12rpx rgba(255,255,255,.35);
}

.eye {
  position: absolute; top: 52rpx; width: 34rpx; height: 36rpx;
  background: #fff; border-radius: 50%; border: 2rpx solid #3c2a6e;
  display: flex; align-items: center; justify-content: center;
  &.left { left: 22rpx; }
  &.right { right: 22rpx; }
  &.blink { animation: blink .1s ease-out; }
}
@keyframes blink { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(.04)} }
.pupil {
  width: 20rpx; height: 24rpx;
  background: radial-gradient(circle at 40% 35%, #8b6fcf 0%, #5a3d9e 60%, #2d1860 100%);
  border-radius: 50%;
  position: relative;
  &::after {
    content: ''; position: absolute; top: 5rpx; left: 6rpx;
    width: 6rpx; height: 6rpx; background: #fff; border-radius: 50%;
  }
}

.blush {
  position: absolute; top: 76rpx; width: 26rpx; height: 14rpx;
  background: rgba(255,160,160,.28); border-radius: 50%; filter: blur(3rpx);
  &.left { left: 8rpx; }
  &.right { right: 8rpx; }
}

.mouth-wrap {
  position: absolute; top: 88rpx; left: 50%; transform: translateX(-50%);
  width: 40rpx; height: 30rpx;
  display: flex; align-items: center; justify-content: center;
}
.mouth {
  width: 22rpx; height: 12rpx;
  border: 2.5rpx solid #e8788b; border-top: none;
  border-radius: 0 0 50% 50%;
  transition: .25s;
}
.character.happy .mouth {
  width: 32rpx; height: 16rpx;
  background: #ff90a0; border: none; border-radius: 50%;
}
.character.surprised .mouth {
  width: 16rpx; height: 18rpx;
  background: #e8788b; border: none; border-radius: 50%;
}
.character.sad .mouth {
  width: 22rpx; height: 12rpx;
  border: 2.5rpx solid #c06878; border-bottom: none;
  border-top: 2.5rpx solid #c06878;
  border-radius: 50% 50% 0 0;
}
.character.thinking .mouth {
  width: 14rpx; height: 14rpx;
  border: 2.5rpx solid #e8788b; background: none; border-radius: 50%;
  transform: translateX(10rpx);
}

.hair-top { position: absolute; top: 20rpx; left: 50%; transform: translateX(-50%); z-index: 3; }
.ahoge {
  position: absolute; top: -8rpx; left: 30rpx;
  width: 16rpx; height: 30rpx; background: #a78bfa;
  border-radius: 8rpx 2rpx 8rpx 2rpx; transform: rotate(-12deg);
  animation: wiggle 3s ease-in-out infinite;
}
@keyframes wiggle { 0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(-22deg)} }
.bangs {
  position: absolute; top: 26rpx; left: 50%; transform: translateX(-50%);
  width: 138rpx; height: 56rpx;
  background: linear-gradient(180deg, #a78bfa 0%, #8b6fe6 100%);
  border-radius: 0 0 50% 50%;
  z-index: 3;
}
.hair-side {
  position: absolute; top: 48rpx; width: 20rpx; height: 60rpx;
  background: linear-gradient(180deg, #8b6fe6 0%, #7c5cbf 100%);
  border-radius: 10rpx; z-index: 3;
  &.left { left: 28rpx; transform: rotate(6deg); }
  &.right { right: 28rpx; transform: rotate(-6deg); }
}

.accessory {
  position: absolute; top: 58rpx; right: 34rpx;
  width: 26rpx; height: 26rpx;
  background: linear-gradient(135deg, #ffb3c6 0%, #f4728a 100%);
  border-radius: 8rpx 50% 24rpx 50%;
  transform: rotate(20deg); z-index: 4;
  box-shadow: 0 2rpx 6rpx rgba(244,114,138,.25);
}

.name-tag {
  font-size: 26rpx; font-weight: 600; color: #fff;
  text-shadow: 0 2rpx 8rpx rgba(0,0,0,.18); margin-top: 6rpx;
}

.controls { display: flex; gap: 12rpx; margin-top: 18rpx; flex-wrap: wrap; justify-content: center; }
.ctrl {
  display: flex; flex-direction: column; align-items: center;
  padding: 10rpx 16rpx; background: #fafbfc; border-radius: 18rpx;
  border: 2rpx solid transparent; transition: .2s;
  &.on { border-color: #a78bfa; background: rgba(167,139,250,.06); box-shadow: 0 3rpx 10rpx rgba(167,139,250,.12); }
  &:active { transform: scale(.94); }
}
.c-icon { font-size: 34rpx; }
.c-label { font-size: 20rpx; color: #777; margin-top: 2rpx; }
</style>
