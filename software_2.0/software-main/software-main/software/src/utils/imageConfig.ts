export interface ImageConfig {
  enableExternal: boolean
  timeout: number
  retryCount: number
  fallbackImage: string
}

export const imageConfig: ImageConfig = {
  enableExternal: false,
  timeout: 5000,
  retryCount: 1,
  fallbackImage: '/static/icons/default-spot.png'
}

const externalApiDomains = [
  'neeko-copilot.bytedance.net',
  'text_to_image',
  'api/images'
]

export function getSafeImageUrl(url: string | undefined | null): string {
  if (!url) {
    return imageConfig.fallbackImage
  }

  const isExternal = externalApiDomains.some(domain => url.includes(domain))
  
  if (isExternal && !imageConfig.enableExternal) {
    console.log('外部API图片已禁用，使用本地占位图')
    return imageConfig.fallbackImage
  }
  
  return url
}

export function isExternalImageUrl(url: string): boolean {
  return externalApiDomains.some(domain => url.includes(domain))
}

export function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (isExternalImageUrl(url) && !imageConfig.enableExternal) {
      resolve(false)
      return
    }

    const img = new Image()
    const timeoutId = setTimeout(() => {
      console.warn('图片预加载超时:', url)
      resolve(false)
    }, imageConfig.timeout)

    img.onload = () => {
      clearTimeout(timeoutId)
      resolve(true)
    }

    img.onerror = () => {
      clearTimeout(timeoutId)
      console.warn('图片预加载失败:', url)
      resolve(false)
    }

    img.src = url
  })
}

export async function preloadImages(urls: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()
  
  const promises = urls.map(async (url) => {
    const success = await preloadImage(url)
    results.set(url, success)
  })
  
  await Promise.all(promises)
  return results
}

export function setImageConfig(config: Partial<ImageConfig>) {
  Object.assign(imageConfig, config)
  console.log('图片配置已更新:', imageConfig)
}

export function enableExternalImages(): void {
  imageConfig.enableExternal = true
  console.log('外部API图片已启用')
}

export function disableExternalImages(): void {
  imageConfig.enableExternal = false
  console.log('外部API图片已禁用')
}
