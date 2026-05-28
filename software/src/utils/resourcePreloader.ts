class ResourcePreloader {
  private threeLoaded = false
  private vrmCache = new Map<string, ArrayBuffer>()
  private preloaded = false
  private loadingPromise: Promise<void> | null = null

  isThreeLoaded(): boolean {
    return this.threeLoaded || !!window.THREE
  }

  waitForThree(): Promise<void> {
    if (this.isThreeLoaded()) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('three-ready', handler)
        resolve()
      }, 3000)

      const handler = () => {
        clearTimeout(timeout)
        this.threeLoaded = true
        resolve()
      }

      if (window.THREE) {
        clearTimeout(timeout)
        this.threeLoaded = true
        resolve()
      } else {
        window.addEventListener('three-ready', handler, { once: true })
      }
    })
  }

  async preloadVRM(
    url: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    if (this.vrmCache.has(url)) {
      onProgress?.(100)
      return
    }

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const contentLength = response.headers.get('content-length')
      const total = parseInt(contentLength || '0', 10)

      if (!total) {
        const arrayBuffer = await response.arrayBuffer()
        this.vrmCache.set(url, arrayBuffer)
        onProgress?.(100)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        const arrayBuffer = await response.arrayBuffer()
        this.vrmCache.set(url, arrayBuffer)
        onProgress?.(100)
        return
      }

      const chunks: Uint8Array[] = []
      let loaded = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        loaded += value.length
        onProgress?.(Math.round((loaded / total) * 100))
      }

      const combined = new Uint8Array(loaded)
      let position = 0
      for (const chunk of chunks) {
        combined.set(chunk, position)
        position += chunk.length
      }

      this.vrmCache.set(url, combined.buffer)
    } catch (error) {
      console.warn('VRM预加载失败:', error)
    }
  }

  getPreloadedVRM(url: string): ArrayBuffer | null {
    return this.vrmCache.get(url) || null
  }

  isVRMPreloaded(url: string): boolean {
    return this.vrmCache.has(url)
  }

  async preloadAll(urls: string[]): Promise<void> {
    if (this.preloaded) return

    await Promise.all(urls.map(url => this.preloadVRM(url)))
    this.preloaded = true
  }

  clearCache() {
    this.vrmCache.clear()
    this.preloaded = false
  }

  getCacheSize(): number {
    return this.vrmCache.size
  }
}

export const preloader = new ResourcePreloader()
