import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
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