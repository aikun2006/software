/**
 * ARFeatureMatcher —— 多尺度特征匹配器（P3.1 ORB + P3.2 暗光增强）
 *
 * 职责：
 *   1. 替代 ARSceneRecognizer 中的简单 RGB 平均值匹配，提供更高精度的离线特征匹配
 *   2. 多尺度特征：将图片缩放到 32x32 和 16x16 两个尺度，分别计算特征
 *   3. 特征向量：平均 RGB + 亮度直方图（16-bin）+ 边缘方向直方图（8-bin）
 *   4. 匹配算法：加权欧氏距离（色彩权重 0.4 + 直方图权重 0.3 + 边缘权重 0.3）
 *   5. 动态阈值：根据当前光照亮度自动调整匹配阈值（亮环境提高阈值，暗环境降低阈值）
 *
 * P3.1 ORB特征匹配增强：
 *   - FAST-9关键点检测（圆周16像素，连续9个亮度差异判定角点）
 *   - rBRIEF描述符（128位二进制，带方向旋转的采样点对比较）
 *   - 汉明距离匹配（异或计数，比欧氏距离快10倍）
 *   - 关键点数量投票机制：匹配内点数越多置信度越高
 *
 * P3.2 暗光环境识别增强：
 *   - 暗光预处理：亮度<60时执行对比度拉伸（直方图均衡化）
 *   - 自适应权重：暗光降低色彩权重（不可靠），提高边缘+ORB权重
 *   - 细化动态阈值：5级亮度分区，暗光更严格
 *
 * 可选注入 ARExitManager：销毁时清空特征缓存。
 */

import { ARExitManager } from './ARExitManager'

/** ORB关键点 */
export interface ORBKeyPoint {
  /** x坐标（相对于特征提取尺寸） */
  x: number
  /** y坐标（相对于特征提取尺寸） */
  y: number
  /** 角点强度分数 */
  score: number
  /** 主方向（弧度，用于rBRIEF旋转不变性） */
  orientation: number
}

/** 图片特征向量 */
export interface ImageFeature {
  /** 平均红色通道值（0-255） */
  avgR: number
  /** 平均绿色通道值（0-255） */
  avgG: number
  /** 平均蓝色通道值（0-255） */
  avgB: number
  /** 平均亮度（0-255，加权计算） */
  brightness: number
  /** 亮度直方图（16-bin，归一化后各 bin 占比 0-1） */
  histogram: number[]
  /** 边缘方向直方图（8-bin，归一化后各 bin 占比 0-1） */
  edgeHistogram: number[]
  /** P3.1: ORB关键点列表 */
  keypoints: ORBKeyPoint[]
  /** P3.1: BRIEF描述符数组（每个关键点一个128位描述符，16字节） */
  descriptors: Uint8Array[]
  /** P3.1: 关键点数量 */
  keypointCount: number
}

/** 匹配结果 */
export interface MatchResult {
  /** 匹配到的景点 ID（无匹配时为 null） */
  spotId: string | null
  /** 加权距离（越小越相似） */
  distance: number
  /** 置信度（0-1，由距离转换而来） */
  confidence: number
}

/** 亮度直方图 bin 数 */
const HISTOGRAM_BINS = 16

/** 边缘方向直方图 bin 数 */
const EDGE_BINS = 8

/** 基准匹配阈值（距离小于此值才认为匹配） */
const BASE_THRESHOLD = 0.5

// ===== P3.1 ORB相关常量 =====

/** ORB特征提取的图像尺寸（48x48，兼顾精度和性能） */
const ORB_IMAGE_SIZE = 48

/** FAST角点检测阈值（中心像素与圆周像素的亮度差需超过此值） */
const FAST_THRESHOLD = 20

/** 最大保留的关键点数量（非极大值抑制后取top-N） */
const MAX_KEYPOINTS = 50

/** BRIEF描述符位数（128位 = 16字节） */
const BRIEF_BITS = 128
const BRIEF_BYTES = BRIEF_BITS / 8

/** 汉明距离匹配阈值（小于此值认为关键点匹配成功） */
const ORB_MATCH_DISTANCE_THRESHOLD = 64

/** FAST圆周16个像素的偏移量（相对于中心像素） */
const FAST_CIRCLE: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -3 }, { dx: 1, dy: -3 }, { dx: 2, dy: -2 }, { dx: 3, dy: -1 },
  { dx: 3, dy: 0 }, { dx: 3, dy: 1 }, { dx: 2, dy: 2 }, { dx: 1, dy: 3 },
  { dx: 0, dy: 3 }, { dx: -1, dy: 3 }, { dx: -2, dy: 2 }, { dx: -3, dy: 1 },
  { dx: -3, dy: 0 }, { dx: -3, dy: -1 }, { dx: -2, dy: -2 }, { dx: -1, dy: -3 }
]

/**
 * rBRIEF采样点对（128对，预生成固定随机模式）
 * 每对在 [-13, 13] 范围内，围绕关键点采样比较亮度
 */
const BRIEF_PATTERN: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number }> = (() => {
  // 使用固定种子伪随机数生成器，保证每次生成的模式一致
  let seed = 42
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return (seed / 0x7fffffff) * 2 - 1 // -1 ~ 1
  }
  const pairs: { x1: number; y1: number; x2: number; y2: number }[] = []
  const radius = 13
  for (let i = 0; i < BRIEF_BITS; i++) {
    pairs.push({
      x1: Math.round(rand() * radius),
      y1: Math.round(rand() * radius),
      x2: Math.round(rand() * radius),
      y2: Math.round(rand() * radius)
    })
  }
  return pairs
})()

/**
 * P3.1: 字节popcount查表（0-255每个值的1的位数）
 * 用于快速计算汉明距离
 */
const POPCOUNT_TABLE: ReadonlyArray<number> = (() => {
  const table = new Array(256)
  for (let i = 0; i < 256; i++) {
    let count = 0
    let n = i
    while (n) {
      count += n & 1
      n >>= 1
    }
    table[i] = count
  }
  return table
})()

export class ARFeatureMatcher {
  /** 特征缓存：图片 src/base64 -> ImageFeature */
  private featureCache: Map<string, ImageFeature> = new Map()

  /** 外部资源回收管理器（可选） */
  private exitManager: ARExitManager | null = null
  /** 已注册的资源句柄 ID */
  private cacheHandleId: string | null = null

  constructor(exitManager?: ARExitManager) {
    this.exitManager = exitManager ?? null
    this.registerCache()
  }

  /**
   * 计算图片 URL 的特征向量。
   * 内部带缓存，同一 src 不重复计算。
   *
   * @param imageSrc 图片 URL 或 base64
   */
  computeFeature(imageSrc: string): Promise<ImageFeature> {
    // 命中缓存
    const cached = this.featureCache.get(imageSrc)
    if (cached) {
      return Promise.resolve(cached)
    }
    return this.loadImage(imageSrc).then(img => {
      const feature = this.extractFeature(img)
      this.featureCache.set(imageSrc, feature)
      return feature
    })
  }

  /**
   * 计算 base64 图片的特征向量。
   * 与 computeFeature 内部逻辑一致，仅语义分离便于调用。
   *
   * @param base64 base64 字符串（data:image/... 或纯 base64）
   */
  computeFeatureFromBase64(base64: string): Promise<ImageFeature> {
    return this.computeFeature(base64)
  }

  /**
   * 匹配当前帧特征与景点特征库。
   *
   * 匹配算法：
   *   1. 计算帧特征与每个景点特征的加权距离
   *   2. 取距离最小的景点作为候选
   *   3. 根据当前亮度计算动态阈值
   *   4. 候选距离 < 动态阈值 → 匹配成功，置信度由距离反比计算
   *
   * @param frameFeature 当前帧特征
   * @param spotFeatures 景点特征库（spotId -> ImageFeature）
   */
  match(frameFeature: ImageFeature, spotFeatures: Map<string, ImageFeature>): MatchResult {
    let bestSpotId: string | null = null
    let bestDistance = Infinity

    for (const [spotId, feature] of spotFeatures) {
      const dist = this.computeDistance(frameFeature, feature)
      if (dist < bestDistance) {
        bestDistance = dist
        bestSpotId = spotId
      }
    }

    // 动态阈值
    const threshold = this.getDynamicThreshold(frameFeature.brightness)

    if (bestSpotId !== null && bestDistance < threshold) {
      // 置信度：距离越小置信度越高，distance=0 时置信度=1
      // 使用 threshold 归一化，上限 0.85（离线匹配置信度上限）
      const confidence = Math.min(1 - bestDistance / threshold, 0.85)
      return {
        spotId: bestSpotId,
        distance: bestDistance,
        confidence: Math.max(0, confidence)
      }
    }

    return {
      spotId: null,
      distance: bestDistance,
      confidence: 0
    }
  }

  /**
   * 多参考图匹配：对每个景点的多张参考图特征取最佳匹配。
   *
   * 策略：
   *   1. 对每个景点的所有参考图特征计算距离，取最小距离作为该景点的代表距离
   *   2. 在所有景点中取距离最小的作为候选
   *   3. 候选距离 < 动态阈值 → 匹配成功
   *
   * 多参考图机制显著提升识别准确率：
   *   - 不同角度、光线下的参考图覆盖更多实际拍摄场景
   *   - 取最小距离相当于"最近邻"匹配，容错性更强
   *
   * @param frameFeature 当前帧特征
   * @param spotFeaturesMap 景点多图特征库（spotId -> ImageFeature[]）
   */
  matchMultiple(
    frameFeature: ImageFeature,
    spotFeaturesMap: Map<string, ImageFeature[]>
  ): MatchResult {
    let bestSpotId: string | null = null
    let bestDistance = Infinity

    for (const [spotId, features] of spotFeaturesMap) {
      // 对该景点的所有参考图取最小距离
      let spotMinDist = Infinity
      for (const refFeature of features) {
        const dist = this.computeDistance(frameFeature, refFeature)
        if (dist < spotMinDist) {
          spotMinDist = dist
        }
      }
      // 更新全局最佳
      if (spotMinDist < bestDistance) {
        bestDistance = spotMinDist
        bestSpotId = spotId
      }
    }

    // 动态阈值
    const threshold = this.getDynamicThreshold(frameFeature.brightness)

    if (bestSpotId !== null && bestDistance < threshold) {
      const confidence = Math.min(1 - bestDistance / threshold, 0.92)
      return {
        spotId: bestSpotId,
        distance: bestDistance,
        confidence: Math.max(0, confidence)
      }
    }

    return {
      spotId: null,
      distance: bestDistance,
      confidence: 0
    }
  }

  /**
   * 计算图片的平均亮度（0-255）。
   * 用于动态阈值计算。
   *
   * @param base64 图片 base64
   */
  computeBrightness(base64: string): Promise<number> {
    return this.loadImage(base64).then(img => {
      const feature = this.extractFeature(img)
      return feature.brightness
    })
  }

  /**
   * P3.2：根据亮度返回动态匹配阈值（5级细化分区）。
   *
   * 动态调整原理：
   *   - 极暗（亮度 < 30）：阈值 -0.15，特征严重退化，要求最严格匹配
   *   - 暗环境（30 ≤ 亮度 < 80）：阈值 -0.08，色彩不可靠，收紧匹配
   *   - 正常环境（80 ≤ 亮度 ≤ 180）：使用基准阈值
   *   - 偏亮环境（180 < 亮度 ≤ 220）：阈值 +0.05，轻微过曝容忍
   *   - 过曝环境（亮度 > 220）：阈值 +0.1，颜色偏白特征偏移
   *
   * @param brightness 当前画面亮度（0-255）
   */
  getDynamicThreshold(brightness: number): number {
    if (brightness < 30) {
      // 极暗环境：特征严重退化，要求最严格匹配
      return BASE_THRESHOLD - 0.15
    } else if (brightness < 80) {
      // 暗环境：色彩不可靠，收紧匹配阈值
      return BASE_THRESHOLD - 0.08
    } else if (brightness > 220) {
      // 过曝：颜色偏白特征偏移，适当放宽
      return BASE_THRESHOLD + 0.1
    } else if (brightness > 180) {
      // 偏亮：轻微过曝容忍
      return BASE_THRESHOLD + 0.05
    }
    return BASE_THRESHOLD
  }

  /**
   * P3.2：根据亮度获取自适应特征权重。
   *
   * 暗光环境下色彩特征不可靠（噪点多、色偏），降低色彩权重，
   * 提高边缘直方图和ORB特征的权重（这两种对光照变化更鲁棒）。
   *
   * @param brightness 当前画面亮度（0-255）
   * @returns 归一化的4维权重 { color, histogram, edge, orb }
   */
  private getAdaptiveWeights(brightness: number): { color: number; histogram: number; edge: number; orb: number } {
    if (brightness < 30) {
      // 极暗：色彩几乎无效，以ORB+边缘为主
      return { color: 0.1, histogram: 0.1, edge: 0.35, orb: 0.45 }
    } else if (brightness < 80) {
      // 暗光：降低色彩权重，提高ORB和边缘
      return { color: 0.2, histogram: 0.15, edge: 0.3, orb: 0.35 }
    } else if (brightness > 220) {
      // 过曝：色彩偏白，增加ORB权重
      return { color: 0.25, histogram: 0.2, edge: 0.25, orb: 0.3 }
    }
    // 正常光照：ORB为主，其他为辅
    return { color: 0.25, histogram: 0.15, edge: 0.2, orb: 0.4 }
  }

  /**
   * 计算两个特征之间的加权距离（P3.1+P3.2增强版）。
   *
   * 距离组成（4维加权）：
   *   1. 色彩距离：RGB 欧氏距离归一化到 0-1
   *   2. 亮度直方图距离：卡方距离，归一化到 0-1
   *   3. 边缘直方图距离：卡方距离，归一化到 0-1
   *   4. P3.1 ORB距离：1 - (匹配关键点数 / max(两图关键点数))
   *
   * 权重根据当前帧亮度自适应调整（P3.2）：
   *   暗光降低色彩权重，提高ORB+边缘权重
   */
  private computeDistance(a: ImageFeature, b: ImageFeature): number {
    // 使用帧特征(a)的亮度选择自适应权重
    const weights = this.getAdaptiveWeights(a.brightness)

    // 色彩距离（归一化到 0-1）
    const colorDist = Math.sqrt(
      Math.pow(a.avgR - b.avgR, 2) +
      Math.pow(a.avgG - b.avgG, 2) +
      Math.pow(a.avgB - b.avgB, 2)
    ) / 441.673 // sqrt(255^2 * 3)

    // 亮度直方图距离（卡方距离）
    const histDist = this.chiSquareDistance(a.histogram, b.histogram)
    // 边缘直方图距离（卡方距离）
    const edgeDist = this.chiSquareDistance(a.edgeHistogram, b.edgeHistogram)

    // P3.1: ORB特征距离（1 - 匹配率，匹配率越高距离越小）
    const orbDist = this.computeORBDistance(a, b)

    // 加权求和
    return (
      colorDist * weights.color +
      histDist * weights.histogram +
      edgeDist * weights.edge +
      orbDist * weights.orb
    )
  }

  /**
   * P3.1：计算两个特征的ORB距离。
   *
   * 算法：
   *   1. 对a中每个关键点，在b中找汉明距离最小的匹配
   *   2. 距离 < ORB_MATCH_DISTANCE_THRESHOLD 视为内点
   *   3. 距离 = 1 - (内点数 / max(a关键点数, b关键点数, 1))
   *
   * @returns 0~1，0表示完全匹配，1表示无匹配
   */
  private computeORBDistance(a: ImageFeature, b: ImageFeature): number {
    // 关键点为空时无法匹配，返回中性距离
    if (a.keypointCount === 0 || b.keypointCount === 0) {
      return 0.5
    }

    let inlierCount = 0
    for (let i = 0; i < a.descriptors.length; i++) {
      const descA = a.descriptors[i]
      let minDist = Infinity
      for (let j = 0; j < b.descriptors.length; j++) {
        const dist = this.hammingDistance(descA, b.descriptors[j])
        if (dist < minDist) {
          minDist = dist
        }
      }
      if (minDist < ORB_MATCH_DISTANCE_THRESHOLD) {
        inlierCount++
      }
    }

    const maxKp = Math.max(a.keypointCount, b.keypointCount)
    return 1 - (inlierCount / maxKp)
  }

  /**
   * P3.1：计算两个BRIEF描述符的汉明距离（异或后1的位数）。
   * 使用查表法快速计算每字节的popcount。
   */
  private hammingDistance(a: Uint8Array, b: Uint8Array): number {
    let dist = 0
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
      dist += POPCOUNT_TABLE[a[i] ^ b[i]]
    }
    return dist
  }

  /**
   * 计算两个直方图之间的卡方距离。
   *
   * 卡方距离公式：sum((a-b)^2 / (a+b))，对零值做保护。
   * 结果归一化到 0-1（除以 bin 数 / 2 的理论上限）。
   */
  private chiSquareDistance(a: number[], b: number[]): number {
    let sum = 0
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
      const denom = a[i] + b[i]
      if (denom > 0) {
        const diff = a[i] - b[i]
        sum += (diff * diff) / denom
      }
    }
    // 卡方距离理论上限为 bin 数（每 bin 最大贡献 1），归一化到 0-1
    return Math.min(1, sum / len)
  }

  /**
   * 从 Image 元素提取多尺度特征（P3.1+P3.2增强版）。
   *
   * 多尺度策略：
   *   - 32x32 尺度：用于计算平均 RGB 和亮度直方图（细节较多）
   *   - 16x16 尺度：用于计算边缘方向直方图（粗糙轮廓更稳定）
   *   - 48x48 尺度：P3.1 ORB特征提取（FAST关键点 + rBRIEF描述符）
   *
   * P3.2 暗光增强：
   *   - 亮度 < 80 时，对48x48灰度图执行对比度拉伸后再提取ORB特征
   */
  private extractFeature(img: HTMLImageElement): ImageFeature {
    // 尺度 1：32x32，计算色彩 + 亮度直方图
    const { avgR, avgG, avgB, brightness, histogram } = this.computeColorAndHistogram(img, 32)
    // 尺度 2：16x16，计算边缘方向直方图
    const edgeHistogram = this.computeEdgeHistogram(img, 16)

    // P3.1: 尺度 3 — 48x48，提取ORB关键点和BRIEF描述符
    const { keypoints, descriptors } = this.extractORBFeatures(img, brightness)

    return {
      avgR,
      avgG,
      avgB,
      brightness,
      histogram,
      edgeHistogram,
      keypoints,
      descriptors,
      keypointCount: keypoints.length
    }
  }

  /**
   * P3.1：提取ORB特征（FAST关键点 + rBRIEF描述符）。
   *
   * 算法流程：
   *   1. 将图片缩放到48x48灰度图
   *   2. P3.2：暗光环境下执行对比度拉伸增强
   *   3. FAST-9角点检测（圆周16像素，连续9个亮/暗判定）
   *   4. 非极大值抑制，保留top-50关键点
   *   5. 计算每个关键点的主方向（灰度质心法）
   *   6. 生成rBRIEF描述符（128位，带方向旋转）
   *
   * @param img 图片元素
   * @param brightness 当前亮度（用于决定是否执行暗光增强）
   */
  private extractORBFeatures(
    img: HTMLImageElement,
    brightness: number
  ): { keypoints: ORBKeyPoint[]; descriptors: Uint8Array[] } {
    const size = ORB_IMAGE_SIZE
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return { keypoints: [], descriptors: [] }
    }

    ctx.drawImage(img, 0, 0, size, size)
    const imageData = ctx.getImageData(0, 0, size, size)
    const data = imageData.data

    // 灰度化
    const gray = new Float32Array(size * size)
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }

    // P3.2：暗光环境对比度拉伸
    if (brightness < 80) {
      this.enhanceContrast(gray, size)
    }

    // FAST关键点检测
    const rawKeypoints = this.detectFASTKeypoints(gray, size)

    // 非极大值抑制 + 取top-N
    const keypoints = this.nonMaxSuppression(rawKeypoints, size).slice(0, MAX_KEYPOINTS)

    // 为每个关键点计算主方向 + rBRIEF描述符
    const descriptors: Uint8Array[] = []
    for (const kp of keypoints) {
      // 计算主方向（灰度质心法）
      kp.orientation = this.computeOrientation(gray, size, kp.x, kp.y)
      // 生成rBRIEF描述符
      const desc = this.computeBRIEFDescriptor(gray, size, kp)
      descriptors.push(desc)
    }

    return { keypoints, descriptors }
  }

  /**
   * P3.1：FAST-9角点检测。
   *
   * FAST算法：
   *   1. 对每个像素(跳过边界3px)，检查半径3的圆周上16个像素
   *   2. 如果有连续≥9个像素亮度 > 中心+阈值 或 < 中心-阈值，则判定为角点
   *   3. 角点分数 = 连续像素数（越大越强）
   *
   * @param gray 灰度图（Float32Array）
   * @param size 图像边长
   */
  private detectFASTKeypoints(gray: Float32Array, size: number): ORBKeyPoint[] {
    const keypoints: ORBKeyPoint[] = []

    for (let y = 3; y < size - 3; y++) {
      for (let x = 3; x < size - 3; x++) {
        const center = gray[y * size + x]
        const high = center + FAST_THRESHOLD
        const low = center - FAST_THRESHOLD

        // 快速预检：检查1, 5, 9, 13号像素（上下左右）
        // 至少3个满足条件才继续完整检测
        const p1 = gray[(y + FAST_CIRCLE[0].dy) * size + (x + FAST_CIRCLE[0].dx)]
        const p5 = gray[(y + FAST_CIRCLE[4].dy) * size + (x + FAST_CIRCLE[4].dx)]
        const p9 = gray[(y + FAST_CIRCLE[8].dy) * size + (x + FAST_CIRCLE[8].dx)]
        const p13 = gray[(y + FAST_CIRCLE[12].dy) * size + (x + FAST_CIRCLE[12].dx)]

        let brightCount = 0
        let darkCount = 0
        if (p1 > high) brightCount++; else if (p1 < low) darkCount++
        if (p5 > high) brightCount++; else if (p5 < low) darkCount++
        if (p9 > high) brightCount++; else if (p9 < low) darkCount++
        if (p13 > high) brightCount++; else if (p13 < low) darkCount++

        if (brightCount < 2 && darkCount < 2) continue

        // 完整圆周检测：找最长连续亮/暗序列
        const circleValues: number[] = []
        for (const offset of FAST_CIRCLE) {
          circleValues.push(gray[(y + offset.dy) * size + (x + offset.dx)])
        }

        // 检查亮序列（连续>high）
        let maxBrightRun = 0
        let maxDarkRun = 0
        // 处理圆周的环绕：遍历两圈
        for (let start = 0; start < 16; start++) {
          let brightRun = 0
          let darkRun = 0
          for (let k = 0; k < 16; k++) {
            const idx = (start + k) % 16
            if (circleValues[idx] > high) {
              brightRun++
              darkRun = 0
            } else if (circleValues[idx] < low) {
              darkRun++
              brightRun = 0
            } else {
              break
            }
          }
          maxBrightRun = Math.max(maxBrightRun, brightRun)
          maxDarkRun = Math.max(maxDarkRun, darkRun)
        }

        // FAST-9：连续≥9个亮或暗像素
        if (maxBrightRun >= 9 || maxDarkRun >= 9) {
          keypoints.push({
            x,
            y,
            score: Math.max(maxBrightRun, maxDarkRun),
            orientation: 0
          })
        }
      }
    }

    return keypoints
  }

  /**
   * P3.1：非极大值抑制（NMS）。
   * 在3x3邻域内只保留分数最高的关键点，避免角点聚集。
   */
  private nonMaxSuppression(keypoints: ORBKeyPoint[], size: number): ORBKeyPoint[] {
    if (keypoints.length === 0) return []

    // 构建分数图
    const scoreMap = new Float32Array(size * size)
    for (const kp of keypoints) {
      scoreMap[kp.y * size + kp.x] = kp.score
    }

    const result: ORBKeyPoint[] = []
    for (const kp of keypoints) {
      let isMax = true
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = kp.x + dx
          const ny = kp.y + dy
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue
          if (scoreMap[ny * size + nx] > kp.score) {
            isMax = false
            break
          }
        }
      }
      if (isMax) {
        result.push(kp)
      }
    }

    // 按分数降序排序
    result.sort((a, b) => b.score - a.score)
    return result
  }

  /**
   * P3.1：计算关键点的主方向（灰度质心法/IC角点方向）。
   *
   * 在关键点周围15x15邻域内，计算灰度质心相对于几何中心的偏移角度。
   * 用于rBRIEF描述符的旋转不变性。
   */
  private computeOrientation(gray: Float32Array, size: number, cx: number, cy: number): number {
    const radius = 7
    let m01 = 0
    let m10 = 0
    let sum = 0

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = cx + dx
        const py = cy + dy
        if (px < 0 || px >= size || py < 0 || py >= size) continue
        // 圆形区域
        if (dx * dx + dy * dy > radius * radius) continue
        const val = gray[py * size + px]
        m10 += dx * val
        m01 += dy * val
        sum += val
      }
    }

    if (sum === 0) return 0
    return Math.atan2(m01 / sum, m10 / sum)
  }

  /**
   * P3.1：计算rBRIEF描述符（128位二进制，带方向旋转）。
   *
   * 算法：
   *   1. 使用预定义的128组采样点对（BRIEF_PATTERN）
   *   2. 根据关键点主方向旋转采样点（旋转矩阵）
   *   3. 对每对采样点比较亮度：若p1 < p2则bit=1，否则bit=0
   *   4. 打包为16字节的Uint8Array
   */
  private computeBRIEFDescriptor(gray: Float32Array, size: number, kp: ORBKeyPoint): Uint8Array {
    const desc = new Uint8Array(BRIEF_BYTES)
    const cos = Math.cos(kp.orientation)
    const sin = Math.sin(kp.orientation)

    for (let i = 0; i < BRIEF_BITS; i++) {
      const pattern = BRIEF_PATTERN[i]
      // 旋转采样点
      const rx1 = Math.round(pattern.x1 * cos - pattern.y1 * sin)
      const ry1 = Math.round(pattern.x1 * sin + pattern.y1 * cos)
      const rx2 = Math.round(pattern.x2 * cos - pattern.y2 * sin)
      const ry2 = Math.round(pattern.x2 * sin + pattern.y2 * cos)

      // 采样（边界保护）
      const px1 = Math.max(0, Math.min(size - 1, kp.x + rx1))
      const py1 = Math.max(0, Math.min(size - 1, kp.y + ry1))
      const px2 = Math.max(0, Math.min(size - 1, kp.x + rx2))
      const py2 = Math.max(0, Math.min(size - 1, kp.y + ry2))

      const v1 = gray[py1 * size + px1]
      const v2 = gray[py2 * size + px2]

      // 比较亮度，设置bit
      if (v1 < v2) {
        desc[i >> 3] |= (1 << (i & 7))
      }
    }

    return desc
  }

  /**
   * P3.2：对比度拉伸增强（暗光环境预处理）。
   *
   * 算法：线性拉伸 + 直方图均衡化简化版
   *   1. 找到灰度图的min/max
   *   2. 线性拉伸到 [0, 255] 全范围
   *   3. 若动态范围太小（< 80），额外做Gamma校正提升暗部细节
   *
   * @param gray 灰度图（原地修改）
   * @param size 图像边长
   */
  private enhanceContrast(gray: Float32Array, size: number): void {
    let min = 255
    let max = 0

    for (let i = 0; i < gray.length; i++) {
      if (gray[i] < min) min = gray[i]
      if (gray[i] > max) max = gray[i]
    }

    const range = max - min
    if (range < 1) return // 全图相同，无法增强

    // 线性拉伸到 [0, 255]
    const scale = 255 / range
    for (let i = 0; i < gray.length; i++) {
      gray[i] = (gray[i] - min) * scale
    }

    // 动态范围太小时，Gamma校正提升暗部
    if (range < 80) {
      const gamma = 0.5 // 开根号，提亮暗部
      const invGamma = 1 / gamma
      for (let i = 0; i < gray.length; i++) {
        gray[i] = 255 * Math.pow(gray[i] / 255, invGamma)
      }
    }
  }

  /**
   * 计算图片的平均 RGB、亮度及亮度直方图。
   *
   * 亮度公式：Y = 0.299R + 0.587G + 0.114B（ITU-R BT.601）
   *
   * @param img 图片元素
   * @param size 缩放尺寸（边长）
   */
  private computeColorAndHistogram(
    img: HTMLImageElement,
    size: number
  ): { avgR: number; avgG: number; avgB: number; brightness: number; histogram: number[] } {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      // 无法获取上下文，返回全零特征
      return {
        avgR: 0,
        avgG: 0,
        avgB: 0,
        brightness: 0,
        histogram: new Array(HISTOGRAM_BINS).fill(0)
      }
    }

    ctx.drawImage(img, 0, 0, size, size)
    const imageData = ctx.getImageData(0, 0, size, size)
    const data = imageData.data

    let totalR = 0
    let totalG = 0
    let totalB = 0
    const histogram = new Array(HISTOGRAM_BINS).fill(0)
    const pixelCount = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      totalR += r
      totalG += g
      totalB += b

      // 亮度（0-255）
      const y = 0.299 * r + 0.587 * g + 0.114 * b
      // 映射到 16-bin（每 bin 覆盖 16 个亮度值）
      const bin = Math.min(HISTOGRAM_BINS - 1, Math.floor(y / (256 / HISTOGRAM_BINS)))
      histogram[bin]++
    }

    // 平均 RGB
    const avgR = totalR / pixelCount
    const avgG = totalG / pixelCount
    const avgB = totalB / pixelCount
    const brightness = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB

    // 直方图归一化（各 bin 占比 0-1）
    const normalizedHist = histogram.map(c => pixelCount > 0 ? c / pixelCount : 0)

    return { avgR, avgG, avgB, brightness, histogram: normalizedHist }
  }

  /**
   * 计算图片的边缘方向直方图。
   *
   * 算法：
   *   1. 灰度化
   *   2. Sobel 算子计算梯度（Gx, Gy）
   *   3. 计算梯度方向 angle = atan2(Gy, Gx)，映射到 0-180 度（无符号方向）
   *   4. 按方向分 8 个 bin 统计梯度幅值
   *   5. 归一化为占比
   *
   * 边缘方向对光照变化不敏感，能区分建筑轮廓与自然景观。
   *
   * @param img 图片元素
   * @param size 缩放尺寸（边长，建议 16x16）
   */
  private computeEdgeHistogram(img: HTMLImageElement, size: number): number[] {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return new Array(EDGE_BINS).fill(0)
    }

    ctx.drawImage(img, 0, 0, size, size)
    const imageData = ctx.getImageData(0, 0, size, size)
    const data = imageData.data

    // 灰度化
    const gray: number[] = new Array(size * size)
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }

    const edgeHist = new Array(EDGE_BINS).fill(0)
    let totalMagnitude = 0

    // Sobel 算子计算梯度（跳过边界像素）
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = y * size + x

        // Sobel Gx
        const gx =
          -gray[idx - size - 1] - 2 * gray[idx - 1] - gray[idx + size - 1] +
          gray[idx - size + 1] + 2 * gray[idx + 1] + gray[idx + size + 1]

        // Sobel Gy
        const gy =
          -gray[idx - size - 1] - 2 * gray[idx - size] - gray[idx - size + 1] +
          gray[idx + size - 1] + 2 * gray[idx + size] + gray[idx + size + 1]

        const magnitude = Math.sqrt(gx * gx + gy * gy)
        if (magnitude < 10) continue // 忽略弱边缘（噪声）

        // 梯度方向（0-180 度，无符号）
        const angle = (Math.atan2(gy, gx) * 180 / Math.PI + 180) % 180
        // 映射到 8-bin（每 bin 覆盖 22.5 度）
        const bin = Math.min(EDGE_BINS - 1, Math.floor(angle / (180 / EDGE_BINS)))
        edgeHist[bin] += magnitude
        totalMagnitude += magnitude
      }
    }

    // 归一化（各 bin 占比 0-1）
    if (totalMagnitude > 0) {
      return edgeHist.map(v => v / totalMagnitude)
    }
    return edgeHist.map(() => 1 / EDGE_BINS)
  }

  /**
   * 加载图片为 HTMLImageElement。
   * 支持 URL 和 base64 两种格式。
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      // 跨域图片需设置 crossOrigin 以便读取像素数据
      if (!src.startsWith('data:')) {
        img.crossOrigin = 'anonymous'
      }

      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`[ARFeatureMatcher] 图片加载失败: ${src.substring(0, 50)}`))
      img.src = src
    })
  }

  /** 清空特征缓存 */
  clearCache(): void {
    this.featureCache.clear()
  }

  /** 获取当前缓存的特征数量 */
  getCacheSize(): number {
    return this.featureCache.size
  }

  /** 向 ARExitManager 注册缓存资源句柄 */
  private registerCache(): void {
    if (!this.exitManager) return
    this.cacheHandleId = `ar-feature-cache-${Date.now()}`
    this.exitManager.register({
      type: 'cache',
      id: this.cacheHandleId,
      dispose: () => this.clearCache()
    })
  }
}
