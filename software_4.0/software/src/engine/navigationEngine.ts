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

import { findRoute, type RouteStep, type RouteSegment } from './pathfinder'
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
    let bestSegIdx = 0
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
        bestSegIdx = Math.min(i, this.route.segments.length - 1)
      }
    }

    return { nodeId: bestNodeId, segIdx: bestSegIdx, distance: Math.sqrt(bestDist) }
  }

  private reroute(px: { x: number; y: number }) {
    if (!this.route) return
    this.state = 'REROUTING'

    // 找到最近的路网节点作为新起点
    const nearestNode = findNearestNode(px.x, px.y)
    if (!nearestNode) return

    const endNodeId = this.route.nodeIds[this.route.nodeIds.length - 1]
    const newRoute = findRoute(nearestNode.id, endNodeId)

    if (newRoute) {
      // 累加已走距离
      const traveledBeforeReroute = this.distTraveled
      this.route = newRoute
      this.currentNodeId = newRoute.nodeIds[0]
      this.currentSegIdx = 0
      // 保留已走距离
      this.onReroute?.(newRoute)
    }

    this.state = 'NAVIGATING'
  }

  private buildProgress(): NavProgress {
    const totalDist = this.route?.totalDistance || 0
    const distRemain = Math.max(0, totalDist - this.distTraveled)
    const distTraveled = Math.min(this.distTraveled, totalDist)

    // 找下一个转弯
    let nextTurn: NavProgress['nextTurn'] = undefined
    if (this.route && this.currentSegIdx < this.route.segments.length) {
      const seg = this.route.segments[this.currentSegIdx]
      const remainInSeg = 0 // 简化：用到达下一个路段的距离
      if (seg.turnInstruction && remainInSeg < this.config.turnAlertDistance) {
        nextTurn = {
          nodeName: seg.toName,
          distance: Math.round(remainInSeg),
          instruction: seg.turnInstruction,
        }
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
