export interface CachedModel {
  vrm: any
  timestamp: number
  size: number
  usageCount: number
}

export interface CacheStats {
  hits: number
  misses: number
  totalRequests: number
  cacheSize: number
  maxCacheSize: number
}

class ModelCache {
  private cache = new Map<string, CachedModel>()
  private maxCacheSize = 2
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    cacheSize: 0,
    maxCacheSize: this.maxCacheSize
  }

  setMaxSize(size: number) {
    this.maxCacheSize = size
    this.stats.maxCacheSize = size
    this.evictIfNeeded()
  }

  get(url: string): CachedModel | null {
    this.stats.totalRequests++
    
    const cached = this.cache.get(url)
    if (cached) {
      this.stats.hits++
      cached.usageCount++
      cached.timestamp = Date.now()
      return cached
    }
    
    this.stats.misses++
    return null
  }

  set(url: string, vrm: any, size: number) {
    this.evictIfNeeded()
    
    this.cache.set(url, {
      vrm,
      timestamp: Date.now(),
      size,
      usageCount: 1
    })
    
    this.stats.cacheSize = this.cache.size
  }

  private evictIfNeeded() {
    while (this.cache.size >= this.maxCacheSize) {
      let oldestKey = ''
      let oldestTimestamp = Infinity
      let minUsage = Infinity

      for (const [key, model] of this.cache) {
        if (model.timestamp < oldestTimestamp || 
            (model.timestamp === oldestTimestamp && model.usageCount < minUsage)) {
          oldestTimestamp = model.timestamp
          minUsage = model.usageCount
          oldestKey = key
        }
      }

      if (oldestKey) {
        const evicted = this.cache.get(oldestKey)
        if (evicted && evicted.vrm && evicted.vrm.dispose) {
          evicted.vrm.dispose()
        }
        this.cache.delete(oldestKey)
        this.stats.cacheSize = this.cache.size
      }
    }
  }

  clear() {
    this.cache.forEach(model => {
      if (model.vrm && model.vrm.dispose) {
        model.vrm.dispose()
      }
    })
    this.cache.clear()
    this.stats.cacheSize = 0
  }

  has(url: string): boolean {
    return this.cache.has(url)
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  getCachedUrls(): string[] {
    return Array.from(this.cache.keys())
  }
}

export const modelCache = new ModelCache()
