export interface ImageLoadOptions {
  timeout?: number
  fallbackUrl?: string
  retryCount?: number
  retryDelay?: number
}

export interface ImageLoadResult {
  url: string
  success: boolean
  error?: string
  loadTime?: number
}

class ImageLoader {
  private loadingCache = new Map<string, Promise<ImageLoadResult>>()

  async loadImage(
    url: string,
    options: ImageLoadOptions = {}
  ): Promise<ImageLoadResult> {
    const {
      timeout = 5000,
      fallbackUrl = this.getDefaultFallback(),
      retryCount = 0,
      retryDelay = 1000
    } = options

    const startTime = performance.now()

    if (this.loadingCache.has(url)) {
      return this.loadingCache.get(url)!
    }

    const loadPromise = this.doLoadImage(url, timeout, fallbackUrl, retryCount, retryDelay, startTime)
    this.loadingCache.set(url, loadPromise)

    try {
      const result = await loadPromise
      return result
    } finally {
      this.loadingCache.delete(url)
    }
  }

  private async doLoadImage(
    url: string,
    timeout: number,
    fallbackUrl: string,
    retryCount: number,
    retryDelay: number,
    startTime: number
  ): Promise<ImageLoadResult> {
    if (!url || !this.isExternalApi(url)) {
      return {
        url,
        success: true,
        loadTime: performance.now() - startTime
      }
    }

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await this.loadWithTimeout(url, timeout)
        
        return {
          url: result.url,
          success: result.success,
          error: result.error,
          loadTime: performance.now() - startTime
        }
      } catch (error) {
        const isLastAttempt = attempt === retryCount
        
        if (isLastAttempt) {
          console.warn(`图片加载失败 (${attempt + 1}/${retryCount + 1}):`, url, error)
          
          return {
            url: fallbackUrl,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            loadTime: performance.now() - startTime
          }
        }

        console.log(`图片加载超时，${retryDelay}ms后重试 (${attempt + 1}/${retryCount})...`)
        await this.delay(retryDelay)
      }
    }

    return {
      url: fallbackUrl,
      success: false,
      error: 'Max retries exceeded',
      loadTime: performance.now() - startTime
    }
  }

  private async loadWithTimeout(
    url: string,
    timeout: number
  ): Promise<{ url: string; success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          url,
          success: false,
          error: 'Load timeout'
        })
      }, timeout)

      const img = new Image()
      
      img.onload = () => {
        clearTimeout(timeoutId)
        resolve({
          url,
          success: true
        })
      }

      img.onerror = (error) => {
        clearTimeout(timeoutId)
        resolve({
          url,
          success: false,
          error: 'Image load error'
        })
      }

      img.src = url
    })
  }

  private isExternalApi(url: string): boolean {
    return url.includes('neeko-copilot.bytedance.net') ||
           url.includes('text_to_image') ||
           url.includes('api/images')
  }

  private getDefaultFallback(): string {
    return '/static/icons/default-spot.png'
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async preloadImages(urls: string[], options: ImageLoadOptions = {}): Promise<Map<string, ImageLoadResult>> {
    const results = new Map<string, ImageLoadResult>()
    
    await Promise.all(
      urls.map(async (url) => {
        const result = await this.loadImage(url, options)
        results.set(url, result)
      })
    )
    
    return results
  }

  clearCache() {
    this.loadingCache.clear()
  }

  cancelPendingLoads() {
    this.loadingCache.clear()
  }
}

export const imageLoader = new ImageLoader()

export default ImageLoader
