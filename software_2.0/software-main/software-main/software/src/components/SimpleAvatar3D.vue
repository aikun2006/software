<template>
  <view class="simple-avatar-container">
    <view class="avatar-wrapper" :class="{ speaking: isSpeaking, idle: !isSpeaking }">
      <view ref="containerRef" class="avatar-canvas-host"></view>
      <view class="loading-overlay" v-if="!ready">
        <text class="loading-text">{{ statusText }}</text>
      </view>
    </view>
    <view class="avatar-controls" v-if="showControls && ready">
      <view class="control-btn" v-for="expr in expressions" :key="expr.id"
        :class="{ active: currentExpression === expr.id }" @click="setExpression(expr.id)">
        <text class="btn-icon">{{ expr.icon }}</text>
        <text class="btn-label">{{ expr.name }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as THREE from 'three'

const props = withDefaults(defineProps<{ showControls?: boolean }>(), { showControls: false })
const emit = defineEmits<{ (e: 'expressionChange', expression: string): void }>()

const containerRef = ref<HTMLElement | null>(null)
const ready = ref(false)
const statusText = ref('初始化中...')
const isSpeaking = ref(false)
const currentExpression = ref('neutral')

const expressions = [
  { id: 'neutral', name: '自然', icon: '😊' },
  { id: 'happy', name: '开心', icon: '😄' },
]

let renderer: any = null
let scene: any = null
let camera: any = null
let cube: any = null
let animationId: number | null = null
let initStarted = false

function awaitForceCleanup(): Promise<void> {
  return new Promise(resolve => {
    // 给浏览器一点时间释放 WebGL 上下文
    setTimeout(resolve, 100)
  })
}

async function initScene() {
  if (initStarted) return
  initStarted = true
  try {
    // 彻底清理：先干掉旧 renderer 和 canvas
    if (renderer) {
      renderer.forceContextLoss()
      renderer.dispose()
      renderer = null
    }
    if (scene) { scene.clear(); scene = null }
    camera = null; cube = null
    if (animationId) { cancelAnimationFrame(animationId); animationId = null }

    // UniApp 中 ref 拿到的不是原生 DOM，需要通过 $el 访问
    const vueInstance = containerRef.value as any
    const el = vueInstance?.$el || document.querySelector('.avatar-canvas-host')
    if (!el || typeof el.appendChild !== 'function') { 
      statusText.value = 'DOM容器访问失败'
      return 
    }
    // 删除所有旧 canvas
    el.querySelectorAll('canvas').forEach((c: HTMLCanvasElement) => c.remove())
    // 确保 WebGL 上下文已释放
    await awaitForceCleanup()

    statusText.value = '创建画布...'
    const canvas = document.createElement('canvas')
    canvas.width = 360
    canvas.height = 960
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    el.appendChild(canvas)

    statusText.value = '检测WebGL...'
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) { statusText.value = 'WebGL不可用'; return }

    statusText.value = '初始化渲染器...'
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true })
    renderer.setSize(180, 480, false)
    renderer.setPixelRatio(2)

    statusText.value = '创建场景...'
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(45, 180 / 480, 0.1, 10)
    camera.position.z = 3

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(1, 1, 2)
    scene.add(light)

    statusText.value = '创建立方体...'
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: 0x4080ff })
    cube = new THREE.Mesh(geo, mat)
    scene.add(cube)

    statusText.value = ''
    ready.value = true
    animate()
  } catch (e: any) {
    statusText.value = '错误: ' + (e.message || String(e))
    console.error('[SimpleAvatar]', e)
  }
}

function animate() {
  animationId = requestAnimationFrame(animate)
  if (!renderer || !scene || !camera) return
  if (cube) {
    cube.rotation.x += 0.01
    cube.rotation.y += 0.02
  }
  renderer.render(scene, camera)
}

const setExpression = (expr: string) => { currentExpression.value = expr; emit('expressionChange', expr) }
const startSpeaking = () => { isSpeaking.value = true }
const stopSpeaking = () => { isSpeaking.value = false }

onMounted(() => {
  setTimeout(() => initScene(), 300)
})

onUnmounted(() => {
  initStarted = false
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) { renderer.dispose(); renderer = null }
  if (scene) { scene.clear(); scene = null }
  cube = null; camera = null
  const el = (containerRef.value as any)?.$el || document.querySelector('.avatar-canvas-host')
  if (el) {
    const c = el.querySelector('canvas')
    if (c) c.remove()
  }
})

defineExpose({ setExpression, startSpeaking, stopSpeaking, ready })
</script>

<style lang="scss" scoped>
.simple-avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.avatar-wrapper {
  position: relative;
  width: 200rpx;
  height: 500rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  &.speaking { animation: speakBounce 0.4s ease-in-out infinite; }
  &.idle { animation: idleSway 4s ease-in-out infinite; }
}

@keyframes speakBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6rpx); } }
@keyframes idleSway { 0%, 100% { transform: rotate(-1deg); } 50% { transform: rotate(1deg); } }

.avatar-canvas-host {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16rpx;
  pointer-events: none;
}

.loading-text { font-size: 22rpx; color: #999; text-align: center; padding: 10rpx; }

.avatar-controls { display: flex; gap: 12rpx; margin-top: 16rpx; flex-wrap: wrap; justify-content: center; }
.control-btn {
  display: flex; flex-direction: column; align-items: center;
  padding: 12rpx 16rpx; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  border-radius: 20rpx; border: 2rpx solid transparent;
  &.active { border-color: #9370db; background: rgba(147,112,219,0.1); }
  &:active { transform: scale(0.95); }
}
.btn-icon { font-size: 36rpx; }
.btn-label { font-size: 20rpx; color: #555; margin-top: 4rpx; }
</style>
