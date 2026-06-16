// Three.js / VRM CDN 引导 —— 必须在所有组件之前加载
import { bootstrapThree } from './utils/threeBootstrap'
bootstrapThree()

import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  return { app }
}
