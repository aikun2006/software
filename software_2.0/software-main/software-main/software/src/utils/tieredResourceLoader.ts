export type ResourcePriority = 'critical' | 'high' | 'medium' | 'low' | 'background'

export type ResourceType = 'model' | 'texture' | 'shader' | 'animation' | 'material'

export interface ResourceTask {
  id: string
  url: string
  type: ResourceType
  priority: ResourcePriority
  dependencies?: string[]
  onProgress?: (progress: number, loaded: number, total: number) => void
  onComplete?: (data: any, taskId: string) => void
  onError?: (error: Error, taskId: string) => void
  metadata?: Record<string, any>
}

export interface LoadedResource {
  id: string
  data: any
  type: ResourceType
  loadTime: number
  size: number
  timestamp: number
}

export interface LoadingStats {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  failedTasks: number
  activeTasks: number
  totalLoadTime: number
  bandwidthUsage: number
}

export interface TieredLoaderConfig {
  maxConcurrentTasks: number
  retryAttempts: number
  retryDelay: number
  timeout: number
  enableProgressiveLoading: boolean
  backgroundLoadDelay: number
  prioritizeBasedOnDevice: boolean
}

const DEFAULT_CONFIG: TieredLoaderConfig = {
  maxConcurrentTasks: 4,
  retryAttempts: 2,
  retryDelay: 1000,
  timeout: 180000,
  enableProgressiveLoading: true,
  backgroundLoadDelay: 500,
  prioritizeBasedOnDevice: true
}

const PRIORITY_WEIGHTS: Record<ResourcePriority, number> = {
  'critical': 5,
  'high': 4,
  'medium': 3,
  'low': 2,
  'background': 1
}

export class TieredResourceLoader {
  private config: TieredLoaderConfig
  private queue: ResourceTask[] = []
  private activeTasks: Map<string, Promise<LoadedResource>> = new Map()
  private loadedResources: Map<string, LoadedResource> = new Map()
  private failedTasks: Set<string> = new Set()
  private taskDependencies: Map<string, Set<string>> = new Map()
  private waitingDependents: Map<string, string[]> = new Map()
  private isRunning: boolean = false
  private loadStartTime: number = 0
  private loadCompleteTime: number = 0
  private totalDataLoaded: number = 0
  private onQueueChangeCallbacks: Array<(stats: LoadingStats) => void> = []

  constructor(config: Partial<TieredLoaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.adjustConfigForDevice()
  }

  private adjustConfigForDevice(): void {
    if (!this.config.prioritizeBasedOnDevice) return

    const nav = navigator as any
    const cores = navigator.hardwareConcurrency || 4
    const memory = nav.deviceMemory || 4

    if (memory >= 8 && cores >= 8) {
      this.config.maxConcurrentTasks = 6
    } else if (memory >= 4 && cores >= 4) {
      this.config.maxConcurrentTasks = 4
    } else {
      this.config.maxConcurrentTasks = 2
    }

    console.log(`分级加载器配置: 并发数=${this.config.maxConcurrentTasks}`)
  }

  addTask(task: ResourceTask): void {
    if (this.loadedResources.has(task.id)) {
      console.log(`任务 ${task.id} 已加载，跳过`)
      task.onComplete?.(this.loadedResources.get(task.id)?.data, task.id)
      return
    }

    if (task.dependencies && task.dependencies.length > 0) {
      task.dependencies.forEach(depId => {
        if (!this.waitingDependents.has(depId)) {
          this.waitingDependents.set(depId, [])
        }
        this.waitingDependents.get(depId)!.push(task.id)
      })
      this.taskDependencies.set(task.id, new Set(task.dependencies))
    }

    this.queue.push(task)
    this.sortQueue()
    this.notifyQueueChange()

    if (!this.isRunning) {
      this.start()
    }
  }

  addBatchTasks(tasks: ResourceTask[]): void {
    tasks.forEach(task => this.addTask(task))
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      const weightDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
      if (weightDiff !== 0) return weightDiff
      return (a.metadata?.order || 0) - (b.metadata?.order || 0)
    })
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.loadStartTime = performance.now()
    this.processQueue()
  }

  stop(): void {
    this.isRunning = false
  }

  private async processQueue(): Promise<void> {
    while (this.isRunning && (this.queue.length > 0 || this.activeTasks.size > 0)) {
      while (this.activeTasks.size < this.config.maxConcurrentTasks && this.queue.length > 0) {
        const task = this.getNextAvailableTask()
        if (task) {
          this.executeTask(task)
        } else {
          break
        }
      }

      if (this.activeTasks.size > 0) {
        await Promise.race(Array.from(this.activeTasks.values()))
      } else {
        break
      }
    }

    if (this.queue.length === 0 && this.activeTasks.size === 0) {
      this.isRunning = false
      this.loadCompleteTime = performance.now()
      console.log(`所有资源加载完成，总耗时: ${Math.round(this.loadCompleteTime - this.loadStartTime)}ms`)
    }
  }

  private getNextAvailableTask(): ResourceTask | null {
    for (let i = 0; i < this.queue.length; i++) {
      const task = this.queue[i]
      if (this.canStartTask(task)) {
        this.queue.splice(i, 1)
        return task
      }
    }
    return null
  }

  private canStartTask(task: ResourceTask): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true
    }

    return task.dependencies.every(depId => this.loadedResources.has(depId))
  }

  private async executeTask(task: ResourceTask): Promise<void> {
    const startTime = performance.now()
    const promise = this.loadResource(task, startTime)
    this.activeTasks.set(task.id, promise)
    this.notifyQueueChange()
  }

  private async loadResource(task: ResourceTask, startTime: number): Promise<LoadedResource> {
    let retryCount = 0

    while (retryCount <= this.config.retryAttempts) {
      try {
        const resource = await this.performLoad(task)
        
        const endTime = performance.now()
        const loadTime = endTime - startTime

        const loadedResource: LoadedResource = {
          id: task.id,
          data: resource,
          type: task.type,
          loadTime,
          size: resource.byteLength || 0,
          timestamp: Date.now()
        }

        this.loadedResources.set(task.id, loadedResource)
        this.totalDataLoaded += loadedResource.size
        this.activeTasks.delete(task.id)
        
        this.handleDependencies(task.id)
        
        task.onProgress?.(100, loadedResource.size, loadedResource.size)
        task.onComplete?.(resource, task.id)
        
        this.notifyQueueChange()
        
        return loadedResource
      } catch (error) {
        retryCount++
        
        if (retryCount > this.config.retryAttempts) {
          this.activeTasks.delete(task.id)
          this.failedTasks.add(task.id)
          
          console.error(`任务 ${task.id} 加载失败，已达到最大重试次数`, error)
          task.onError?.(error instanceof Error ? error : new Error(String(error)), task.id)
          
          this.notifyQueueChange()
          
          throw error
        }
        
        console.warn(`任务 ${task.id} 加载失败，${this.config.retryDelay}ms 后重试 (${retryCount}/${this.config.retryAttempts})`)
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))
      }
    }

    throw new Error('Unexpected error in loadResource')
  }

  private async performLoad(task: ResourceTask): Promise<any> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const downloadStart = performance.now()
      
      const response = await fetch(task.url, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentLength = response.headers.get('content-length')
      const totalSize = contentLength ? parseInt(contentLength) : 0

      if (task.onProgress && response.body) {
        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let receivedLength = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          chunks.push(value)
          receivedLength += value.length

          if (totalSize > 0) {
            const progress = Math.round((receivedLength / totalSize) * 100)
            task.onProgress(progress, receivedLength, totalSize)
          }
        }

        const downloadTime = performance.now() - downloadStart
        console.log(`任务 ${task.id} 下载完成: ${receivedLength} bytes, 耗时 ${Math.round(downloadTime)}ms`)

        const arrayBuffer = new Uint8Array(receivedLength)
        let offset = 0
        for (const chunk of chunks) {
          arrayBuffer.set(chunk, offset)
          offset += chunk.length
        }

        return arrayBuffer.buffer
      }

      const arrayBuffer = await response.arrayBuffer()
      const downloadTime = performance.now() - downloadStart
      console.log(`任务 ${task.id} 下载完成: ${arrayBuffer.byteLength} bytes, 耗时 ${Math.round(downloadTime)}ms`)

      return arrayBuffer
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private handleDependencies(completedTaskId: string): void {
    const dependents = this.waitingDependents.get(completedTaskId)
    if (!dependents) return

    dependents.forEach(dependentId => {
      const dependencies = this.taskDependencies.get(dependentId)
      if (dependencies) {
        dependencies.delete(completedTaskId)
        
        if (dependencies.size === 0) {
          this.taskDependencies.delete(dependentId)
        }
      }
    })

    this.waitingDependents.delete(completedTaskId)
  }

  getResource(id: string): LoadedResource | undefined {
    return this.loadedResources.get(id)
  }

  hasResource(id: string): boolean {
    return this.loadedResources.has(id)
  }

  getStats(): LoadingStats {
    return {
      totalTasks: this.queue.length + this.activeTasks.size + this.loadedResources.size + this.failedTasks.size,
      completedTasks: this.loadedResources.size,
      pendingTasks: this.queue.length,
      failedTasks: this.failedTasks.size,
      activeTasks: this.activeTasks.size,
      totalLoadTime: this.loadCompleteTime - this.loadStartTime,
      bandwidthUsage: this.totalDataLoaded
    }
  }

  onQueueChange(callback: (stats: LoadingStats) => void): () => void {
    this.onQueueChangeCallbacks.push(callback)
    return () => {
      const index = this.onQueueChangeCallbacks.indexOf(callback)
      if (index > -1) {
        this.onQueueChangeCallbacks.splice(index, 1)
      }
    }
  }

  private notifyQueueChange(): void {
    const stats = this.getStats()
    this.onQueueChangeCallbacks.forEach(callback => callback(stats))
  }

  clear(): void {
    this.queue = []
    this.activeTasks.clear()
    this.loadedResources.clear()
    this.failedTasks.clear()
    this.taskDependencies.clear()
    this.waitingDependents.clear()
    this.isRunning = false
    this.totalDataLoaded = 0
    this.notifyQueueChange()
  }

  cancelTask(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId)
    if (index > -1) {
      this.queue.splice(index, 1)
      this.notifyQueueChange()
      return true
    }
    return false
  }

  reprioritizeTask(taskId: string, newPriority: ResourcePriority): boolean {
    const task = this.queue.find(t => t.id === taskId)
    if (task) {
      task.priority = newPriority
      this.sortQueue()
      this.notifyQueueChange()
      return true
    }
    return false
  }
}

export const tieredLoader = new TieredResourceLoader()

export function createVRMLoadTask(
  id: string,
  url: string,
  priority: ResourcePriority = 'high',
  options?: Partial<ResourceTask>
): ResourceTask {
  return {
    id,
    url,
    type: 'model',
    priority,
    ...options
  }
}

export function createFirstPersonVRMTasks(baseUrl: string): ResourceTask[] {
  return [
    createVRMLoadTask('vrm_core', baseUrl, 'critical', {
      metadata: { order: 1, description: '核心模型（头部+上半身）' }
    }),
    createVRMLoadTask('vrm_hands', baseUrl.replace('.vrm', '_hands.vrm'), 'medium', {
      metadata: { order: 2, description: '手部细节模型' },
      dependencies: ['vrm_core']
    }),
    createVRMLoadTask('vrm_details', baseUrl.replace('.vrm', '_details.vrm'), 'low', {
      metadata: { order: 3, description: '服装和细节模型' },
      dependencies: ['vrm_core']
    }),
    createVRMLoadTask('vrm_highres', baseUrl.replace('.vrm', '_highres.vrm'), 'background', {
      metadata: { order: 4, description: '高分辨率纹理' },
      dependencies: ['vrm_core']
    })
  ]
}
