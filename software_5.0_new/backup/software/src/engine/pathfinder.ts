/**
 * 路网寻路引擎 —— A* 算法
 *
 * 核心保证：
 * 1. 路径必须沿路网边行走，不可能"穿墙而过"
 * 2. 支持多停靠点连续规划
 * 3. 支持路线偏好权重（最短 / 景观优先 / 无障碍）
 * 4. 像素坐标 → 实际距离转换
 */

import {
  getAdjacencyList,
  getNodeById,
  getSpotNodes,
  findNearestNode,
  findNodeByName,
  getAllEdges,
  getNeighbors,
  type RoadNode,
  type RoadEdge
} from './roadNetwork'

// ==================== 类型 ====================

export interface RoutePreferences {
  /** 路线偏好 */
  mode: 'shortest' | 'scenic' | 'accessible'
  /** 自定义边权重乘数，map[边类型] = 乘数 */
  weightMultipliers?: Partial<Record<RoadEdge['type'], number>>
}

export interface RouteStep {
  /** 途经节点ID序列 */
  nodeIds: string[]
  /** 总距离（米） */
  totalDistance: number
  /** 预估步行时间（分钟，按 80m/min 计算） */
  estimatedMinutes: number
  /** 路段详情 */
  segments: RouteSegment[]
  /** 是否由偏好模式降级到最短路径（老年人路线无可达路径时回退） */
  degraded?: boolean
}

export interface RouteSegment {
  fromNodeId: string
  toNodeId: string
  fromName: string
  toName: string
  distance: number
  edgeType: RoadEdge['type']
  /** 所属道路 id（按路合并后填充） */
  roadId?: string
  /** 所属道路名，如"景区1路"（导航横条显示"沿X路走Y米"） */
  roadName?: string
  /** 本路段覆盖的节点序列（含首尾，用于 SVG 渲染当前段） */
  nodeIds?: string[]
  /** 转弯方向（相对上一段的角度变化） */
  turnDirection?: 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'u-turn'
  /** 转弯提示 */
  turnInstruction?: string
}

export interface MultiStopRoute {
  /** 完整节点ID序列（去重合并） */
  path: string[]
  /** 总距离（米） */
  totalDistance: number
  /** 总预估时间（分钟） */
  totalMinutes: number
  /** 每段路线 */
  legs: RouteStep[]
  /** 是否任一段发生降级 */
  degraded?: boolean
  /** 备选路线（距离稍远但偏好不同） */
  alternatives?: RouteStep[]
}

/** 像素坐标点 */
export interface PixelPoint { x: number; y: number }

// ==================== 权重计算 ====================

const DEFAULT_WEIGHTS: Record<RoadEdge['type'], number> = {
  'main':     1.0,   // 主干道 — 标准权重
  'side':     1.0,   // 支路
  'stairs':   1.0,   // 台阶 — 年轻人视为普通通路，走真正最短路径
  'bridge':   1.0,   // 桥梁 — 视为普通通路，不额外惩罚（坡度由独立台阶边体现）
  'covered':  1.0,   // 廊道 — 标准权重（年轻人按纯最短路径规划）
}

const SCENIC_WEIGHTS: Record<RoadEdge['type'], number> = {
  'main':     1.2,
  'side':     0.8,   // 支路往往更有景观
  'stairs':   2.0,
  'bridge':   0.7,   // 桥上观景好
  'covered':  0.6,   // 廊道景观好
}

const ACCESSIBLE_WEIGHTS: Record<RoadEdge['type'], number> = {
  'main':     1.0,
  'side':     1.0,
  'stairs':   Infinity,  // 禁止台阶
  'bridge':   1.0,   // 桥面平坦，不额外惩罚；真正的障碍是台阶
  'covered':  1.0,
}

function getEdgeWeight(edge: RoadEdge, prefs: RoutePreferences): number {
  const base =
    prefs.weightMultipliers?.[edge.type] ??
    (prefs.mode === 'scenic' ? SCENIC_WEIGHTS[edge.type] :
     prefs.mode === 'accessible' ? ACCESSIBLE_WEIGHTS[edge.type] :
     DEFAULT_WEIGHTS[edge.type])
  return base * edge.distance
}

/**
 * 按年龄推导路线偏好（年龄个性化路线）
 *
 * - 年龄缺失（null/undefined）→ 默认最短路径
 * - ≥60 岁 → 无障碍模式：不再用权重软惩罚（曾导致为避台阶而远绕），
 *           改由 findAccessibleRoute 做「有界绕行」——先取与年轻人一致的最短路径，
 *           仅当其含台阶、且存在不远的无台阶替代（≤1.4×）时才换路线，
 *           否则照走最短路径并提示含台阶。
 * - <60 岁 → 默认最短路径（台阶/桥/廊道均不额外惩罚，走真正最短）
 */
export function ageToPrefs(age: number | null | undefined): RoutePreferences {
  if (age == null) return { mode: 'shortest' }
  if (age >= 60) return { mode: 'accessible' }
  return { mode: 'shortest' }
}

// ==================== A* 算法 ====================

interface AStarNode {
  id: string
  g: number       // 起点到当前点的实际代价
  h: number       // 当前点到终点的启发式估计
  f: number       // g + h
  parent: string | null
  edge: RoadEdge | null
}

/**
 * A* 搜索：从 startId 到 endId 的最优路径
 * 
 * @returns 路径节点ID序列 + 总距离，若不可达返回 null
 */
function aStar(
  startId: string,
  endId: string,
  prefs: RoutePreferences = { mode: 'shortest' }
): { path: string[]; distance: number; edges: RoadEdge[] } | null {

  const adj = getAdjacencyList()
  const startNode = getNodeById(startId)
  const endNode = getNodeById(endId)
  if (!startNode || !endNode) return null
  if (startId === endId) return { path: [startId], distance: 0, edges: [] }

  const openMap = new Map<string, AStarNode>()
  const closed = new Set<string>()
  const parentMap = new Map<string, { parentId: string; edge: RoadEdge }>()

  // 启发函数
  function heuristic(fromId: string): number {
    const n = getNodeById(fromId)
    if (!n) return 0
    const dx = n.x - endNode!.x
    const dy = n.y - endNode!.y
    return Math.sqrt(dx * dx + dy * dy) / 2.8
  }

  const start: AStarNode = {
    id: startId,
    g: 0,
    h: heuristic(startId),
    f: 0,
    parent: null,
    edge: null,
  }
  start.f = start.g + start.h
  openMap.set(startId, start)

  while (openMap.size > 0) {
    let current: AStarNode | null = null
    let currentId = ''
    let minF = Infinity
    // 用 for...of 而非 forEach：TS 能跟踪闭包外的赋值，避免 current 被收窄为 never
    for (const [id, node] of openMap) {
      if (node.f < minF) { minF = node.f; current = node; currentId = id }
    }
    if (!current) break

    // 到达终点 → 重建路径
    if (currentId === endId) {
      const path: string[] = []
      const pathEdges: RoadEdge[] = []
      let stepId: string = endId
      while (stepId !== startId) {
        path.unshift(stepId)
        const parent = parentMap.get(stepId)
        if (!parent) break
        if (parent.edge) pathEdges.unshift(parent.edge)
        stepId = parent.parentId
      }
      path.unshift(startId)
      const distance = pathEdges.reduce((sum, e) => sum + e.distance, 0)
      return { path, distance, edges: pathEdges }
    }

    openMap.delete(currentId)
    closed.add(currentId)

    // 扩展邻居
    const neighbors = adj.get(currentId) || []
    for (const { neighborId, edge } of neighbors) {
      if (closed.has(neighborId)) continue
      // 注意：不再对 accessible 模式硬跳过台阶——改为交给权重决定：
      // weightMultipliers 提供有限值时台阶可通行（软惩罚），Infinity 时由下方 isFinite 跳过（硬禁）

      const weight = getEdgeWeight(edge, prefs)
      if (!isFinite(weight)) continue

      const tentativeG = current.g + weight
      const existing = openMap.get(neighborId)

      if (!existing || tentativeG < existing.g) {
        const h = heuristic(neighborId)
        parentMap.set(neighborId, { parentId: currentId, edge })
        if (existing) {
          existing.g = tentativeG
          existing.f = tentativeG + h
          existing.parent = currentId
          existing.edge = edge
        } else {
          openMap.set(neighborId, {
            id: neighborId,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: currentId,
            edge,
          })
        }
      }
    }
  }

  return null
}

// ==================== 高层API ====================

/** 由路径节点序列构造路线结果（统一估算距离/时长/分段） */
function buildStep(path: string[], degraded: boolean): RouteStep {
  const edges = rebuildEdgesFromPath(path)
  const segments = buildSegments(path, edges)
  const totalDist = segments.reduce((sum, s) => sum + s.distance, 0)
  return {
    nodeIds: path,
    totalDistance: totalDist,
    estimatedMinutes: Math.ceil(totalDist / 80),
    segments,
    degraded,
  }
}

// ==================== 近平手优先走桥（年轻人） ====================

/** 桥偏好阈值（米）：含桥最短路和纯最短路相差不超过此值时，优先走桥 */
const BRIDGE_NEAR_TIE_THRESHOLD = 5

/**
 * 单源 Dijkstra 最短树：返回 source 到所有可达节点的加权距离与前驱。
 * 与 aStar 同风格（线性取最小，节点规模 ~900 足够快）。
 * 用于「近平手优先走桥」——需同时知道起点/终点两端到桥边端点的距离。
 */
function dijkstraTree(
  source: string,
  prefs: RoutePreferences,
): { dist: Map<string, number>; prev: Map<string, string | null>; prevEdge: Map<string, RoadEdge | null> } | null {
  if (!getNodeById(source)) return null
  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()
  const prevEdge = new Map<string, RoadEdge | null>()
  dist.set(source, 0)
  prev.set(source, null)
  prevEdge.set(source, null)

  const open = new Set<string>([source])
  const closed = new Set<string>()
  while (open.size > 0) {
    // 取 open 中 dist 最小者（线性扫描，与 aStar 一致）
    let u = ''
    let best = Infinity
    for (const id of open) {
      const d = dist.get(id) ?? Infinity
      if (d < best) { best = d; u = id }
    }
    if (!isFinite(best)) break
    open.delete(u)
    closed.add(u)
    for (const { neighborId, edge } of getNeighbors(u)) {
      if (closed.has(neighborId)) continue
      const weight = getEdgeWeight(edge, prefs)
      if (!isFinite(weight)) continue
      const nd = best + weight
      if (nd < (dist.get(neighborId) ?? Infinity)) {
        dist.set(neighborId, nd)
        prev.set(neighborId, u)
        prevEdge.set(neighborId, edge)
        open.add(neighborId)
      }
    }
  }
  return { dist, prev, prevEdge }
}

/** 从最短树中重建 root→target 的路径与边序列 */
function reconstructPath(
  tree: { dist: Map<string, number>; prev: Map<string, string | null>; prevEdge: Map<string, RoadEdge | null> },
  root: string,
  target: string,
): { path: string[]; edges: RoadEdge[] } | null {
  if (!tree.dist.has(target)) return null
  const path: string[] = []
  const edges: RoadEdge[] = []
  let cur: string | null = target
  while (cur !== null && cur !== root) {
    path.unshift(cur)
    const pe = tree.prevEdge.get(cur)
    if (pe) edges.unshift(pe)
    cur = tree.prev.get(cur) ?? null
  }
  if (cur !== root) return null
  path.unshift(root)
  return { path, edges }
}

/**
 * 「近平手优先走桥」：在纯最短路之外，再算一条「必经至少一条桥边」的最短路；
 * 若两者距离差 ≤ BRIDGE_NEAR_TIE_THRESHOLD，返回含桥路线，否则返回纯最短。
 *
 * 算法：正/反向各跑一次 Dijkstra 得到 from/to 两端到所有节点的距离，
 * 再遍历所有桥边 (a,b) 取 min(dist(from,a)+len+dist(to,b), dist(from,b)+len+dist(to,a))。
 * 仅在 shortest 模式调用，此时所有边权为 1，距离即米数，与 aStar 返回的 distance 口径一致。
 */
function preferBridgeIfNearTie(
  fromId: string,
  toId: string,
  shortest: { path: string[]; distance: number; edges: RoadEdge[] },
  prefs: RoutePreferences,
): { path: string[]; distance: number; edges: RoadEdge[] } {
  // 纯最短路已过桥，无需替换
  if (shortest.edges.some(e => e.type === 'bridge')) return shortest
  const bridgeEdges = getAllEdges().filter(e => e.type === 'bridge')
  if (bridgeEdges.length === 0) return shortest
  const treeFrom = dijkstraTree(fromId, prefs)
  const treeTo = dijkstraTree(toId, prefs)
  if (!treeFrom || !treeTo) return shortest

  let bestCost = Infinity
  let bestChoice: { a: string; b: string; edge: RoadEdge } | null = null
  for (const e of bridgeEdges) {
    const len = getEdgeWeight(e, prefs) // shortest 模式下 = e.distance（米）
    const fa = treeFrom.dist.get(e.from) ?? Infinity
    const fb = treeFrom.dist.get(e.to) ?? Infinity
    const ta = treeTo.dist.get(e.from) ?? Infinity
    const tb = treeTo.dist.get(e.to) ?? Infinity
    // 两种走向：from→a，桥 a→b，b→to
    const c1 = fa + len + tb   // from→e.from，桥 e.from→e.to，e.to→to
    const c2 = fb + len + ta   // from→e.to，桥 e.to→e.from，e.from→to
    if (c1 < bestCost) { bestCost = c1; bestChoice = { a: e.from, b: e.to, edge: e } }
    if (c2 < bestCost) { bestCost = c2; bestChoice = { a: e.to, b: e.from, edge: e } }
  }
  if (!bestChoice) return shortest
  // 仅当含桥路线与纯最短路近平手时才采纳
  if (bestCost - shortest.distance > BRIDGE_NEAR_TIE_THRESHOLD) return shortest

  // 重建路径：from→a（正向树）+ 桥边 a→b + b→to（反向树反转得 b→to）
  const fwd = reconstructPath(treeFrom, fromId, bestChoice.a)   // [from,...,a]
  const bwd = reconstructPath(treeTo, toId, bestChoice.b)       // [to,...,b]
  if (!fwd || !bwd) return shortest
  const bwdRev = bwd.path.slice().reverse()                     // [b,...,to]
  const bwdEdgesRev = bwd.edges.slice().reverse()
  const path = [...fwd.path, ...bwdRev]                         // [from,...,a,b,...,to]
  const edges = [...fwd.edges, bestChoice.edge, ...bwdEdgesRev]
  return { path, distance: bestCost, edges }
}

/**
 * 计算两点间路径
 */
export function findRoute(
  fromNodeId: string,
  toNodeId: string,
  prefs: RoutePreferences = { mode: 'shortest' }
): RouteStep | null {
  // 老年人个性化：改用「有界绕行」策略，避免软惩罚导致的远绕
  if (prefs.mode === 'accessible') {
    return findAccessibleRoute(fromNodeId, toNodeId)
  }

  const result = aStar(fromNodeId, toNodeId, prefs)
  // 不可达降级：偏好模式下若无可达路径，回退到最短路径
  if (!result && prefs.mode !== 'shortest') {
    const fallback = aStar(fromNodeId, toNodeId, { mode: 'shortest' })
    if (!fallback) return null
    return buildStep(fallback.path, true)
  }
  if (!result) return null
  // 年轻人（shortest 模式）：与含桥最短路比较，近平手时优先走桥
  if (prefs.mode === 'shortest') {
    const bridged = preferBridgeIfNearTie(fromNodeId, toNodeId, result, prefs)
    return buildStep(bridged.path, false)
  }
  return buildStep(result.path, false)
}

/**
 * 老年人路线（有界绕行策略）：
 * 1) 先取与年轻人一致的最短路径；若不含台阶，直接用（同路线）。
 * 2) 若含台阶，尝试找无台阶替代（台阶硬禁）；仅当替代距离 ≤ 最短的 1.4 倍时采纳。
 * 3) 替代太远或不存在 → 照走最短路径，标记 degraded 提示含台阶。
 * 这样老年人只在「代价不大」时才绕开台阶，不会为避台阶而远绕。
 */
function findAccessibleRoute(fromNodeId: string, toNodeId: string): RouteStep | null {
  const MAX_DETOUR = 1.4 // 无台阶替代最多比最短路径长 40% 才采纳
  const shortest = aStar(fromNodeId, toNodeId, { mode: 'shortest' })
  if (!shortest) return null
  const hasStairs = shortest.edges.some(e => e.type === 'stairs')
  if (!hasStairs) return buildStep(shortest.path, false)
  const alt = aStar(fromNodeId, toNodeId, { mode: 'shortest', weightMultipliers: { stairs: Infinity } })
  if (alt && alt.distance <= shortest.distance * MAX_DETOUR) {
    return buildStep(alt.path, false)
  }
  return buildStep(shortest.path, true)
}

/**
 * 连续多停靠点路线规划
 * 
 * @param waypointIds 途经路网节点ID列表
 * @param prefs 路线偏好
 */
export function findMultiStopRoute(
  waypointIds: string[],
  prefs: RoutePreferences = { mode: 'shortest' }
): MultiStopRoute | null {
  if (waypointIds.length < 2) return null

  const legs: RouteStep[] = []
  let totalDist = 0
  let degraded = false
  const allPath: string[] = []

  for (let i = 0; i < waypointIds.length - 1; i++) {
    const leg = findRoute(waypointIds[i], waypointIds[i + 1], prefs)
    if (!leg) return null  // 某段不可达

    if (leg.degraded) degraded = true

    // 合并路径（去重连接点）
    if (allPath.length > 0 && allPath[allPath.length - 1] === leg.nodeIds[0]) {
      allPath.push(...leg.nodeIds.slice(1))
    } else {
      allPath.push(...leg.nodeIds)
    }
    legs.push(leg)
    totalDist += leg.totalDistance
  }

  return {
    path: allPath,
    totalDistance: totalDist,
    totalMinutes: Math.ceil(totalDist / 80),
    legs,
    degraded,
  }
}

/**
 * 根据景点ID规划路线
 * 
 * 自动将景点ID映射到最近路网节点，然后调用 A*。
 */
export function findRouteBySpots(
  fromSpotId: string,
  toSpotId: string,
  prefs: RoutePreferences = { mode: 'shortest' }
): RouteStep | null {
  const fromNodes = getSpotNodes(fromSpotId)
  const toNodes = getSpotNodes(toSpotId)

  // 起点无映射 → 退到检票口；终点无映射 → 无法导航
  const fromId = fromNodes.length > 0 ? fromNodes[0] : findNodeByName('检票口')?.id
  const toId = toNodes.length > 0 ? toNodes[0] : ''
  if (!fromId || !toId) return null

  return findRoute(fromId, toId, prefs)
}

/**
 * 多景点路线（用景点ID）
 */
export function findMultiStopRouteBySpots(
  spotIds: string[],
  prefs: RoutePreferences = { mode: 'shortest' }
): MultiStopRoute | null {
  const nodeIds: string[] = []
  for (const spotId of spotIds) {
    const nodes = getSpotNodes(spotId)
    if (nodes.length > 0) {
      nodeIds.push(nodes[0])
    } else {
      // 尝试按名称查找
      const found = findNodeForSpot(spotId)
      if (found) nodeIds.push(found)
    }
  }
  if (nodeIds.length < 2) return null
  return findMultiStopRoute(nodeIds, prefs)
}

function findNodeForSpot(spotId: string): string | null {
  // 尝试直接匹配节点ID
  const direct = getNodeById(spotId)
  if (direct) return direct.id
  // 尝试名称部分匹配
  for (const n of []) { /* no fallback for now */ }
  return null
}

// ==================== 内部工具 ====================

/** 从路径节点序列重建边列表 */
function rebuildEdgesFromPath(path: string[]): RoadEdge[] {
  const adj = getAdjacencyList()
  const edgeList: RoadEdge[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const neighbors = adj.get(path[i]) || []
    const found = neighbors.find(n => n.neighborId === path[i + 1])
    if (found) {
      edgeList.push(found.edge)
    } else {
      // 边不存在——不应该发生
      edgeList.push({ from: path[i], to: path[i + 1], distance: estimateDist(path[i], path[i + 1]), type: 'side' })
    }
  }
  return edgeList
}

/** 估算两点间距离（像素 → 米） */
function estimateDist(fromId: string, toId: string): number {
  const a = getNodeById(fromId)
  const b = getNodeById(toId)
  if (!a || !b) return 50
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.round(Math.sqrt(dx * dx + dy * dy) / 2.8)
}

/**
 * 从路径生成路段描述：按 roadId 合并连续同路边的为一条"沿景区N路走Xm"指令。
 *
 * 486 节点的 OSM 路网若逐边输出会有上百段，无法供人类使用；
 * 按 roadId 合并后整条游览路线通常只剩 ~20-40 条"沿某路走X米"指令。
 * 无 roadId 的边（旧手绘网络回退）退化为逐边路段。
 */
function buildSegments(path: string[], edges: RoadEdge[]): RouteSegment[] {
  if (path.length < 2 || edges.length === 0) return []
  const segments: RouteSegment[] = []

  // 1. 按连续 roadId 分组（roadId 缺失时每边自成一组，即旧逐边行为）
  interface Group { roadId: string; roadName: string; edgeIdxs: number[] }
  const groups: Group[] = []
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    const rid = e.roadId ?? `__edge_${i}`
    const rname = e.roadName ?? ''
    const last = groups[groups.length - 1]
    if (last && last.roadId === rid) {
      last.edgeIdxs.push(i)
    } else {
      groups.push({ roadId: rid, roadName: rname, edgeIdxs: [i] })
    }
  }

  // 2. 每组生成一个合并路段
  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g]
    const firstIdx = grp.edgeIdxs[0]
    const lastIdx = grp.edgeIdxs[grp.edgeIdxs.length - 1]
    const fromNode = getNodeById(path[firstIdx])
    const toNode = getNodeById(path[lastIdx + 1])

    // 段内距离累加 + 主导边类型
    let distance = 0
    const typeCount: Record<string, number> = {}
    for (const ei of grp.edgeIdxs) {
      const e = edges[ei]
      distance += e.distance
      typeCount[e.type] = (typeCount[e.type] || 0) + 1
    }
    const edgeType = (Object.keys(typeCount).sort((a, b) => typeCount[b] - typeCount[a])[0] || 'side') as RoadEdge['type']

    // 段内节点序列（含首尾，供 SVG 渲染当前段高亮）
    const nodeIds: string[] = []
    for (let k = firstIdx; k <= lastIdx + 1; k++) nodeIds.push(path[k])

    // 转弯方向：进入本段路口处，相对上一段行进方向的变化
    let turnDirection: RouteSegment['turnDirection'] = 'straight'
    if (g > 0) {
      const prev = getNodeById(path[firstIdx - 1])
      const curr = fromNode
      const next = getNodeById(path[firstIdx + 1])
      if (prev && curr && next) {
        turnDirection = calcTurn(prev, curr, next)
      }
    }

    // 指令文本：有路名→"沿景区N路走X米"；无路名→退化为转弯提示
    const distM = Math.max(1, Math.round(distance))
    let turnInstruction: string
    if (grp.roadName) {
      turnInstruction = `沿${grp.roadName}走${distM}米`
    } else {
      turnInstruction = turnToText(turnDirection, toNode?.name || '')
    }

    segments.push({
      fromNodeId: path[firstIdx],
      toNodeId: path[lastIdx + 1],
      fromName: fromNode?.name || path[firstIdx],
      toName: toNode?.name || path[lastIdx + 1],
      distance: distM,
      edgeType,
      roadId: grp.roadName ? grp.roadId : undefined,
      roadName: grp.roadName || undefined,
      nodeIds,
      turnDirection,
      turnInstruction,
    })
  }

  // 合并过短段（路口跨接边 1-5m）到前一段，减少噪音指令
  const merged: RouteSegment[] = []
  for (const seg of segments) {
    const prev = merged[merged.length - 1]
    if (prev && seg.distance <= 5) {
      prev.distance += seg.distance
      prev.toNodeId = seg.toNodeId
      prev.toName = seg.toName
      prev.nodeIds = (prev.nodeIds || []).concat((seg.nodeIds || []).slice(1))
    } else {
      merged.push({ ...seg })
    }
  }
  return merged
}

/** 计算转弯方向 */
function calcTurn(
  prev: RoadNode,
  curr: RoadNode,
  next: RoadNode
): RouteSegment['turnDirection'] {
  // 向量：prev→curr 和 curr→next
  const v1 = { x: curr.x - prev.x, y: curr.y - prev.y }
  const v2 = { x: next.x - curr.x, y: next.y - curr.y }

  // 叉积判断左右
  const cross = v1.x * v2.y - v1.y * v2.x
  // 点积判断角度
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
  const cosAngle = dot / (mag1 * mag2)
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI

  if (angle < 10) return 'straight'
  if (angle > 150) return 'u-turn'
  if (cross > 0) return angle < 45 ? 'slight-left' : 'left'
  return angle < 45 ? 'slight-right' : 'right'
}

function turnToText(dir: RouteSegment['turnDirection'], targetName: string): string {
  switch (dir) {
    case 'left': return `左转，前往${targetName}`
    case 'right': return `右转，前往${targetName}`
    case 'slight-left': return `稍向左转，前往${targetName}`
    case 'slight-right': return `稍向右转，前往${targetName}`
    case 'u-turn': return `掉头，前往${targetName}`
    default: return `直行，前往${targetName}`
  }
}

// ==================== 路径→SVG渲染数据 ====================

/**
 * 将路径节点转为 SVG polyline points 字符串
 */
export function pathToSVGPoints(nodeIds: string[]): string {
  return nodeIds
    .map(id => {
      const n = getNodeById(id)
      return n ? `${n.x},${n.y}` : ''
    })
    .filter(s => s)
    .join(' ')
}

/**
 * 将路径转为像素坐标点数组
 */
export function pathToPixelPoints(nodeIds: string[]): PixelPoint[] {
  return nodeIds
    .map(id => {
      const n = getNodeById(id)
      return n ? { x: n.x, y: n.y } : null
    })
    .filter((p): p is PixelPoint => p !== null)
}

/**
 * 提取路径上途经的地标节点（name 非空的节点），保持顺序，去重相邻同名。
 * 用于路线模式在导航页展示"途经景区名"。
 */
export function getLandmarksOnPath(nodeIds: string[]): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = []
  let lastName = ''
  for (const id of nodeIds) {
    const n = getNodeById(id)
    if (!n || !n.name) continue
    if (n.name === lastName) continue
    result.push({ id: n.id, name: n.name })
    lastName = n.name
  }
  return result
}

// ==================== 导出 ====================

export { aStar as _aStarTest }
