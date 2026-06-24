/**
 * 灵山景区路网数据模块
 * 
 * 数据来源：可视化路网编辑器手工标注，JSON 文件位于 src/data/lingshan-road-network.json
 * 地图尺寸：1677 × 1920 像素
 * 
 * 路网保证：所有边均基于手绘地图实际道路标注，A* 算法只能在边上行走，
 * 绝不可能出现"穿墙而过"的路径。
 */

import roadNetworkData from '@/data/lingshan-road-network.json'

export interface RoadNode {
  id: string
  name: string
  x: number
  y: number
}

export interface RoadEdge {
  from: string
  to: string
  distance: number   // 步行距离（米）
  type: 'main' | 'side' | 'stairs' | 'bridge' | 'covered'
}

export interface RoadNetwork {
  imageWidth: number
  imageHeight: number
  nodes: RoadNode[]
  edges: RoadEdge[]
}

/** 邻接表：nodeId → [{ neighborId, edge }] */
type AdjacencyList = Map<string, { neighborId: string; edge: RoadEdge }[]>

// ==================== 单例加载 ====================

let _network: RoadNetwork | null = null
let _adjacency: AdjacencyList | null = null
let _nodeMap: Map<string, RoadNode> | null = null

function loadNetwork(): RoadNetwork {
  if (_network) return _network
  _network = roadNetworkData as unknown as RoadNetwork
  // 修正 edges 中可能缺少 type 的情况
  _network.edges.forEach(e => { if (!e.type) (e as any).type = 'side' })
  return _network
}

/** 获取完整路网数据 */
export function getRoadNetwork(): RoadNetwork {
  return loadNetwork()
}

/** 获取图片尺寸 */
export function getMapSize(): { width: number; height: number } {
  const n = loadNetwork()
  return { width: n.imageWidth, height: n.imageHeight }
}

/** 通过ID获取节点 */
export function getNodeById(id: string): RoadNode | undefined {
  if (!_nodeMap) {
    _nodeMap = new Map()
    loadNetwork().nodes.forEach(n => _nodeMap!.set(n.id, n))
  }
  return _nodeMap.get(id)
}

/** 获取所有节点 */
export function getAllNodes(): RoadNode[] {
  return loadNetwork().nodes
}

/** 获取所有边 */
export function getAllEdges(): RoadEdge[] {
  return loadNetwork().edges
}

/** 获取邻接表（有向，每条无向边拆成两条有向边） */
export function getAdjacencyList(): AdjacencyList {
  if (_adjacency) return _adjacency
  _adjacency = new Map()
  const network = loadNetwork()

  // 初始化所有节点
  network.nodes.forEach(n => _adjacency!.set(n.id, []))

  // 每条无向边 → 两条有向邻接记录
  network.edges.forEach(e => {
    const listA = _adjacency!.get(e.from)
    const listB = _adjacency!.get(e.to)
    if (listA) listA.push({ neighborId: e.to, edge: e })
    if (listB) listB.push({ neighborId: e.from, edge: e })
  })

  return _adjacency
}

/** 获取节点的邻居列表 */
export function getNeighbors(nodeId: string): { neighborId: string; edge: RoadEdge }[] {
  return getAdjacencyList().get(nodeId) || []
}

// ==================== 景点→路网节点映射 ====================

/**
 * 景点名 → 路网中对应的中文节点名
 * getSpotNodes() 自动从路网中按名称匹配节点ID
 */
const SPOT_NAME_MAP: Record<string, string> = {
  'ticket-gate':    '检票口',
  'tourist-center': '游客中心',
  'holiday-plaza':  '检票口',
  'guide-service':  '检票口',
  'bridge-1':       '桥',
  'puti-dadao':     '菩提大道',
  'futan':          '佛足坛',
  'jiulong':        '九龙灌浴',
  'wuyin':          '五印坛城',
  'scenic-exit':    '景区出口',
  'fangong':        '灵山梵宫',
  'palm':           '灵山佛手',
  'jile-lifo':      '祈年殿',
  'qifu':           '祈年殿',
  'manfeilong':     '飞龙塔',
  'talong':         '飞龙塔',
  'jingshe':        '灵山精舍',
  'sushi':          '蔬食馆',
  'baizi':          '百子戏弥勒',
  'xiangfu':        '祥符禅寺',
  'shengshi':       '祥符禅寺',
  'xingtan':        '杏坛广场',
  'buddha':         '灵山大佛',
  'buddha-base':    '佛',
  'wujinyi':        '杏坛广场',
  'fojiao':         '佛',
  'fangsheng':      '九龙灌浴',
}

/** 根据景点ID获取候选路网节点ID（按名称模糊匹配） */
export function getSpotNodes(spotId: string): string[] {
  const name = SPOT_NAME_MAP[spotId]
  if (!name) return []
  return getAllNodes()
    .filter(n => n.name.includes(name))
    .map(n => n.id)
}

/** 根据中文名查找路网节点 */
export function findNodeByName(name: string): RoadNode | undefined {
  return getAllNodes().find(n => n.name === name || n.name.includes(name))
}

/** 根据节点名称模糊查找 */
export function findNodesByName(name: string): RoadNode[] {
  const lower = name.toLowerCase()
  return getAllNodes().filter(n => n.name.toLowerCase().includes(lower))
}

/** 找到距离某坐标最近的路网节点 */
export function findNearestNode(x: number, y: number): RoadNode | null {
  const nodes = getAllNodes()
  if (nodes.length === 0) return null
  let best = nodes[0]
  let bestDist = Infinity
  nodes.forEach(n => {
    const dx = n.x - x
    const dy = n.y - y
    const d = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; best = n }
  })
  return best
}
