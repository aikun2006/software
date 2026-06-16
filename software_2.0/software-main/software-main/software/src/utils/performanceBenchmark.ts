export interface BenchmarkConfig {
  iterations: number
  warmUpRuns: number
  deviceProfiles: DeviceProfile[]
}

export interface DeviceProfile {
  name: string
  memory: number
  cores: number
  deviceType: 'desktop' | 'mobile' | 'tablet'
  expectedLevel: 'high' | 'medium' | 'low'
}

export interface BenchmarkResult {
  testName: string
  iterations: number
  average: number
  min: number
  max: number
  median: number
  p95: number
  stdDev: number
  deviceProfile: DeviceProfile
  timestamp: number
}

export interface InitBenchmarkReport {
  results: BenchmarkResult[]
  totalTime: number
  deviceInfo: DeviceProfile
  recommendations: string[]
}

class PerformanceBenchmark {
  private config: BenchmarkConfig = {
    iterations: 5,
    warmUpRuns: 2,
    deviceProfiles: [
      {
        name: '高端设备',
        memory: 8,
        cores: 8,
        deviceType: 'desktop',
        expectedLevel: 'high'
      },
      {
        name: '中端设备',
        memory: 4,
        cores: 4,
        deviceType: 'mobile',
        expectedLevel: 'medium'
      },
      {
        name: '低端设备',
        memory: 2,
        cores: 2,
        deviceType: 'mobile',
        expectedLevel: 'low'
      }
    ]
  }

  private deviceProfile: DeviceProfile = this.detectDeviceProfile()

  private detectDeviceProfile(): DeviceProfile {
    const nav = navigator as any
    const memory = nav.deviceMemory || 4
    const cores = navigator.hardwareConcurrency || 4
    
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'
    const userAgent = navigator.userAgent
    if (/Mobile|Android|iPhone/.test(userAgent)) {
      deviceType = 'mobile'
    } else if (/Tablet|iPad/.test(userAgent)) {
      deviceType = 'tablet'
    }

    let expectedLevel: 'high' | 'medium' | 'low' = 'low'
    if (memory >= 8 && cores >= 8) {
      expectedLevel = 'high'
    } else if (memory >= 4 && cores >= 4) {
      expectedLevel = 'medium'
    }

    return {
      name: `${deviceType}-${expectedLevel}`,
      memory,
      cores,
      deviceType,
      expectedLevel
    }
  }

  async runBenchmark(
    testName: string,
    testFn: () => Promise<void> | void
  ): Promise<BenchmarkResult> {
    const times: number[] = []

    for (let i = 0; i < this.config.warmUpRuns; i++) {
      await testFn()
      await this.delay(100)
    }

    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now()
      await testFn()
      const end = performance.now()
      times.push(end - start)
      await this.delay(200)
    }

    return this.calculateResults(testName, times)
  }

  private calculateResults(testName: string, times: number[]): BenchmarkResult {
    const sorted = [...times].sort((a, b) => a - b)
    const sum = times.reduce((acc, val) => acc + val, 0)
    const average = sum / times.length
    const median = sorted[Math.floor(sorted.length / 2)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    
    const squaredDiffs = times.map(t => Math.pow(t - average, 2))
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / times.length
    const stdDev = Math.sqrt(variance)

    return {
      testName,
      iterations: this.config.iterations,
      average: Math.round(average * 100) / 100,
      min: Math.round(sorted[0] * 100) / 100,
      max: Math.round(sorted[sorted.length - 1] * 100) / 100,
      median: Math.round(median * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      deviceProfile: this.deviceProfile,
      timestamp: Date.now()
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async runInitBenchmark(
    initFn: () => Promise<void>
  ): Promise<InitBenchmarkReport> {
    const startTime = performance.now()
    const results: BenchmarkResult[] = []
    const recommendations: string[] = []

    const stageResults = {
      threeLoad: await this.runBenchmark('THREE库加载', async () => {
        await new Promise<void>(resolve => {
          if (window.THREE) {
            resolve()
          } else {
            const handler = () => resolve()
            window.addEventListener('three-ready', handler, { once: true })
            setTimeout(resolve, 3000)
          }
        })
      }),

      sceneInit: await this.runBenchmark('场景初始化', async () => {
        await initFn()
      }),

      modelLoad: await this.runBenchmark('模型加载', async () => {
        await initFn()
      }),

      firstRender: await this.runBenchmark('首次渲染', async () => {
        await initFn()
      })
    }

    results.push(...Object.values(stageResults))

    const avgTotal = results.reduce((sum, r) => sum + r.average, 0)
    
    if (this.deviceProfile.expectedLevel === 'low') {
      recommendations.push('建议使用低分辨率模型')
      recommendations.push('考虑启用模型预加载')
    }
    
    if (avgTotal > 3000) {
      recommendations.push('总初始化时间超过3秒，建议优化模型大小')
    }

    if (stageResults.threeLoad.average > 1000) {
      recommendations.push('CDN加载时间过长，考虑使用本地资源')
    }

    return {
      results,
      totalTime: Math.round(performance.now() - startTime),
      deviceInfo: this.deviceProfile,
      recommendations
    }
  }

  generateComparisonReport(
    before: InitBenchmarkReport,
    after: InitBenchmarkReport
  ): string {
    let report = '# 性能优化对比报告\n\n'
    report += `## 测试时间: ${new Date().toLocaleString()}\n\n`
    report += `## 设备信息\n`
    report += `- 设备类型: ${before.deviceInfo.deviceType}\n`
    report += `- 内存: ${before.deviceInfo.memory}GB\n`
    report += `- CPU核心数: ${before.deviceInfo.cores}\n`
    report += `- 预期性能等级: ${before.deviceInfo.expectedLevel}\n\n`

    report += `## 优化效果对比\n\n`
    report += `| 测试项目 | 优化前 | 优化后 | 提升 | 提升比例 |\n`
    report += `|---------|--------|--------|------|----------|\n`

    before.results.forEach((beforeResult, index) => {
      const afterResult = after.results[index]
      const improvement = beforeResult.average - afterResult.average
      const percent = ((improvement / beforeResult.average) * 100).toFixed(1)
      
      report += `| ${beforeResult.testName} | ${beforeResult.average}ms | ${afterResult.average}ms | ${improvement.toFixed(1)}ms | ${percent}% |\n`
    })

    const totalBefore = before.results.reduce((sum, r) => sum + r.average, 0)
    const totalAfter = after.results.reduce((sum, r) => sum + r.average, 0)
    const totalImprovement = totalBefore - totalAfter
    const totalPercent = ((totalImprovement / totalBefore) * 100).toFixed(1)

    report += `\n**总体优化效果**: ${totalImprovement.toFixed(1)}ms (${totalPercent}%)\n\n`

    if (after.recommendations.length > 0) {
      report += `## 优化建议\n\n`
      after.recommendations.forEach(rec => {
        report += `- ${rec}\n`
      })
    }

    return report
  }

  getDeviceProfile(): DeviceProfile {
    return this.deviceProfile
  }

  setConfig(config: Partial<BenchmarkConfig>) {
    this.config = { ...this.config, ...config }
  }
}

export const benchmark = new PerformanceBenchmark()
