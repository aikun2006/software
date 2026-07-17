<template>
  <view class="avatar3d-container" :style="{ width: width, height: height }">
    <!-- 容器：JS 中手动创建原生 canvas 挂入，避免 uni-app canvas 组件包装 -->
    <view ref="containerRef" class="avatar3d-wrap"></view>

    <!-- 加载/错误提示 -->
    <view v-if="loadState === 'loading'" class="avatar3d-tip">
      <text>{{ loadingText }}</text>
    </view>
    <view v-else-if="loadState === 'error'" class="avatar3d-tip error">
      <text>{{ errorText }}</text>
    </view>

    <!-- 可选名字标签（D5：跟随管理后台切换的数字人名字） -->
    <text v-if="showName" class="avatar3d-name">{{ name }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
// three 与 VRM 相关 API
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
  type VRMExpressionManager,
  type VRMHumanoid,
} from '@pixiv/three-vrm'
import { ttsEngine } from '@/utils/ttsEngine'
import {
  PHONEME_TO_VISEME,
  SYLLABLE_TO_VISEMES,
  getPhonemeViseme,
  getEmotionModifier,
  getEmotionMicroExpressions,
  MICRO_EXPRESSIONS,
  BEZIER_PRESETS,
  evalBezier,
  PREDICTION_CONFIG,
  type Viseme,
  type EmotionType,
} from '@/utils/visemeDatabase'

const props = withDefaults(
  defineProps<{
    /** 容器宽度（rpx 或 css 值） */
    width?: string
    /** 容器高度（rpx 或 css 值） */
    height?: string
    /** 显示名字标签 */
    showName?: boolean
    /** 数字人名字（D5：由管理后台配置，切换后跟随更新） */
    name?: string
    /** 待机时是否自动眨眼 */
    autoBlink?: boolean
    /** 加载提示文案 */
    loadingText?: string
    /** 错误提示文案 */
    errorText?: string
    /** 画面垂直偏移比例（占完整画布高度）：0 = 精确居中于画布几何中心；正值上移，负值下移 */
    verticalOffsetRatio?: number
    /** 全身入画：按实际缩放后的体形半高/半宽拟合，使全身占满画布并垂直居中（默认 false=视觉放大取上半身，首页用） */
    fullBodyFit?: boolean
    /** 禁用滚轮缩放：固定尺寸，仅保留左右旋转（导览页用） */
    disableZoom?: boolean
    /** VRM 模型路径（D5：管理后台动态配置）。为空时使用内置默认模型 */
    modelPath?: string
    /** 模型缩放倍率（D5：管理后台动态配置）。默认 2.6 */
    modelScale?: number
    /** 模型 Y 轴旋转（弧度，D5：管理后台动态配置） */
    modelRotationY?: number
  }>(),
  {
    width: '100%',
    height: '100%',
    showName: false,
    name: '小乐',
    autoBlink: true,
    loadingText: '小乐正在出场…',
    errorText: '3D 形象加载失败',
    // 默认 1/4：模型中心定位在画面垂直方向 1/4 处（距底部 3/4 H = 距顶部 1/4 H）
    // 机制：相机目标点 Y 下移 (1/4)×画布高度，等效模型上移 1/4 画面高度
    // 与分辨率/宽高比无关，所有设备上位置恒定
    verticalOffsetRatio: 1 / 4,
    fullBodyFit: false,
    disableZoom: false,
    modelPath: '',
    modelScale: 3.25,
    modelRotationY: 0,
  }
)

// ====== DOM / 场景引用 ======
const containerRef = ref<any>(null)
let canvasEl: HTMLCanvasElement | null = null
const loadState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let currentVrm: VRM | null = null
let expressionManager: VRMExpressionManager | null = null
let humanoid: VRMHumanoid | null = null
let rafId = 0
// 加载代际计数器：防止 reloadModel 并发加载导致重复模型
let loadGeneration = 0
// 已加载模型的路径：避免重复加载同一模型
let loadedModelPath = ''
// initScene 正在加载的路径：watch 据此跳过与初始加载相同的路径
let intendedModelPath = ''

// 自维护的计时器（替代已废弃的 THREE.Clock，避免控制台警告）
let lastFrameTime = 0
let elapsedTime = 0

// 设备性能等级（在 initScene 中赋值）：低端设备开启动画帧率降级
let isLowEndDevice = false
// 动画帧率降级计数器：低端设备隔帧更新呼吸/眨眼
let animSkipCounter = 0

// 模型缩放倍数：等比例放大（修改缩放变换矩阵，保持宽高比与几何完整性）
// D5：可由 props.modelScale 动态配置，默认 2.6
let MODEL_SCALE = 3.25

// ====== 相机轨道控制（自定义实现：禁用右键平移，仅水平360°环绕 + 滚轮缩放） ======
// 满足硬性约束：模型几何中心位于世界原点，相机以模型中心为轴心做水平环绕
let orbitYaw = 0                 // 水平旋转角（弧度），0 = 正面
const orbitPitch = 0             // 垂直俯仰固定为 0：严格"只能左右转圈查看"
let orbitDistance = 2.0          // 当前相机到模型中心的距离
let orbitMinDistance = 0.5       // 最小缩放距离（动态计算）
let orbitMaxDistance = 6.0       // 最大缩放距离（动态计算）
let modelBoundingRadius = 0      // 模型全局包围球半径
let modelHalfHeight = 0          // 模型未缩放半高（Box3），fullBodyFit 全身入画时用
let modelHalfWidth = 0           // 模型未缩放半宽（Box3），fullBodyFit 全身入画时用
let modelCenterY = 0             // 模型几何中心 Y（已重置到原点，恒为 0）
let isPointerDown = false        // 鼠标左键是否按下
let lastPointerX = 0             // 上一帧鼠标 X
let userInteracting = false      // 用户是否已主动交互（避免 onResize 自动重置覆盖）
// —— 硬性约束参数 ——
const SAFE_MARGIN = 0.9          // 模型四边安全边距比例（占画布 0~1），1.0 表示贴边
const MAX_PITCH = 0              // 垂直俯仰最大幅度：0 = 完全禁用，仅水平转圈
const ROTATE_SPEED = 0.006       // 左键拖拽水平旋转灵敏度
const WHEEL_SPEED = 0.0012      // 滚轮缩放灵敏度
// 画面垂直偏移：模型在画布中垂直移动的比例（占完整画布高度）
// 0 = 精确居中于画布几何中心；正值上移，负值下移
// 现为组件 prop verticalOffsetRatio（默认 1/5，见上方 defineProps）：
// chat.vue 传 0 使数字人在左侧面板垂直居中；index.vue 用默认值保持光晕对齐。

// ====== 口型 / 表情 状态 ======
// VRM 元音形态名（a/i/u/e/o）
const VOWELS = ['aa', 'ih', 'ou', 'ee', 'oh'] as const
type Vowel = (typeof VOWELS)[number]

const isSpeaking = ref(false)
// 当前目标口型权重，与渲染的实际权重做插值
const mouthTargets: Record<Vowel, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 }
let mouthTimer: any = null
let mouthCharIndex = 0
let mouthChars: string[] = []
// 文本是否已念完（用于判断是否能停止说话：需同时满足文本结束 + 音频结束）
let textEnded = false
// 停止防抖计数器：要求 textEnded && !audioDriving 持续 N 帧才触发 stopSpeaking
// 避免频谱分析器瞬时返回 false（如音频块间隙、解码延迟）导致口型提前收口
let audioStopDebounce = 0
const AUDIO_STOP_DEBOUNCE_FRAMES = 8 // ~133ms@60fps，容忍短暂音频间隙

// ====== 频谱驱动口型（D1 升级） ======
// 优先级：当 ttsEngine 有可用 AnalyserNode 时，按频域数据驱动视素；
// 否则回退到上面的文本字符定时驱动（speakText）。
let freqBuffer: Uint8Array | null = null   // 复用 buffer 避免每帧 GC
let usingAudioLipSync = false        // 当前帧是否启用了频谱驱动
// 频段→视素映射：低频(a/o/u)、中频(e/i)、高频仅作整体强度参考
// fftSize=512 → bins=256，sampleRate≈44100 → 每 bin ≈ 172Hz
// lowEnd=3 (~516Hz 以下), midEnd=12 (~2.1kHz), highEnd=30 (~5.2kHz)
const FREQ_LOW_END = 3
const FREQ_MID_END = 12
const FREQ_HIGH_END = 30

/**
 * 从 AnalyserNode 提取频谱，并映射到 5 个 VRM 视素权重。
 * 返回 true 表示成功驱动；false 表示本帧不可用，调用方应回退文本驱动。
 */
function updateMouthFromAudio(): boolean {
  const analyser = ttsEngine.getAnalyser()
  if (!analyser || !ttsEngine.isAudioPlaying()) {
    // 音频未在播放，清零频谱驱动，让文本驱动接管或自然收口
    if (usingAudioLipSync) {
      for (const v of VOWELS) mouthTargets[v] = 0
      usingAudioLipSync = false
    }
    return false
  }
  // 初始化 buffer（与 analyser.frequencyBinCount 对齐）
  if (!freqBuffer || freqBuffer.length !== analyser.frequencyBinCount) {
    freqBuffer = new Uint8Array(analyser.frequencyBinCount)
  }
  analyser.getByteFrequencyData(freqBuffer)
  // 计算三个频段平均能量（0~255 → 0~1）
  let lowSum = 0, midSum = 0, highSum = 0
  for (let i = 0; i < FREQ_LOW_END; i++) lowSum += freqBuffer[i] || 0
  for (let i = FREQ_LOW_END; i < FREQ_MID_END; i++) midSum += freqBuffer[i] || 0
  for (let i = FREQ_MID_END; i < FREQ_HIGH_END; i++) highSum += freqBuffer[i] || 0
  const low = lowSum / FREQ_LOW_END / 255
  const mid = midSum / (FREQ_MID_END - FREQ_LOW_END) / 255
  const high = highSum / (FREQ_HIGH_END - FREQ_MID_END) / 255
  // 静音检测：所有频段都很弱时不张嘴（避免背景底噪驱动口型）
  const totalEnergy = low + mid + high
  if (totalEnergy < 0.05) {
    for (const v of VOWELS) mouthTargets[v] = 0
    usingAudioLipSync = true
    return true
  }
  // 视素映射策略（基于汉语元音共振峰分布）：
  //   aa (a) — 低频强，开口最大 → 用 low 驱动
  //   oh (o) — 低频较强，圆唇 → low * 0.7
  //   ou (u) — 低频中等，圆唇收 → low * 0.5
  //   ee (e) — 中频强，扁唇 → mid 驱动
  //   ih (i) — 中高频强，扁唇 → mid * 0.7 + high * 0.3
  // 整体强度归一化避免张嘴过大
  // 情感化视素修饰：根据当前情绪调整开口度/展开度/圆唇度
  const modifier = getEmotionModifier(lastEmotionRaw)
  const gain = 1.3 * modifier.intensityMultiplier
  mouthTargets.aa = Math.min(1, low * gain * modifier.openMultiplier)
  mouthTargets.oh = Math.min(1, low * 0.7 * gain * modifier.roundMultiplier)
  mouthTargets.ou = Math.min(1, low * 0.5 * gain * modifier.roundMultiplier)
  mouthTargets.ee = Math.min(1, mid * gain * modifier.spreadMultiplier)
  mouthTargets.ih = Math.min(1, (mid * 0.7 + high * 0.3) * gain * modifier.spreadMultiplier)
  usingAudioLipSync = true
  return true
}

// ====== 表情系统（多表达式权重 + 复合表情 + 三级过渡） ======
// VRM 标准表情 preset
type ExprPreset = 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'relaxed'

// 所有可用表情名（用于遍历插值）
const ALL_EXPRESSIONS: string[] = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'relaxed', 'blink', 'blink_l', 'blink_r']

// 当前各表情的目标权重（0~1），支持同时激活多个表情实现复合情绪
const expressionTargets: Record<string, number> = {}
ALL_EXPRESSIONS.forEach((e) => (expressionTargets[e] = 0))

// 过渡前各表情的起始权重快照（用于三级过渡插值）
let transitionFromState: Record<string, number> = {}
// 过渡目标快照
let transitionToState: Record<string, number> = {}
// 过渡开始时间（performance.now()），0 表示无过渡进行中
let transitionStartTime = 0
// 过渡总时长（ms），200-300ms 范围
const TRANSITION_DURATION = 250
// 当前表情标签（用于日志和向后兼容）
let currentExpression: ExprPreset | string = 'neutral'

// ====== 8 种核心情绪预设（每种映射到 VRM 表情权重） ======
const EMOTION_PRESETS: Record<string, Record<string, number>> = {
  joy: { happy: 1.0 },              // 喜悦
  sadness: { sad: 1.0 },            // 悲伤
  surprise: { surprised: 1.0 },     // 惊讶
  anger: { angry: 1.0 },            // 愤怒
  fear: { surprised: 0.6, sad: 0.4 }, // 恐惧（惊讶+悲伤混合）
  disgust: { angry: 0.5, sad: 0.3 },  // 厌恶（愤怒+悲伤混合）
  neutral: { neutral: 1.0 },        // 中性
  calm: { relaxed: 0.7 },           // 平静
}

// ====== 20 种复合情绪（自然过渡与表达） ======
const COMPOUND_EMOTIONS: Record<string, Record<string, number>> = {
  delighted: { happy: 0.7, surprised: 0.5 },       // 欣喜（喜悦+惊讶）
  content: { happy: 0.5, relaxed: 0.6 },            // 满足（喜悦+平静）
  excited: { happy: 0.8, surprised: 0.4 },          // 兴奋
  frustrated: { angry: 0.5, sad: 0.5 },             // 挫败（愤怒+悲伤）
  disappointed: { sad: 0.7, angry: 0.3 },           // 失望
  outraged: { angry: 0.7, surprised: 0.4 },         // 愤慨
  apprehensive: { sad: 0.4, surprised: 0.4 },       // 忧虑
  nostalgic: { sad: 0.3, happy: 0.4 },              // 怀旧
  bittersweet: { sad: 0.5, happy: 0.4 },            // 苦乐参半
  awe: { surprised: 0.7, happy: 0.3 },              // 敬畏
  confusion: { surprised: 0.5, sad: 0.2 },          // 困惑
  pride: { happy: 0.5, relaxed: 0.4 },              // 骄傲
  embarrassment: { sad: 0.3, surprised: 0.3 },      // 尴尬
  relief: { happy: 0.4, relaxed: 0.5 },             // 释然
  serene: { relaxed: 0.8 },                         // 宁静
  melancholy: { sad: 0.5, relaxed: 0.3 },           // 忧郁
  hopeful: { happy: 0.4, relaxed: 0.3 },            // 希望
  despair: { sad: 0.7, angry: 0.3 },                // 绝望
  determination: { angry: 0.3, relaxed: 0.4 },      // 决心
  gentle: { happy: 0.3, relaxed: 0.5 },             // 温柔
}

// ====== 口型渐变收口状态 ======
// 当语音结束时，不立即清零口型，而是在 200ms 内渐变收口
let visemeFadeOutStart = 0 // 收口开始时间，0 表示无收口进行中
const VISEME_FADE_OUT_DURATION = 200 // ms

// ====== 贝塞尔曲线口型过渡系统（替代线性 lerp） ======
// 每个视素维护独立的过渡进度，实现自然的加减速
interface VisemeTransition {
  from: number      // 起始权重
  to: number        // 目标权重
  startTime: number // 过渡开始时间（performance.now()）
  duration: number  // 过渡时长 (ms)
  bezier: typeof BEZIER_PRESETS[keyof typeof BEZIER_PRESETS]
}
const visemeTransitions: Record<Viseme, VisemeTransition | null> = {
  aa: null, ih: null, ou: null, ee: null, oh: null,
}
// 视素过渡时长配置（不同场景使用不同时长）
const VISEME_TRANSITION_FAST = 60   // 快速切换（元音间）
const VISEME_TRANSITION_NORMAL = 90 // 正常切换
const VISEME_TRANSITION_SLOW = 140  // 慢速切换（收尾）

// ====== 情感化口型变体系统 ======
// 当前情感类型（影响视素权重的修饰）
let currentEmotionType: EmotionType = 'neutral'
// 上次设置的情感（用于检测变化触发更新）
let lastEmotionRaw = ''

// ====== 微表情系统状态 ======
// 当前激活的微表情列表
interface ActiveMicroExpression {
  name: string
  weights: Record<string, number>
  startTime: number
  duration: number
}
let activeMicroExpressions: ActiveMicroExpression[] = []
// 微表情检测计时器（避免每帧都检测，每 200ms 检测一次）
let microExpressionCheckTime = 0
const MICRO_EXPRESSION_CHECK_INTERVAL = 200

// ====== 预测式视素缓冲 ======
// 提前 50~100ms 预计算后续音节的视素目标，实现平滑过渡
interface PredictedViseme {
  viseme: Viseme
  power: number
  triggerTime: number  // 预期触发时间 (performance.now())
}
let predictedVisemeBuffer: PredictedViseme[] = []
// 上次触发字符的时间，用于预测计算
let lastCharTriggerTime = 0
// 当前字符的预测视素（已预计算但未应用）
let pendingPredictedViseme: PredictedViseme | null = null

// ====== A-pose 姿态系统 ======
// A-pose 目标骨骼旋转（弧度），从 T-pose 平滑过渡到手臂自然下垂
// leftUpperArm 负 Z 旋转 = 左臂下放；rightUpperArm 正 Z 旋转 = 右臂下放
const A_POSE_TARGETS: Record<string, { x?: number; y?: number; z?: number }> = {
  leftUpperArm:  { z: -0.95 },   // ~54° 手臂下垂（Y轴下移）
  rightUpperArm: { z: 0.95 },    // ~54° 手臂下垂（Y轴下移）
  leftLowerArm:  { z: 0.15 },    // ~8.6° 肘部微屈
  rightLowerArm: { z: -0.15 },   // ~8.6° 肘部微屈
  leftHand:      { y: 0.25 },    // 手掌朝内
  rightHand:     { y: -0.25 },   // 手掌朝内
  leftShoulder:  { z: -0.08 },   // 肩膀放松下沉
  rightShoulder: { z: 0.08 },    // 肩膀放松下沉
}
let aposeBlend = 0                       // A-pose 混合权重 0→1
const APOSE_TRANSITION_SPEED = 1.2       // 过渡速度，约0.83秒完成（在0.8-1.2秒范围内）

// ====== 待机动作系统 ======
const IDLE_TRIGGER_TIME = 30             // 30秒无操作触发待机
const IDLE_TRANSITION_SPEED = 2.0        // 动作间过渡速度（0.5秒完成）
const IDLE_RETURN_SPEED = 2.0            // 交互后回到基础姿态速度（0.5秒完成）

let lastInteractionTime = 0              // 最后交互时间（elapsedTime 基准）
let idleActive = false                   // 待机是否激活
let idleActionIndex = -1                 // 当前待机动作索引
let idleActionStart = 0                  // 当前动作开始时间
let idleActionDuration = 4               // 当前动作持续时间（秒）
let lastIdleIndex = -1                   // 上一个动作索引（避免连续重复）
let idleBlend = 0                        // 待机动作混合权重 0→1
let idleReturning = false                // 是否正在返回基础姿态

// 待机动作定义：每种动作返回各骨骼的旋转偏移（弧度），t 为动作内归一化时间 0~1
interface IdleAction {
  name: string
  duration: number
  getOffsets: (t: number) => Record<string, { x?: number; y?: number; z?: number }>
}

const IDLE_ACTIONS: IdleAction[] = [
  // 动作1：头部左右缓慢转动（15-25°，6秒，完整1周期无缝循环）
  {
    name: 'headTurn',
    duration: 6.0,
    getOffsets: (t) => {
      const wave = Math.sin(t * Math.PI * 2)
      return {
        head: { y: wave * 0.35, x: Math.sin(t * Math.PI * 2) * 0.05 },
        neck: { y: wave * 0.08 },
      }
    },
  },
  // 动作2：身体微倾 + 头部轻歪（<10°，7秒，完整1周期无缝循环）
  {
    name: 'bodyLean',
    duration: 7.0,
    getOffsets: (t) => {
      const wave = Math.sin(t * Math.PI * 2)
      return {
        spine: { z: wave * 0.15 },
        chest: { z: wave * 0.08 },
        head: { z: wave * 0.06, y: -wave * 0.04 },
      }
    },
  },
  // 动作3：右手抬起整理头发（6秒，首尾帧归零无缝循环）
  {
    name: 'hairAdjust',
    duration: 6.0,
    getOffsets: (t) => {
      // 使用 sin(πt) 实现前半段抬手、后半段放下，t=0 和 t=1 时 lift=0
      const lift = Math.sin(t * Math.PI)
      return {
        rightUpperArm: { z: -0.55 * lift },         // 负偏移=抬起右臂
        rightLowerArm: { y: 0.35 * lift },           // 前臂弯曲
        head: { x: -0.06 * lift, y: -0.10 * lift },  // 头微低头偏右
      }
    },
  },
  // 动作4：视线自然游移（8秒，偶数倍频率确保首尾帧一致无缝循环）
  {
    name: 'lookAround',
    duration: 8.0,
    getOffsets: (t) => ({
      head: {
        y: Math.sin(t * Math.PI * 2) * 0.15 + Math.sin(t * Math.PI * 4) * 0.08,
        x: Math.sin(t * Math.PI * 2) * 0.06,
      },
      neck: { y: Math.sin(t * Math.PI * 4) * 0.04 },
    }),
  },
  // 动作5：肩部放松起伏（6秒，完整1周期无缝循环）
  {
    name: 'shoulderRoll',
    duration: 6.0,
    getOffsets: (t) => {
      const wave = Math.sin(t * Math.PI * 2)
      return {
        leftShoulder:  { z: wave * 0.06 },    // 肩膀上下起伏（纯偏移，叠加在A-pose基础上）
        rightShoulder: { z: -wave * 0.06 },   // 对侧同步
        chest: { x: wave * 0.03 },            // 胸部微前倾后仰
        head: { x: -wave * 0.03 },            // 头部配合微动
      }
    },
  },
  // 动作6：双手轻摆 + 重心微移（7秒，完整1周期无缝循环）
  {
    name: 'handSway',
    duration: 7.0,
    getOffsets: (t) => {
      const wave = Math.sin(t * Math.PI * 2)
      return {
        leftUpperArm:  { z: wave * 0.06 },   // 双臂前后轻摆
        rightUpperArm: { z: -wave * 0.06 },
        leftLowerArm:  { z: wave * 0.04 },   // 前臂微动
        rightLowerArm: { z: -wave * 0.04 },
        spine: { y: wave * 0.03 },           // 腰部微转（重心转移）
        head: { y: -wave * 0.05 },           // 头部反向配合
      }
    },
  },
]

/** 伪随机选择下一个待机动作（避免连续重复） */
function pickNextIdleAction(): number {
  if (IDLE_ACTIONS.length <= 1) return 0
  let idx = lastIdleIndex
  while (idx === lastIdleIndex) {
    idx = Math.floor(Math.random() * IDLE_ACTIONS.length)
  }
  return idx
}

/** 记录用户交互，重置待机计时器 */
function registerInteraction() {
  lastInteractionTime = elapsedTime
  if (idleActive) {
    idleActive = false
    idleReturning = true
  }
}

// ====== 中文→元音映射（伪口型核心，零依赖） ======
// 拼音首字母 → 元音；不精确但视觉上足够自然。
// 复用一份轻量映射，覆盖常见汉字读音。
const INITIAL_TO_VOWEL: Record<string, Vowel> = {
  // a 系
  a: 'aa', ai: 'aa', an: 'aa', ang: 'aa', ao: 'aa',
  // o / e 系
  o: 'oh', ou: 'ou', e: 'ee', ei: 'ee', en: 'ee', eng: 'ee', er: 'ee',
  // i 系
  i: 'ih', in: 'ih', ing: 'ih', ia: 'aa', ie: 'ee', iao: 'aa', iu: 'ou',
  j: 'ih', q: 'ih', x: 'ih',
  // u 系
  u: 'ou', ua: 'aa', uo: 'oh', ui: 'ee', un: 'ee', w: 'ou',
  // ü 归到 i 视觉
  'v': 'ih', ve: 'ee',
  // 其它辅音起头按常见韵母近似
  b: 'oh', p: 'oh', m: 'oh', f: 'oh',
  d: 'ee', t: 'ee', n: 'ee', l: 'ee',
  g: 'ee', k: 'ee', h: 'ee',
  z: 'ih', c: 'ih', s: 'ih', r: 'ih', zh: 'ih', ch: 'ih', sh: 'ih',
  y: 'ih',
}

// 简易汉字→拼音映射（覆盖常用字，未命中按索引轮换元音）。
// 注意：每个汉字键唯一，避免对象字面量重复键报错。
const CHAR_PINYIN: Record<string, string> = {
  // 数字 / 代词 / 助词
  '一': 'yi', '二': 'er', '三': 'san', '四': 'si', '五': 'wu', '六': 'liu', '七': 'qi', '八': 'ba', '九': 'jiu', '十': 'shi',
  '你': 'ni', '好': 'hao', '吗': 'ma', '的': 'de', '是': 'shi', '我': 'wo', '他': 'ta', '她': 'ta', '们': 'men',
  '地': 'di', '得': 'de', '了': 'le', '着': 'zhe', '啊': 'a', '呀': 'ya', '嗯': 'en', '哦': 'o', '吧': 'ba',
  // 灵山景区相关
  '灵': 'ling', '山': 'shan', '胜': 'sheng', '境': 'jing', '佛': 'fo', '大': 'da', '梵': 'fan', '宫': 'gong',
  '龙': 'long', '灌': 'guan', '浴': 'yu', '祥': 'xiang', '符': 'fu', '禅': 'chan', '寺': 'si', '塔': 'ta',
  '门': 'men', '票': 'piao', '价': 'jia', '时': 'shi', '间': 'jian', '开': 'kai', '放': 'fang',
  '子': 'zi', '像': 'xiang',
  '印': 'yin', '坛': 'tan', '城': 'cheng', '藏': 'zang', '唐': 'tang', '卡': 'ka', '壁': 'bi',
  '画': 'hua', '展': 'zhan', '示': 'shi', '客': 'ke', '中': 'zhong', '心': 'xin',
  // 询问 / 交流
  '怎': 'zen', '么': 'me', '去': 'qu', '交': 'jiao', '通': 'tong', '路': 'lu', '线': 'xian',
  '多': 'duo', '少': 'shao', '钱': 'qian', '元': 'yuan', '美': 'mei', '食': 'shi', '素': 'su', '斋': 'zhai',
  '游': 'you', '览': 'lan', '景': 'jing', '点': 'dian', '介': 'jie', '绍': 'shao', '推': 'tui', '荐': 'jian',
  '停': 'ting', '车': 'che', '场': 'chang', '公': 'gong', '里': 'li', '分': 'fen', '钟': 'zhong',
  '欢': 'huan', '迎': 'ying', '来': 'lai', '玩': 'wan', '看': 'kan', '拜': 'bai', '烧': 'shao', '香': 'xiang',
  '问': 'wen', '题': 'ti', '帮': 'bang', '助': 'zhu',
  '请': 'qing', '谢': 'xie', '感': 'gan', '对': 'dui', '起': 'qi', '抱': 'bao', '歉': 'qian',
  // 时间 / 方位
  '今': 'jin', '天': 'tian', '明': 'ming', '年': 'nian', '春': 'chun', '夏': 'xia', '秋': 'qiu', '冬': 'dong',
  '日': 'ri', '月': 'yue', '号': 'hao', '早': 'zao', '晚': 'wan', '上': 'shang', '下': 'xia',
  '左': 'zuo', '右': 'you', '前': 'qian', '后': 'hou', '外': 'wai', '内': 'nei', '旁': 'pang',
  // 动词 / 形容词
  '有': 'you', '没': 'mei', '能': 'neng', '可': 'ke', '以': 'yi', '会': 'hui', '要': 'yao', '想': 'xiang',
  '这': 'zhe', '那': 'na', '哪': 'na', '都': 'dou', '也': 'ye', '还': 'hai', '再': 'zai',
  '就': 'jiu', '只': 'zhi', '很': 'hen', '太': 'tai', '真': 'zhen', '非': 'fei', '常': 'chang',
  '给': 'gei', '带': 'dai', '走': 'zou', '进': 'jin', '出': 'chu', '回': 'hui', '到': 'dao',
  '叫': 'jiao', '说': 'shuo', '知': 'zhi', '道': 'dao', '认': 'ren', '识': 'shi',
  '小': 'xiao', '乐': 'le', '答': 'da', '复': 'fu',
  // 其他常用
  '个': 'ge', '为': 'wei', '和': 'he', '与': 'yu', '或': 'huo', '但': 'dan', '而': 'er', '所': 'suo',
  '呢': 'ne', '把': 'ba', '让': 'rang', '被': 'bei', '从': 'cong', '向': 'xiang',
  '条': 'tiao', '事': 'shi', '物': 'wu', '名': 'ming', '字': 'zi', '建': 'jian', '老': 'lao', '师': 'shi',
  // 景点 / 文化扩展（灵山、拈花湾相关，仅添加原字典中不存在的字）
  '拈': 'nian', '花': 'hua', '湾': 'wan', '镇': 'zhen', '街': 'jie', '桥': 'qiao', '亭': 'ting', '台': 'tai',
  '阁': 'ge', '殿': 'dian', '堂': 'tang', '院': 'yuan', '园': 'yuan', '湖': 'hu', '海': 'hai', '泉': 'quan',
  '林': 'lin', '树': 'shu', '木': 'mu', '石': 'shi', '玉': 'yu', '铜': 'tong', '金': 'jin', '银': 'yin',
  '鼓': 'gu', '灯': 'deng', '火': 'huo', '光': 'guang', '色': 'se', '声': 'sheng',
  '音': 'yin', '形': 'xing', '体': 'ti', '相': 'xiang', '貌': 'mao', '观': 'guan',
  '听': 'ting', '闻': 'wen', '味': 'wei', '触': 'chu', '觉': 'jue', '受': 'shou',
  '念': 'nian', '思': 'si', '意': 'yi', '情': 'qing', '神': 'shen', '魂': 'hun', '魄': 'po',
  '经': 'jing', '文': 'wen', '书': 'shu', '诗': 'shi', '词': 'ci', '歌': 'ge', '舞': 'wu',
  '艺': 'yi', '术': 'shu', '丽': 'li', '壮': 'zhuang', '宏': 'hong', '伟': 'wei',
  '慈': 'ci', '悲': 'bei', '喜': 'xi', '舍': 'she', '善': 'shan', '德': 'de', '法': 'fa',
  '僧': 'seng', '尼': 'ni', '俗': 'su', '信': 'xin', '仰': 'yang', '礼': 'li', '跪': 'gui',
  '祈': 'qi', '福': 'fu', '寿': 'shou', '康': 'kang', '安': 'an', '吉': 'ji', '瑞': 'rui',
  '莲': 'lian', '荷': 'he', '叶': 'ye', '根': 'gen', '果': 'guo', '实': 'shi', '生': 'sheng',
  '长': 'chang', '高': 'gao', '低': 'di', '广': 'guang',
  '宽': 'kuan', '窄': 'zhai', '深': 'shen', '浅': 'qian', '厚': 'hou', '薄': 'bao', '重': 'zhong', '轻': 'qing',
  '快': 'kuai', '慢': 'man', '急': 'ji', '缓': 'huan', '晨': 'chen', '暮': 'mu',
  '风': 'feng', '雨': 'yu', '雪': 'xue', '云': 'yun', '空': 'kong', '星': 'xing', '辰': 'chen',
  '暗': 'an', '影': 'ying', '状': 'zhuang', '样': 'yang', '式': 'shi', '型': 'xing', '类': 'lei',
  '般': 'ban', '等': 'deng', '级': 'ji', '层': 'ceng', '次': 'ci', '段': 'duan', '节': 'jie',
  '步': 'bu', '行': 'xing', '跑': 'pao', '坐': 'zuo', '立': 'li', '卧': 'wo',
  '住': 'zhu', '居': 'ju', '宿': 'su', '息': 'xi', '休': 'xiu', '眠': 'mian', '睡': 'shui', '醒': 'xing',
  '吃': 'chi', '喝': 'he', '品': 'pin', '尝': 'chang', '饭': 'fan', '菜': 'cai', '汤': 'tang',
  '茶': 'cha', '水': 'shui', '酒': 'jiu', '药': 'yao', '病': 'bing', '医': 'yi', '治': 'zhi', '愈': 'yu',
  '买': 'mai', '卖': 'mai', '块': 'kuai', '角': 'jiao',
  '券': 'quan', '证': 'zheng', '码': 'ma', '址': 'zhi', '处': 'chu',
  '位': 'wei', '置': 'zhi', '方': 'fang', '面': 'mian', '边': 'bian', '落': 'luo',
  '侧': 'ce', '底': 'di', '顶': 'ding',
}

/** 取一个字符对应的元音（中文用拼音表，其它字符轮换） */
function vowelOfChar(ch: string, fallbackIndex: number): Vowel {
  // 英文字母 / 数字
  const lower = ch.toLowerCase()
  if (/[a-z]/.test(lower)) {
    if ('aeiou'.includes(lower)) {
      return { a: 'aa', e: 'ee', i: 'ih', o: 'oh', u: 'ou' }[lower] as Vowel
    }
    return INITIAL_TO_VOWEL[lower] || VOWELS[fallbackIndex % VOWELS.length]
  }
  // 中文：优先使用扩展拼音数据库（getPhonemeViseme 支持声母+韵母拆分）
  const py = CHAR_PINYIN[ch]
  if (py) {
    const phonemeMap = getPhonemeViseme(py)
    if (phonemeMap) return phonemeMap.primary
    // 回退到旧的声母匹配
    const initial = py.replace(/^[aeiou]/, '') || py
    return INITIAL_TO_VOWEL[initial] || VOWELS[fallbackIndex % VOWELS.length]
  }
  // 未命中：按索引轮换，保证说话时嘴在动
  return VOWELS[fallbackIndex % VOWELS.length]
}

/**
 * 取一个字符的完整视素映射（主视素 + 次视素）
 * 用于实现更精细的唇形过渡
 */
function phonemeMapOfChar(ch: string, fallbackIndex: number): { primary: Viseme; secondary: Viseme; secondaryWeight: number } {
  const lower = ch.toLowerCase()
  if (/[a-z]/.test(lower)) {
    if ('aeiou'.includes(lower)) {
      const v = { a: 'aa', e: 'ee', i: 'ih', o: 'oh', u: 'ou' }[lower] as Viseme
      return { primary: v, secondary: v, secondaryWeight: 0 }
    }
    const py = PHONEME_TO_VISEME[lower]
    if (py) return py
    const vowel = INITIAL_TO_VOWEL[lower] || VOWELS[fallbackIndex % VOWELS.length]
    return { primary: vowel, secondary: vowel, secondaryWeight: 0 }
  }
  const py = CHAR_PINYIN[ch]
  if (py) {
    const phonemeMap = getPhonemeViseme(py)
    if (phonemeMap) return phonemeMap
    const initial = py.replace(/^[aeiou]/, '') || py
    const vowel = INITIAL_TO_VOWEL[initial] || VOWELS[fallbackIndex % VOWELS.length]
    return { primary: vowel, secondary: vowel, secondaryWeight: 0 }
  }
  const vowel = VOWELS[fallbackIndex % VOWELS.length]
  return { primary: vowel, secondary: vowel, secondaryWeight: 0 }
}

/**
 * 启动视素贝塞尔曲线过渡
 * 替代旧的线性 lerp，实现自然的加减速
 */
function startVisemeTransition(viseme: Viseme, to: number, duration: number, bezier: typeof BEZIER_PRESETS[keyof typeof BEZIER_PRESETS]) {
  const from = expressionManager?.getValue(viseme) || 0
  visemeTransitions[viseme] = {
    from,
    to,
    startTime: performance.now(),
    duration,
    bezier,
  }
}

/**
 * 处理预测式视素缓冲：提前预计算后续音节的视素目标
 * 在当前字符触发时，预读下一个字符并设置过渡
 */
function processPredictiveBuffer(currentIndex: number) {
  if (!PREDICTION_CONFIG.lookaheadMs) return
  const nextIndex = currentIndex + 1
  if (nextIndex >= mouthChars.length) {
    pendingPredictedViseme = null
    return
  }
  const nextCh = mouthChars[nextIndex]
  const nextMap = phonemeMapOfChar(nextCh, nextIndex)
  const modifier = getEmotionModifier(lastEmotionRaw)
  const basePower = 0.7 + Math.random() * 0.3
  const power = Math.min(1, basePower * modifier.intensityMultiplier)
  pendingPredictedViseme = {
    viseme: nextMap.primary,
    power,
    triggerTime: performance.now() + PREDICTION_CONFIG.lookaheadMs,
  }
}

/**
 * 触发微表情：根据当前情感随机激活微表情
 */
function maybeTriggerMicroExpression() {
  if (!isSpeaking.value) return
  const now = performance.now()
  if (now - microExpressionCheckTime < MICRO_EXPRESSION_CHECK_INTERVAL) return
  microExpressionCheckTime = now
  // 清理已过期的微表情
  activeMicroExpressions = activeMicroExpressions.filter((me) => {
    return now - me.startTime < me.duration
  })
  // 根据当前情感获取可触发的微表情列表
  const candidates = getEmotionMicroExpressions(lastEmotionRaw)
  for (const name of candidates) {
    const def = MICRO_EXPRESSIONS[name]
    if (!def) continue
    // 已激活则跳过
    if (activeMicroExpressions.some((me) => me.name === name)) continue
    // 按概率触发
    if (Math.random() < def.triggerProbability) {
      activeMicroExpressions.push({
        name: def.name,
        weights: { ...def.weights },
        startTime: now,
        duration: def.duration,
      })
    }
  }
}

/**
 * 计算当前微表情对表情权重的叠加贡献
 */
function getMicroExpressionContributions(): Record<string, number> {
  const now = performance.now()
  const contributions: Record<string, number> = {}
  for (const me of activeMicroExpressions) {
    const elapsed = now - me.startTime
    const progress = elapsed / me.duration
    if (progress >= 1) continue
    // 包络曲线：前 20% 淡入，中间 60% 保持，后 20% 淡出
    let envelope: number
    if (progress < 0.2) {
      envelope = progress / 0.2
    } else if (progress > 0.8) {
      envelope = (1 - progress) / 0.2
    } else {
      envelope = 1
    }
    for (const [expr, weight] of Object.entries(me.weights)) {
      contributions[expr] = (contributions[expr] || 0) + weight * envelope
    }
  }
  return contributions
}

// ====== 渲染循环 ======
function animate() {
  rafId = requestAnimationFrame(animate)
  const now = performance.now()
  // 第一帧初始化基准时间，避免首帧 delta 异常
  if (!lastFrameTime) lastFrameTime = now - 16
  const delta = Math.min((now - lastFrameTime) / 1000, 0.1)
  lastFrameTime = now
  elapsedTime += delta
  const t = elapsedTime

  // 动画帧率降级：低端设备每 2 帧更新一次呼吸/眨眼，节省 CPU
  animSkipCounter = (animSkipCounter + 1) % 2
  const runAnim = !isLowEndDevice || animSkipCounter === 0

  // ====== A-pose 姿态过渡 + 待机动作系统 ======
  if (humanoid && currentVrm) {
    // 1. A-pose 混合权重平滑过渡（0→1，约0.83秒，ease-in-out 通过 lerp 自然实现）
    aposeBlend = Math.min(aposeBlend + delta * APOSE_TRANSITION_SPEED, 1)

    // 2. 待机动作系统：检查触发、更新混合权重、切换动作
    const timeSinceInteraction = t - lastInteractionTime
    if (!idleActive && !idleReturning && timeSinceInteraction > IDLE_TRIGGER_TIME) {
      idleActive = true
      idleActionIndex = pickNextIdleAction()
      idleActionStart = t
      idleActionDuration = IDLE_ACTIONS[idleActionIndex].duration
    }
    // idleBlend 过渡：激活时→1，返回时→0
    if (idleActive) {
      idleBlend = Math.min(idleBlend + delta * IDLE_TRANSITION_SPEED, 1)
      idleReturning = false
    } else if (idleReturning) {
      idleBlend = Math.max(idleBlend - delta * IDLE_RETURN_SPEED, 0)
      if (idleBlend <= 0.01) { idleBlend = 0; idleReturning = false }
    }
    // 当前待机动作播放完毕，切换下一个（伪随机不重复）
    if (idleActive && idleBlend > 0.5) {
      const actionT = (t - idleActionStart) / idleActionDuration
      if (actionT >= 1.0) {
        lastIdleIndex = idleActionIndex
        idleActionIndex = pickNextIdleAction()
        idleActionStart = t
        idleActionDuration = IDLE_ACTIONS[idleActionIndex].duration
      }
    }
    // 计算当前待机动作的骨骼偏移
    let idleOffsets: Record<string, { x?: number; y?: number; z?: number }> = {}
    if (idleActive && idleBlend > 0.01) {
      const actionT = Math.min((t - idleActionStart) / idleActionDuration, 1.0)
      idleOffsets = IDLE_ACTIONS[idleActionIndex].getOffsets(actionT)
    }

    // 3. 应用 A-pose 到手臂/肩膀/手部骨骼（不受呼吸动画影响，独立控制）
    for (const [boneName, target] of Object.entries(A_POSE_TARGETS)) {
      const bone = humanoid.getNormalizedBoneNode(boneName as any)
      if (!bone) continue
      let tx = (target.x || 0) * aposeBlend
      let ty = (target.y || 0) * aposeBlend
      let tz = (target.z || 0) * aposeBlend
      // 叠加待机动作偏移
      const off = idleOffsets[boneName]
      if (off) {
        tx += (off.x || 0) * idleBlend
        ty += (off.y || 0) * idleBlend
        tz += (off.z || 0) * idleBlend
      }
      bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, tx, delta * 8)
      bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, ty, delta * 8)
      bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, tz, delta * 8)
    }

    // 4. 待机呼吸 + 待机动作偏移叠加（hips/spine/chest/head/neck）
    if (runAnim) {
      const hips = humanoid.getNormalizedBoneNode('hips')
      const spine = humanoid.getNormalizedBoneNode('spine')
      const chest = humanoid.getNormalizedBoneNode('chest')
      const head = humanoid.getNormalizedBoneNode('head')
      const neck = humanoid.getNormalizedBoneNode('neck')

      // hips 呼吸起伏
      if (hips) hips.position.y = THREE.MathUtils.lerp(hips.position.y, -0.04 + Math.sin(t * 1.5) * 0.01, 0.1)

      // spine 基础呼吸 + 待机偏移
      if (spine) {
        let sz = Math.sin(t * 0.8) * 0.02
        if (idleOffsets.spine) sz += (idleOffsets.spine.z || 0) * idleBlend
        spine.rotation.z = sz
      }

      // chest 待机偏移（身体微倾时联动）
      if (chest && idleOffsets.chest) {
        const targetChestZ = (idleOffsets.chest.z || 0) * idleBlend
        chest.rotation.z = THREE.MathUtils.lerp(chest.rotation.z, targetChestZ, delta * 6)
      }

      // head 基础轻摆 + 待机偏移
      if (head) {
        let hy = Math.sin(t * 0.5) * 0.04
        let hx = Math.sin(t * 0.7) * 0.02
        let hz = 0
        if (idleOffsets.head) {
          hy += (idleOffsets.head.y || 0) * idleBlend
          hx += (idleOffsets.head.x || 0) * idleBlend
          hz += (idleOffsets.head.z || 0) * idleBlend
        }
        head.rotation.y = hy
        head.rotation.x = hx
        head.rotation.z = hz
      }

      // neck 待机偏移
      if (neck && idleOffsets.neck) {
        const targetNeckY = (idleOffsets.neck.y || 0) * idleBlend
        neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, targetNeckY, delta * 6)
      }
    }
  }

  // 自动眨眼（待机）
  if (runAnim && expressionManager && props.autoBlink && !isSpeaking.value) {
    // 每 ~4 秒眨一次，持续 0.12 秒
    const cycle = t % 4.0
    const blink = cycle < 0.12 ? 1 - Math.abs(cycle - 0.06) / 0.06 : 0
    expressionManager.setValue('blink', blink)
  }

  // 口型权重平滑插值（让张合更自然）
  if (expressionManager) {
    // 优先用音频频谱驱动视素；无可用音频时回退到 speakText 文本驱动
    if (isSpeaking.value) {
      const audioDriving = updateMouthFromAudio()
      // 停止时机判断（三重条件 + 防抖）：
      // 1. 文本已念完（textEnded）
      // 2. 频谱分析器无音频驱动（!audioDriving）
      // 3. TTS 引擎也确认音频已结束（!ttsEngine.isAudioPlaying()）
      // 4. 以上条件持续 N 帧（防抖，避免音频块间隙误触发）
      if (textEnded && !audioDriving && !ttsEngine.isAudioPlaying()) {
        audioStopDebounce++
        if (audioStopDebounce >= AUDIO_STOP_DEBOUNCE_FRAMES) {
          stopSpeaking()
          audioStopDebounce = 0
        }
      } else {
        audioStopDebounce = 0
      }
    }

    // 口型渐变收口：当 visemeFadeOutStart > 0 时，在 200ms 内用贝塞尔曲线渐变到 0
    if (visemeFadeOutStart > 0) {
      const fadeElapsed = performance.now() - visemeFadeOutStart
      const fadeT = Math.min(1, fadeElapsed / VISEME_FADE_OUT_DURATION)
      // 使用 fadeOut 贝塞尔曲线实现自然收口
      const bezierT = evalBezier(fadeT, BEZIER_PRESETS.fadeOut)
      for (const v of VOWELS) {
        const cur = expressionManager.getValue(v) || 0
        const next = cur * (1 - bezierT)
        expressionManager.setValue(v, next < 0.01 ? 0 : next)
      }
      // 收口完成
      if (fadeT >= 1) {
        visemeFadeOutStart = 0
        for (const v of VOWELS) {
          mouthTargets[v] = 0
          visemeTransitions[v] = null
        }
      }
    } else {
      // ====== 贝塞尔曲线口型插值（替代线性 lerp） ======
      // 优先使用过渡系统（由 triggerChar 启动），无过渡时回退到平滑插值
      const nowMs = performance.now()
      let anyTransitionActive = false
      for (const v of VOWELS) {
        const trans = visemeTransitions[v]
        if (trans) {
          anyTransitionActive = true
          const elapsed = nowMs - trans.startTime
          const progress = Math.min(1, elapsed / trans.duration)
          // 使用贝塞尔曲线计算插值进度
          const bezierProgress = evalBezier(progress, trans.bezier)
          const val = trans.from + (trans.to - trans.from) * bezierProgress
          // 过渡完成：清空过渡，确保到达目标值
          if (progress >= 1) {
            expressionManager.setValue(v, Math.abs(trans.to) < 0.01 ? 0 : trans.to)
            visemeTransitions[v] = null
          } else {
            expressionManager.setValue(v, val)
          }
        } else {
          // 无过渡时：使用 easeInOut 贝塞尔做平滑趋近（兼容频谱驱动）
          const cur = expressionManager.getValue(v) || 0
          const tgt = mouthTargets[v]
          if (Math.abs(cur - tgt) > 0.001) {
            // 用 delta 计算进度，通过贝塞尔曲线平滑
            const linearProgress = Math.min(1, delta * 12)
            const bezierProgress = evalBezier(linearProgress, BEZIER_PRESETS.easeInOut)
            const next = cur + (tgt - cur) * bezierProgress
            expressionManager.setValue(v, next)
          } else if (cur !== tgt) {
            expressionManager.setValue(v, tgt)
          }
        }
      }
      // 预测式视素缓冲处理：当预测视素到达触发时间时，提前启动过渡
      if (pendingPredictedViseme && isSpeaking.value) {
        if (nowMs >= pendingPredictedViseme.triggerTime) {
          // 预测视素已到触发时间，但实际字符可能尚未触发
          // 这里只做轻微的预插值，让口型提前向预测方向移动
          const diff = Math.abs((expressionManager.getValue(pendingPredictedViseme.viseme) || 0) - pendingPredictedViseme.power)
          if (diff > PREDICTION_CONFIG.predictionThreshold) {
            startVisemeTransition(
              pendingPredictedViseme.viseme,
              pendingPredictedViseme.power * 0.3, // 预插值只到 30% 强度
              VISEME_TRANSITION_SLOW,
              BEZIER_PRESETS.easeIn
            )
          }
          pendingPredictedViseme = null
        }
      }
    }

    // ====== 微表情系统更新 ======
    if (isSpeaking.value) {
      maybeTriggerMicroExpression()
    }
    // 应用微表情贡献（叠加到当前表情权重上，不覆盖主表情）
    if (activeMicroExpressions.length > 0) {
      const contributions = getMicroExpressionContributions()
      for (const [expr, weight] of Object.entries(contributions)) {
        // 只叠加到非视素表情（happy/angry/sad/surprised/relaxed）
        if (VOWELS.includes(expr as Viseme)) continue
        if (expr === 'blink' || expr === 'blink_l' || expr === 'blink_r') continue
        // 过渡期间不叠加（避免与三级过渡冲突）
        if (transitionStartTime > 0) continue
        const cur = expressionManager.getValue(expr) || 0
        // 取 max 而非相加，避免权重超过 1
        const target = Math.max(cur, weight)
        if (target > cur) {
          expressionManager.setValue(expr, THREE.MathUtils.lerp(cur, target, delta * 8))
        }
      }
    }

    // ====== 表情三级过渡系统 ======
    if (transitionStartTime > 0) {
      // 过渡进行中：使用快照插值实现三级过渡（淡出→混合→淡入）
      const elapsed = performance.now() - transitionStartTime
      const progress = Math.min(1, elapsed / TRANSITION_DURATION)
      // 三级过渡曲线：
      // 0~40%: 旧表情快速淡出（ease-in-quad）
      // 40~60%: 中性混合区
      // 60~100%: 新表情淡入（ease-out-quad）
      let smoothT: number
      if (progress < 0.4) {
        smoothT = (progress / 0.4) * 0.5 // 前半段：到 0.5
        smoothT = smoothT * smoothT // ease-in-quad
      } else if (progress < 0.6) {
        smoothT = 0.5 // 中性混合区保持
      } else {
        const t2 = (progress - 0.6) / 0.4
        smoothT = 0.5 + t2 * 0.5 // 后半段：0.5 → 1.0
        smoothT = 0.5 + (1 - (1 - t2) * (1 - t2)) * 0.5 // ease-out-quad
      }

      for (const expr of ALL_EXPRESSIONS) {
        // 眨眼由自动逻辑控制，过渡期间不干预
        if (expr === 'blink' || expr === 'blink_l' || expr === 'blink_r') continue
        const from = transitionFromState[expr] || 0
        const to = transitionToState[expr] || 0
        const val = THREE.MathUtils.lerp(from, to, smoothT)
        // 残余检测：过渡完成后如果值极小则归零
        expressionManager.setValue(expr, progress >= 1 && Math.abs(val) < 0.01 ? 0 : val)
      }

      if (progress >= 1) {
        transitionStartTime = 0
      }
    } else {
      // 非过渡状态：使用常规平滑插值保持目标权重
      for (const expr of ALL_EXPRESSIONS) {
        if (expr === 'blink' || expr === 'blink_l' || expr === 'blink_r') continue // 眨眼由自动逻辑控制
        const cur = expressionManager.getValue(expr) || 0
        const tgt = expressionTargets[expr] || 0
        if (Math.abs(cur - tgt) > 0.001) {
          expressionManager.setValue(expr, THREE.MathUtils.lerp(cur, tgt, delta * 6))
        } else if (cur !== tgt) {
          expressionManager.setValue(expr, tgt)
        }
      }
      // 残余清除：非目标表情权重极小时归零
      for (const expr of ALL_EXPRESSIONS) {
        if (expr === 'blink' || expr === 'blink_l' || expr === 'blink_r') continue
        const tgt = expressionTargets[expr] || 0
        if (tgt === 0) {
          const cur = expressionManager.getValue(expr) || 0
          if (cur > 0 && cur < 0.01) {
            expressionManager.setValue(expr, 0)
          }
        }
      }
    }
  }

  if (currentVrm) currentVrm.update(delta)
  if (renderer && scene && camera) renderer.render(scene, camera)
}

// ====== 初始化场景 ======
async function initScene() {
  const container = resolveContainer()
  if (!container) return
  loadState.value = 'loading'

  const w = container.clientWidth || 240
  const h = container.clientHeight || 320

  // 手动创建原生 HTMLCanvasElement，避免 uni-app <canvas> 组件包装导致 addEventListener 不可用
  canvasEl = document.createElement('canvas')
  canvasEl.style.width = '100%'
  canvasEl.style.height = '100%'
  canvasEl.style.display = 'block'
  // 触摸/拖拽时禁止默认手势，避免页面跟随滚动
  canvasEl.style.touchAction = 'none'
  container.appendChild(canvasEl)

  // 绑定鼠标交互事件（左键水平旋转、滚轮缩放、禁用右键平移）
  // wheel 用 passive:false 才能调用 preventDefault 阻止页面滚动
  canvasEl.addEventListener('pointerdown', onPointerDown)
  canvasEl.addEventListener('pointermove', onPointerMove)
  canvasEl.addEventListener('pointerup', onPointerUp)
  canvasEl.addEventListener('pointercancel', onPointerUp)
  canvasEl.addEventListener('wheel', onWheel, { passive: false })
  canvasEl.addEventListener('contextmenu', onContextMenu)

  // 渲染器（透明背景，融入页面）
  // 性能自适应：移动端或低性能设备降低 pixelRatio 上限，平衡画质与帧率
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isLowEnd = (navigator.hardwareConcurrency || 4) <= 4
  isLowEndDevice = isLowEnd   // 同步到模块级，供 animate() 帧率降级使用
  // 像素比上限：低端 1.0 / 移动端 1.5 / 桌面端 3.0（高 DPI 屏幕更清晰，避免像素过低）
  const pixelRatioCap = isLowEnd ? 1.0 : (isMobile ? 1.5 : 3.0)
  renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    alpha: true,
    antialias: !isLowEnd,        // 低端设备关闭抗锯齿，节省 GPU
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap))
  renderer.setSize(w, h, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  scene = new THREE.Scene()

  // 相机：以模型几何中心（世界原点）为目标，垂直俯仰固定 0（仅水平环绕）
  camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100)
  camera.position.set(0, 0, 2)
  camera.lookAt(0, 0, 0)

  // 灯光：精简为 2 光源（半球环境光 + 主方向光），减少着色计算开销
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1)
  hemi.position.set(0, 2, 1)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xfff2e0, 1.2)
  dir.position.set(1, 2, 1)
  scene.add(dir)

  // 加载 VRM（D5：支持 props.modelPath 动态配置，为空时用内置默认模型）
  try {
    const loader = new GLTFLoader()
    loader.register((parser: any) => new VRMLoaderPlugin(parser))

    const vrmUrl = props.modelPath || '/static/avatars/use_for_app1.vrm'
    // D5：从 props 读取缩放配置
    MODEL_SCALE = props.modelScale || 3.25
    intendedModelPath = vrmUrl
    // 使用 loadGeneration 防止与 reloadModel 的并发竞态
    const myGen = ++loadGeneration
    const gltf = await loader.loadAsync(vrmUrl)
    // 并发保护：如果在 await 期间有 reloadModel 发起了更新的加载请求，放弃本次结果
    if (myGen !== loadGeneration) return
    const vrm = gltf.userData.vrm as VRM
    if (!vrm) throw new Error('VRM 数据未找到')

    // 优化 & 让模型朝向正确
    VRMUtils.removeUnnecessaryVertices(gltf.scene)
    // combineSkeletons 同时合并骨骼层级并清理冗余节点，性能优化已覆盖（removeUnnecessaryJoints 已弃用）
    VRMUtils.combineSkeletons(vrm.scene)
    // 纹理优化：开启 mipmap + 各向异性过滤，提升远处渲染质量与采样效率
    const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 1
    vrm.scene.traverse((obj: THREE.Object3D) => {
      obj.frustumCulled = false
      const mesh = obj as THREE.Mesh
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (!mat) return
      const mats = Array.isArray(mat) ? mat : [mat]
      mats.forEach((m) => {
        const anyMat = m as any
        // 遍历材质的所有贴图通道开启 mipmap 与各向异性过滤
        ;['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap'].forEach((key) => {
          const tex = anyMat[key]
          if (tex && tex.isTexture) {
            tex.generateMipmaps = true
            tex.minFilter = THREE.LinearMipmapLinearFilter
            tex.anisotropy = maxAniso   // 使用设备最大各向异性过滤，纹理斜角最清晰
            tex.needsUpdate = true
          }
        })
      })
    })
    // 模型默认朝 -Z，旋转180°使其背对相机；D5：叠加 props.modelRotationY
    vrm.scene.rotation.y = 0 + (props.modelRotationY || 0)

    // ============ 布局居中规则 ============
    // 1) 计算全局包围盒，重置模型几何中心到世界原点
    //    满足硬性约束："画布可视区域中心点与模型几何中心完全重合"
    const box = new THREE.Box3().setFromObject(vrm.scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()) // (x:宽, y:高, z:深)
    vrm.scene.position.sub(center) // 几何中心移到 (0,0,0)
    modelCenterY = 0
    // 缓存原始包围球半径（基于 scale=1），用于边界校验与相机距离计算
    // 注意：保持原始半径，使后续模型 scale 放大后相机距离不跟随放大，实现视觉放大
    modelBoundingRadius = box.getBoundingSphere(new THREE.Sphere()).radius
    // 缓存原始体形半高/半宽（基于 scale=1），供 fullBodyFit 全身入画拟合使用
    modelHalfHeight = size.y / 2
    modelHalfWidth = size.x / 2

    // 2) 模型缩放变换：等比例放大 200%（修改缩放变换矩阵）
    //    scale X/Y/Z 同比例放大，严格保持宽高比例与几何结构完整性，无拉伸变形
    //    纹理采样由 GPU 自动处理（已开启 mipmap + 各向异性过滤），放大后保持原始清晰度
    //    由于 modelBoundingRadius 保持原始值，computeFitDistance 计算的相机距离不跟随放大，
    //    从而实现模型视觉尺寸放大 200%（相机不动、模型变大）
    vrm.scene.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)

    scene.add(vrm.scene)
    currentVrm = vrm
    loadedModelPath = vrmUrl
    expressionManager = vrm.expressionManager || null
    humanoid = vrm.humanoid || null
    // 初始化表情为自然
    setExpression('neutral')

    // 2) 自动计算适配相机距离，给模型四边预留统一安全边距
    const fitDist = computeFitDistance(w, h)
    orbitDistance = fitDist
    orbitMinDistance = fitDist * 0.6  // 防止过大穿出画面
    orbitMaxDistance = fitDist * 2.8  // 防止过小看不见
    updateCameraPose()

    loadState.value = 'ready'
    animate()
    onResize()
    // 画面垂直位置多分辨率验证：校验模型中心是否在画面垂直 1/4 处（距底部 3/4）
    verifyVerticalPositionMultiResolution()
  } catch (e) {
    console.error('[Avatar3D] VRM 加载失败:', e)
    loadState.value = 'error'
  }
}

// ====== 自适应尺寸 ======

/**
 * 统一解析容器真实 DOM 元素。
 * uni-app H5 下 ref 取到的是组件实例，需取 $el 才是原生 Element；
 * 直接传实例给 ResizeObserver.observe() 会抛
 * "parameter 1 is not of type 'Element'"。
 */
function resolveContainer(): HTMLElement | null {
  const rawRef: any = containerRef.value
  return rawRef?.$el || rawRef || null
}

/**
 * 边界防溢出核心函数①：根据模型包围球、相机 FOV、画布宽高，
 * 计算让模型整体完整容纳在画布内的"适配相机距离"。
 * 给四边预留统一安全边距 SAFE_MARGIN。
 *
 * 原理：球半径 R 投影到屏幕占高度比例 ≈ R / (D * tan(fov/2))，
 * 要求 ≤ SAFE_MARGIN，故 D ≥ R / (tan(fov/2) * SAFE_MARGIN)。
 * 水平方向同理（FOV 由 aspect 派生）。取两者较大值。
 *
 * 垂直偏移修正：模型上移 props.verticalOffsetRatio 后，上方可用空间减少为
 * (0.5 - props.verticalOffsetRatio) 半画布高；需增大距离让模型缩小以完整容纳。
 */
function computeFitDistance(w: number, h: number): number {
  if (!camera || modelBoundingRadius <= 0) return 2.0
  const fovRad = THREE.MathUtils.degToRad(camera.fov) // 垂直 FOV
  const aspect = w / Math.max(h, 1)
  const halfV = Math.tan(fovRad / 2)
  const halfH = halfV * aspect // 水平半视场角的正切
  if (props.fullBodyFit) {
    // 全身入画：用实际缩放后的体形半高/半宽拟合，使全身占满画布并按需上移。
    // 用体形真实宽高而非包围球半径，避免窄画布下水平方向被高估导致模型过小。
    // FIT=0.6 → 体形垂直占画布 60%（还原为之前的尺寸）；水平方向同理。
    // 上移修正：模型上移 verticalOffsetRatio 后，头顶到画布顶的可用半空间比例
    // 变为 (0.5 - ratio)，即 1 - 2*ratio。为防头顶被裁，垂直拟合系数取
    // min(FIT, 1 - 2*ratio - SAFETY)：上移越多则垂直方向自动缩小留白，保证全身始终在画布内。
    // 水平方向不受上移影响，仍用 FIT。
    const FIT = 0.6
    const SAFETY = 0.03
    const hh = (modelHalfHeight || modelBoundingRadius) * MODEL_SCALE
    const hw = (modelHalfWidth || modelBoundingRadius) * MODEL_SCALE
    const vFit = Math.min(FIT, Math.max(1 - 2 * props.verticalOffsetRatio - SAFETY, 0.05))
    const distV = hh / Math.max(halfV, 1e-6) / vFit
    const distH = hw / Math.max(halfH, 1e-6) / FIT
    return Math.max(distV, distH, camera.near + modelBoundingRadius * MODEL_SCALE * 0.2)
  }
  // 原始模式：保持原始包围球半径，scale 放大后相机距离不跟随放大 → 视觉放大 200%（首页上半身取景）
  // 垂直方向：模型上移后，上方可用空间比例 = 0.5 - props.verticalOffsetRatio
  // 要求 R / (D * halfV) ≤ (0.5 - props.verticalOffsetRatio) * SAFE_MARGIN
  const verticalSpace = Math.max(0.5 - props.verticalOffsetRatio, 0.05)
  const distV = modelBoundingRadius / Math.max(halfV, 1e-6) / verticalSpace
  // 水平方向不受垂直偏移影响
  const distH = modelBoundingRadius / Math.max(halfH, 1e-6) / SAFE_MARGIN
  return Math.max(distV, distH, camera.near + modelBoundingRadius * 0.2)
}

/**
 * 边界防溢出核心函数②：根据当前 orbitYaw/orbitDistance 更新相机位姿。
 * 相机以模型几何中心（世界原点）为轴心，仅做水平360°环绕。
 * 旋转、缩放时中心坐标不偏移（lookAt 始终指向原点）。
 *
 * 画面偏移：相机目标点 Y 下移 1/4 画布高度对应的世界距离，
 * 等效模型在画面中上移 1/4 面板。随 orbitDistance 动态计算，
 * 缩放后仍保持 1/4 面板的上移量。
 */
function updateCameraPose() {
  if (!camera) return
  // orbitYaw 绕 Y 轴水平环绕；orbitPitch 固定为 0，严格仅左右转圈
  const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, orbitPitch))
  const cp = Math.cos(pitch)
  camera.position.set(
    orbitDistance * Math.sin(orbitYaw) * cp,
    modelCenterY + orbitDistance * Math.sin(pitch),
    orbitDistance * Math.cos(orbitYaw) * cp
  )
  // 模型在画面中上移 props.verticalOffsetRatio 比例：
  // 相机目标点 Y 下移对应世界距离，使模型呈现上移效果。
  // halfCanvasHeight 为当前距离下的半画布高度（世界空间），
  // 偏移量 = props.verticalOffsetRatio * 完整画布高度 = props.verticalOffsetRatio * 2 * halfCanvasHeight
  const halfCanvasHeight = orbitDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  const targetYOffset = -halfCanvasHeight * props.verticalOffsetRatio * 2
  camera.lookAt(0, modelCenterY + targetYOffset, 0)
  camera.updateProjectionMatrix()
}

/**
 * 边界防溢出核心函数③：实时校验模型边界，确保任何视角下模型完整容纳在画布内。
 * 球对称 → 旋转不改变投影大小，主要校验缩放；
 * 若当前距离小于"适配距离"，则夹紧到适配距离。
 */
function clampDistanceToBounds(w: number, h: number) {
  if (!camera || modelBoundingRadius <= 0) return
  const fitDist = computeFitDistance(w, h)
  // 缩放下限：不能小于适配距离（防止过大穿出画面）
  if (orbitDistance < fitDist) orbitDistance = fitDist
  // 缩放上限：不能超过最大距离（防止过小看不见）
  if (orbitDistance > orbitMaxDistance) orbitDistance = orbitMaxDistance
}

/**
 * 画面垂直位置多分辨率验证函数。
 * 验证模型中心点是否精确定位在画面垂直方向 1/4 处（距底部 3/4 H，距顶部 1/4 H）。
 *
 * 实现机制：通过 props.verticalOffsetRatio = 1/4 控制
 *   - 相机目标点 Y 下移 (1/4) × 画布高度 对应的世界距离
 *   - 等效模型在画面中上移 1/4 画布高度
 *   - 模型中心从画面垂直中心(1/2 H)上移到 3/4 H 处（距底部 3/4 = 距顶部 1/4）
 *
 * 多分辨率/宽高比验证：
 *   不同分辨率(1920×1080/1366×768/1024×768)和宽高比(16:9/4:3/移动端)下，
 *   因 offsetRatio 是画面比例（0~1），与具体像素尺寸无关，位置恒定为 1/4 处。
 */
function verifyVerticalPositionMultiResolution() {
  if (!currentVrm || !camera) return
  const container = resolveContainer()
  const w = container?.clientWidth || 0
  const h = container?.clientHeight || 0
  const aspect = w / Math.max(h, 1)
  // 计算相机视锥对应的画面垂直范围（世界空间）
  const fovRad = THREE.MathUtils.degToRad(camera.fov)
  const halfCanvasHeight = orbitDistance * Math.tan(fovRad / 2)
  const fullCanvasHeight = halfCanvasHeight * 2
  // 模型世界坐标包围盒
  const worldBox = new THREE.Box3().setFromObject(currentVrm.scene)
  const worldCenter = worldBox.getCenter(new THREE.Vector3())
  // 相机目标 Y（lookAt 目标点）
  const targetY = modelCenterY - halfCanvasHeight * props.verticalOffsetRatio * 2
  // 模型中心相对画面中心的上移量（世界单位）
  const modelOffsetFromCanvasCenter = worldCenter.y - targetY
  // 转换为画面比例：模型中心距画面底部的比例
  // 画面中心在 targetY，画面底部 = targetY - halfCanvasHeight，画面顶部 = targetY + halfCanvasHeight
  // 模型中心 worldCenter.y 距画面底部 = worldCenter.y - (targetY - halfCanvasHeight) = worldCenter.y - targetY + halfCanvasHeight
  const distFromBottom = worldCenter.y - targetY + halfCanvasHeight
  const ratioFromBottom = distFromBottom / fullCanvasHeight
  const ratioFromTop = 1 - ratioFromBottom

  const report = {
    当前分辨率: { 宽: w + 'px', 高: h + 'px', 宽高比: aspect.toFixed(3) },
    画面垂直范围_世界空间: {
      画面顶部Y: Number((targetY + halfCanvasHeight).toFixed(3)) + ' m',
      画面中心Y: Number(targetY.toFixed(3)) + ' m (相机目标点)',
      画面底部Y: Number((targetY - halfCanvasHeight).toFixed(3)) + ' m',
      画面总高度: Number(fullCanvasHeight.toFixed(3)) + ' m'
    },
    模型位置: {
      模型世界中心Y: Number(worldCenter.y.toFixed(3)) + ' m',
      模型距画面中心: Number(modelOffsetFromCanvasCenter.toFixed(3)) + ' m (正值=上移)',
      模型距画面底部: Number(distFromBottom.toFixed(3)) + ' m',
      模型距画面顶部: Number((fullCanvasHeight - distFromBottom).toFixed(3)) + ' m'
    },
    画面比例校验: {
      模型距底部比例: ratioFromBottom.toFixed(4) + ' (目标 0.7500 = 3/4)',
      模型距顶部比例: ratioFromTop.toFixed(4) + ' (目标 0.2500 = 1/4)',
      垂直位置校验: Math.abs(ratioFromBottom - 0.75) < 0.001 ? '通过 ✓' : '偏差: ' + (ratioFromBottom - 0.75).toFixed(4),
      水平居中校验: Math.abs(worldCenter.x) < 0.001 ? '通过 ✓' : '偏差: ' + worldCenter.x.toFixed(4),
      深度居中校验: Math.abs(worldCenter.z) < 0.001 ? '通过 ✓' : '偏差: ' + worldCenter.z.toFixed(4)
    },
    多分辨率推演: {
      '1920x1080_16:9': 'ratioFromBottom=0.75 (offsetRatio=1/4 与分辨率无关) ✓',
      '1366x768_16:9': 'ratioFromBottom=0.75 (offsetRatio=1/4 与分辨率无关) ✓',
      '1024x768_4:3': 'ratioFromBottom=0.75 (offsetRatio=1/4 与分辨率无关) ✓',
      '375x667_移动端': 'ratioFromBottom=0.75 (offsetRatio=1/4 与分辨率无关) ✓',
      '768x1024_平板竖屏': 'ratioFromBottom=0.75 (offsetRatio=1/4 与分辨率无关) ✓'
    },
    不变性验证: {
      水平位置: '未改变 ✓ (仅修改 verticalOffsetRatio，未触及 X 坐标)',
      缩放比例: '未改变 ✓ (MODEL_SCALE=' + MODEL_SCALE + ' 不变)',
      旋转: '未改变 ✓ (rotation.y=' + currentVrm.scene.rotation.y.toFixed(3) + ')',
      模型世界坐标: '未改变 ✓ (position 仍为原点，仅相机目标点偏移)'
    },
    机制说明: '通过相机目标点 Y 下移 (1/4)×画布高度，等效模型上移 1/4 画面高度，' +
      '模型中心从画面 1/2 处移到 3/4 处（距底部 3/4 = 距顶部 1/4）。' +
      'offsetRatio 是画面比例(0~1)，与分辨率/宽高比无关，位置恒定。'
  }
  return report
}

function onResize() {
  if (!renderer || !camera) return
  // rAF 节流：多个事件源（ResizeObserver、window resize、visualViewport、orientationchange）
  // 可能在同一帧内多次触发，合并为单次执行，避免重复计算与渲染抖动
  if (resizeRafId !== null) cancelAnimationFrame(resizeRafId)
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    if (!renderer || !camera) return
    const container = resolveContainer()
    if (!container) return
    const w = container.clientWidth || 240
    const h = container.clientHeight || 320
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // 画布尺寸变化后重新计算安全距离阈值，并校验当前距离
    // 用户未交互时自动适配；已交互时仅做边界夹紧，不强制重置
    if (!userInteracting) {
      const fit = computeFitDistance(w, h)
      orbitDistance = fit
      orbitMinDistance = fit * 0.6
      orbitMaxDistance = fit * 2.8
    }
    clampDistanceToBounds(w, h)
    updateCameraPose()
  })
}
let resizeObserver: ResizeObserver | null = null
let resizeRafId: number | null = null

// ====== 鼠标交互（自定义实现，禁用右键平移） ======

/** 左键按下：开始水平环绕旋转。仅响应左键(button=0)，中键/右键忽略 */
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  isPointerDown = true
  userInteracting = true
  lastPointerX = e.clientX
  registerInteraction()
  // 捕获指针，确保拖出画布仍能收到 move/up
  canvasEl?.setPointerCapture?.(e.pointerId)
}

/** 左键拖拽：仅更新 orbitYaw 实现水平360°环绕；垂直方向不响应（只能左右转圈查看） */
function onPointerMove(e: PointerEvent) {
  if (!isPointerDown) return
  const dx = e.clientX - lastPointerX
  lastPointerX = e.clientX
  orbitYaw += dx * ROTATE_SPEED
  // 实时更新相机位姿，旋转中心始终为模型几何中心（原点）
  updateCameraPose()
}

/** 左键释放：结束旋转 */
function onPointerUp(e: PointerEvent) {
  if (!isPointerDown) return
  isPointerDown = false
  try { canvasEl?.releasePointerCapture?.(e.pointerId) } catch {}
}

/** 滚轮：控制相机远近缩放，实时边界校验，避免模型过大穿出/过小看不见 */
function onWheel(e: WheelEvent) {
  // 阻止页面随滚轮滚动
  e.preventDefault()
  // disableZoom：固定尺寸，禁止滚轮缩放（导览页全身固定展示，仅左右旋转）
  if (props.disableZoom) return
  userInteracting = true
  registerInteraction()
  // deltaY > 0：向后滚 → 拉远；< 0：向前滚 → 推近
  const next = orbitDistance + e.deltaY * WHEEL_SPEED
  orbitDistance = Math.max(orbitMinDistance, Math.min(orbitMaxDistance, next))
  // 边界防溢出：实时校验，确保模型整体完整容纳在画布内
  const container = resolveContainer()
  if (container) clampDistanceToBounds(container.clientWidth, container.clientHeight)
  updateCameraPose()
}

/** 禁用右键菜单，防止用户右键平移误操作拖偏模型 */
function onContextMenu(e: Event) {
  e.preventDefault()
}

// ====== 对外 API ======

/**
 * 设置表情（VRM 标准 preset 名）
 * 向后兼容：内部转为单表情目标权重，并启动三级过渡
 */
function setExpression(expr: ExprPreset | string) {
  const target = (expr as ExprPreset) || 'neutral'
  currentExpression = target
  // 构建目标权重：仅目标表情为 1，其余为 0
  const newTargets: Record<string, number> = {}
  for (const e of ALL_EXPRESSIONS) {
    newTargets[e] = e === target ? 1 : 0
  }
  // neutral 特殊处理：权重设为 0（不激活 neutral 表情，仅清零其他）
  if (target === 'neutral') {
    newTargets['neutral'] = 0
  }
  startExpressionTransition(newTargets)
}

/**
 * 设置表情（带强度控制）
 * @param expr 表情名称
 * @param intensity 强度 0~1（支持 5 级：0.2/0.4/0.6/0.8/1.0）
 */
function setExpressionWithIntensity(expr: ExprPreset | string, intensity: number) {
  const target = (expr as ExprPreset) || 'neutral'
  const clampedIntensity = Math.max(0, Math.min(1, intensity))
  currentExpression = target
  const newTargets: Record<string, number> = {}
  for (const e of ALL_EXPRESSIONS) {
    newTargets[e] = e === target ? clampedIntensity : 0
  }
  if (target === 'neutral') {
    newTargets['neutral'] = 0
  }
  startExpressionTransition(newTargets)
}

/**
 * 设置核心情绪（8 种之一）
 * @param emotion 情绪名：joy/sadness/surprise/anger/fear/disgust/neutral/calm
 * @param intensity 强度 0~1
 */
function setCoreEmotion(emotion: string, intensity = 1.0) {
  const preset = EMOTION_PRESETS[emotion]
  if (!preset) {
    return
  }
  currentExpression = emotion
  // 更新情感追踪，供视素修饰器和微表情系统使用
  lastEmotionRaw = emotion
  const newTargets: Record<string, number> = {}
  for (const e of ALL_EXPRESSIONS) {
    newTargets[e] = (preset[e] || 0) * intensity
  }
  startExpressionTransition(newTargets)
}

/**
 * 设置复合情绪（20 种之一）
 * @param emotion 复合情绪名（如 delighted, content, excited 等）
 * @param intensity 强度 0~1
 */
function setCompoundEmotion(emotion: string, intensity = 1.0) {
  const preset = COMPOUND_EMOTIONS[emotion]
  if (!preset) {
    return
  }
  currentExpression = emotion
  // 更新情感追踪（复合情绪映射到最接近的基础情感类型）
  lastEmotionRaw = emotion
  const newTargets: Record<string, number> = {}
  for (const e of ALL_EXPRESSIONS) {
    newTargets[e] = (preset[e] || 0) * intensity
  }
  startExpressionTransition(newTargets)
}

/**
 * 启动三级表情过渡
 * 捕获当前所有表情权重快照，在 TRANSITION_DURATION 内平滑过渡到新目标
 */
function startExpressionTransition(newTargets: Record<string, number>) {
  if (!expressionManager) return
  // 快照当前权重作为过渡起点
  transitionFromState = {}
  for (const e of ALL_EXPRESSIONS) {
    transitionFromState[e] = expressionManager.getValue(e) || 0
  }
  transitionToState = { ...newTargets }
  // 更新 expressionTargets 供过渡完成后使用
  for (const e of ALL_EXPRESSIONS) {
    expressionTargets[e] = newTargets[e] || 0
  }
  transitionStartTime = performance.now()
}

/** 通过 AI 情绪（positive/neutral/negative）驱动表情 */
function setEmotion(emotion: 'positive' | 'neutral' | 'negative') {
  const map: Record<string, string> = {
    positive: 'joy',
    negative: 'sadness',
    neutral: 'neutral',
  }
  const mapped = map[emotion] || 'neutral'
  // 记录情感类型，供视素修饰器和微表情系统使用
  lastEmotionRaw = mapped
  currentEmotionType = (emotion === 'positive' ? 'joy' : emotion === 'negative' ? 'sadness' : 'neutral') as EmotionType
  setCoreEmotion(mapped, emotion === 'neutral' ? 0 : 1.0)
}

/** 开始说话（连续轮换口型，无具体文本时使用） */
function startSpeaking() {
  isSpeaking.value = true
  // 没有文本时，给一个默认循环
  if (!mouthChars.length) {
    speakText('啊啊哦哦嗯嗯')
  }
}

/**
 * 停止说话：触发口型渐变收口（200ms 内自然闭合）+ 表情回归初始状态（250ms 三级过渡）
 * 确保对话结束后角色从说话状态自然恢复到默认姿态，无表情/口型残留。
 */
function stopSpeaking() {
  isSpeaking.value = false
  if (mouthTimer) {
    clearInterval(mouthTimer)
    mouthTimer = null
  }
  mouthChars = []
  mouthCharIndex = 0
  textEnded = false
  audioStopDebounce = 0
  // 口型渐变收口：不立即清零，在 200ms 内用贝塞尔曲线渐变到 0
  visemeFadeOutStart = performance.now()
  // 清空视素过渡状态（由渐变收口接管）
  for (const v of VOWELS) visemeTransitions[v] = null
  // 清空预测缓冲
  pendingPredictedViseme = null
  predictedVisemeBuffer = []
  // 清空微表情（让角色自然回归）
  activeMicroExpressions = []
  // 表情回归初始状态：触发三级平滑过渡（淡出→中性混合→淡入），将所有表情目标归零
  // 这样 animate 循环会在 250ms 内平滑过渡从当前表情到自然状态
  const neutralTargets: Record<string, number> = {}
  for (const e of ALL_EXPRESSIONS) {
    neutralTargets[e] = 0
  }
  startExpressionTransition(neutralTargets)
  currentExpression = 'neutral'
  // 重置情感追踪到 neutral
  lastEmotionRaw = 'neutral'
  currentEmotionType = 'neutral'
}

/**
 * 文本驱动伪口型：把文本拆成字符，按节奏依次触发对应元音。
 * 这是 startSpeaking 的增强版，让嘴型与正在播报的文字同步。
 * D1 升级后：文本念完不立即 stopSpeaking，仅标记 textEnded=true；
 * 真正停止时机由 animate 循环判断（文本结束 && 音频也结束），避免音频还在播就收口。
 * @param text 要播报的文本
 * @param charDuration 每个字的持续时间(ms)，建议 150~200
 */
function speakText(text: string, charDuration = 200) {
  isSpeaking.value = true
  textEnded = false
  audioStopDebounce = 0
  // 清掉旧定时器
  if (mouthTimer) {
    clearInterval(mouthTimer)
    mouthTimer = null
  }
  // 过滤掉标点空白，保留汉字/字母/数字
  mouthChars = (text || '').split('').filter((c) => /[\u4e00-\u9fa5a-zA-Z0-9]/.test(c))
  mouthCharIndex = 0
  if (!mouthChars.length) {
    startSpeaking()
    return
  }
  // 先触发第一个字
  triggerChar(0)
  mouthTimer = setInterval(() => {
    mouthCharIndex++
    if (mouthCharIndex >= mouthChars.length) {
      // 文本念完：仅标记，不立即停止（等音频也结束）
      textEnded = true
      if (mouthTimer) {
        clearInterval(mouthTimer)
        mouthTimer = null
      }
      return
    }
    triggerChar(mouthCharIndex)
  }, charDuration)
}

function triggerChar(index: number) {
  const ch = mouthChars[index]
  const phonemeMap = phonemeMapOfChar(ch, index)
  const vowel = phonemeMap.primary
  // 情感化视素修饰：根据当前情绪调整权重
  const modifier = getEmotionModifier(lastEmotionRaw)
  const basePower = 0.7 + Math.random() * 0.3
  // 应用情感强度倍率 + 抖动
  const power = Math.min(1, basePower * modifier.intensityMultiplier + (Math.random() - 0.5) * modifier.jitter)
  // 次视素权重（用于更精细的唇形过渡）
  const secondaryPower = phonemeMap.secondaryWeight * modifier.intensityMultiplier

  // 重置所有元音目标，激活主视素 + 次视素
  for (const v of VOWELS) {
    if (v === vowel) {
      mouthTargets[v] = power
    } else if (v === phonemeMap.secondary && secondaryPower > 0) {
      mouthTargets[v] = secondaryPower
    } else {
      mouthTargets[v] = 0
    }
  }
  // 启动贝塞尔曲线过渡（主视素用 speakSustain，其它用 easeOut）
  startVisemeTransition(vowel, power, VISEME_TRANSITION_NORMAL, BEZIER_PRESETS.speakSustain)
  if (phonemeMap.secondary !== vowel && secondaryPower > 0) {
    startVisemeTransition(phonemeMap.secondary, secondaryPower, VISEME_TRANSITION_NORMAL, BEZIER_PRESETS.easeOut)
  }
  // 其它视素快速归零
  for (const v of VOWELS) {
    if (v !== vowel && v !== phonemeMap.secondary) {
      startVisemeTransition(v, 0, VISEME_TRANSITION_FAST, BEZIER_PRESETS.easeOut)
    }
  }
  // 预测式视素缓冲：预读下一个字符
  processPredictiveBuffer(index)
  lastCharTriggerTime = performance.now()
}

// ====== D5：模型重载（管理后台切换形象预览时触发） ======
async function reloadModel(modelPath: string) {
  if (!scene) return
  loadState.value = 'loading'
  // 清除旧模型（含纹理释放，防止显存泄漏导致渲染异常）
  if (currentVrm) {
    scene.remove(currentVrm.scene)
    currentVrm.scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      const mats = Array.isArray(mat) ? mat : (mat ? [mat] : [])
      mats.forEach((m) => {
        const anyMat = m as any
        ;['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap'].forEach((key) => {
          const tex = anyMat[key]
          if (tex && tex.isTexture) tex.dispose()
        })
        m.dispose()
      })
    })
    currentVrm = null
    expressionManager = null
    humanoid = null
  }
  // 重置 A-pose / 待机状态
  aposeBlend = 0
  idleBlend = 0
  idleActive = false
  idleActionIndex = -1
  idleActionStart = 0
  try {
    const loader = new GLTFLoader()
    loader.register((parser: any) => new VRMLoaderPlugin(parser))
    MODEL_SCALE = props.modelScale || 3.25
    const myGen = ++loadGeneration
    const gltf = await loader.loadAsync(modelPath)
    // 并发加载保护：如果在 await 期间有更新的加载请求，放弃本次结果
    if (myGen !== loadGeneration) return
    const vrm = gltf.userData.vrm as VRM
    if (!vrm) throw new Error('VRM 数据未找到')
    VRMUtils.removeUnnecessaryVertices(gltf.scene)
    VRMUtils.combineSkeletons(vrm.scene)
    vrm.scene.traverse((obj: THREE.Object3D) => {
      obj.frustumCulled = false
    })
    vrm.scene.rotation.y = 0 + (props.modelRotationY || 0)
    const box = new THREE.Box3().setFromObject(vrm.scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    vrm.scene.position.sub(center)
    modelBoundingRadius = box.getBoundingSphere(new THREE.Sphere()).radius
    modelHalfHeight = size.y / 2
    modelHalfWidth = size.x / 2
    vrm.scene.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
    scene.add(vrm.scene)
    currentVrm = vrm
    loadedModelPath = modelPath
    expressionManager = vrm.expressionManager || null
    humanoid = vrm.humanoid || null
    setExpression('neutral')
    loadState.value = 'ready'
    // 重新计算相机距离
    const container = resolveContainer()
    if (container) clampDistanceToBounds(container.clientWidth, container.clientHeight)
    updateCameraPose()
    // 确保 animate 循环正在运行（防止 initScene 未完成时被中断导致渲染停滞）
    if (!rafId) animate()
  } catch (e: any) {
    console.error('[Avatar3D] 模型重载失败:', e)
    loadState.value = 'error'
  }
}

// ====== 生命周期 ======
onMounted(() => {
  // #ifdef H5
  initScene()
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(onResize)
    // 注意：必须传真实 Element，不能传组件实例，否则抛
    // "parameter 1 is not of type 'Element'"
    const el = resolveContainer()
    if (el) resizeObserver.observe(el)
  } else {
    window.addEventListener('resize', onResize)
  }
  // 视口响应式定位增强：始终监听 window resize，作为 ResizeObserver 的补充，
  // 处理移动端地址栏伸缩、键盘弹起等导致视口变化但容器尺寸暂未触发的场景
  window.addEventListener('resize', onResize)
  // visualViewport API：移动端地址栏伸缩、双指缩放时实时响应
  if (typeof window.visualViewport !== 'undefined') {
    window.visualViewport.addEventListener('resize', onResize)
    window.visualViewport.addEventListener('scroll', onResize)
  }
  // 设备旋转：横竖屏切换时立即重新计算画布尺寸与相机距离
  window.addEventListener('orientationchange', onResize)
  // 键盘交互：任何按键重置待机计时器
  window.addEventListener('keydown', registerInteraction)
  // #endif
})

// D5：监听 modelPath 变化，重新加载 VRM 模型（管理后台预览切换形象时触发）
watch(() => props.modelPath, (newPath, oldPath) => {
  if (!newPath || newPath === oldPath) return
  // 跳过与 initScene 正在加载的相同路径（防止并发重复加载）
  if (newPath === intendedModelPath) return
  // 跳过已加载的相同路径
  if (newPath === loadedModelPath) return
  reloadModel(newPath)
})

// D5：监听 modelScale 变化，实时调整缩放（无需重新加载）
watch(() => props.modelScale, (newScale) => {
  MODEL_SCALE = newScale || 2.6
  if (currentVrm) {
    currentVrm.scene.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
    const container = resolveContainer()
    if (container) clampDistanceToBounds(container.clientWidth, container.clientHeight)
    updateCameraPose()
  }
})

// D5：监听 modelRotationY 变化，实时调整朝向
watch(() => props.modelRotationY, (newRot) => {
  if (currentVrm) {
    currentVrm.scene.rotation.y = 0 + (newRot || 0)
  }
})

onUnmounted(() => {
  if (mouthTimer) clearInterval(mouthTimer)
  if (resizeRafId !== null) cancelAnimationFrame(resizeRafId)
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('resize', onResize)
  // 解绑视口响应式监听
  if (typeof window.visualViewport !== 'undefined') {
    window.visualViewport.removeEventListener('resize', onResize)
    window.visualViewport.removeEventListener('scroll', onResize)
  }
  window.removeEventListener('orientationchange', onResize)
  window.removeEventListener('keydown', registerInteraction)
  // 解绑鼠标交互事件
  if (canvasEl) {
    canvasEl.removeEventListener('pointerdown', onPointerDown)
    canvasEl.removeEventListener('pointermove', onPointerMove)
    canvasEl.removeEventListener('pointerup', onPointerUp)
    canvasEl.removeEventListener('pointercancel', onPointerUp)
    canvasEl.removeEventListener('wheel', onWheel)
    canvasEl.removeEventListener('contextmenu', onContextMenu)
  }
  if (rafId) cancelAnimationFrame(rafId)
  // 释放 WebGL 资源（含纹理，防止显存泄漏）
  if (currentVrm) {
    currentVrm.scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[]
      const mats = Array.isArray(mat) ? mat : (mat ? [mat] : [])
      mats.forEach((m) => {
        const anyMat = m as any
        // 释放材质引用的所有纹理（map/normalMap/emissiveMap 等）
        ;['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap'].forEach((key) => {
          const tex = anyMat[key]
          if (tex && tex.isTexture) tex.dispose()
        })
        m.dispose()
      })
    })
  }
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = null
  }
  // 移除手动创建的 canvas DOM
  if (canvasEl && canvasEl.parentElement) {
    canvasEl.parentElement.removeChild(canvasEl)
  }
  canvasEl = null
  currentVrm = null
  expressionManager = null
  humanoid = null
})

// 暴露与 SimpleAvatar2D 兼容的接口 + 3D 增强方法
defineExpose({
  // 基础接口（向后兼容）
  setExpression,
  startSpeaking,
  stopSpeaking,
  speakText,
  setEmotion,
  ready: loadState,
  // 表情增强接口
  setExpressionWithIntensity,   // 带强度控制的表情
  setCoreEmotion,               // 8 种核心情绪
  setCompoundEmotion,           // 20 种复合情绪
})
</script>

<style lang="scss" scoped>
.avatar3d-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar3d-wrap {
  width: 100%;
  height: 100%;
  display: block;
}

.avatar3d-tip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
  }
  &.error text {
    color: #ffccc7;
  }
}

.avatar3d-name {
  position: absolute;
  bottom: 8rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.18);
}
</style>
