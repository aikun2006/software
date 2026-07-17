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
      resolve(false)
    }, imageConfig.timeout)

    img.onload = () => {
      clearTimeout(timeoutId)
      resolve(true)
    }

    img.onerror = () => {
      clearTimeout(timeoutId)
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
}

export function enableExternalImages(): void {
  imageConfig.enableExternal = true
}

export function disableExternalImages(): void {
  imageConfig.enableExternal = false
}
