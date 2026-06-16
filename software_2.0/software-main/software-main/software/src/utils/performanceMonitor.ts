export interface PerformanceMetrics {
  loadStartTime: number
  loadEndTime: number
  totalLoadTime: number
  modelParseTime: number
  textureLoadTime: number
  frameRate: number
  memoryUsage: number
  drawCalls: number
  triangleCount: number
  modelSize: number
  cacheHit: boolean
}

export interface PerformanceReport {
  metrics: PerformanceMetrics
  timestamp: number
  deviceInfo: DeviceInfo
}

export interface DeviceInfo {
  browser: string
  os: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  gpu: string
  memory: number
  cores: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    loadStartTime: 0,
    loadEndTime: 0,
    totalLoadTime: 0,
    modelParseTime: 0,
    textureLoadTime: 0,
    frameRate: 60,
    memoryUsage: 0,
    drawCalls: 0,
    triangleCount: 0,
    modelSize: 0,
    cacheHit: false
  }
  
  private frameCount = 0
  private lastFrameTime = 0
  private fpsUpdateInterval: number | null = null
  private reports: PerformanceReport[] = []
  
  private deviceInfo: DeviceInfo = this.getDeviceInfo()

  private getDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent
    let browser = 'Unknown'
    let os = 'Unknown'
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'
    let gpu = 'Unknown'
    let memory = 0
    let cores = navigator.hardwareConcurrency || 4

    if (userAgent.includes('Chrome')) browser = 'Chrome'
    else if (userAgent.includes('Firefox')) browser = 'Firefox'
    else if (userAgent.includes('Safari')) browser = 'Safari'
    else if (userAgent.includes('Edge')) browser = 'Edge'

    if (userAgent.includes('Windows')) os = 'Windows'
    else if (userAgent.includes('Mac OS')) os = 'macOS'
    else if (userAgent.includes('Linux')) os = 'Linux'
    else if (userAgent.includes('Android')) os = 'Android'
    else if (userAgent.includes('like Mac')) os = 'iOS'

    if (/Mobile|Android|iPhone/.test(userAgent)) {
      deviceType = 'mobile'
    } else if (/Tablet|iPad/.test(userAgent)) {
      deviceType = 'tablet'
    }

    if (navigator.gpu) {
      navigator.gpu.requestAdapter().then(adapter => {
        if (adapter) {
          gpu = adapter.info.description || 'Unknown GPU'
        }
      })
    }

    if (navigator.deviceMemory) {
      memory = navigator.deviceMemory
    }

    return { browser, os, deviceType, gpu, memory, cores }
  }

  startTimer(metric: keyof Pick<PerformanceMetrics, 'loadStartTime' | 'modelParseTime' | 'textureLoadTime'>) {
    this.metrics[metric] = performance.now()
  }

  endTimer(metric: keyof Pick<PerformanceMetrics, 'loadStartTime' | 'modelParseTime' | 'textureLoadTime'>) {
    const startTime = this.metrics[metric]
    if (startTime > 0) {
      const endTime = performance.now()
      if (metric === 'loadStartTime') {
        this.metrics.loadEndTime = endTime
        this.metrics.totalLoadTime = endTime - startTime
      } else if (metric === 'modelParseTime') {
        this.metrics.modelParseTime = endTime - startTime
      } else if (metric === 'textureLoadTime') {
        this.metrics.textureLoadTime = endTime - startTime
      }
    }
  }

  startFPSMonitoring() {
    this.lastFrameTime = performance.now()
    this.frameCount = 0

    const measureFPS = () => {
      const now = performance.now()
      this.frameCount++

      if (now - this.lastFrameTime >= 1000) {
        this.metrics.frameRate = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime))
        this.frameCount = 0
        this.lastFrameTime = now
      }

      this.fpsUpdateInterval = requestAnimationFrame(measureFPS)
    }

    this.fpsUpdateInterval = requestAnimationFrame(measureFPS)
  }

  stopFPSMonitoring() {
    if (this.fpsUpdateInterval) {
      cancelAnimationFrame(this.fpsUpdateInterval)
      this.fpsUpdateInterval = null
    }
  }

  updateMemoryUsage() {
    if (performance.memory) {
      this.metrics.memoryUsage = (performance.memory.usedJSHeapSize / (1024 * 1024))
    }
  }

  setModelSize(size: number) {
    this.metrics.modelSize = size
  }

  setDrawCalls(count: number) {
    this.metrics.drawCalls = count
  }

  setTriangleCount(count: number) {
    this.metrics.triangleCount = count
  }

  setCacheHit(hit: boolean) {
    this.metrics.cacheHit = hit
  }

  getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage()
    return { ...this.metrics }
  }

  generateReport(): PerformanceReport {
    return {
      metrics: this.getMetrics(),
      timestamp: Date.now(),
      deviceInfo: this.deviceInfo
    }
  }

  saveReport() {
    const report = this.generateReport()
    this.reports.push(report)
    
    if (this.reports.length > 100) {
      this.reports.shift()
    }
  }

  getReports(): PerformanceReport[] {
    return [...this.reports]
  }

  reset() {
    this.metrics = {
      loadStartTime: 0,
      loadEndTime: 0,
      totalLoadTime: 0,
      modelParseTime: 0,
      textureLoadTime: 0,
      frameRate: 60,
      memoryUsage: 0,
      drawCalls: 0,
      triangleCount: 0,
      modelSize: 0,
      cacheHit: false
    }
    this.frameCount = 0
    this.lastFrameTime = 0
  }

  getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    return this.deviceInfo.deviceType
  }

  getPerformanceLevel(): 'high' | 'medium' | 'low' {
    const { deviceType, memory, cores } = this.deviceInfo
    
    if (deviceType === 'desktop' && memory >= 8 && cores >= 8) {
      return 'high'
    } else if (deviceType === 'desktop' && memory >= 4 && cores >= 4) {
      return 'medium'
    } else if (deviceType === 'tablet' || (deviceType === 'mobile' && memory >= 4)) {
      return 'medium'
    } else {
      return 'low'
    }
  }
}

export const performanceMonitor = new PerformanceMonitor()
