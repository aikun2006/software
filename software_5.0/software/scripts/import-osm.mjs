/**
 * OSM 路网导入脚本 —— 从 OpenStreetMap 生成灵山景区路网 JSON
 *
 * 数据源：Overpass API（与 https://overpass-turbo.eu 同源）
 *   可选手动导出：去 overpass-turbo.eu 框选灵山景区 → 导出 GeoJSON →
 *   保存为 scripts/overpass.geojson，脚本会优先读本地文件，否则自动拉取 API。
 *
 * 流程：
 *   1. Overpass 拉取 bbox 内所有 highway way（含几何 out geom）
 *   2. 过滤可步行类型（footway/path/steps/pedestrian/track）
 *   3. 按 (lat,lon) 去重端点 → 自动重建交叉口连通性（OSM way 在路口共享节点）
 *   4. 沿线密化到约 500 节点（自适应间距）
 *   5. GPS→像素：复刻 src/engine/gpsTransform.ts 的仿射变换，保证与地图对齐
 *   6. 每条 way 编号 景区N路（N=1,2,3...），边带 roadId/roadName
 *   7. B 混合：把手画网络(.manual.json)的 stairs/bridge 语义按空间邻近投射到 OSM 边
 *   8. 烘焙地标名：手画网络的命名节点 → 最近 OSM 节点继承 name（保 getSpotNodes 可用）
 *
 * 用法：npm run import-osm
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA_DIR = resolve(ROOT, 'src/data')
const OUT_PATH = resolve(DATA_DIR, 'lingshan-road-network.json')
const MANUAL_PATH = resolve(DATA_DIR, 'lingshan-road-network.manual.json')
const LOCAL_GEOJSON = resolve(__dirname, 'overpass.geojson')

// 灵山景区 bbox（S, W, N, E）——略大于已知锚点范围，留边距
const BBOX = [31.421, 120.088, 31.435, 120.098]
const TARGET_NODES = 500

// ====== GPS→像素 仿射（与 src/engine/gpsTransform.ts 完全一致）======
const REF = {
  buddhaPx:  { x: 600,  y: 420  },
  buddhaGps: { lat: 31.43205, lng: 120.09151 },
  gatePx:    { x: 700,  y: 1790 },
  gateGps:   { lat: 31.42380, lng: 120.09220 },
}
const MAP_W = 1677
const MAP_H = 1920
const scaleX = (REF.gatePx.x - REF.buddhaPx.x) / (REF.gateGps.lng - REF.buddhaGps.lng)
const scaleY = (REF.gatePx.y - REF.buddhaPx.y) / (REF.gateGps.lat - REF.buddhaGps.lat)
const offsetX = REF.buddhaPx.x - REF.buddhaGps.lng * scaleX
const offsetY = REF.buddhaPx.y - REF.buddhaGps.lat * scaleY
function gpsToPixel(lat, lng) {
  return { x: Math.round(lng * scaleX + offsetX), y: Math.round(lat * scaleY + offsetY) }
}
// 像素→米（与 engine 一致：1m ≈ 2.8px）
const PX_PER_M = 2.8
function pxToM(px) { return Math.round(px / PX_PER_M) }

// ====== 可步行 highway 类型 → 边类型 ======
const WALKABLE = {
  'footway': 'side', 'path': 'side', 'track': 'side',
  'pedestrian': 'main', 'steps': 'stairs',
}
function tagToEdgeType(tags) {
  if (tags.bridge === 'yes') return 'bridge'
  if (tags.highway === 'steps') return 'stairs'
  if (tags.covered === 'yes') return 'covered'
  return WALKABLE[tags.highway] || null
}

// ====== 1. 获取 OSM 数据 ======
async function fetchOsm() {
  if (existsSync(LOCAL_GEOJSON)) {
    console.log('[import] 使用本地 scripts/overpass.geojson')
    return JSON.parse(readFileSync(LOCAL_GEOJSON, 'utf8'))
  }
  const q = `[out:json][timeout:60];(way["highway"](${BBOX.join(',')}););out geom;`
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.privatefinanced.de/api/interpreter',
  ]
  let lastErr = null
  for (const ep of endpoints) {
    for (const attempt of [1, 2]) {
      try {
        console.log(`[import] 拉取 ${ep} (第${attempt}次)...`)
        // URLSearchParams 等价 curl --data-urlencode，自动设 Content-Type 与编码
        const params = new URLSearchParams()
        params.set('data', q)
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: params,
        })
        if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue }
        const json = await res.json()
        if (!json.elements) { lastErr = new Error('空响应'); continue }
        console.log(`[import] 拉取到 ${json.elements.length} 条 way`)
        return json
      } catch (e) {
        lastErr = e
        console.log(`[import] 失败: ${e.message}, 重试...`)
      }
    }
  }
  throw new Error('Overpass 全部端点失败: ' + (lastErr?.message || '未知'))
}

// ====== 2. 几何工具 ======
function haversine(a, b) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const la1 = toRad(a.lat), la2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// 沿折线按固定间距采样（含端点）；跨段保持间距连续
function densify(geom, spacing) {
  const pts = [geom[0]]
  let carry = 0
  for (let i = 1; i < geom.length; i++) {
    const a = geom[i - 1], b = geom[i]
    const segLen = haversine(a, b)
    if (segLen < 1e-6) { carry = 0; continue }
    let d = carry
    while (d + spacing <= segLen) {
      d += spacing
      const t = d / segLen
      pts.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })
    }
    carry = segLen - d
  }
  const last = geom[geom.length - 1]
  const prev = pts[pts.length - 1]
  if (haversine(prev, last) > 0.01) pts.push(last)
  return pts
}

// ====== 3. 主流程 ======
async function main() {
  const osm = await fetchOsm()
  const ways = (osm.elements || []).filter(e => e.type === 'way' && Array.isArray(e.geometry))

  // 过滤可步行 way，并预计算总长（决定密化间距）
  const walkable = []
  let totalLen = 0
  for (const w of ways) {
    const et = tagToEdgeType(w.tags || {})
    if (!et) continue
    const geom = w.geometry.map(g => ({ lat: g.lat, lng: g.lon }))
    if (geom.length < 2) continue
    // 像素质心是否落在地图图幅内——剔除景区外周边道路噪声
    const pxPts = geom.map(g => gpsToPixel(g.lat, g.lng))
    const cx = pxPts.reduce((s, p) => s + p.x, 0) / pxPts.length
    const cy = pxPts.reduce((s, p) => s + p.y, 0) / pxPts.length
    const inBounds = cx >= 0 && cx <= MAP_W && cy >= 0 && cy <= MAP_H
    const isStructural = et === 'stairs' || et === 'bridge' // stairs/bridge 无论内外都保留
    if (!inBounds && !isStructural) continue
    let len = 0
    for (let i = 1; i < geom.length; i++) len += haversine(geom[i - 1], geom[i])
    walkable.push({ tags: w.tags || {}, type: et, geom, len })
    totalLen += len
  }
  // 自适应间距：目标 ~TARGET_NODES 节点（cap 12m 以在 ~8.5km 总长下落到 ~500 节点）
  const spacing = Math.max(5, Math.min(12, totalLen / (TARGET_NODES * 0.75)))
  console.log(`[import] 可步行 way: ${walkable.length}，总长 ${totalLen.toFixed(0)}m，密化间距 ${spacing.toFixed(1)}m`)

  // 节点去重表：key = "lat,lng"(6位) → nodeId；nodeById 供 O(1) 查询
  const nodeKeyMap = new Map()
  const nodeById = new Map()
  const nodes = [] // {id, name, x, y, roadId?, roadName?}
  let nodeSeq = 0
  function getOrCreateNode(lat, lng, roadId, roadName) {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
    const existing = nodeKeyMap.get(key)
    if (existing) return existing
    const id = 'N' + String(++nodeSeq).padStart(4, '0')
    const px = gpsToPixel(lat, lng)
    const node = { id, name: '', x: px.x, y: px.y, roadId, roadName }
    nodes.push(node)
    nodeById.set(id, node)
    nodeKeyMap.set(key, id)
    return id
  }

  const edges = [] // {from, to, distance, type, roadId, roadName}
  const waySeqs = [] // 每条 way 的有序节点ID序列（连通性修复用）
  let roadSeq = 0
  for (const w of walkable) {
    const roadId = 'r' + (++roadSeq)
    const roadName = `景区${roadSeq}路`
    const pts = densify(w.geom, spacing)
    const seq = pts.map(p => getOrCreateNode(p.lat, p.lng, roadId, roadName))
    waySeqs.push(seq)
    for (let i = 0; i < seq.length - 1; i++) {
      const fromId = seq[i], toId = seq[i + 1]
      if (fromId === toId) continue
      const a = nodeById.get(fromId)
      const b = nodeById.get(toId)
      const dx = b.x - a.x, dy = b.y - a.y
      const dist = pxToM(Math.sqrt(dx * dx + dy * dy))
      edges.push({ from: fromId, to: toId, distance: Math.max(1, dist), type: w.type, roadId, roadName })
    }
  }
  console.log(`[import] 基础网络: ${nodes.length} 节点, ${edges.length} 边, ${roadSeq} 条路`)

  // ====== 6.5 连通性修复：way 端点吸附到邻近不同路的节点 ======
  // OSM 不同 way 在路口往往不共享节点，密化后端点落在其他 way 边附近却无法连通；
  // 对每个 way 的首尾端点找最近的不同路节点，阈值内加跨接边（捕捉 T/十字路口）。
  const ENDPOINT_SNAP_PX = 22  // ~7.8m，略大于密化间距/2，捕捉路口；远小于并行路间距
  let crossEdges = 0
  const edgeExists = (a, b) => edges.some(e =>
    (e.from === a && e.to === b) || (e.from === b && e.to === a))
  for (const seq of waySeqs) {
    if (seq.length < 1) continue
    for (const epId of [seq[0], seq[seq.length - 1]]) {
      const ep = nodeById.get(epId)
      if (!ep || !ep.roadId) continue
      let bestId = null, bestD = ENDPOINT_SNAP_PX
      for (const n of nodes) {
        if (!n.roadId || n.roadId === ep.roadId) continue  // 跳过同路，避免环路假连接
        const d = Math.hypot(n.x - ep.x, n.y - ep.y)
        if (d < bestD) { bestD = d; bestId = n.id }
      }
      if (bestId && !edgeExists(epId, bestId)) {
        const tgt = nodeById.get(bestId)
        const dist = Math.max(1, pxToM(Math.hypot(tgt.x - ep.x, tgt.y - ep.y)))
        edges.push({ from: epId, to: bestId, distance: dist, type: 'side', roadId: 'r-cross', roadName: '路口连接' })
        crossEdges++
      }
    }
  }
  console.log(`[import] 连通性修复: 跨接 ${crossEdges} 条路口边`)

  // ====== 6.6 兜底连通：按分量最近邻桥接 ======
  // 端点吸附后仍可能残留小分量（如检票口所在的短 way 离主网 >22px）；
  // 迭代地把每个非主分量用最近节点对桥接到主分量，直到全部并入或超出上限。
  function componentsOf() {
    const adj2 = new Map(nodes.map(n => [n.id, []]))
    for (const e of edges) { adj2.get(e.from)?.push(e.to); adj2.get(e.to)?.push(e.from) }
    const comp = new Map()
    let c = 0
    const sizes = []
    for (const n of nodes) {
      if (comp.has(n.id)) continue
      c++
      let size = 0
      const stack = [n.id]
      while (stack.length) {
        const id = stack.pop()
        if (comp.has(id)) continue
        comp.set(id, c)
        size++
        for (const nb of (adj2.get(id) || [])) if (!comp.has(nb)) stack.push(nb)
      }
      sizes.push(size)
    }
    return { comp, sizes }
  }
  const BRIDGE_PX = 240  // ~86m 兜底桥接上限：OSM 在路口/广场常有 50-80m 空白，需覆盖以连通主路网
  let bridgeEdges = 0
  for (let iter = 0; iter < 12; iter++) {
    const { comp, sizes } = componentsOf()
    if (sizes.length <= 1) break
    // 主分量 = 最大
    let mainComp = 1, mainSize = 0
    sizes.forEach((sz, i) => { if (sz > mainSize) { mainSize = sz; mainComp = i + 1 } })
    // 每个非主分量：找离主分量最近的节点对，加一条桥
    const nonMainByComp = new Map()
    for (const n of nodes) {
      const c = comp.get(n.id)
      if (c === mainComp) continue
      if (!nonMainByComp.has(c)) nonMainByComp.set(c, [])
      nonMainByComp.get(c).push(n)
    }
    let added = 0
    for (const members of nonMainByComp.values()) {
      let bestN = null, bestId = null, bestD = BRIDGE_PX
      for (const n of members) {
        for (const m of nodes) {
          if (comp.get(m.id) !== mainComp) continue
          const d = Math.hypot(m.x - n.x, m.y - n.y)
          if (d < bestD) { bestD = d; bestN = n; bestId = m.id }
        }
      }
      if (bestId && !edgeExists(bestN.id, bestId)) {
        const tgt = nodeById.get(bestId)
        const dist = Math.max(1, pxToM(Math.hypot(tgt.x - bestN.x, tgt.y - bestN.y)))
        edges.push({ from: bestN.id, to: bestId, distance: dist, type: 'side', roadId: 'r-bridge', roadName: '连接步道' })
        bridgeEdges++
        added++
      }
    }
    if (added === 0) break
  }
  console.log(`[import] 兜底桥接: ${bridgeEdges} 条`)

  // ====== 7. B 混合：手画网络 stairs/bridge 语义投射 ======
  let hybridCount = 0
  if (existsSync(MANUAL_PATH)) {
    const manual = JSON.parse(readFileSync(MANUAL_PATH, 'utf8'))
    const mNode = new Map((manual.nodes || []).map(n => [n.id, n]))
    const sbEdges = (manual.edges || []).filter(e => e.type === 'stairs' || e.type === 'bridge')
    for (const me of sbEdges) {
      const a = mNode.get(me.from), b = mNode.get(me.to)
      if (!a || !b) continue
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      // 找最近 OSM 边（按边中点）
      let best = -1, bestD = Infinity
      for (let i = 0; i < edges.length; i++) {
        const na = nodes.find(n => n.id === edges[i].from)
        const nb = nodes.find(n => n.id === edges[i].to)
        if (!na || !nb) continue
        const ex = (na.x + nb.x) / 2, ey = (na.y + nb.y) / 2
        const d = Math.hypot(ex - mx, ey - my)
        if (d < bestD) { bestD = d; best = i }
      }
      if (best >= 0 && bestD <= 25) { // 25px ≈ 15m
        edges[best].type = me.type
        hybridCount++
      }
    }
    console.log(`[import] B 混合: 投射 ${hybridCount}/${sbEdges.length} 条 stairs/bridge 语义`)
  } else {
    console.log('[import] 未找到 .manual.json，跳过 stairs/bridge 混合')
  }

  // ====== 8. 烘焙地标名：手画网络命名节点 → 最近 OSM 节点 ======
  let namedCount = 0
  if (existsSync(MANUAL_PATH)) {
    const manual = JSON.parse(readFileSync(MANUAL_PATH, 'utf8'))
    const named = (manual.nodes || []).filter(n => n.name && n.name.trim())
    for (const ln of named) {
      // 找最近 OSM 节点
      let best = -1, bestD = Infinity
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i].x - ln.x, nodes[i].y - ln.y)
        if (d < bestD) { bestD = d; best = i }
      }
      if (best >= 0 && bestD <= 40) { // 40px ≈ 24m
        if (!nodes[best].name) nodes[best].name = ln.name
        namedCount++
      } else {
        // OSM 附近无节点：注入一个锚点节点并连到最近 OSM 节点
        const id = 'N' + String(++nodeSeq).padStart(4, '0')
        const anchor = { id, name: ln.name, x: ln.x, y: ln.y, roadId: 'r-anchor', roadName: '景区步道' }
        nodes.push(anchor)
        if (best >= 0) {
          const target = nodes[best]
          const dist = Math.max(1, pxToM(Math.hypot(target.x - ln.x, target.y - ln.y)))
          edges.push({ from: id, to: target.id, distance: dist, type: 'side', roadId: 'r-anchor', roadName: '景区步道' })
        }
        namedCount++
      }
    }
    console.log(`[import] 烘焙地标名: ${namedCount}/${named.length}`)
  }

  // ====== 边类型分布 ======
  const typeDist = {}
  for (const e of edges) typeDist[e.type] = (typeDist[e.type] || 0) + 1
  console.log(`[import] 边类型分布: ${JSON.stringify(typeDist)}`)

  // ====== 输出 ======
  const out = {
    version: '4.0-osm',
    imageWidth: MAP_W,
    imageHeight: MAP_H,
    nodes,
    edges,
  }
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8')
  console.log(`[import] 写出: ${OUT_PATH}`)
  console.log(`[import] 完成: ${nodes.length} 节点, ${edges.length} 边, ${roadSeq} 路`)
}

main().catch(e => {
  console.error('[import] 失败:', e)
  process.exit(1)
})
