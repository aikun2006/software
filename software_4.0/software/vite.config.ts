import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  // uni() 的 options 会合并进条件编译预处理器(uni:pre)的 include/exclude 过滤器。
  // 默认 COMMON_EXCLUDE 已失效，导致 node_modules 下的第三方库也会被预处理扫描。
  // three-vrm.module.js 内嵌 WebGL shader 源码(含 "#endif" 字样)，会被误判为
  // 条件编译指令，触发预处理器正则崩溃。这里显式排除 node_modules 修复该问题。
  plugins: [
    uni({
      exclude: [/node_modules\/(@pixiv|three)/]
    })
  ],
  server: {
    proxy: {
      '/api/tts': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/api/chat': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/api/chat-vision': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  },
  resolve: {
    alias: {
      'three/examples/jsm': 'three/examples/jsm'
    }
  }
})