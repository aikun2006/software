/**
 * 实时导航引擎
 *
 * 状态机：[IDLE] → [NAVIGATING] → [PAUSED] → [COMPLETED]
 *                         ↓
 *                    [OFF_ROUTE] → [REROUTING] → [NAVIGATING]
 *
 * 功能：
 * 1. 沿规划路线追踪用户位置
 * 2. 偏航检测 + 自动重规划
 * 3. 距离/ETA 计算
 * 4. 转弯提示
 */

import { findRoute, type RouteStep, type RouteSegment, type RoutePreferences } from './pathfinder'
import { getNodeById, findNearestNode, type RoadNode } from './roadNetwork'

// ==================== 类型 ====================

export type NavState = 'IDLE' | 'NAVIGATING' | 'PAUSED' | 'OFF_ROUTE' | 'REROUTING' | 'COMPLETED'

export interface NavProgress {
  state: NavState
  /** 当前最近的路径节点ID */
  currentNodeId: string
  /** 当前路段索引（在 segments 数组中的位置） */
  currentSegmentIndex: number
  /** 已走距离（米） */
  distanceTraveled: number
  /** 剩余距离（米） */
  distanceRemaining: number
  /** 总距离（米） */
  totalDistance: number
  /** 预估剩余时间（分钟） */
  etaMinutes: number
  /** 进度百分比 (0-100) */
  progressPercent: number
  /** 下一个转弯点（路段终点） */
  nextTurn?: {
    nodeName: string
    distance: number
    instruction: string
  }
}

export interface NavConfig {
  /** 偏航检测阈值（米） */
  offRouteThreshold: number
  /** 转弯提示距离（米） */
  turnAlertDistance: number
  /** 到达终点距离（米） */
  arrivalDistance: number
}

const DEFAULT_CONFIG: NavConfig = {
  offRouteThreshold: 25,
  turnAlertDistance: 30,
  arrivalDistance: 15,
}

// ==================== 引擎 ====================

export class NavigationEngine {
  private config: NavConfig
  private route: RouteStep | null = null
  private state: NavState = 'IDLE'
  private currentNodeId = ''
  private currentSegIdx = 0
  private distTraveled = 0
  private lastPixelPos: { x: number; y: number } | null = null
  /** 路线偏好（偏航重规划时复用，保持年龄个性化一致） */
  private prefs: RoutePreferences = { mode: 'shortest' }
  /** 节点ID → 所属路段索引（合并段后，路径节点不再与路段一一对应，需显式映射） */
  private segNodeMap: Map<string, number> = new Map()

  // 回调
  private onProgress?: (p: NavProgress) => void
  private onOffRoute?: () => void
  private onArrive?: () => void
  private onReroute?: (newRoute: RouteStep) => void

  constructor(config?: Partial<NavConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ---- 公开API ----

  /** 设置路线并开始导航 */
  startRoute(route: RouteStep) {
    this.route = route
    this.state = 'NAVIGATING'
    this.currentNodeId = route.nodeIds[0]
    this.currentSegIdx = 0
    this.distTraveled = 0
    this.lastPixelPos = null
    this.buildSegNodeMap()
  }

  /** 设置路线偏好（偏航重规划时复用） */
  setPreferences(prefs: RoutePreferences) {
    this.prefs = prefs
  }

  /** 暂停/恢复 */
  togglePause() {
    if (this.state === 'NAVIGATING') this.state = 'PAUSED'
    else if (this.state === 'PAUSED') this.state = 'NAVIGATING'
  }

  /** 停止导航 */
  stop() {
    this.state = 'IDLE'
    this.route = null
    this.lastPixelPos = null
  }

  /** 获取当前路线 */
  getRoute(): RouteStep | null { return this.route }

  /** 获取当前状态 */
  getState(): NavState { return this.state }

  // ---- 回调注册 ----

  setCallbacks(cbs: {
    onProgress?: (p: NavProgress) => void
    onOffRoute?: () => void
    onArrive?: () => void
    onReroute?: (newRoute: RouteStep) => void
  }) {
    this.onProgress = cbs.onProgress
    this.onOffRoute = cbs.onOffRoute
    this.onArrive = cbs.onArrive
    this.onReroute = cbs.onReroute
  }

  // ---- 核心：处理 GPS 位置更新 ----

  /**
   * 接收 GPS 像素坐标，更新导航状态
   * 
   * @param px 当前 GPS 位置投影到地图像素的坐标
   * @returns 当前进度
   */
  updatePosition(px: { x: number; y: number }): NavProgress {
    if (this.state === 'IDLE' || this.state === 'COMPLETED' || !this.route) {
      return this.buildProgress()
    }

    if (this.state === 'PAUSED') {
      return this.buildProgress()
    }

    // 1. 找路径上最近的节点
    const nearest = this.findNearestOnPath(px)
    if (!nearest) {
      this.lastPixelPos = px
      return this.buildProgress()
    }

    this.currentNodeId = nearest.nodeId
    this.currentSegIdx = nearest.segIdx

    // 2. 计算已走距离
    if (this.lastPixelPos) {
      const dx = px.x - this.lastPixelPos.x
      const dy = px.y - this.lastPixelPos.y
      const pixelDist = Math.sqrt(dx * dx + dy * dy)
      this.distTraveled += pixelDist / 2.8 // 像素→米
    }
    this.lastPixelPos = px

    // 3. 计算到路径的偏移距离
    const offsetDist = nearest.distance / 2.8
    if (offsetDist > this.config.offRouteThreshold) {
      this.state = 'OFF_ROUTE'
      this.onOffRoute?.()
      // 自动重规划
      this.reroute(px)
    } else if (this.state === 'OFF_ROUTE') {
      this.state = 'NAVIGATING'
    }

    // 4. 检查到达
    const remaining = (this.route.totalDistance || 1) - this.distTraveled
    if (remaining <= this.config.arrivalDistance) {
      this.state = 'COMPLETED'
      this.distTraveled = this.route.totalDistance
      this.onArrive?.()
    }

    const progress = this.buildProgress()
    this.onProgress?.(progress)
    return progress
  }

  // ---- 内部 ----

  private findNearestOnPath(px: { x: number; y: number }): {
    nodeId: string; segIdx: number; distance: number
  } | null {
    if (!this.route) return null
    const path = this.route.nodeIds

    let bestNodeId = path[0]
    let bestDist = Infinity

    for (let i = 0; i < path.length; i++) {
      const node = getNodeById(path[i])
      if (!node) continue
      const dx = node.x - px.x
      const dy = node.y - px.y
      const d = dx * dx + dy * dy
      if (d < bestDist) {
        bestDist = d
        bestNodeId = path[i]
      }
    }

    // 合并段后路径节点不再与路段一一对应：用预建的 segNodeMap 定位所属路段
    const segIdx = this.segNodeMap.get(bestNodeId) ?? 0
    return { nodeId: bestNodeId, segIdx, distance: Math.sqrt(bestDist) }
  }

  /** 构建 节点ID→路段索引 映射：段内非末尾节点归属本段，末尾节点归属下一段（到达路口即进入新路） */
  private buildSegNodeMap() {
    this.segNodeMap.clear()
    if (!this.route) return
    const segs = this.route.segments
    for (let s = 0; s < segs.length; s++) {
      const nodes = segs[s].nodeIds || [segs[s].fromNodeId, segs[s].toNodeId]
      for (let k = 0; k < nodes.length - 1; k++) {
        if (!this.segNodeMap.has(nodes[k])) this.segNodeMap.set(nodes[k], s)
      }
    }
    // 最后一段的末尾节点归属最后一段
    const last = segs[segs.length - 1]
    if (last) {
      const lastNodes = last.nodeIds || [last.fromNodeId, last.toNodeId]
      const tail = lastNodes[lastNodes.length - 1]
      if (tail && !this.segNodeMap.has(tail)) this.segNodeMap.set(tail, segs.length - 1)
    }
  }

  private reroute(px: { x: number; y: number }) {
    if (!this.route) return
    this.state = 'REROUTING'

    // 找到最近的路网节点作为新起点
    const nearestNode = findNearestNode(px.x, px.y)
    if (!nearestNode) return

    const endNodeId = this.route.nodeIds[this.route.nodeIds.length - 1]
    const newRoute = findRoute(nearestNode.id, endNodeId, this.prefs)

    if (newRoute) {
      // 累加已走距离
      const traveledBeforeReroute = this.distTraveled
      this.route = newRoute
      this.currentNodeId = newRoute.nodeIds[0]
      this.currentSegIdx = 0
      this.buildSegNodeMap()
      // 保留已走距离
      this.onReroute?.(newRoute)
    }

    this.state = 'NAVIGATING'
  }

  private buildProgress(): NavProgress {
    const totalDist = this.route?.totalDistance || 0
    const distRemain = Math.max(0, totalDist - this.distTraveled)
    const distTraveled = Math.min(this.distTraveled, totalDist)

    // 当前路段的实时指令：沿某路剩余多少米（顶部横条始终展示当前 maneuver）
    let nextTurn: NavProgress['nextTurn'] = undefined
    if (this.route && this.currentSegIdx < this.route.segments.length) {
      const seg = this.route.segments[this.currentSegIdx]
      const segNodes = seg.nodeIds || [seg.fromNodeId, seg.toNodeId]
      // 当前节点在段内的位置
      let pos = segNodes.indexOf(this.currentNodeId)
      if (pos < 0) pos = 0
      // 从当前位置沿段内边到段末的剩余距离（像素→米）
      let remainInSeg = 0
      for (let k = pos; k < segNodes.length - 1; k++) {
        const a = getNodeById(segNodes[k])
        const b = getNodeById(segNodes[k + 1])
        if (a && b) remainInSeg += Math.hypot(b.x - a.x, b.y - a.y) / 2.8
      }
      nextTurn = {
        nodeName: seg.roadName || seg.toName,
        distance: Math.max(0, Math.round(remainInSeg)),
        instruction: seg.turnInstruction || `沿${seg.roadName || '步道'}前行`,
      }
    }

    return {
      state: this.state,
      currentNodeId: this.currentNodeId,
      currentSegmentIndex: this.currentSegIdx,
      distanceTraveled: Math.round(distTraveled),
      distanceRemaining: Math.round(distRemain),
      totalDistance: Math.round(totalDist),
      etaMinutes: Math.ceil(distRemain / 80),
      progressPercent: totalDist > 0 ? Math.min(100, Math.round((distTraveled / totalDist) * 100)) : 0,
      nextTurn,
    }
  }
}

/** 单例 */
export const navEngine = new NavigationEngine()
