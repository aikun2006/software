/**
 * 灵山景区路网数据模块
 * 
 * 数据来源：OpenStreetMap (Overpass API) 真实路网几何 + 手绘台阶/桥语义叠加，
 * 由 scripts/import-osm.mjs 生成，JSON 文件位于 src/data/lingshan-road-network.json
 * 地图尺寸：1677 × 1920 像素
 * 
 * 路网保证：所有边均基于真实道路几何，A* 算法只能在边上行走，
 * 绝不可能出现"穿墙而过"的路径。每个节点/边归属一条"景区N路"，
 * 导航指令按 roadId 合并以保持人类可读的步骤数。
 */

import roadNetworkData from '@/data/lingshan-road-network.json'

export interface RoadNode {
  id: string
  name: string
  x: number
  y: number
  roadId?: string    // 所属道路 id（OSM 导入后填充，如 "r1"）
  roadName?: string  // 所属道路名（如 "景区1路"）
}

export interface RoadEdge {
  from: string
  to: string
  distance: number   // 步行距离（米）
  type: 'main' | 'side' | 'stairs' | 'bridge' | 'covered'
  roadId?: string    // 所属道路 id（OSM 导入后填充）
  roadName?: string  // 所属道路名（按路合并导航指令时使用）
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

/** 编辑器覆盖数据在 storage 中的键（存在则优先于打包 JSON 生效） */
const NETWORK_OVERRIDE_KEY = 'lingshan-road-network-override-v4'

let _network: RoadNetwork | null = null
let _adjacency: AdjacencyList | null = null
let _nodeMap: Map<string, RoadNode> | null = null

function loadNetwork(): RoadNetwork {
  if (_network) return _network
  // 优先使用编辑器保存的覆盖数据（运行时可由节点编辑器更新）
  const stored = typeof uni !== 'undefined' ? uni.getStorageSync(NETWORK_OVERRIDE_KEY) : ''
  if (stored) {
    try { _network = JSON.parse(stored) as RoadNetwork } catch { _network = null }
  }
  if (!_network) {
    _network = roadNetworkData as unknown as RoadNetwork
    // 修正 edges 中可能缺少 type 的情况
    _network.edges.forEach(e => { if (!e.type) (e as any).type = 'side' })
  }
  return _network
}

/**
 * 运行时注入/撤销一份路网覆盖数据，并清空邻接表/节点Map缓存。
 * 节点编辑器保存后调用，使导航/地图页立即使用编辑后的网络。
 * 传 null 撤销覆盖（应先清除 storage，否则下次 loadNetwork 会重新读回）。
 */
export function setNetworkOverride(data: RoadNetwork | null): void {
  _network = data
  _adjacency = null
  _nodeMap = null
}

/** 从 storage 读取覆盖数据并应用（编辑器保存后调用） */
export function applyStoredOverride(): void {
  const stored = typeof uni !== 'undefined' ? uni.getStorageSync(NETWORK_OVERRIDE_KEY) : ''
  if (!stored) { setNetworkOverride(null); return }
  try { setNetworkOverride(JSON.parse(stored) as RoadNetwork) } catch { setNetworkOverride(null) }
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
 * 景点ID → 路网中对应的中文节点名（可配多个别名，命中其一即可）
 * 别名用于兼容同一景点的不同写法（如 梵足坛/佛足坛、曼飞龙塔/飞龙塔）。
 * 注意：不要把一个景点的别名设成另一个景点的节点名，否则会匹配到错误节点。
 */
const SPOT_NAME_MAP: Record<string, string[]> = {
  'ticket-gate':    ['检票口'],
  'tourist-center': ['游客中心'],
  'holiday-plaza':  ['假日广场'],          // 原代理到「检票口」→ 会导航到检票口
  'guide-service':  ['导游服务'],           // 原代理到「检票口」
  'bridge-1':       ['桥'],
  'puti-dadao':     ['菩提大道'],
  'futan':          ['梵足坛', '佛足坛'],    // 景点名与路网名两种写法都认
  'jiulong':        ['九龙灌浴'],
  'wuyin':          ['五印坛城'],
  'scenic-exit':    ['景区出口'],
  'fangong':        ['灵山梵宫'],
  'palm':           ['灵山佛手'],
  'jile-lifo':      ['极乐礼佛'],           // 原代理到「祈年殿」→ 会导航到错误地点
  'qifu':           ['祈福普缘'],           // 原代理到「祈年殿」
  'manfeilong':     ['曼飞龙塔', '飞龙塔', '曼龙飞塔'],  // 同一塔的多种写法（含用户编辑时的笔误）
  'talong':         ['灵山多宝塔', '多宝塔'], // 原代理到「飞龙塔」→ 与曼飞龙塔撞同一节点
  'jingshe':        ['灵山精舍'],
  'sushi':          ['蔬食馆'],
  'baizi':          ['百子戏弥勒'],
  'xiangfu':        ['祥符禅寺'],
  'shengshi':       ['盛凡斋'],             // 原代理到「祥符禅寺」
  'xingtan':        ['杏坛广场'],
  'buddha':         ['灵山大佛'],
  'buddha-base':    ['佛座'],
  'wujinyi':        ['无尽意斋'],
  'fojiao':         ['佛教文化'],
  'fangsheng':      ['放生礼佛'],           // 原代理到「九龙灌浴」→ 会导航到错误地点
}

/** 根据景点ID获取候选路网节点ID（按名称模糊匹配，命中任一别名即可） */
export function getSpotNodes(spotId: string): string[] {
  const names = SPOT_NAME_MAP[spotId]
  if (!names || names.length === 0) return []
  return getAllNodes()
    .filter(n => n.name && names.some(nm => n.name.includes(nm)))
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
