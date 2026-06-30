<template>
  <view class="nav-page">
    <!-- 地图区 -->
    <view class="nav-map-wrap">
      <image
        ref="mapImgRef"
        class="nav-map"
        src="/static/lingshan-map.jpg"
        mode="widthFix"
        @load="onMapLoad"
      />
      <!-- SVG 路线叠加 -->
      <svg v-if="routeData" class="nav-svg" :viewBox="svgViewBox" preserveAspectRatio="none">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <!-- 发光带 -->
        <polyline :points="svgPoints" fill="none" stroke="#4da6ff" stroke-width="16"
          stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.12" />
        <!-- 主线路 -->
        <polyline :points="svgPoints" fill="none" stroke="url(#routeGrad)" stroke-width="7"
          stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)" />
        <linearGradient id="routeGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#4caf50" />
          <stop offset="40%" stop-color="#4080ff" />
          <stop offset="100%" stop-color="#e94560" />
        </linearGradient>
        <!-- 起点标记 -->
        <circle v-if="startPoint" :cx="startPoint.x" :cy="startPoint.y" r="20"
          fill="#4caf50" stroke="#fff" stroke-width="4" filter="url(#glow)" />
        <text v-if="startPoint" :x="startPoint.x-30" :y="startPoint.y" fill="#fff"
          font-size="13" text-anchor="end" font-weight="bold" dominant-baseline="middle">起</text>
        <!-- 终点标记 -->
        <circle v-if="endPoint" :cx="endPoint.x" :cy="endPoint.y" r="20"
          fill="#e94560" stroke="#fff" stroke-width="4" filter="url(#glow)" />
        <!-- 终点脉冲圈 -->
        <circle v-if="endPoint" :cx="endPoint.x" :cy="endPoint.y" r="32"
          fill="none" stroke="#e94560" stroke-width="2" stroke-opacity="0.4">
          <animate attributeName="r" from="20" to="40" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <text v-if="endPoint" :x="endPoint.x+30" :y="endPoint.y" fill="#fff"
          font-size="13" text-anchor="start" font-weight="bold" dominant-baseline="middle">{{ destName }}</text>
        <!-- 实时位置标记（GPS定位中才显示） -->
        <circle v-if="myPos" :cx="myPos.x" :cy="myPos.y" r="18"
          fill="#00d4ff" stroke="#fff" stroke-width="3" opacity="0.85" filter="url(#glow)">
          <animate attributeName="r" from="14" to="22" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.9" to="0.5" dur="1s" repeatCount="indefinite" />
        </circle>
      </svg>
    </view>

    <!-- 顶部导航栏：毛玻璃 -->
    <view class="nav-topbar">
      <view class="topbar-back" @click="goBack">
        <text class="back-arrow-img">‹</text>
      </view>
      <text class="topbar-title">{{ destName || '目的地' }}</text>
      <view class="topbar-gps" @click="toggleGps">
        <text class="gps-icon">{{ gpsActive ? '📍' : '⊙' }}</text>
      </view>
    </view>

    <!-- 路线摘要卡片 -->
    <view class="summary-card" v-if="routeData">
      <view class="sum-item">
        <text class="sum-num">{{ gpsActive ? navProgress.distanceRemaining + 'm' : distText }}</text>
        <text class="sum-label">{{ gpsActive ? '剩余' : '距离' }}</text>
      </view>
      <view class="sum-item">
        <text class="sum-num">{{ gpsActive ? navProgress.etaMinutes + 'min' : timeText }}</text>
        <text class="sum-label">{{ gpsActive ? '预计' : '步行' }}</text>
      </view>
      <view class="sum-item" @click="showSteps = !showSteps">
        <text class="sum-num">{{ gpsActive ? navProgress.progressPercent + '%' : segmentCount }}</text>
        <text class="sum-label">{{ gpsActive ? '进度' : ('路段 ' + (showSteps ? '▲' : '▼')) }}</text>
      </view>
    </view>

    <!-- GPS模拟面板 -->
    <view class="gps-panel" v-if="gpsActive && routeData">
      <text class="gps-hint" v-if="!realGps">模拟导航中（点击地图切换真实GPS）</text>
      <text class="gps-hint real" v-else>📍 真实GPS定位中</text>
    </view>

    <!-- 路线步骤面板（可折叠） -->
    <view class="steps-sheet" :class="{ open: showSteps }" v-if="routeData">
      <view class="sheet-handle" @click="showSteps = !showSteps">
        <view class="handle-bar"></view>
      </view>
      <scroll-view scroll-y class="sheet-body">
        <view class="step-card" v-for="(s, i) in steps" :key="i">
          <view class="card-icon" :class="iconClass(i)">
            <text v-if="i === 0">▶</text>
            <text v-else-if="i === steps.length - 1">📍</text>
            <text v-else-if="s.isTurn">{{ turnIcon(s.action) }}</text>
            <text v-else>→</text>
          </view>
          <view class="card-body">
            <text class="card-action">{{ s.action }}</text>
            <text class="card-dist">{{ s.dist }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  getMapSize, findNodeByName, getSpotNodes, getAllNodes, getNodeById, type RoadNode,
} from '@/engine/roadNetwork'
import {
  findRoute, findMultiStopRoute, pathToSVGPoints, pathToPixelPoints,
  type RouteStep, type PixelPoint, type MultiStopRoute,
} from '@/engine/pathfinder'
import { gpsToPixel, type GpsCoord, type PixelCoord } from '@/engine/gpsTransform'
import { navEngine, type NavProgress } from '@/engine/navigationEngine'

const destName = ref('')
const svgPoints = ref('')
const svgViewBox = ref('0 0 1677 1920')
const routeData = ref<RouteStep | null>(null)
const routeError = ref('')
const startPoint = ref<PixelPoint | null>(null)
const endPoint = ref<PixelPoint | null>(null)
const waypoints = ref<PixelPoint[]>([])
const showSteps = ref(false)

// GPS / 位置追踪
const gpsActive = ref(false)
const realGps = ref(false)
const myPos = ref<PixelCoord | null>(null)
const navProgress = ref<NavProgress>({
  state: 'IDLE',
  currentNodeId: '',
  currentSegmentIndex: 0,
  distanceTraveled: 0,
  distanceRemaining: 0,
  totalDistance: 0,
  etaMinutes: 0,
  progressPercent: 0,
})

let simInterval: ReturnType<typeof setInterval> | null = null
let realWatchId: number | null = null
let simStep = 0

// ---- 计算属性 ----
const distText = computed(() => {
  const d = routeData.value?.totalDistance || 0
  return d < 1000 ? `${d}m` : `${(d / 1000).toFixed(1)}km`
})
const timeText = computed(() => {
  const m = routeData.value?.estimatedMinutes || 0
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${m % 60}m`
})
const segmentCount = computed(() => routeData.value?.segments.length || 0)

interface StepItem { action: string; place: string; dist: string; isTurn: boolean }
const steps = computed<StepItem[]>(() => {
  if (!routeData.value) return []
  return routeData.value.segments.map((seg, i) => {
    const distStr = seg.distance + 'm'
    const isTurn = seg.turnDirection && seg.turnDirection !== 'straight'
    return {
      action: seg.turnInstruction || (i === 0 ? `从${seg.fromName}出发` : `前往${seg.toName}`),
      place: seg.toName,
      dist: distStr,
      isTurn: !!isTurn,
    }
  })
})

function iconClass(i: number) {
  if (i === 0) return 'icon-start'
  if (i === steps.value.length - 1) return 'icon-end'
  return steps.value[i]?.isTurn ? 'icon-turn' : 'icon-go'
}
function turnIcon(action: string) {
  if (action.includes('左')) return '↰'
  if (action.includes('右')) return '↱'
  return '↑'
}

// ---- 事件 ----
function onMapLoad() {
  const { width, height } = getMapSize()
  svgViewBox.value = `0 0 ${width} ${height}`
}
function goBack() { uni.navigateBack() }

// ---- URL 参数解析 ----
function parseHashParams() {
  const hash = window.location.hash
  if (!hash?.includes('?')) return null
  const p = new URLSearchParams(hash.split('?')[1])
  return { name: p.get('name') || '目的地', dest: p.get('dest') || '', waypoints: p.get('waypoints') || undefined }
}

// ---- 路线计算 ----
function computeRoute(name: string, destSpotId: string, waypointIds?: string) {
  destName.value = decodeURIComponent(name)
  routeError.value = ''

  let toNodeId: string | null = null
  const spotNodes = getSpotNodes(destSpotId)
  if (spotNodes.length > 0) toNodeId = spotNodes[0]
  else {
    const direct = getNodeById(destSpotId)
    if (direct) toNodeId = direct.id
    else {
      const found = getAllNodes().find(n => n.name.includes(destSpotId))
      if (found) toNodeId = found.id
    }
  }
  if (!toNodeId) { routeError.value = `未找到"${name}"`; return }

  // 起点：检票口
  const gateNode = findNodeByName('检票口')
  if (!gateNode) { routeError.value = '缺少检票口节点'; return }

  let result: RouteStep | null
  let pathIds: string[]

  if (waypointIds) {
    console.log('[nav] waypoints raw:', waypointIds)
    const spotList = waypointIds.split(',').map(s => s.trim()).filter(Boolean)
    console.log('[nav] spotList:', spotList)
    // 去掉第一个(起点)和最后一个(终点)，中间是途经点
    const viaSpots = spotList.length > 2 ? spotList.slice(1, -1) : []
    console.log('[nav] viaSpots:', viaSpots, 'dest:', destSpotId)
    
    // 将spotID转为nodeID
    const viaNodeIds: string[] = []
    for (const sid of viaSpots) {
      const nodes = getSpotNodes(sid)
      console.log('[nav] spot', sid, '→ nodes:', nodes)
      if (nodes.length > 0) viaNodeIds.push(nodes[0])
    }
    
    const allNodeIds = [gateNode.id, ...viaNodeIds, toNodeId]
    console.log('[nav] allNodeIds:', allNodeIds)
    const mr = findMultiStopRoute(allNodeIds)
    if (!mr) { routeError.value = '路线不可达'; console.error('[nav] findMultiStopRoute failed'); return }
    
    console.log('[nav] 多停靠路线:', mr.path.length, 'nodes,', mr.totalDistance, 'm')
    routeData.value = {
      nodeIds: mr.path,
      totalDistance: mr.totalDistance,
      estimatedMinutes: mr.totalMinutes,
      segments: mr.legs.reduce((arr: any[], l: any) => arr.concat(l.segments), []),
    }
    pathIds = mr.path
  } else {
    result = findRoute(gateNode.id, toNodeId)
    if (!result) { routeError.value = '路线不可达'; return }
    pathIds = result.nodeIds
    routeData.value = result
  }

  svgPoints.value = pathToSVGPoints(pathIds)
  const pts = pathToPixelPoints(pathIds)
  startPoint.value = pts[0] || null
  endPoint.value = pts[pts.length - 1] || null
  waypoints.value = pts.slice(1, -1)
  showSteps.value = true
}

// ---- GPS / 定位模拟 ----

function toggleGps() {
  if (gpsActive.value) { stopGps(); return }
  if (!routeData.value) return
  
  // 优先尝试真实GPS
  if (navigator.geolocation) {
    startRealGps()
  } else {
    startGps() // fallback to simulation
  }
}

function startRealGps() {
  if (!routeData.value) return
  gpsActive.value = true
  realGps.value = true
  navEngine.startRoute(routeData.value)
  navEngine.setCallbacks({
    onProgress: (p) => { navProgress.value = p },
    onArrive: () => { stopGps() },
    onOffRoute: () => { console.log('[nav] 偏航') },
  })

  realWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const gps: GpsCoord = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }
      const px = gpsToPixel(gps)
      if (px) {
        myPos.value = px
        navEngine.updatePosition(px)
      }
    },
    (err) => {
      console.log('[nav] GPS错误:', err.message, '→ 切换到模拟')
      stopRealGps()
      startGps()
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  )
}

function stopRealGps() {
  if (realWatchId !== null) {
    navigator.geolocation.clearWatch(realWatchId)
    realWatchId = null
  }
  realGps.value = false
}

function startGps() {
  if (!routeData.value) return
  gpsActive.value = true
  navEngine.startRoute(routeData.value)
  navEngine.setCallbacks({
    onProgress: (p) => { navProgress.value = p },
    onArrive: () => { stopGps() },
    onOffRoute: () => { console.log('[nav] 偏航') },
  })
  simStep = 0
  startSimulation()
}

function stopGps() {
  gpsActive.value = false
  realGps.value = false
  myPos.value = null
  navEngine.stop()
  if (simInterval) { clearInterval(simInterval); simInterval = null }
  if (realWatchId !== null) { navigator.geolocation.clearWatch(realWatchId); realWatchId = null }
}

function startSimulation() {
  if (!routeData.value) return
  const pts = pathToPixelPoints(routeData.value.nodeIds)
  myPos.value = pts[0]
  simStep = 0
  simInterval = setInterval(() => {
    if (simStep >= pts.length - 1) { stopGps(); return }
    simStep++
    const pt = pts[simStep]
    myPos.value = pt
    navEngine.updatePosition(pt)
  }, 600)
}

// ---- 启动 ----
onMounted(() => {
  const params = parseHashParams()
  if (params) {
    setTimeout(() => computeRoute(params.name, params.dest, params.waypoints), 500)
  } else {
    try {
      const u = new URL(window.location.href)
      setTimeout(() => computeRoute(
        u.searchParams.get('name') || '灵山大佛',
        u.searchParams.get('dest') || 'n41'
      ), 500)
    } catch { routeError.value = '无法获取导航参数' }
  }
})

onUnmounted(() => { if (simInterval) clearInterval(simInterval) })
</script>

<style lang="scss" scoped>
@import "@/styles/variables.scss";

.nav-page {
  width: 100%; min-height: 100vh; position: relative;
  overflow-y: auto; overflow-x: hidden;
  background: #f7f2e3;
  font-family: $font-body;
}

// ====== 地图 ======
.nav-map-wrap { width: 100%; position: relative; }
.nav-map { width: 100%; height: auto; display: block; }
.nav-svg {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%; pointer-events: none; z-index: 2;
}

// ====== 顶部栏：毛玻璃 ======
.nav-topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  display: flex; align-items: center;
  padding: calc(env(safe-area-inset-top) + 12rpx) 20rpx 14rpx;
  background: rgba(247, 242, 227, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(0,0,0,.06);
}
.topbar-back {
  width: 60rpx; height: 60rpx; border-radius: 50%;
  background: rgba(0,0,0,.06);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: transform 0.25s ease, filter 0.25s ease, background 0.25s ease;
  &:active { background: rgba(0,0,0,.1); }
  &:hover {
    transform: scale(1.18);
    filter: brightness(1.25) saturate(1.3);
  }
}
.back-arrow-img { font-size: 40rpx; color: #333; line-height: 40rpx; font-weight: 300; }
.topbar-title {
  flex: 1; text-align: center; font-size: 32rpx; font-weight: 600;
  color: #333; letter-spacing: 2rpx;
}
.topbar-spacer { width: 60rpx; }

// ====== 路线摘要卡片 ======
.summary-card {
  position: fixed; top: calc(env(safe-area-inset-top) + 90rpx);
  left: 24rpx; right: 24rpx; z-index: 40;
  display: flex; background: rgba(255, 255, 250, 0.92);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-radius: 20rpx; padding: 20rpx 12rpx;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,.08);
}
.sum-item {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  gap: 4rpx;
  &:nth-child(3) { cursor: pointer; }
}
.sum-num {
  font-size: 36rpx; font-weight: 700; color: #c4a45a;
  letter-spacing: 1rpx;
}
.sum-label {
  font-size: 20rpx; color: #888; text-transform: uppercase;
  letter-spacing: 1rpx;
}

// ====== 步骤面板 ======
.steps-sheet {
  position: fixed; left: 16rpx; right: 16rpx; bottom: 0; z-index: 45;
  background: rgba(255, 255, 250, 0.96);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-radius: 28rpx 28rpx 0 0;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 -8rpx 40rpx rgba(0,0,0,.08);
  transform: translateY(calc(100% - 48rpx));
  transition: transform 0.35s cubic-bezier(.4,0,.2,1);
  max-height: 55vh; display: flex; flex-direction: column;
  &.open { transform: translateY(0); }
}
.sheet-handle {
  display: flex; justify-content: center; padding: 16rpx 0 8rpx;
  flex-shrink: 0; cursor: pointer;
}
.handle-bar {
  width: 60rpx; height: 6rpx; border-radius: 3rpx;
  background: rgba(0,0,0,.15);
}
.sheet-body {
  flex: 1; overflow-y: auto; padding: 8rpx 16rpx;
  padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
}
.step-card {
  display: flex; align-items: flex-start; gap: 16rpx;
  padding: 16rpx; margin-bottom: 4rpx;
  border-radius: 14rpx; background: rgba(0,0,0,.03);
  border: 1px solid rgba(0,0,0,.04);
}
.card-icon {
  width: 52rpx; height: 52rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 22rpx; color: #fff;
  &.icon-start { background: rgba(76,175,80,.2); color: #4caf50; }
  &.icon-end { background: rgba(233,69,96,.2); color: #e94560; font-size: 24rpx; }
  &.icon-turn { background: rgba(240,147,43,.2); color: #f0932b; }
  &.icon-go { background: rgba(64,128,255,.15); color: #4080ff; }
}
.card-body {
  flex: 1; display: flex; align-items: center; justify-content: space-between;
  padding-top: 12rpx;
}
.card-action { font-size: 26rpx; color: #333; flex: 1; }
.card-dist { font-size: 22rpx; color: #c4a45a; font-weight: 500; flex-shrink: 0; }

// ====== GPS ======
.topbar-gps {
  width: 60rpx; height: 60rpx; border-radius: 50%;
  background: rgba(0,0,0,.06); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  &:active { background: rgba(0,0,0,.1); }
}
.gps-icon { font-size: 28rpx; }
.gps-panel {
  position: fixed; bottom: 60rpx; left: 50%; transform: translateX(-50%); z-index: 46;
  background: rgba(0,212,255,.15); border: 1px solid rgba(0,212,255,.3);
  border-radius: 20rpx; padding: 12rpx 24rpx;
}
.gps-hint { font-size: 22rpx; color: #00d4ff; }
</style>
