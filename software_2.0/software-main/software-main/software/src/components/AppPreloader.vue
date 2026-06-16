<template>
  <view class="preloader" v-if="isPreloading">
    <text class="preload-text">{{ status }}</text>
    <view class="preload-progress">
      <view class="progress-bar" :style="{ width: progress + '%' }"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { preloader } from '@/utils/resourcePreloader'

const isPreloading = ref(false)
const progress = ref(0)
const status = ref('准备中...')

onMounted(async () => {
  const modelUrl = '/static/avatars/guide_avatar.vrm'
  
  isPreloading.value = true
  status.value = '预加载3D资源...'
  progress.value = 10
  
  await preloader.waitForThree()
  progress.value = 30
  
  status.value = '预加载模型...'
  
  await preloader.preloadVRM(modelUrl, (p) => {
    progress.value = 30 + (p * 0.7)
  })
  
  progress.value = 100
  status.value = '加载完成'
  
  setTimeout(() => {
    isPreloading.value = false
  }, 500)
})

defineExpose({
  getProgress: () => progress.value,
  isComplete: () => progress.value >= 100
})
</script>

<style lang="scss" scoped>
.preloader {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  z-index: 9999;
}

.preload-text {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 20rpx;
}

.preload-progress {
  width: 400rpx;
  height: 8rpx;
  background: #e8e8e8;
  border-radius: 4rpx;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(135deg, #9370db 0%, #8a5cf6 100%);
  transition: width 0.3s ease;
}
</style>
