/**
 * AR 识别插件层 —— 类型定义
 *
 * 本文件定义 AR 插件内部流转所需的全部数据结构。
 * AR 插件对外只暴露公共方法，不直接依赖现有页面组件。
 */

/** AR 识别结果 */
export interface ARRecognitionResult {
  /** 景点 ID（与 spots.ts 中的 id 对应） */
  spotId: string
  /** 景点名称 */
  spotName: string
  /** 置信度 0~1 */
  confidence: number
  /** 识别到的场景描述 */
  description: string
  /** 识别时间戳（毫秒） */
  timestamp: number
}

/** AR 叠加卡片数据 */
export interface AROverlayCard {
  /** 卡片唯一标识 */
  id: string
  /** 关联景点 ID */
  spotId: string
  /** 景点名称 */
  spotName: string
  /** 简短描述（悬浮标签展示） */
  shortDesc: string
  /** 完整描述（展开卡片时展示，可选） */
  fullDesc?: string
  /** 置信度 0~1 */
  confidence: number
  /** 屏幕横坐标（相对于视频容器左上角） */
  x: number
  /** 屏幕纵坐标（相对于视频容器左上角） */
  y: number
  /** 是否可见 */
  visible: boolean
}

/** 知识库上下文（从 spots.ts 拉取的完整景点信息） */
export interface KnowledgeContext {
  spotId: string
  spotName: string
  fullDesc: string
  locationInfo: string
  tips: string
  time: string
}

/** AR 运行状态 */
export type ARStatus = 'idle' | 'loading' | 'recognizing' | 'recognized' | 'error'

/**
 * 资源句柄 —— 统一回收机制的抽象。
 * 每个被注册的资源（摄像头、流、请求、定时器、缓存）都封装为此结构，
 * 由 ARExitManager 统一追踪并在退出时一次性释放。
 */
export interface ResourceHandle {
  /** 资源类型 */
  type: 'camera' | 'stream' | 'request' | 'timer' | 'cache'
  /** 资源唯一标识 */
  id: string
  /** 释放该资源的回调（同步或异步均可） */
  dispose: () => void
}

// ===== 性能监控相关 =====
export interface PerformanceMetrics {
  fps: number
  recognitionLatency: number
  memoryUsage: number
  requestSuccessRate: number
  cpuLoadEstimate: number
  timestamp: number
}

// ===== 设备分级相关 =====
export type DeviceTier = 'high' | 'medium' | 'low'

export interface AdaptiveARParams {
  cameraWidth: number
  cameraHeight: number
  targetFps: number
  frameMaxWidth: number
  jpegQuality: number
  recognitionInterval: number
  enableBackdropFilter: boolean
  enableAnimation: boolean
  maxOverlayCards: number
}

// ===== 手势交互相关 =====
export type GestureType = 'pan' | 'pinch' | 'rotate' | 'doubleTap' | 'longPress'

export interface TransformState {
  translateX: number
  translateY: number
  scale: number
  rotation: number
}

// ===== 会话管理相关 =====
export type SessionState = 'created' | 'active' | 'paused' | 'resumed' | 'destroyed' | 'error'

// ===== 增强识别结果 =====
export interface ARTrackingState {
  spotId: string | null
  lastSeenTimestamp: number
  consecutiveMatches: number
  trackingQuality: number  // 0-1, 跟踪质量分数
}

// ===== P2.3 光照估计 =====
export interface ARLightEstimate {
  /** 平均亮度 0-255 */
  brightness: number
  /** 色温（开尔文K值），暖光~3000K，日光~5500K，冷光~7500K */
  colorTemperature: number
  /** 主光源方向X分量（-1~1，正值=光源在右） */
  lightDirectionX: number
  /** 主光源方向Y分量（-1~1，正值=光源在下） */
  lightDirectionY: number
  /** 估计时间戳 */
  timestamp: number
}

// ===== AI增强AR功能类型 =====

/** 智能物体识别结果 */
export interface SmartObjectInfo {
  /** 物体名称 */
  name: string
  /** 物体类型（建筑/雕塑/植物/标志物等） */
  type: string
  /** 物体描述 */
  description: string
  /** 属性键值对 */
  attributes: Record<string, string>
  /** 相关文化历史知识 */
  knowledge: string
}

/** 智能识别响应 */
export interface SmartRecognizeResult {
  /** 识别到的物体列表 */
  objects: SmartObjectInfo[]
  /** 场景整体描述 */
  scene_summary: string
  /** 推荐的AR交互动作列表 */
  recommended_actions: string[]
}

/** 场景理解生成的AR内容 */
export interface SceneContent {
  /** AR场景解说文案 */
  narration: string
  /** 画面亮点位置 */
  highlight_points: Array<{
    name: string
    x: number
    y: number
    content: string
  }>
  /** 推荐游览路线 */
  recommended_route: string
  /** 互动建议列表 */
  interaction_suggestions: string[]
  /** 文化背景 */
  cultural_context: string
}

/** 用户意图预测建议 */
export interface IntentSuggestion {
  /** 建议类型: guide/navigate/qa/photo */
  type: string
  /** 建议标题 */
  title: string
  /** 建议动作 */
  action: string
  /** 优先级（数字越大优先级越高） */
  priority: number
}

/** 意图预测结果 */
export interface IntentPrediction {
  /** 预测的用户意图 */
  predicted_intent: string
  /** 预测置信度 0-1 */
  confidence: number
  /** 推荐交互建议列表 */
  suggestions: IntentSuggestion[]
  /** 推荐下一景点 */
  next_spot: string
  /** 个性化提示 */
  personalized_tip: string
}

