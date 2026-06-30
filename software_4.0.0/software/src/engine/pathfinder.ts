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
}

export interface RouteSegment {
  fromNodeId: string
  toNodeId: string
  fromName: string
  toName: string
  distance: number
  edgeType: RoadEdge['type']
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
  /** 备选路线（距离稍远但偏好不同） */
  alternatives?: RouteStep[]
}

/** 像素坐标点 */
export interface PixelPoint { x: number; y: number }

// ==================== 权重计算 ====================

const DEFAULT_WEIGHTS: Record<RoadEdge['type'], number> = {
  'main':     1.0,   // 主干道 — 标准权重
  'side':     1.0,   // 支路
  'stairs':   1.8,   // 台阶 — 较费力
  'bridge':   1.2,   // 桥梁 — 稍费力（可能有坡度）
  'covered':  0.9,   // 廊道 — 遮阳挡雨，偏好
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
  'bridge':   1.5,
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
    openMap.forEach((node, id) => {
      if (node.f < minF) { minF = node.f; current = node; currentId = id }
    })
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
      if (prefs.mode === 'accessible' && edge.type === 'stairs') continue

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

/**
 * 计算两点间路径
 */
export function findRoute(
  fromNodeId: string,
  toNodeId: string,
  prefs: RoutePreferences = { mode: 'shortest' }
): RouteStep | null {
  const result = aStar(fromNodeId, toNodeId, prefs)
  if (!result) return null

  const edges = rebuildEdgesFromPath(result.path)
  const segments = buildSegments(result.path, edges)
  const totalDist = segments.reduce((sum, s) => sum + s.distance, 0)

  return {
    nodeIds: result.path,
    totalDistance: totalDist,
    estimatedMinutes: Math.ceil(totalDist / 80),
    segments,
  }
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
  const allPath: string[] = []

  for (let i = 0; i < waypointIds.length - 1; i++) {
    const leg = findRoute(waypointIds[i], waypointIds[i + 1], prefs)
    if (!leg) return null  // 某段不可达

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
  
  // 如果没有精确映射，用检票口作为起点
  const fromId = fromNodes.length > 0 ? fromNodes[0] : 'n4'
  const toId = toNodes.length > 0 ? toNodes[0] : 'n20'

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

/** 从路径生成路段描述 */
function buildSegments(path: string[], edges: RoadEdge[]): RouteSegment[] {
  const segments: RouteSegment[] = []

  for (let i = 0; i < path.length - 1; i++) {
    const fromNode = getNodeById(path[i])
    const toNode = getNodeById(path[i + 1])
    const edge = edges[i]

    const seg: RouteSegment = {
      fromNodeId: path[i],
      toNodeId: path[i + 1],
      fromName: fromNode?.name || path[i],
      toName: toNode?.name || path[i + 1],
      distance: edge?.distance || 50,
      edgeType: edge?.type || 'side',
    }

    // 计算转弯方向
    if (i > 0) {
      const prev = getNodeById(path[i - 1])
      const curr = fromNode
      const next = toNode
      if (prev && curr && next) {
        seg.turnDirection = calcTurn(prev, curr, next)
        seg.turnInstruction = turnToText(seg.turnDirection, seg.toName)
      }
    }

    segments.push(seg)
  }

  return segments
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

// ==================== 导出 ====================

export { aStar as _aStarTest }
