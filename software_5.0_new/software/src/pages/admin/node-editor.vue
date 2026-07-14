<template>
  <view class="editor-page">
    <!-- 顶部栏 -->
    <view class="ed-topbar">
      <view class="topbar-back" @click="goBack"><text class="back-arrow">‹</text></view>
      <text class="topbar-title">路网节点编辑</text>
      <view class="topbar-count">
        <text class="count-dot" :class="{ dirty }">●</text>
        <text class="count-text">节点{{ nodes.length }} · 边{{ edges.length }}</text>
      </view>
    </view>

    <!-- 工具栏 -->
    <view class="ed-toolbar">
      <view class="tool-group">
        <view
          class="tool-btn"
          v-for="m in MODES"
          :key="m.key"
          :class="{ active: mode === m.key }"
          @click="setMode(m.key)"
        >
          <text class="tool-icon">{{ m.icon }}</text>
          <text class="tool-label">{{ m.label }}</text>
        </view>
      </view>

      <view class="tool-group edge-type-group" v-if="mode === 'add-edge'">
        <view
          class="type-btn"
          v-for="t in EDGE_TYPES"
          :key="t"
          :class="{ active: edgeType === t }"
          :style="{ borderColor: edgeType === t ? EDGE_COLOR[t] : 'transparent' }"
          @click="edgeType = t"
        >
          <text class="type-dot" :style="{ background: EDGE_COLOR[t] }"></text>
          <text class="type-label">{{ EDGE_LABEL[t] }}</text>
        </view>
      </view>

      <view class="tool-group tool-actions">
        <view class="act-btn auto" @click="autoConnect">🪄自动连线</view>
        <view class="act-btn save" @click="save">💾保存</view>
        <view class="act-btn export" @click="exportJson">⬇导出</view>
        <view class="act-btn import" @click="importJson">⬆导入</view>
        <view class="act-btn clear" @click="clearAll">🗑清空</view>
        <view class="act-btn reset" @click="reset">↺重置</view>
      </view>
    </view>

    <!-- 模式提示 -->
    <view class="mode-hint">
      <text>{{ modeHint }}</text>
    </view>

    <!-- 地图 + SVG 叠加 -->
    <view class="map-box">
      <image class="map-image" src="/static/lingshan-map.jpg" mode="scaleToFill" />
      <svg
        ref="svgRef"
        class="edit-svg"
        :viewBox="viewBox"
        preserveAspectRatio="none"
        @click="onSvgBackgroundClick($event)"
        @mousedown="onSvgMouseDown($event)"
      >
        <!-- 边 -->
        <line
          v-for="(e, idx) in edges"
          :key="e.from + '-' + e.to"
          :x1="nodeMap.get(e.from)?.x ?? 0"
          :y1="nodeMap.get(e.from)?.y ?? 0"
          :x2="nodeMap.get(e.to)?.x ?? 0"
          :y2="nodeMap.get(e.to)?.y ?? 0"
          :stroke="EDGE_COLOR[e.type]"
          :stroke-width="selectedEdgeId === idx ? 7 : 3"
          stroke-linecap="round"
          @click.stop="onEdgeClick(idx, $event)"
        />
        <!-- 节点 -->
        <template v-for="n in nodes" :key="n.id">
          <circle
            :cx="n.x"
            :cy="n.y"
            :r="n.name ? 12 : 7"
            :fill="n.name ? '#e94560' : '#4da6ff'"
            :stroke="selectedNodeId === n.id ? '#ffd54a' : '#fff'"
            :stroke-width="selectedNodeId === n.id ? 4 : edgeFirstId === n.id ? 3 : 1"
            @click.stop="onNodeClick(n.id, $event)"
            @mousedown.stop="onNodeMouseDown(n.id, $event)"
          />
          <text
            v-if="n.name"
            class="node-label"
            :x="n.x"
            :y="n.y - 16"
            font-size="13"
            fill="#3a2a12"
            font-weight="bold"
            text-anchor="middle"
          >{{ n.name }}</text>
        </template>
      </svg>
    </view>

    <!-- 底部编辑面板 -->
    <view class="edit-panel" v-if="selectedNode || selectedEdge">
      <!-- 节点编辑 -->
      <view class="panel-section" v-if="selectedNode">
        <view class="panel-header">
          <text class="panel-title">节点 {{ selectedNode.id }}</text>
          <text class="panel-coord">({{ selectedNode.x }}, {{ selectedNode.y }})</text>
        </view>
        <view class="panel-row">
          <text class="row-label">名称</text>
          <input
            class="row-input"
            :value="selectedNode.name || ''"
            placeholder="如 灵山大佛 / 检票口"
            @input="onNodeInput('name', $event)"
          />
        </view>
        <view class="panel-tip">命名与景区一致即标记为地标（如 灵山大佛、检票口）</view>
        <view class="panel-row">
          <text class="row-label">路号</text>
          <input
            class="row-input"
            :value="selectedNode.roadId || ''"
            placeholder="如 r1"
            @input="onNodeInput('roadId', $event)"
          />
        </view>
        <view class="panel-row">
          <text class="row-label">路名</text>
          <input
            class="row-input"
            :value="selectedNode.roadName || ''"
            placeholder="如 景区1路"
            @input="onNodeInput('roadName', $event)"
          />
        </view>
        <view class="panel-actions">
          <view class="p-btn danger" @click="deleteNode(selectedNode.id)">删除节点</view>
        </view>
      </view>

      <!-- 边编辑 -->
      <view class="panel-section" v-else-if="selectedEdge">
        <view class="panel-header">
          <text class="panel-title">连线</text>
          <text class="panel-coord">{{ selectedEdge.from }} → {{ selectedEdge.to }}</text>
        </view>
        <view class="panel-row">
          <text class="row-label">类型</text>
          <view class="type-pick">
            <view
              class="type-btn"
              v-for="t in EDGE_TYPES"
              :key="t"
              :class="{ active: selectedEdge.type === t }"
              :style="{ borderColor: selectedEdge.type === t ? EDGE_COLOR[t] : 'transparent' }"
              @click="setEdgeType(t)"
            >
              <text class="type-dot" :style="{ background: EDGE_COLOR[t] }"></text>
              <text class="type-label">{{ EDGE_LABEL[t] }}</text>
            </view>
          </view>
        </view>
        <view class="panel-row">
          <text class="row-label">长度</text>
          <text class="row-value">{{ selectedEdge.distance }}m（自动）</text>
        </view>
        <view class="panel-actions">
          <view class="p-btn danger" @click="deleteEdge(selectedEdgeId!)">删除边</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  getRoadNetwork, getMapSize, applyStoredOverride, setNetworkOverride,
  type RoadNode, type RoadEdge,
} from '@/engine/roadNetwork'
import { clientToMap } from '@/utils/mapCoord'

const PX_PER_M = 2.8
const OVERRIDE_KEY = 'lingshan-road-network-override-v4'

type Mode = 'add-node' | 'add-edge' | 'move' | 'delete'
type EdgeType = RoadEdge['type']

const MODES: { key: Mode; icon: string; label: string }[] = [
  { key: 'add-node', icon: '📍', label: '加点' },
  { key: 'add-edge', icon: '🔗', label: '连线' },
  { key: 'move', icon: '✋', label: '移动' },
  { key: 'delete', icon: '🗑', label: '删除' },
]
const EDGE_TYPES: EdgeType[] = ['main', 'side', 'stairs', 'bridge', 'covered']
const EDGE_COLOR: Record<EdgeType, string> = {
  main: '#4080ff', side: '#9a9a9a', stairs: '#e67e22', bridge: '#9b59b6', covered: '#16a085',
}
const EDGE_LABEL: Record<EdgeType, string> = {
  main: '主路', side: '支路', stairs: '台阶', bridge: '桥', covered: '廊道',
}

const svgRef = ref<any>(null)
const viewBox = ref('0 0 1677 1920')

const nodes = ref<RoadNode[]>([])
const edges = ref<RoadEdge[]>([])
const mode = ref<Mode>('add-node')
const edgeType = ref<EdgeType>('main')
const selectedNodeId = ref<string | null>(null)
const selectedEdgeId = ref<number | null>(null)
const edgeFirstId = ref<string | null>(null)
const dirty = ref(false)

// 导入用的隐藏 file input（H5 下用原生 DOM 读取本地 JSON 备份）
const hiddenFileInput = ref<any>(null)

// 拖拽状态
let dragId: string | null = null
let dragMoved = false

const nodeMap = computed(() => {
  const m = new Map<string, RoadNode>()
  nodes.value.forEach(n => m.set(n.id, n))
  return m
})

const selectedNode = computed(() =>
  selectedNodeId.value ? nodeMap.value.get(selectedNodeId.value) : undefined
)
const selectedEdge = computed(() =>
  selectedEdgeId.value !== null ? edges.value[selectedEdgeId.value] : undefined
)

const modeHint = computed(() => {
  switch (mode.value) {
    case 'add-node': return '点击地图空地添加节点；点节点可选中编辑'
    case 'add-edge': return edgeFirstId.value
      ? `已选起点 ${edgeFirstId.value}，再点一个节点完成连线（类型：${EDGE_LABEL[edgeType.value]}）`
      : `点击两个节点连线（类型：${EDGE_LABEL[edgeType.value]}）`
    case 'move': return '按住节点拖动以移动位置'
    case 'delete': return '点击节点删除该节点及其连线；点击连线删除该边'
  }
})

// ==================== 初始化 ====================

function loadFromNetwork() {
  const net = getRoadNetwork()
  nodes.value = JSON.parse(JSON.stringify(net.nodes))
  edges.value = JSON.parse(JSON.stringify(net.edges))
  selectedNodeId.value = null
  selectedEdgeId.value = null
  edgeFirstId.value = null
}

onMounted(() => {
  const { width, height } = getMapSize()
  viewBox.value = `0 0 ${width} ${height}`
  loadFromNetwork()
  window.addEventListener('mousemove', onWinMouseMove)
  window.addEventListener('mouseup', onWinMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onWinMouseMove)
  window.removeEventListener('mouseup', onWinMouseUp)
})

function goBack() { uni.navigateBack() }

function setMode(m: Mode) {
  mode.value = m
  edgeFirstId.value = null
}

// ==================== 坐标换算 ====================

function svgEl(): Element | null {
  return svgRef.value as unknown as SVGSVGElement | null
}

function eventCoord(e: MouseEvent): { x: number; y: number } | null {
  return clientToMap(e.clientX, e.clientY, svgEl())
}

function clamp(v: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(v)))
}

// ==================== 节点/边操作 ====================

function nextId(): string {
  let max = 0
  for (const n of nodes.value) {
    const m = /^N(\d+)$/.exec(n.id)
    if (m) max = Math.max(max, +m[1])
  }
  return 'N' + String(max + 1).padStart(4, '0')
}

function edgeDist(aId: string, bId: string): number {
  const a = nodeMap.value.get(aId)
  const b = nodeMap.value.get(bId)
  if (!a || !b) return 1
  return Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / PX_PER_M))
}

function addNode(c: { x: number; y: number }) {
  const { width, height } = getMapSize()
  const id = nextId()
  nodes.value.push({
    id, name: '', x: clamp(c.x, width), y: clamp(c.y, height),
    roadId: 'r-new', roadName: '新路段',
  })
  selectedNodeId.value = id
  selectedEdgeId.value = null
  dirty.value = true
}

function createEdge(aId: string, bId: string, type: EdgeType) {
  if (aId === bId) return
  const exists = edges.value.some(e =>
    (e.from === aId && e.to === bId) || (e.from === bId && e.to === aId)
  )
  if (exists) { uni.showToast({ title: '该连线已存在', icon: 'none' }); return }
  const a = nodeMap.value.get(aId)
  edges.value.push({
    from: aId, to: bId, distance: edgeDist(aId, bId), type,
    roadId: a?.roadId || 'r-new', roadName: a?.roadName || '新路段',
  })
  dirty.value = true
}

// 自动用「主路」把所有未连通的节点接入网络（最小生成树思路）：
// 现有边已构成的连通分量原样保留，仅在不同分量间按最短距离补主路边，
// 直到全图连通。结果是每个节点至少有一条边，且任意两点导航可达。
function autoConnect() {
  const all = nodes.value
  if (all.length < 2) {
    uni.showToast({ title: '节点不足，无需连线', icon: 'none' })
    return
  }
  uni.showModal({
    title: '自动连线',
    content: `用「主路」把未连通的节点接入网络？\n现有 ${edges.value.length} 条边保留，仅补充必要的主路边。`,
    success: (r) => {
      if (!r.confirm) return
      // 并查集：初始化每个节点为独立分量
      const parent = new Map<string, string>()
      for (const n of all) parent.set(n.id, n.id)
      const find = (x: string): string => {
        let cur = x
        while (parent.get(cur) !== cur) {
          const p = parent.get(cur)!
          parent.set(cur, parent.get(p)!) // 路径压缩
          cur = p
        }
        return cur
      }
      const union = (a: string, b: string) => parent.set(find(a), find(b))
      // 先把现有边并入连通分量（保留用户已连的桥/台阶等）
      for (const e of edges.value) {
        if (parent.has(e.from) && parent.has(e.to)) union(e.from, e.to)
      }
      // 统计初始连通分量数，目标补 (分量数-1) 条边使全图连通
      const roots = new Set<string>()
      for (const n of all) roots.add(find(n.id))
      const target = roots.size - 1
      if (target <= 0) {
        uni.showToast({ title: '已全部连通，无需补线', icon: 'none' })
        return
      }
      // 生成候选边：所有跨分量的节点对，按距离升序（Kruskal）
      const candidates: { from: string; to: string; distance: number }[] = []
      for (let i = 0; i < all.length; i++) {
        const a = all[i]
        for (let j = i + 1; j < all.length; j++) {
          const b = all[j]
          if (find(a.id) === find(b.id)) continue
          candidates.push({ from: a.id, to: b.id, distance: edgeDist(a.id, b.id) })
        }
      }
      candidates.sort((p, q) => p.distance - q.distance)
      const added: RoadEdge[] = []
      for (const c of candidates) {
        if (added.length >= target) break
        if (find(c.from) === find(c.to)) continue
        union(c.from, c.to)
        const a = nodeMap.value.get(c.from)
        added.push({
          from: c.from, to: c.to, distance: c.distance, type: 'main',
          roadId: a?.roadId || 'r-new', roadName: a?.roadName || '新路段',
        })
      }
      if (added.length === 0) {
        uni.showToast({ title: '已全部连通，无需补线', icon: 'none' })
        return
      }
      edges.value = edges.value.concat(added)
      selectedEdgeId.value = null
      dirty.value = true
      uni.showToast({ title: `已连 ${added.length} 条主路`, icon: 'success' })
    },
  })
}

function deleteNode(id: string) {
  nodes.value = nodes.value.filter(n => n.id !== id)
  edges.value = edges.value.filter(e => e.from !== id && e.to !== id)
  if (selectedNodeId.value === id) selectedNodeId.value = null
  selectedEdgeId.value = null
  if (edgeFirstId.value === id) edgeFirstId.value = null
  dirty.value = true
}

function deleteEdge(idx: number) {
  edges.value = edges.value.filter((_, i) => i !== idx)
  selectedEdgeId.value = null
  dirty.value = true
}

function setEdgeType(t: EdgeType) {
  const idx = selectedEdgeId.value
  if (idx === null) return
  const e = edges.value[idx]
  if (e) { e.type = t; dirty.value = true }
}

function recomputeEdgesFor(nodeId: string) {
  edges.value.forEach(e => {
    if (e.from === nodeId || e.to === nodeId) e.distance = edgeDist(e.from, e.to)
  })
}

// ==================== 事件处理 ====================

function onSvgBackgroundClick(e: MouseEvent) {
  // 拖拽刚结束，吞掉这次背景点击，避免误触
  if (dragMoved) { dragMoved = false; return }
  if (mode.value === 'add-node') {
    const c = eventCoord(e)
    if (c) addNode(c)
  } else {
    selectedNodeId.value = null
    selectedEdgeId.value = null
    edgeFirstId.value = null
  }
}

function onNodeClick(id: string, e: MouseEvent) {
  if (mode.value === 'add-edge') {
    if (!edgeFirstId.value) {
      edgeFirstId.value = id
    } else if (edgeFirstId.value !== id) {
      createEdge(edgeFirstId.value, id, edgeType.value)
      edgeFirstId.value = null
    } else {
      edgeFirstId.value = null
    }
  } else if (mode.value === 'delete') {
    deleteNode(id)
  } else {
    selectedNodeId.value = id
    selectedEdgeId.value = null
  }
}

function onEdgeClick(idx: number, e: MouseEvent) {
  if (mode.value === 'delete') {
    deleteEdge(idx)
  } else {
    selectedEdgeId.value = idx
    selectedNodeId.value = null
    edgeFirstId.value = null
  }
}

function onSvgMouseDown(e: MouseEvent) {
  // 仅 move 模式下，节点 mousedown 会单独触发；此处处理背景按下时无操作
}

function onNodeMouseDown(id: string, e: MouseEvent) {
  if (mode.value !== 'move') return
  dragId = id
  dragMoved = false
  selectedNodeId.value = id
  selectedEdgeId.value = null
}

function onWinMouseMove(e: MouseEvent) {
  if (!dragId) return
  const c = clientToMap(e.clientX, e.clientY, svgEl())
  if (!c) return
  const n = nodeMap.value.get(dragId)
  if (!n) return
  const { width, height } = getMapSize()
  n.x = clamp(c.x, width)
  n.y = clamp(c.y, height)
  recomputeEdgesFor(dragId)
  dragMoved = true
  dirty.value = true
}

function onWinMouseUp() {
  dragId = null
}

function onNodeInput(field: 'name' | 'roadId' | 'roadName', e: any) {
  const id = selectedNodeId.value
  if (!id) return
  const n = nodes.value.find(x => x.id === id)
  if (!n) return
  ;(n as any)[field] = e.detail?.value ?? ''
  dirty.value = true
}

// ==================== 持久化 ====================

function buildData() {
  const { width, height } = getMapSize()
  return {
    version: '5.0-editor',
    imageWidth: width,
    imageHeight: height,
    nodes: nodes.value,
    edges: edges.value,
  }
}

function save() {
  uni.setStorageSync(OVERRIDE_KEY, JSON.stringify(buildData()))
  applyStoredOverride()
  dirty.value = false
  uni.showToast({ title: '已保存·即时生效', icon: 'success' })
}

function importJson() {
  const g = globalThis as any
  const doc = g.document
  if (!doc) {
    uni.showToast({ title: '当前环境不支持导入', icon: 'error' })
    return
  }
  // 复用单个隐藏 input，避免重复创建
  if (!hiddenFileInput.value) {
    const input = doc.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.display = 'none'
    input.onchange = () => {
      const file = input.files && input.files[0]
      if (!file) return
      const reader = new g.FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result)
          if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            throw new Error('格式不符')
          }
          // 规整为完整 RoadNetwork 结构（缺字段时回退到当前地图尺寸）
          const { width, height } = getMapSize()
          const restored = {
            version: data.version || '5.0-editor',
            imageWidth: data.imageWidth || width,
            imageHeight: data.imageHeight || height,
            nodes: data.nodes,
            edges: data.edges,
          }
          nodes.value = restored.nodes
          edges.value = restored.edges
          viewBox.value = `0 0 ${restored.imageWidth} ${restored.imageHeight}`
          selectedNodeId.value = null
          selectedEdgeId.value = null
          edgeFirstId.value = null
          // 立即写入覆盖存储并生效，与「保存」等价
          uni.setStorageSync(OVERRIDE_KEY, JSON.stringify(restored))
          applyStoredOverride()
          dirty.value = false
          uni.showToast({ title: '已导入并保存生效', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: 'JSON 解析失败，未导入', icon: 'error' })
        }
      }
      reader.readAsText(file)
    }
    doc.body.appendChild(input)
    hiddenFileInput.value = input
  }
  // 清空 value 以便连续选择同一文件也能触发 change
  hiddenFileInput.value.value = ''
  hiddenFileInput.value.click()
}

function exportJson() {
  const g = globalThis as any
  const blob = new Blob([JSON.stringify(buildData(), null, 2)], { type: 'application/json' })
  const url = g.URL.createObjectURL(blob)
  const a = g.document.createElement('a')
  a.href = url
  a.download = 'lingshan-road-network.json'
  g.document.body.appendChild(a)
  a.click()
  g.document.body.removeChild(a)
  g.URL.revokeObjectURL(url)
  uni.showToast({ title: '已下载 JSON', icon: 'success' })
}

function reset() {
  uni.showModal({
    title: '重置确认',
    content: '清除本地编辑数据并恢复打包路网？',
    success: (r) => {
      if (!r.confirm) return
      uni.removeStorageSync(OVERRIDE_KEY)
      setNetworkOverride(null)
      loadFromNetwork()
      dirty.value = false
      uni.showToast({ title: '已重置', icon: 'success' })
    },
  })
}

// 清空当前画布上的所有节点和边，方便完全重新绘制
// 仅改动本地画布状态，不写入 storage；未保存时可用「重置」恢复打包路网
function clearAll() {
  uni.showModal({
    title: '清空确认',
    content: '删除当前所有节点和边？清空后可重新点选节点（未保存可用「重置」恢复）。',
    success: (r) => {
      if (!r.confirm) return
      nodes.value = []
      edges.value = []
      selectedNodeId.value = null
      selectedEdgeId.value = null
      edgeFirstId.value = null
      dragId = null
      dirty.value = true
      uni.showToast({ title: '已清空', icon: 'success' })
    },
  })
}
</script>

<style lang="scss" scoped>
@import "@/styles/variables.scss";

.editor-page {
  min-height: 100vh;
  background: #f7f2e3;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: calc(env(safe-area-inset-top) + 88rpx + 100rpx + 48rpx);
  padding-bottom: 360rpx;
  font-family: $font-body;
}

// ====== 顶部栏 ======
.ed-topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  height: calc(env(safe-area-inset-top) + 88rpx);
  padding: calc(env(safe-area-inset-top) + 12rpx) 20rpx 12rpx;
  display: flex; align-items: center; gap: 16rpx;
  background: rgba(247, 242, 227, 0.92);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.topbar-back {
  width: 60rpx; height: 60rpx; border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  display: flex; align-items: center; justify-content: center;
  &:active { background: rgba(0, 0, 0, 0.12); }
}
.back-arrow { font-size: 40rpx; color: #333; line-height: 40rpx; font-weight: 300; }
.topbar-title { flex: 1; font-size: 32rpx; font-weight: 600; color: #333; }
.topbar-count { display: flex; align-items: center; gap: 8rpx; }
.count-dot { font-size: 20rpx; color: #aaa;
  &.dirty { color: #e94560; }
}
.count-text { font-size: 22rpx; color: #888; }

// ====== 工具栏 ======
.ed-toolbar {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 88rpx);
  left: 0; right: 0; z-index: 49;
  display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx;
  padding: 10rpx 16rpx;
  background: rgba(255, 255, 250, 0.95);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.tool-group { display: flex; align-items: center; gap: 8rpx; }
.tool-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-width: 92rpx; padding: 6rpx 10rpx; border-radius: 12rpx;
  background: rgba(0, 0, 0, 0.04);
  &.active { background: rgba(64, 128, 255, 0.18); box-shadow: 0 0 0 2rpx #4080ff inset; }
  &:active { transform: scale(0.94); }
  .tool-icon { font-size: 28rpx; }
  .tool-label { font-size: 20rpx; color: #555; }
}
.edge-type-group { flex-wrap: wrap; }
.type-btn {
  display: flex; align-items: center; gap: 6rpx;
  padding: 6rpx 12rpx; border-radius: 20rpx;
  border: 2rpx solid transparent; background: rgba(0, 0, 0, 0.04);
  &.active { background: rgba(255, 255, 255, 0.9); }
  &:active { transform: scale(0.94); }
  .type-dot { width: 14rpx; height: 14rpx; border-radius: 50%; }
  .type-label { font-size: 20rpx; color: #555; }
}
.tool-actions { margin-left: auto; }
.act-btn {
  font-size: 22rpx; padding: 10rpx 16rpx; border-radius: 12rpx;
  background: rgba(0, 0, 0, 0.06); color: #444;
  &:active { transform: scale(0.94); }
  &.save { background: rgba(76, 175, 80, 0.18); color: #2e7d32; }
  &.export { background: rgba(64, 128, 255, 0.16); color: #1565c0; }
  &.import { background: rgba(33, 150, 243, 0.16); color: #0d47a1; }
  &.auto { background: rgba(0, 188, 212, 0.16); color: #00838f; }
  &.clear { background: rgba(230, 126, 34, 0.16); color: #b9540f; }
  &.reset { background: rgba(233, 69, 96, 0.14); color: #c0392b; }
}

// ====== 模式提示 ======
.mode-hint {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 88rpx + 100rpx);
  left: 0; right: 0; z-index: 48;
  padding: 6rpx 24rpx;
  font-size: 20rpx; color: #8a7a5a;
  background: rgba(255, 255, 250, 0.7);
  text-align: center;
}

// ====== 地图区 ======
.map-box {
  position: relative;
  width: 100%;
}
.map-image {
  width: 100%;
  height: auto;
  aspect-ratio: 1677 / 1920;
  display: block;
}
.edit-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  z-index: 2;
  cursor: crosshair;
}
.node-label { pointer-events: none; }

// ====== 编辑面板 ======
.edit-panel {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 40;
  max-height: 340rpx;
  overflow-y: auto;
  background: #fffef8;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 -6rpx 24rpx rgba(0, 0, 0, 0.08);
  padding: 16rpx 24rpx calc(env(safe-area-inset-bottom) + 16rpx);
}
.panel-section { display: flex; flex-direction: column; gap: 10rpx; }
.panel-header { display: flex; align-items: baseline; gap: 16rpx; }
.panel-title { font-size: 28rpx; font-weight: 600; color: #333; }
.panel-coord { font-size: 22rpx; color: #999; }
.panel-row { display: flex; align-items: center; gap: 12rpx; }
.row-label { font-size: 24rpx; color: #666; width: 80rpx; flex-shrink: 0; }
.row-input {
  flex: 1; font-size: 26rpx; color: #333;
  border: 1px solid rgba(0, 0, 0, 0.12); border-radius: 10rpx;
  padding: 8rpx 14rpx; background: #fff;
}
.row-value { font-size: 24rpx; color: #555; }
.panel-tip { font-size: 20rpx; color: #b08a3a; padding-left: 92rpx; }
.type-pick { display: flex; flex-wrap: wrap; gap: 8rpx; }
.panel-actions { display: flex; justify-content: flex-end; margin-top: 4rpx; }
.p-btn {
  font-size: 24rpx; padding: 10rpx 20rpx; border-radius: 10rpx;
  &.danger { background: rgba(233, 69, 96, 0.14); color: #c0392b; }
  &:active { transform: scale(0.94); }
}
</style>
