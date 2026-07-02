<template>
  <view class="nav-page">
    <!-- 顶部导航栏：毛玻璃 -->
    <view class="nav-topbar">
      <view class="topbar-back" @click="goBack">
        <text class="back-arrow-img">‹</text>
      </view>
      <text class="topbar-title">{{ destName || '目的地' }}</text>
      <view class="topbar-gps" @click="toggleGps">
        <text class="gps-icon">{{ gpsActive ? '⏹' : '📍' }}</text>
      </view>
    </view>

    <!-- 横条板块：折叠显示当前 maneuver，展开显示全部路段 -->
    <view class="maneuver-bar" :class="{ expanded: barExpanded }" v-if="routeData">
      <!-- 折叠态：当前这一步 -->
      <view class="bar-collapsed" @click="barExpanded = !barExpanded" v-if="!barExpanded">
        <view class="bar-icon" :class="currentIconClass">
          <text class="bar-icon-char">{{ currentIconChar }}</text>
        </view>
        <view class="bar-text">
          <text class="bar-instruction">{{ currentInstruction }}</text>
          <text class="bar-sub">
            <text v-if="gpsActive">剩余 {{ currentRemainM }}m · {{ navProgress.distanceRemaining }}m / {{ navProgress.etaMinutes }}min</text>
            <text v-else>全程 {{ distText }} · {{ timeText }} · 共 {{ segmentCount }} 段</text>
          </text>
        </view>
        <text class="bar-chevron">⌃</text>
      </view>

      <!-- 展开态：全部路段 -->
      <scroll-view v-else scroll-y class="bar-expanded">
        <view class="bar-header" @click="barExpanded = false">
          <text class="bar-title">全程 {{ distText }} · {{ timeText }} · {{ segmentCount }} 段</text>
          <text class="bar-chevron down">⌄</text>
        </view>
        <view
          class="bar-step"
          v-for="(s, i) in steps"
          :key="i"
          :class="{ active: i === currentSegIdx, done: i < currentSegIdx }"
          @click="barExpanded = false"
        >
          <view class="bar-step-icon" :class="stepIconClass(i)">
            <text>{{ stepIconChar(i) }}</text>
          </view>
          <view class="bar-step-body">
            <text class="bar-step-action">{{ s.action }}</text>
            <text class="bar-step-dist">{{ s.dist }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 横条下方信息栈：降级提示 + 途经景区胶囊（仅折叠态显示，常规流不挡地图） -->
    <view class="below-bar" v-if="routeData && !barExpanded && (routeData.degraded || passedSpots.length)">
      <view class="degrade-hint" v-if="routeData.degraded">本路线仍含台阶，未找到更近的无台阶替代，老年人请留意缓行</view>
      <scroll-view v-if="passedSpots.length" class="passed-spots" scroll-x>
        <view class="ps-chip" v-for="(s, i) in passedSpots" :key="s.id">
          <text class="ps-idx">{{ i + 1 }}</text>
          <text class="ps-name">{{ s.name }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 地图区（路线在后台显示） -->
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
          <linearGradient id="routeGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#4caf50" />
            <stop offset="40%" stop-color="#4080ff" />
            <stop offset="100%" stop-color="#e94560" />
          </linearGradient>
        </defs>
        <!-- 发光带 -->
        <polyline :points="svgPoints" fill="none" stroke="#4da6ff" stroke-width="16"
          stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.12" />
        <!-- 主线路 -->
        <polyline :points="svgPoints" fill="none" stroke="url(#routeGrad)" stroke-width="7"
          stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)" />
        <!-- 起点标记 -->
        <circle v-if="startPoint" :cx="startPoint.x" :cy="startPoint.y" r="20"
          fill="#4caf50" stroke="#fff" stroke-width="4" filter="url(#glow)" />
        <text v-if="startPoint" :x="startPoint.x-30" :y="startPoint.y" fill="#fff"
          font-size="13" text-anchor="end" font-weight="bold" dominant-baseline="middle">起</text>
        <!-- 终点标记 -->
        <circle v-if="endPoint" :cx="endPoint.x" :cy="endPoint.y" r="20"
          fill="#e94560" stroke="#fff" stroke-width="4" filter="url(#glow)" />
        <circle v-if="endPoint" :cx="endPoint.x" :cy="endPoint.y" r="32"
          fill="none" stroke="#e94560" stroke-width="2" stroke-opacity="0.4">
          <animate attributeName="r" from="20" to="40" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <text v-if="endPoint" :x="endPoint.x+30" :y="endPoint.y" fill="#fff"
          font-size="13" text-anchor="start" font-weight="bold" dominant-baseline="middle">{{ destName }}</text>
        <!-- 实时位置标记 -->
        <circle v-if="myPos" :cx="myPos.x" :cy="myPos.y" r="18"
          fill="#00d4ff" stroke="#fff" stroke-width="3" opacity="0.85" filter="url(#glow)">
          <animate attributeName="r" from="14" to="22" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.9" to="0.5" dur="1s" repeatCount="indefinite" />
        </circle>
      </svg>
    </view>

    <!-- 路线模式标签（固定，不随页面滚动） -->
    <view v-if="routeData" class="mode-badge" :class="routeModeText === '老年友好' ? 'mode-aged' : 'mode-standard'">{{ routeModeText }}</view>

    <view v-if="routeError" class="route-error">{{ routeError }}</view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  getMapSize, findNodeByName, getSpotNodes, getNodeById, type RoadNode,
} from '@/engine/roadNetwork'
import {
  findRoute, findMultiStopRoute, pathToSVGPoints, pathToPixelPoints, ageToPrefs,
  getLandmarksOnPath,
  type RouteStep, type PixelPoint, type RoutePreferences,
} from '@/engine/pathfinder'
import { gpsToPixel, type GpsCoord, type PixelCoord } from '@/engine/gpsTransform'
import { navEngine, type NavProgress } from '@/engine/navigationEngine'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const destName = ref('')
const svgPoints = ref('')
const svgViewBox = ref('0 0 1677 1920')
const routeData = ref<RouteStep | null>(null)
const routeError = ref('')
const startPoint = ref<PixelPoint | null>(null)
const endPoint = ref<PixelPoint | null>(null)
const barExpanded = ref(false)
const passedSpots = ref<{ id: string; name: string }[]>([])
const routeModeText = ref('标准路线')

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
let simDist = 0
let currentPrefs: RoutePreferences = { mode: 'shortest' }

// 模拟参数：按距离推进（而非逐节点），每 tick 前进固定米数
const SIM_TICK_MS = 400
const SIM_SPEED_M = 5 // ~12.5m/s 演示节奏，1km 约 80s 跑完

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

interface StepItem { action: string; dist: string; distNum: number; turn?: string }
const steps = computed<StepItem[]>(() => {
  if (!routeData.value) return []
  return routeData.value.segments.map((seg) => ({
    action: seg.turnInstruction || `前往${seg.toName}`,
    dist: seg.distance + 'm',
    distNum: seg.distance,
    turn: seg.turnDirection,
  }))
})

const isNavigating = computed(() => gpsActive.value && navProgress.value.state !== 'IDLE')
const currentSegIdx = computed(() =>
  isNavigating.value ? navProgress.value.currentSegmentIndex : 0
)
const currentInstruction = computed(() => {
  if (isNavigating.value && navProgress.value.nextTurn) return navProgress.value.nextTurn.instruction
  return steps.value[currentSegIdx.value]?.action || '准备出发'
})
const currentRemainM = computed(() => {
  if (isNavigating.value && navProgress.value.nextTurn) return navProgress.value.nextTurn.distance
  return steps.value[currentSegIdx.value]?.distNum || 0
})
const currentTurn = computed(() => steps.value[currentSegIdx.value]?.turn)

function turnIconCharOf(turn?: string): string {
  if (turn === 'left') return '↰'
  if (turn === 'right') return '↱'
  if (turn === 'slight-left') return '↖'
  if (turn === 'slight-right') return '↗'
  if (turn === 'u-turn') return '⤴'
  return '↑'
}
const currentIconChar = computed(() => {
  if (currentSegIdx.value === 0 && !isNavigating.value) return '▶'
  if (currentSegIdx.value >= steps.value.length - 1) return '🏁'
  return turnIconCharOf(currentTurn.value)
})
const currentIconClass = computed(() => iconClassFor(currentSegIdx.value, currentTurn.value))

function iconClassFor(i: number, turn?: string) {
  if (i === 0) return 'ic-start'
  if (i >= steps.value.length - 1) return 'ic-end'
  if (turn && turn !== 'straight') return 'ic-turn'
  return 'ic-go'
}
function stepIconClass(i: number) {
  return iconClassFor(i, steps.value[i]?.turn)
}
function stepIconChar(i: number): string {
  if (i === 0) return '▶'
  if (i === steps.value.length - 1) return '🏁'
  return turnIconCharOf(steps.value[i]?.turn)
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

// ---- 路线计算（带年龄偏好） ----
function computeRoute(name: string, destSpotId: string, waypointIds?: string) {
  destName.value = decodeURIComponent(name)
  routeError.value = ''
  currentPrefs = ageToPrefs(userStore.user?.age ?? null)
  routeModeText.value = currentPrefs.mode === 'accessible' ? '老年友好' : '标准路线'

  let toNodeId: string | null = null
  const spotNodes = getSpotNodes(destSpotId)
  if (spotNodes.length > 0) toNodeId = spotNodes[0]
  else {
    // SPOT_NAME_MAP 未命中时，先按显示名在路网里找节点，再退回按 id 直查
    const found = findNodeByName(destName.value)
    if (found) toNodeId = found.id
    else {
      const direct = getNodeById(destSpotId)
      if (direct) toNodeId = direct.id
    }
  }
  if (!toNodeId) { routeError.value = `未找到"${name}"`; return }

  // 起点：检票口
  const gateNode = findNodeByName('检票口')
  if (!gateNode) { routeError.value = '缺少检票口节点'; return }

  navEngine.setPreferences(currentPrefs)

  let pathIds: string[]
  let degraded = false

  if (waypointIds) {
    const spotList = waypointIds.split(',').map(s => s.trim()).filter(Boolean)
    const viaSpots = spotList.length > 2 ? spotList.slice(1, -1) : []
    const viaNodeIds: string[] = []
    for (const sid of viaSpots) {
      const nodes = getSpotNodes(sid)
      if (nodes.length > 0) viaNodeIds.push(nodes[0])
    }
    const allNodeIds = [gateNode.id, ...viaNodeIds, toNodeId]
    const mr = findMultiStopRoute(allNodeIds, currentPrefs)
    if (!mr) { routeError.value = '路线不可达'; return }
    pathIds = mr.path
    degraded = !!mr.degraded
    routeData.value = {
      nodeIds: mr.path,
      totalDistance: mr.totalDistance,
      estimatedMinutes: mr.totalMinutes,
      segments: mr.legs.reduce((arr: RouteStep['segments'], l) => arr.concat(l.segments), []),
      degraded,
    }
  } else {
    const result = findRoute(gateNode.id, toNodeId, currentPrefs)
    if (!result) { routeError.value = '路线不可达'; return }
    pathIds = result.nodeIds
    degraded = !!result.degraded
    routeData.value = result
  }

  // 路线模式（多景点）列出途经地标；单目的地导航模式不列
  passedSpots.value = waypointIds ? getLandmarksOnPath(pathIds) : []

  svgPoints.value = pathToSVGPoints(pathIds)
  const pts = pathToPixelPoints(pathIds)
  startPoint.value = pts[0] || null
  endPoint.value = pts[pts.length - 1] || null
}

// ---- GPS / 定位模拟 ----

function toggleGps() {
  if (gpsActive.value) { stopGps(); return }
  if (!routeData.value) return
  if (navigator.geolocation) startRealGps()
  else startGps()
}

function startRealGps() {
  if (!routeData.value) return
  gpsActive.value = true
  realGps.value = true
  navEngine.setPreferences(currentPrefs)
  navEngine.startRoute(routeData.value)
  navEngine.setCallbacks({
    onProgress: (p) => { navProgress.value = p },
    onArrive: () => { stopGps() },
    onOffRoute: () => { console.log('[nav] 偏航') },
  })
  realWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const px = gpsToPixel({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      if (px) { myPos.value = px; navEngine.updatePosition(px) }
    },
    (err) => { console.log('[nav] GPS错误:', err.message, '→ 切换到模拟'); stopRealGps(); startGps() },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  )
}

function stopRealGps() {
  if (realWatchId !== null) { navigator.geolocation.clearWatch(realWatchId); realWatchId = null }
  realGps.value = false
}

/** 模拟导航：按距离沿路径推进，位置在节点间线性插值 */
function startGps() {
  if (!routeData.value) return
  gpsActive.value = true
  navEngine.setPreferences(currentPrefs)
  navEngine.startRoute(routeData.value)
  navEngine.setCallbacks({
    onProgress: (p) => { navProgress.value = p },
    onArrive: () => { stopGps() },
    onOffRoute: () => { console.log('[nav] 偏航') },
  })
  simDist = 0
  myPos.value = positionAtDistance(routeData.value.nodeIds, 0)
  simInterval = setInterval(() => {
    if (!routeData.value) return
    simDist += SIM_SPEED_M
    const total = routeData.value.totalDistance
    if (simDist >= total) simDist = total
    const px = positionAtDistance(routeData.value.nodeIds, simDist)
    if (px) { myPos.value = px; navEngine.updatePosition(px) }
    if (simDist >= total) { stopGps() }
  }, SIM_TICK_MS)
}

/** 沿路径在指定累计距离处取插值像素坐标（节点间线性插值） */
function positionAtDistance(pathIds: string[], distM: number): PixelCoord | null {
  let acc = 0
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = getNodeById(pathIds[i])
    const b = getNodeById(pathIds[i + 1])
    if (!a || !b) continue
    const segM = Math.hypot(b.x - a.x, b.y - a.y) / 2.8
    if (acc + segM >= distM) {
      const t = segM > 0 ? (distM - acc) / segM : 0
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    acc += segM
  }
  const last = getNodeById(pathIds[pathIds.length - 1])
  return last ? { x: last.x, y: last.y } : null
}

function stopGps() {
  gpsActive.value = false
  realGps.value = false
  myPos.value = null
  navEngine.stop()
  if (simInterval) { clearInterval(simInterval); simInterval = null }
  if (realWatchId !== null) { navigator.geolocation.clearWatch(realWatchId); realWatchId = null }
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
        u.searchParams.get('dest') || 'buddha'
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
  // 顶部 topbar + 横条板块占位，地图起始其下
  padding-top: calc(env(safe-area-inset-top) + 88rpx + 124rpx);
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
  &:hover { transform: scale(1.18); filter: brightness(1.25) saturate(1.3); }
}
.back-arrow-img { font-size: 40rpx; color: #333; line-height: 40rpx; font-weight: 300; }
.topbar-title {
  flex: 1; text-align: center; font-size: 32rpx; font-weight: 600;
  color: #333; letter-spacing: 2rpx;
}
.topbar-gps {
  width: 60rpx; height: 60rpx; border-radius: 50%;
  background: rgba(0,0,0,.06); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  &:active { background: rgba(0,0,0,.1); }
}
.gps-icon { font-size: 28rpx; }

// ====== 横条板块（maneuver bar） ======
.maneuver-bar {
  position: fixed; left: 0; right: 0; z-index: 49;
  top: calc(env(safe-area-inset-top) + 88rpx);
  background: rgba(255, 255, 250, 0.94);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 6rpx 24rpx rgba(0,0,0,.07);
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(.4,0,.2,1);
  max-height: 124rpx;
  &.expanded { max-height: 60vh; }
}
.bar-collapsed {
  display: flex; align-items: center; gap: 16rpx;
  padding: 18rpx 24rpx; cursor: pointer;
}
.bar-icon {
  width: 64rpx; height: 64rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  background: rgba(64,128,255,.12);
  &.ic-start { background: rgba(76,175,80,.18); }
  &.ic-end { background: rgba(233,69,96,.18); }
  &.ic-turn { background: rgba(240,147,43,.18); }
  &.ic-go { background: rgba(64,128,255,.12); }
}
.bar-icon-char { font-size: 30rpx; color: #4080ff; }
.bar-icon.ic-start .bar-icon-char { color: #4caf50; }
.bar-icon.ic-end .bar-icon-char { color: #e94560; }
.bar-icon.ic-turn .bar-icon-char { color: #f0932b; }
.bar-text { flex: 1; display: flex; flex-direction: column; gap: 4rpx; min-width: 0; }
.bar-instruction {
  font-size: 30rpx; font-weight: 600; color: #333;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bar-sub { font-size: 22rpx; color: #999; }
.bar-chevron {
  font-size: 36rpx; color: #c4a45a; flex-shrink: 0; line-height: 1;
  transform: rotate(0deg); transition: transform 0.3s ease;
}
.bar-chevron.down { transform: rotate(180deg); }

.bar-expanded {
  max-height: 60vh;
}
.bar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16rpx 24rpx; cursor: pointer;
  border-bottom: 1px solid rgba(0,0,0,.05);
  position: sticky; top: 0; background: rgba(255,255,250,.96);
}
.bar-title { font-size: 24rpx; color: #c4a45a; font-weight: 600; }
.bar-step {
  display: flex; align-items: center; gap: 16rpx;
  padding: 18rpx 24rpx;
  border-bottom: 1px solid rgba(0,0,0,.04);
  &.active { background: rgba(196,164,90,.12); }
  &.done { opacity: 0.5; }
}
.bar-step-icon {
  width: 52rpx; height: 52rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 24rpx;
  background: rgba(64,128,255,.1); color: #4080ff;
  &.ic-start { background: rgba(76,175,80,.18); color: #4caf50; }
  &.ic-end { background: rgba(233,69,96,.18); color: #e94560; }
  &.ic-turn { background: rgba(240,147,43,.18); color: #f0932b; }
}
.bar-step-body { flex: 1; display: flex; align-items: center; justify-content: space-between; }
.bar-step-action { font-size: 26rpx; color: #333; flex: 1; }
.bar-step-dist { font-size: 22rpx; color: #c4a45a; font-weight: 500; flex-shrink: 0; }

// ====== 路线模式标签（固定，不随页面滚动） ======
.mode-badge {
  position: fixed;
  left: 24rpx;
  bottom: calc(env(safe-area-inset-bottom) + 40rpx);
  z-index: 48;
  display: flex; align-items: center; gap: 10rpx;
  padding: 10rpx 22rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.18);
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
  &::before {
    content: '';
    width: 14rpx; height: 14rpx; border-radius: 50%;
    flex-shrink: 0;
  }
  &.mode-standard { color: #1565c0; &::before { background: #4080ff; } } // 标准路线=蓝
  &.mode-aged { color: #2e7d32; &::before { background: #4caf50; } }    // 老年友好=绿
}

// ====== 横条下方信息栈（常规流，落在 padding-top 之后，不挡地图） ======
.below-bar {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 8rpx 24rpx 0;
}

// ====== 降级提示 ======
.degrade-hint {
  background: rgba(240,147,43,.14); border: 1px solid rgba(240,147,43,.3);
  border-radius: 14rpx; padding: 10rpx 20rpx;
  font-size: 22rpx; color: #d6801f; text-align: center;
}

// ====== 途经景区胶囊 ======
.passed-spots {
  white-space: nowrap;
  padding: 4rpx 0 8rpx;
}
.ps-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  margin-right: 12rpx;
  padding: 6rpx 16rpx 6rpx 8rpx;
  border-radius: 30rpx;
  background: #fff;
  border: 1px solid rgba(196, 164, 90, 0.35);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}
.ps-idx {
  display: flex; align-items: center; justify-content: center;
  width: 32rpx; height: 32rpx; border-radius: 50%;
  background: linear-gradient(135deg, #4caf50, #4080ff);
  color: #fff; font-size: 20rpx; font-weight: 600;
}
.ps-name {
  font-size: 24rpx; color: #5a4a32; font-weight: 500;
}

// ====== 地图 ======
.nav-map-wrap { width: 100%; position: relative; }
.nav-map { width: 100%; height: auto; display: block; }
.nav-svg {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%; pointer-events: none; z-index: 2;
}

// ====== 错误 ======
.route-error {
  text-align: center; color: #e94560; font-size: 26rpx;
  padding: 40rpx 24rpx;
}
</style>
