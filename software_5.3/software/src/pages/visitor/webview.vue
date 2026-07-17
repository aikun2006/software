<template>
  <view class="webview-page">
    <!-- 全屏 iframe，无滚动条 -->
    <iframe class="webview-frame" :src="targetUrl" frameborder="0" allowfullscreen></iframe>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const targetUrl = ref('')

onLoad((options) => {
  if (options && options.url) {
    targetUrl.value = decodeURIComponent(options.url)
  }
})
</script>

<style lang="scss" scoped>
.webview-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;          // 全屏无右侧滚动条
  background: #fff;
}

.webview-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
