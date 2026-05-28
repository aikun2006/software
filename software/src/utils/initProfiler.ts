export interface InitStage {
  name: string
  startTime: number
  endTime?: number
  duration?: number
}

export interface InitPerformanceReport {
  stages: InitStage[]
  totalTime: number
  deviceInfo: any
  timestamp: number
}

class InitializationProfiler {
  private stages: Map<string, InitStage> = new Map()
  private startTime: number = 0

  start() {
    this.startTime = performance.now()
    this.stages.clear()
  }

  markStart(stageName: string) {
    this.stages.set(stageName, {
      name: stageName,
      startTime: performance.now()
    })
  }

  markEnd(stageName: string) {
    const stage = this.stages.get(stageName)
    if (stage) {
      stage.endTime = performance.now()
      stage.duration = stage.endTime - stage.startTime
    }
  }

  getReport(): InitPerformanceReport {
    const stages = Array.from(this.stages.values())
    const totalTime = performance.now() - this.startTime

    return {
      stages,
      totalTime,
      deviceInfo: this.getDeviceInfo(),
      timestamp: Date.now()
    }
  }

  getStageDuration(stageName: string): number {
    return this.stages.get(stageName)?.duration || 0
  }

  getTotalTime(): number {
    return performance.now() - this.startTime
  }

  private getDeviceInfo() {
    const nav = navigator as any
    return {
      userAgent: navigator.userAgent,
      deviceMemory: nav.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency,
      platform: navigator.platform
    }
  }
}

export const initProfiler = new InitializationProfiler()

export const profileInit = async <T>(
  stageName: string,
  fn: () => T | Promise<T>
): Promise<T> => {
  initProfiler.markStart(stageName)
  try {
    const result = await fn()
    initProfiler.markEnd(stageName)
    return result
  } catch (error) {
    initProfiler.markEnd(stageName)
    throw error
  }
}
