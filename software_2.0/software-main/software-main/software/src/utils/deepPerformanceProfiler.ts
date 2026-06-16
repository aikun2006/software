export interface PerformanceMetrics {
  timestamp: number
  cpuCores: number
  deviceMemory: number
  gpuMemory?: number
}

export interface InitializationStage {
  id: string
  name: string
  description: string
  startTime: number
  endTime: number
  duration: number
  cpuUsage?: number
  memoryUsage?: number
  subStages?: InitializationStage[]
  critical: boolean
  dependencies?: string[]
}

export interface VRMAnalysis {
  vertexCount: number
  faceCount: number
  triangleCount: number
  boneCount: number
  textureCount: number
  textureMemory: number
  materialCount: number
  animationClipCount: number
  expressionCount: number
  blendShapeCount: number
}

export interface ShaderMetrics {
  totalVariants: number
  compiledVariants: number
  compileTime: Map<string, number>
  totalCompileTime: number
}

export interface DetailedPerformanceReport {
  initializationStages: InitializationStage[]
  vrmAnalysis: VRMAnalysis | null
  shaderMetrics: ShaderMetrics | null
  networkMetrics: NetworkMetrics | null
  memoryMetrics: MemoryMetrics
  frameMetrics: FrameMetrics[]
  deviceInfo: DeviceInfo
  totalInitializationTime: number
  criticalPathTime: number
  bottlenecks: Bottleneck[]
  recommendations: OptimizationRecommendation[]
}

export interface DeviceInfo {
  userAgent: string
  platform: string
  deviceMemory: number
  hardwareConcurrency: number
  screenResolution: { width: number; height: number }
  devicePixelRatio: number
  estimatedGPU?: string
}

export interface NetworkMetrics {
  requestCount: number
  totalDownloadSize: number
  downloadTime: number
  averageBandwidth: number
  requestTimings: Map<string, { start: number; end: number; size: number }>
}

export interface MemoryMetrics {
  initialHeap: number
  peakHeap: number
  finalHeap: number
  allocatedBuffers: number
  textureMemory: number
  geometryMemory: number
}

export interface FrameMetrics {
  frameNumber: number
  timestamp: number
  deltaTime: number
  fps: number
  cpuTime: number
  gpuTime?: number
  drawCalls: number
  triangles: number
}

export interface Bottleneck {
  stageId: string
  stageName: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  impactPercentage: number
  rootCause: string
  possibleSolutions: string[]
}

export interface OptimizationRecommendation {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  estimatedImprovement: string
  difficulty: 'easy' | 'medium' | 'hard'
  implementationSteps: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

export interface BenchmarkConfig {
  iterations: number
  warmupIterations: number
  collectMemoryStats: boolean
  collectShaderStats: boolean
  collectNetworkStats: boolean
  collectGPUStats: boolean
  sampleFrameRate: boolean
  sampleDuration: number
}

const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  iterations: 10,
  warmupIterations: 3,
  collectMemoryStats: true,
  collectShaderStats: true,
  collectNetworkStats: true,
  collectGPUStats: false,
  sampleFrameRate: true,
  sampleDuration: 5000
}

class DeepPerformanceProfiler {
  private currentStageStack: InitializationStage[] = []
  private stages: Map<string, InitializationStage> = new Map()
  private frameMetrics: FrameMetrics[] = []
  private vrmAnalysis: VRMAnalysis | null = null
  private shaderMetrics: ShaderMetrics = {
    totalVariants: 0,
    compiledVariants: 0,
    compileTime: new Map(),
    totalCompileTime: 0
  }
  private networkMetrics: NetworkMetrics = {
    requestCount: 0,
    totalDownloadSize: 0,
    downloadTime: 0,
    averageBandwidth: 0,
    requestTimings: new Map()
  }
  private memoryMetrics: MemoryMetrics = {
    initialHeap: 0,
    peakHeap: 0,
    finalHeap: 0,
    allocatedBuffers: 0,
    textureMemory: 0,
    geometryMemory: 0
  }
  private benchmarkResults: DetailedPerformanceReport[] = []
  private isBenchmarking: boolean = false
  private frameSamplingActive: boolean = false
  private frameSampleStartTime: number = 0
  private frameCount: number = 0
  private lastFrameTime: number = 0

  startProfiling(): void {
    this.stages.clear()
    this.frameMetrics = []
    this.currentStageStack = []
    this.frameCount = 0
    
    const perf = performance as any
    this.memoryMetrics.initialHeap = perf.memory?.usedJSHeapSize || 0
    this.memoryMetrics.peakHeap = this.memoryMetrics.initialHeap
  }

  startStage(
    id: string,
    name: string,
    description: string,
    critical: boolean = true,
    dependencies: string[] = []
  ): void {
    const stage: InitializationStage = {
      id,
      name,
      description,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      critical,
      dependencies
    }
    this.currentStageStack.push(stage)
    this.stages.set(id, stage)
  }

  endStage(id: string): void {
    const stage = this.stages.get(id)
    if (stage) {
      stage.endTime = performance.now()
      stage.duration = stage.endTime - stage.startTime
      
      if (this.currentStageStack.length > 1) {
        const parent = this.currentStageStack[this.currentStageStack.length - 2]
        if (parent) {
          if (!parent.subStages) parent.subStages = []
          parent.subStages.push(stage)
        }
      }
      
      this.currentStageStack.pop()
      this.updateMemoryMetrics()
    }
  }

  async profileStage<T>(
    id: string,
    name: string,
    description: string,
    fn: () => Promise<T>,
    critical: boolean = true,
    dependencies: string[] = []
  ): Promise<T> {
    this.startStage(id, name, description, critical, dependencies)
    try {
      const result = await fn()
      this.endStage(id)
      return result
    } catch (error) {
      this.endStage(id)
      throw error
    }
  }

  recordVRMAnalysis(analysis: VRMAnalysis): void {
    this.vrmAnalysis = analysis
  }

  recordShaderCompile(shaderName: string, compileTime: number): void {
    this.shaderMetrics.compileTime.set(shaderName, compileTime)
    this.shaderMetrics.totalCompileTime += compileTime
    this.shaderMetrics.compiledVariants++
  }

  recordNetworkRequest(
    url: string,
    startTime: number,
    endTime: number,
    size: number
  ): void {
    this.networkMetrics.requestCount++
    this.networkMetrics.totalDownloadSize += size
    this.networkMetrics.downloadTime += endTime - startTime
    this.networkMetrics.requestTimings.set(url, { start: startTime, end: endTime, size })
  }

  private updateMemoryMetrics(): void {
    const perf = performance as any
    if (perf.memory) {
      this.memoryMetrics.finalHeap = perf.memory.usedJSHeapSize
      if (this.memoryMetrics.finalHeap > this.memoryMetrics.peakHeap) {
        this.memoryMetrics.peakHeap = this.memoryMetrics.finalHeap
      }
    }
  }

  recordTextureMemory(size: number): void {
    this.memoryMetrics.textureMemory += size
  }

  recordGeometryMemory(size: number): void {
    this.memoryMetrics.geometryMemory += size
  }

  recordFrame(deltaTime: number, drawCalls?: number, triangles?: number): void {
    if (!this.frameSamplingActive) return

    const now = performance.now()
    this.frameCount++

    const frameMetric: FrameMetrics = {
      frameNumber: this.frameCount,
      timestamp: now,
      deltaTime,
      fps: Math.round(1000 / deltaTime),
      cpuTime: deltaTime,
      drawCalls: drawCalls || 0,
      triangles: triangles || 0
    }

    this.frameMetrics.push(frameMetric)

    if (now - this.frameSampleStartTime > 30000) {
      this.stopFrameSampling()
    }
  }

  startFrameSampling(): void {
    this.frameSamplingActive = true
    this.frameSampleStartTime = performance.now()
    this.frameCount = 0
    this.frameMetrics = []
  }

  stopFrameSampling(): void {
    this.frameSamplingActive = false
  }

  getDeviceInfo(): DeviceInfo {
    const nav = navigator as any
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      deviceMemory: nav.deviceMemory || 4,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      screenResolution: {
        width: window.screen.width,
        height: window.screen.height
      },
      devicePixelRatio: window.devicePixelRatio
    }
  }

  identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = []
    const stages = Array.from(this.stages.values())
    const totalTime = this.getTotalTime()

    stages.forEach(stage => {
      const impact = (stage.duration / totalTime) * 100
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'low'
      
      if (impact > 40) severity = 'critical'
      else if (impact > 25) severity = 'high'
      else if (impact > 10) severity = 'medium'

      if (severity !== 'low' && stage.critical) {
        bottlenecks.push({
          stageId: stage.id,
          stageName: stage.name,
          severity,
          impactPercentage: Math.round(impact),
          rootCause: this.identifyRootCause(stage),
          possibleSolutions: this.getPossibleSolutions(stage.id)
        })
      }
    })

    return bottlenecks.sort((a, b) => b.impactPercentage - a.impactPercentage)
  }

  private identifyRootCause(stage: InitializationStage): string {
    if (stage.id.includes('download')) return '网络带宽限制或资源文件过大'
    if (stage.id.includes('parse')) return '模型解析复杂度高或VRM文件结构复杂'
    if (stage.id.includes('shader')) return 'Shader变体过多或编译逻辑复杂'
    if (stage.id.includes('scene')) return '场景初始化逻辑冗余'
    return '需要进一步分析的性能瓶颈'
  }

  private getPossibleSolutions(stageId: string): string[] {
    switch (stageId) {
      case 'download_model':
        return [
          '实施模型压缩（减少文件大小30-50%）',
          '使用CDN加速下载',
          '实现渐进式加载（先加载低质量版本）'
        ]
      case 'parse_model':
        return [
          '使用Web Worker在后台线程解析模型',
          '实现模型预解析和缓存',
          '简化模型复杂度（减少顶点/面片数）'
        ]
      case 'compile_shaders':
        return [
          '实现Shader预编译（应用启动时）',
          '减少Shader变体数量（移除不必要的组合）',
          '使用简化Shader变体进行首屏渲染'
        ]
      default:
        return ['优化算法复杂度', '减少冗余计算', '实施并行处理']
    }
  }

  generateRecommendations(bottlenecks: Bottleneck[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = []

    if (bottlenecks.some(b => b.stageId.includes('download'))) {
      recommendations.push({
        id: 'compression',
        title: '模型资源压缩',
        description: '对VRM模型文件进行压缩，减少下载和加载时间',
        priority: 'critical',
        estimatedImprovement: '30-50%加载时间减少',
        difficulty: 'medium',
        implementationSteps: [
          '使用gzip/brotli压缩VRM文件',
          '简化模型几何结构',
          '压缩纹理资源'
        ],
        riskLevel: 'low'
      })
    }

    if (bottlenecks.some(b => b.stageId.includes('parse'))) {
      recommendations.push({
        id: 'parallel_processing',
        title: '并行处理与Web Worker',
        description: '将模型解析等计算密集型任务移至后台线程',
        priority: 'high',
        estimatedImprovement: '25-40%解析时间减少',
        difficulty: 'hard',
        implementationSteps: [
          '创建模型解析Web Worker',
          '实现主线程与Worker通信',
          '处理进度更新回调'
        ],
        riskLevel: 'medium'
      })
    }

    recommendations.push({
      id: 'progressive_loading',
      title: '分级资源加载',
      description: '优先加载首屏所需资源，延迟加载非关键资源',
      priority: 'high',
      estimatedImprovement: '40-60%首屏时间减少',
      difficulty: 'medium',
      implementationSteps: [
        '定义资源优先级',
        '实现分级加载管理器',
        '实现加载完成后的资源整合'
      ],
      riskLevel: 'low'
    })

    return recommendations
  }

  getCriticalPathTime(): number {
    let criticalTime = 0
    const criticalStages = Array.from(this.stages.values()).filter(s => s.critical)
    criticalStages.forEach(stage => {
      criticalTime += stage.duration
    })
    return criticalTime
  }

  getTotalTime(): number {
    const stages = Array.from(this.stages.values())
    if (stages.length === 0) return 0
    const firstTime = Math.min(...stages.map(s => s.startTime))
    const lastTime = Math.max(...stages.map(s => s.endTime || s.startTime))
    return lastTime - firstTime
  }

  getReport(): DetailedPerformanceReport {
    return {
      initializationStages: Array.from(this.stages.values()),
      vrmAnalysis: this.vrmAnalysis,
      shaderMetrics: { ...this.shaderMetrics },
      networkMetrics: this.networkMetrics,
      memoryMetrics: { ...this.memoryMetrics },
      frameMetrics: [...this.frameMetrics],
      deviceInfo: this.getDeviceInfo(),
      totalInitializationTime: this.getTotalTime(),
      criticalPathTime: this.getCriticalPathTime(),
      bottlenecks: this.identifyBottlenecks(),
      recommendations: this.generateRecommendations(this.identifyBottlenecks())
    }
  }

  async runBenchmark(
    testFn: () => Promise<void>,
    config: Partial<BenchmarkConfig> = {}
  ): Promise<DetailedPerformanceReport> {
    const fullConfig = { ...DEFAULT_BENCHMARK_CONFIG, ...config }
    this.isBenchmarking = true
    this.benchmarkResults = []

    console.log('=== 开始性能基准测试 ===')
    console.log(`配置: 迭代${fullConfig.iterations}次, 预热${fullConfig.warmupIterations}次`)

    for (let i = 0; i < fullConfig.warmupIterations; i++) {
      console.log(`预热迭代 ${i + 1}/${fullConfig.warmupIterations}`)
      this.startProfiling()
      await testFn()
    }

    for (let i = 0; i < fullConfig.iterations; i++) {
      console.log(`测试迭代 ${i + 1}/${fullConfig.iterations}`)
      this.startProfiling()
      
      if (fullConfig.sampleFrameRate) {
        this.startFrameSampling()
      }

      await testFn()

      this.stopFrameSampling()
      const report = this.getReport()
      this.benchmarkResults.push(report)

      console.log(`迭代 ${i + 1} 完成: ${Math.round(report.totalInitializationTime)}ms`)
    }

    const averageReport = this.computeAverageReport(this.benchmarkResults)
    this.isBenchmarking = false

    console.log('=== 性能基准测试完成 ===')
    console.log(`平均初始化时间: ${Math.round(averageReport.totalInitializationTime)}ms`)

    return averageReport
  }

  private computeAverageReport(reports: DetailedPerformanceReport[]): DetailedPerformanceReport {
    if (reports.length === 0) return this.getReport()

    const times = reports.map(r => r.totalInitializationTime)
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length
    const variance = times.reduce((sum, t) => sum + Math.pow(t - averageTime, 2), 0) / times.length
    const stdDev = Math.sqrt(variance)

    console.log(`初始化时间标准差: ${Math.round(stdDev)}ms (${Math.round((stdDev / averageTime) * 100)}%)`)

    return {
      ...reports[0],
      totalInitializationTime: averageTime
    }
  }

  exportToJSON(): string {
    return JSON.stringify(this.getReport(), (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value)
      }
      return value
    }, 2)
  }

  reset(): void {
    this.startProfiling()
    this.vrmAnalysis = null
    this.shaderMetrics = {
      totalVariants: 0,
      compiledVariants: 0,
      compileTime: new Map(),
      totalCompileTime: 0
    }
  }
}

export const deepProfiler = new DeepPerformanceProfiler()
