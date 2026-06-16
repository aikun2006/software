/**
 * Three.js / VRM CDN 引导加载器
 * 
 * 在 dev 模式下，index.html 的内联脚本已经加载了这些库到 window 全局；
 * 在 build 模式下，Vite 会删除内联脚本，所以这里通过动态 import() 从 CDN 加载。
 * Vite 不会打包外部 URL 的动态导入，它们会作为运行时 import 保留。
 */

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js'
const GLTF_CDN = 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/loaders/GLTFLoader.js'
const VRM_CDN = 'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@1.0.6/lib/three-vrm.module.js'

export async function bootstrapThree(): Promise<void> {
  // dev 模式下 window.THREE 已由 index.html 设置好了
  if (window.THREE && window.VRMLoaderPlugin) {
    console.log('[ThreeBootstrap] Three.js 已由 index.html 预加载，跳过')
    window.dispatchEvent(new CustomEvent('three-ready'))
    return
  }

  console.log('[ThreeBootstrap] 从 CDN 动态加载 Three.js / VRM...')

  try {
    const [threeModule, gltfModule, vrmModule] = await Promise.all([
      import(/* @vite-ignore */ THREE_CDN),
      import(/* @vite-ignore */ GLTF_CDN),
      import(/* @vite-ignore */ VRM_CDN),
    ])

    window.THREE = threeModule
    window.GLTFLoader = gltfModule.GLTFLoader
    window.AnimationMixer = threeModule.AnimationMixer
    window.AnimationClip = threeModule.AnimationClip
    window.VRMLoaderPlugin = vrmModule.VRMLoaderPlugin
    window.VRM = vrmModule.VRM

    console.log('[ThreeBootstrap] Three.js / VRM 加载完成')
    window.dispatchEvent(new CustomEvent('three-ready'))
  } catch (err) {
    console.error('[ThreeBootstrap] CDN 加载失败:', err)
    // 仍然派发事件，让组件超时降级
    window.dispatchEvent(new CustomEvent('three-ready'))
  }
}
