// 端到端路由验证：用真实 OSM 数据跑 A*，对比 shortest vs elderly（台阶×8/桥×4）
// 验证：①主干地标可达 ②老年人路线尽量规避台阶/桥 ③按 roadId 合并后指令数 << 节点数
import { readFileSync } from 'node:fs'

const net = JSON.parse(readFileSync(new URL('../src/data/lingshan-road-network.json', import.meta.url), 'utf8'))
const PX_PER_M = 2.8

// 邻接表
const adj = new Map()
for (const n of net.nodes) adj.set(n.id, [])
for (const e of net.edges) {
  adj.get(e.from).push({ neighborId: e.to, edge: e })
  adj.get(e.to).push({ neighborId: e.from, edge: e })
}
const nodeMap = new Map(net.nodes.map(n => [n.id, n]))
const getNode = id => nodeMap.get(id)

// 权重
const DEFAULT_W = { main: 1.0, side: 1.0, stairs: 1.8, bridge: 1.2, covered: 0.9 }
const ACCESSIBLE_W = { main: 1.0, side: 1.0, stairs: Infinity, bridge: 1.5, covered: 1.0 }
function edgeWeight(edge, prefs) {
  const base = prefs.weightMultipliers?.[edge.type]
    ?? (prefs.mode === 'accessible' ? ACCESSIBLE_W[edge.type] : DEFAULT_W[edge.type])
  return base * edge.distance
}

// A*
function aStar(startId, endId, prefs) {
  if (startId === endId) return { path: [startId], edges: [] }
  const open = new Map()
  const closed = new Set()
  const parent = new Map()
  const endN = getNode(endId)
  const heur = id => { const n = getNode(id); return Math.hypot(n.x - endN.x, n.y - endN.y) / PX_PER_M }
  open.set(startId, { id: startId, g: 0, h: heur(startId), f: 0 })
  open.get(startId).f = heur(startId)
  while (open.size) {
    let cur = null, curId = ''
    let minF = Infinity
    for (const [id, nd] of open) if (nd.f < minF) { minF = nd.f; cur = nd; curId = id }
    if (curId === endId) {
      const path = [], edges = []
      let s = endId
      while (s !== startId) {
        path.unshift(s)
        const p = parent.get(s); if (!p) break
        if (p.edge) edges.unshift(p.edge)
        s = p.parentId
      }
      path.unshift(startId)
      return { path, edges }
    }
    open.delete(curId); closed.add(curId)
    for (const { neighborId, edge } of (adj.get(curId) || [])) {
      if (closed.has(neighborId)) continue
      const w = edgeWeight(edge, prefs)
      if (!isFinite(w)) continue
      const tg = cur.g + w
      const ex = open.get(neighborId)
      if (!ex || tg < ex.g) {
        parent.set(neighborId, { parentId: curId, edge })
        const h = heur(neighborId)
        if (ex) { ex.g = tg; ex.f = tg + h }
        else open.set(neighborId, { id: neighborId, g: tg, h, f: tg + h })
      }
    }
  }
  return null
}

// 按 roadId 合并段（含过短段并入前段，与 pathfinder.buildSegments 一致）
function buildSegments(path, edges) {
  if (!edges.length) return []
  const groups = []
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    const rid = e.roadId ?? `__e${i}`
    const last = groups[groups.length - 1]
    if (last && last.roadId === rid) last.idxs.push(i)
    else groups.push({ roadId: rid, roadName: e.roadName ?? '', idxs: [i] })
  }
  const segs = groups.map(g => {
    let dist = 0, types = {}
    for (const ei of g.idxs) { dist += edges[ei].distance; types[edges[ei].type] = (types[edges[ei].type] || 0) + 1 }
    const dominant = Object.keys(types).sort((a, b) => types[b] - types[a])[0]
    return { roadName: g.roadName, distance: Math.max(1, Math.round(dist)), edges: g.idxs.length, dominant }
  })
  // 合并过短段到前段
  const merged = []
  for (const s of segs) {
    const prev = merged[merged.length - 1]
    if (prev && s.distance <= 5) { prev.distance += s.distance }
    else merged.push({ ...s })
  }
  return merged
}

function nameToId(nm) { for (const n of net.nodes) if (n.name && n.name.includes(nm)) return n.id; return null }

const fromId = nameToId('检票口')
const toId = nameToId('灵山大佛')
console.log(`起点 检票口=${fromId}，终点 灵山大佛=${toId}`)

const PREFS = {
  shortest: { mode: 'shortest' },
  elderly: { mode: 'accessible', weightMultipliers: { stairs: 8, bridge: 4 } },
}

for (const [label, prefs] of Object.entries(PREFS)) {
  const r = aStar(fromId, toId, prefs)
  if (!r) { console.log(`[${label}] 不可达！`); continue }
  const dist = r.edges.reduce((s, e) => s + e.distance, 0)
  const stairs = r.edges.filter(e => e.type === 'stairs').length
  const bridge = r.edges.filter(e => e.type === 'bridge').length
  const segs = buildSegments(r.path, r.edges)
  console.log(`\n[${label}] 路径节点=${r.path.length} 总距离=${Math.round(dist)}m 台阶边=${stairs} 桥边=${bridge}`)
  console.log(`[${label}] 合并指令数=${segs.length}（节点 ${r.path.length} → ${segs.length} 段）`)
  console.log(`[${label}] 前 8 段: ${segs.slice(0, 8).map(s => `${s.roadName||'步道'}(${s.distance}m,${s.dominant})`).join(' → ')}`)
}

// 验证全部 18 个地标从检票口可达
console.log(`\n[地标可达性] 从检票口出发：`)
const named = net.nodes.filter(n => n.name).map(n => n.name)
const uniqNames = [...new Set(named)]
let reachable = 0
for (const nm of uniqNames) {
  const tid = nameToId(nm)
  const r = aStar(fromId, tid, PREFS.elderly)
  if (r) {
    const dist = r.edges.reduce((s, e) => s + e.distance, 0)
    const stairs = r.edges.filter(e => e.type === 'stairs').length
    const bridge = r.edges.filter(e => e.type === 'bridge').length
    console.log(`  ✓ ${nm}: ${Math.round(dist)}m, 台阶${stairs}/桥${bridge}`)
    reachable++
  } else {
    console.log(`  ✗ ${nm}: 不可达`)
  }
}
console.log(`[地标可达性] ${reachable}/${uniqNames.length} 可达`)

// 额外：统计网络连通分量
const visited = new Set()
const compOf = new Map()
let comps = 0
const compSizes = []
for (const n of net.nodes) {
  if (visited.has(n.id)) continue
  comps++
  const stack = [n.id]
  let size = 0
  while (stack.length) {
    const id = stack.pop()
    if (visited.has(id)) continue
    visited.add(id)
    compOf.set(id, comps)
    size++
    for (const { neighborId } of (adj.get(id) || [])) if (!visited.has(neighborId)) stack.push(neighborId)
  }
  compSizes.push(size)
}
console.log(`\n[网络] 节点=${net.nodes.length} 边=${net.edges.length} 连通分量=${comps}`)
console.log(`[网络] 分量大小(降序): ${compSizes.sort((a,b)=>b-a).join(', ')}`)
console.log(`[网络] 检票口(N0472) 所在分量大小: ${compSizes[compOf.get('N0472')-1]}`)
console.log(`[网络] 灵山大佛(N0060) 所在分量大小: ${compSizes[compOf.get('N0060')-1]}`)

// 诊断：每个非主分量到主分量的最近距离
const mainComp = compOf.get('N0060') // 用大佛所在分量作参考（若它是主分量）
// 找最大分量
let mainC = 1, mainSz = 0
compSizes.forEach((s, i) => { if (s > mainSz) { mainSz = s; mainC = i + 1 } })
const mainNodes = net.nodes.filter(n => compOf.get(n.id) === mainC)
const nonMainComps = [...new Set([...compOf.values()])].filter(c => c !== mainC)
console.log(`\n[诊断] 主分量#${mainC} 大小=${mainSz}，非主分量到主分量最近距离：`)
for (const c of nonMainComps) {
  const members = net.nodes.filter(n => compOf.get(n.id) === c)
  let minD = Infinity, who = null
  for (const n of members) for (const m of mainNodes) {
    const d = Math.hypot(m.x - n.x, m.y - n.y)
    if (d < minD) { minD = d; who = n.id }
  }
  console.log(`  分量#${c} 大小=${members.length} → 最近距 ${minD.toFixed(0)}px (${(minD/2.8).toFixed(0)}m) @ ${who}`)
}
