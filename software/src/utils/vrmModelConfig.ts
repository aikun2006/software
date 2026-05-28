export interface VRMModelConfig {
  modelPath: string
  scale: number
  position: {
    x: number
    y: number
    z: number
  }
  rotation: {
    x: number
    y: number
    z: number
  }
  arkitConfig: {
    enabled: boolean
    expressionKeys: string[]
  }
  materialConfig: {
    transparent: boolean
    side: number
  }
  animationConfig: {
    idleAnimation: string
    transitionDuration: number
  }
  lightingConfig: {
    ambientIntensity: number
    directionalIntensity: number
    fillLightIntensity: number
  }
}

export const VRM_TEMPLATE_CONFIG: VRMModelConfig = {
  modelPath: '/static/avatars/puppy护士 1 侧边灰 arkit校正.vrm',
  
  scale: 1.5,
  
  position: {
    x: 0,
    y: -1.2,
    z: 0
  },
  
  rotation: {
    x: 0,
    y: 0,
    z: 0
  },
  
  arkitConfig: {
    enabled: true,
    expressionKeys: [
      'blink',
      'blinkLeft',
      'blinkRight',
      'happy',
      'angry',
      'sad',
      'surprised',
      'neutral',
      'smile',
      'thinking',
      'sleepy',
      'relaxed'
    ]
  },
  
  materialConfig: {
    transparent: true,
    side: 2
  },
  
  animationConfig: {
    idleAnimation: 'Idle',
    transitionDuration: 0.3
  },
  
  lightingConfig: {
    ambientIntensity: 0.6,
    directionalIntensity: 0.8,
    fillLightIntensity: 0.4
  }
}

export class VRMModelLoader {
  private config: VRMModelConfig
  private vrm: any = null
  private scene: any = null
  
  constructor(config: VRMModelConfig = VRM_TEMPLATE_CONFIG) {
    this.config = config
  }
  
  async loadVRM(arrayBuffer: ArrayBuffer): Promise<any> {
    const startTime = performance.now()
    
    const THREE = window.THREE
    const { GLTFLoader } = window
    const { VRMLoaderPlugin } = window
    
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    
    const gltf = await loader.parseAsync(arrayBuffer, '')
    const vrm = gltf.userData.vrm
    
    if (!vrm) {
      throw new Error('VRM model not found in GLTF data')
    }
    
    this.applyConfig(vrm)
    
    this.vrm = vrm
    
    const endTime = performance.now()
    console.log(`VRM模型加载耗时: ${Math.round(endTime - startTime)}ms`)
    console.log('VRM模型配置已应用:', this.config)
    
    return vrm
  }
  
  private applyConfig(vrm: any) {
    vrm.scene.scale.set(
      this.config.scale,
      this.config.scale,
      this.config.scale
    )
    
    vrm.scene.position.set(
      this.config.position.x,
      this.config.position.y,
      this.config.position.z
    )
    
    vrm.scene.rotation.set(
      this.config.rotation.x,
      this.config.rotation.y,
      this.config.rotation.z
    )
    
    this.applyMaterialConfig(vrm)
    
    this.configureExpressions(vrm)
  }
  
  private applyMaterialConfig(vrm: any) {
    vrm.scene.traverse((object: any) => {
      if (object.isMesh) {
        object.frustumCulled = true
        
        if (object.material) {
          const materials = Array.isArray(object.material) 
            ? object.material 
            : [object.material]
          
          materials.forEach((mat: any) => {
            mat.transparent = this.config.materialConfig.transparent
            mat.side = this.config.materialConfig.side
            mat.needsUpdate = true
          })
        }
      }
    })
  }
  
  private configureExpressions(vrm: any) {
    if (!vrm.expressionManager) {
      console.warn('VRM模型不支持表情系统')
      return
    }
    
    const availableExpressions = vrm.expressionManager.expressions
    console.log('可用的表情表达式:', availableExpressions.map((e: any) => e.expressionName))
    
    if (this.config.arkitConfig.enabled) {
      console.log('ARKit表情配置已启用')
      console.log('配置的表达式键:', this.config.arkitConfig.expressionKeys)
    }
  }
  
  setExpression(expressionName: string, value: number) {
    if (!this.vrm?.expressionManager) return
    
    try {
      const expression = this.vrm.expressionManager.getExpression(expressionName)
      if (expression) {
        expression.setValue(Math.max(0, Math.min(1, value)))
        this.vrm.expressionManager.update()
      }
    } catch (error) {
      console.warn(`设置表情 ${expressionName} 失败:`, error)
    }
  }
  
  resetExpressions() {
    if (!this.vrm?.expressionManager) return
    
    const expressions = this.vrm.expressionManager.expressions
    expressions.forEach((expr: any) => {
      expr.setValue(0)
    })
    this.vrm.expressionManager.update()
  }
  
  getVRM(): any {
    return this.vrm
  }
  
  dispose() {
    if (this.vrm) {
      this.vrm.scene.traverse((object: any) => {
        if (object.geometry) {
          object.geometry.dispose()
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat: any) => mat.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
      
      if (this.vrm.dispose) {
        this.vrm.dispose()
      }
      
      this.vrm = null
    }
  }
  
  getConfig(): VRMModelConfig {
    return { ...this.config }
  }
  
  updateConfig(newConfig: Partial<VRMModelConfig>) {
    this.config = { ...this.config, ...newConfig }
    
    if (this.vrm) {
      this.applyConfig(this.vrm)
    }
  }
}

export const vrmModelLoader = new VRMModelLoader()

export default VRMModelLoader
