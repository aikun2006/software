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

    <!-- 可选名字标签 -->
    <text v-if="showName" class="avatar3d-name">小乐</text>
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

const props = withDefaults(
  defineProps<{
    /** 容器宽度（rpx 或 css 值） */
    width?: string
    /** 容器高度（rpx 或 css 值） */
    height?: string
    /** 显示名字标签 */
    showName?: boolean
    /** 待机时是否自动眨眼 */
    autoBlink?: boolean
    /** 加载提示文案 */
    loadingText?: string
    /** 错误提示文案 */
    errorText?: string
  }>(),
  {
    width: '100%',
    height: '100%',
    showName: false,
    autoBlink: true,
    loadingText: '小乐正在出场…',
    errorText: '3D 形象加载失败',
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

// 自维护的计时器（替代已废弃的 THREE.Clock，避免控制台警告）
let lastFrameTime = 0
let elapsedTime = 0

// 设备性能等级（在 initScene 中赋值）：低端设备开启动画帧率降级
let isLowEndDevice = false
// 动画帧率降级计数器：低端设备隔帧更新呼吸/眨眼
let animSkipCounter = 0

// 模型缩放倍数：等比例放大 200%（修改缩放变换矩阵，保持宽高比与几何完整性）
const MODEL_SCALE = 2.0

// ====== 相机轨道控制（自定义实现：禁用右键平移，仅水平360°环绕 + 滚轮缩放） ======
// 满足硬性约束：模型几何中心位于世界原点，相机以模型中心为轴心做水平环绕
let orbitYaw = 0                 // 水平旋转角（弧度），0 = 正面
const orbitPitch = 0             // 垂直俯仰固定为 0：严格"只能左右转圈查看"
let orbitDistance = 2.0          // 当前相机到模型中心的距离
let orbitMinDistance = 0.5       // 最小缩放距离（动态计算）
let orbitMaxDistance = 6.0       // 最大缩放距离（动态计算）
let modelBoundingRadius = 0      // 模型全局包围球半径
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
// 当前：上移 1/5 面板
const VERTICAL_OFFSET_RATIO = 1 / 5

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

// 表情：VRM 标准表情 preset
type ExprPreset = 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'relaxed'
let currentExpression: ExprPreset = 'neutral'
let expressionWeight = 0 // 平滑过渡到 1

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
  // 中文
  const py = CHAR_PINYIN[ch]
  if (py) {
    const initial = py.replace(/^[aeiou]/, '') || py
    return INITIAL_TO_VOWEL[initial] || VOWELS[fallbackIndex % VOWELS.length]
  }
  // 未命中：按索引轮换，保证说话时嘴在动
  return VOWELS[fallbackIndex % VOWELS.length]
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

  // 待机呼吸：spine / chest 微微起伏 + 头部轻摆
  if (runAnim && humanoid && currentVrm) {
    const hips = humanoid.getNormalizedBoneNode('hips')
    const spine = humanoid.getNormalizedBoneNode('spine')
    const head = humanoid.getNormalizedBoneNode('head')
    if (hips) hips.position.y = THREE.MathUtils.lerp(hips.position.y, -0.04 + Math.sin(t * 1.5) * 0.01, 0.1)
    if (spine) spine.rotation.z = Math.sin(t * 0.8) * 0.02
    if (head) {
      head.rotation.y = Math.sin(t * 0.5) * 0.04
      head.rotation.x = Math.sin(t * 0.7) * 0.02
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
    for (const v of VOWELS) {
      const cur = expressionManager.getValue(v) || 0
      const tgt = mouthTargets[v]
      const next = THREE.MathUtils.lerp(cur, tgt, delta * 12)
      expressionManager.setValue(v, next)
    }
    // 表情权重平滑
    const curExpr = expressionManager.getValue(currentExpression) || 0
    expressionManager.setValue(currentExpression, THREE.MathUtils.lerp(curExpr, expressionWeight, delta * 6))
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

  // 加载 VRM
  try {
    const loader = new GLTFLoader()
    loader.register((parser: any) => new VRMLoaderPlugin(parser))

    const gltf = await loader.loadAsync('/static/avatars/guide.vrm')
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
    // 模型默认朝 +Z，翻转使其面向相机（相机位于 +Z）
    vrm.scene.rotation.y = Math.PI

    // ============ 布局居中规则 ============
    // 1) 计算全局包围盒，重置模型几何中心到世界原点
    //    满足硬性约束："画布可视区域中心点与模型几何中心完全重合"
    const box = new THREE.Box3().setFromObject(vrm.scene)
    const center = box.getCenter(new THREE.Vector3())
    vrm.scene.position.sub(center) // 几何中心移到 (0,0,0)
    modelCenterY = 0
    // 缓存原始包围球半径（基于 scale=1），用于边界校验与相机距离计算
    // 注意：保持原始半径，使后续模型 scale 放大后相机距离不跟随放大，实现视觉放大
    modelBoundingRadius = box.getBoundingSphere(new THREE.Sphere()).radius

    // 2) 模型缩放变换：等比例放大 200%（修改缩放变换矩阵）
    //    scale X/Y/Z 同比例放大，严格保持宽高比例与几何结构完整性，无拉伸变形
    //    纹理采样由 GPU 自动处理（已开启 mipmap + 各向异性过滤），放大后保持原始清晰度
    //    由于 modelBoundingRadius 保持原始值，computeFitDistance 计算的相机距离不跟随放大，
    //    从而实现模型视觉尺寸放大 200%（相机不动、模型变大）
    vrm.scene.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)

    scene.add(vrm.scene)
    currentVrm = vrm
    expressionManager = vrm.expressionManager || null
    humanoid = vrm.humanoid || null
    // 初始化表情为自然
    setExpression('neutral')
    expressionWeight = 1

    // 2) 自动计算适配相机距离，给模型四边预留统一安全边距
    const fitDist = computeFitDistance(w, h)
    orbitDistance = fitDist
    orbitMinDistance = fitDist * 0.6  // 防止过大穿出画面
    orbitMaxDistance = fitDist * 2.8  // 防止过小看不见
    updateCameraPose()

    loadState.value = 'ready'
    animate()
    onResize()
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
 * 垂直偏移修正：模型上移 VERTICAL_OFFSET_RATIO 后，上方可用空间减少为
 * (0.5 - VERTICAL_OFFSET_RATIO) 半画布高；需增大距离让模型缩小以完整容纳。
 */
function computeFitDistance(w: number, h: number): number {
  if (!camera || modelBoundingRadius <= 0) return 2.0
  const fovRad = THREE.MathUtils.degToRad(camera.fov) // 垂直 FOV
  const aspect = w / Math.max(h, 1)
  const halfV = Math.tan(fovRad / 2)
  const halfH = halfV * aspect // 水平半视场角的正切
  // 垂直方向：模型上移后，上方可用空间比例 = 0.5 - VERTICAL_OFFSET_RATIO
  // 要求 R / (D * halfV) ≤ (0.5 - VERTICAL_OFFSET_RATIO) * SAFE_MARGIN
  const verticalSpace = Math.max(0.5 - VERTICAL_OFFSET_RATIO, 0.05)
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
  // 模型在画面中上移 VERTICAL_OFFSET_RATIO 比例：
  // 相机目标点 Y 下移对应世界距离，使模型呈现上移效果。
  // halfCanvasHeight 为当前距离下的半画布高度（世界空间），
  // 偏移量 = VERTICAL_OFFSET_RATIO * 完整画布高度 = VERTICAL_OFFSET_RATIO * 2 * halfCanvasHeight
  const halfCanvasHeight = orbitDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  const targetYOffset = -halfCanvasHeight * VERTICAL_OFFSET_RATIO * 2
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

function onResize() {
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
}
let resizeObserver: ResizeObserver | null = null

// ====== 鼠标交互（自定义实现，禁用右键平移） ======

/** 左键按下：开始水平环绕旋转。仅响应左键(button=0)，中键/右键忽略 */
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  isPointerDown = true
  userInteracting = true
  lastPointerX = e.clientX
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
  userInteracting = true
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

/** 设置表情（VRM 标准 preset 名） */
function setExpression(expr: ExprPreset | string) {
  // 先把旧表情权重目标归零
  if (expressionManager && currentExpression !== 'neutral') {
    expressionManager.setValue(currentExpression, 0)
  }
  currentExpression = (expr as ExprPreset) || 'neutral'
  expressionWeight = currentExpression === 'neutral' ? 0 : 1
}

/** 通过 AI 情绪（positive/neutral/negative）驱动表情 */
function setEmotion(emotion: 'positive' | 'neutral' | 'negative') {
  const map: Record<string, ExprPreset> = {
    positive: 'happy',
    negative: 'sad',
    neutral: 'neutral',
  }
  setExpression(map[emotion] || 'neutral')
}

/** 开始说话（连续轮换口型，无具体文本时使用） */
function startSpeaking() {
  isSpeaking.value = true
  // 没有文本时，给一个默认循环
  if (!mouthChars.length) {
    speakText('啊啊哦哦嗯嗯')
  }
}

/** 停止说话：口型归零 */
function stopSpeaking() {
  isSpeaking.value = false
  if (mouthTimer) {
    clearInterval(mouthTimer)
    mouthTimer = null
  }
  mouthChars = []
  mouthCharIndex = 0
  for (const v of VOWELS) mouthTargets[v] = 0
}

/**
 * 文本驱动伪口型：把文本拆成字符，按节奏依次触发对应元音。
 * 这是 startSpeaking 的增强版，让嘴型与正在播报的文字同步。
 * @param text 要播报的文本
 * @param charDuration 每个字的持续时间(ms)，建议 150~200
 */
function speakText(text: string, charDuration = 160) {
  isSpeaking.value = true
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
      // 文本念完，自然收口
      stopSpeaking()
      return
    }
    triggerChar(mouthCharIndex)
  }, charDuration)
}

function triggerChar(index: number) {
  const ch = mouthChars[index]
  const vowel = vowelOfChar(ch, index)
  // 重置所有元音目标，只激活当前一个；加一点随机抖动更像在说话
  const power = 0.7 + Math.random() * 0.3
  for (const v of VOWELS) mouthTargets[v] = v === vowel ? power : 0
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
  // #endif
})

onUnmounted(() => {
  if (mouthTimer) clearInterval(mouthTimer)
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('resize', onResize)
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
  setExpression,
  startSpeaking,
  stopSpeaking,
  // 3D 增强接口
  speakText,
  setEmotion,
  ready: loadState,
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
