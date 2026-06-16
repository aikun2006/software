import { VRM_TEMPLATE_CONFIG } from './vrmModelConfig'

const createScene = (
  canvas,
  width,
  height,
  pixelRatio = 1,
  antialias = true
) => {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = null
  
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1000)
  camera.position.z = 3.5
  
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  })
  
  renderer.setSize(width, height)
  renderer.setPixelRatio(pixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  
  const ambientLight = new THREE.AmbientLight(
    0xffffff, 
    VRM_TEMPLATE_CONFIG.lightingConfig.ambientIntensity
  )
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(
    0xffffff, 
    VRM_TEMPLATE_CONFIG.lightingConfig.directionalIntensity
  )
  directionalLight.position.set(1, 1, 1)
  scene.add(directionalLight)
  
  const fillLight = new THREE.DirectionalLight(
    0xffffff, 
    VRM_TEMPLATE_CONFIG.lightingConfig.fillLightIntensity
  )
  fillLight.position.set(-1, 0.5, -1)
  scene.add(fillLight)
  
  renderer.setClearColor(0x000000, 0)
  
  return { scene, camera, renderer }
}

const loadVRMModel = async (arrayBuffer, scale = VRM_TEMPLATE_CONFIG.scale) => {
  const startTime = performance.now()
  
  const THREE = window.THREE
  const { GLTFLoader } = window
  const { VRM, VRMLoaderPlugin } = window
  
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  
  const gltf = await loader.parseAsync(arrayBuffer, '')
  const vrm = gltf.userData.vrm || (gltf.vrm ? gltf.vrm : null)
  
  if (!vrm) {
    throw new Error('VRM model not found in GLTF data')
  }
  
  vrm.scene.scale.set(
    VRM_TEMPLATE_CONFIG.scale,
    VRM_TEMPLATE_CONFIG.scale,
    VRM_TEMPLATE_CONFIG.scale
  )
  
  vrm.scene.position.set(
    VRM_TEMPLATE_CONFIG.position.x,
    VRM_TEMPLATE_CONFIG.position.y,
    VRM_TEMPLATE_CONFIG.position.z
  )
  
  vrm.scene.traverse((object) => {
    if (object.isMesh) {
      object.frustumCulled = true
      
      if (object.material) {
        const materials = Array.isArray(object.material) 
          ? object.material 
          : [object.material]
        
        materials.forEach(mat => {
          mat.transparent = VRM_TEMPLATE_CONFIG.materialConfig.transparent
          mat.side = VRM_TEMPLATE_CONFIG.materialConfig.side
          mat.needsUpdate = true
        })
      }
    }
  })
  
  console.log('VRM模型配置已应用:')
  console.log('- 缩放比例:', VRM_TEMPLATE_CONFIG.scale)
  console.log('- 位置:', VRM_TEMPLATE_CONFIG.position)
  console.log('- 材质透明:', VRM_TEMPLATE_CONFIG.materialConfig.transparent)
  
  if (vrm.expressionManager) {
    console.log('ARKit表情系统已启用')
    console.log('可用的表情:', vrm.expressionManager.expressions.map(e => e.expressionName))
  }
  
  const endTime = performance.now()
  console.log(`VRM模型解析耗时: ${Math.round(endTime - startTime)}ms`)
  
  return vrm
}

export { createScene, loadVRMModel }
