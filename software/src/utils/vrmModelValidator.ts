import { VRM_TEMPLATE_CONFIG } from './vrmModelConfig'

export interface VRMValidationResult {
  isValid: boolean
  checks: ValidationCheck[]
  errors: string[]
  warnings: string[]
  metadata: VRMMetadata
}

export interface ValidationCheck {
  name: string
  passed: boolean
  message: string
  details?: any
}

export interface VRMMetadata {
  modelName: string
  author: string
  version: string
  createdAt?: string
  expressions: string[]
  boneCount: number
  meshCount: number
  textureCount: number
}

class VRMModelValidator {
  private checks: ValidationCheck[] = []
  private errors: string[] = []
  private warnings: string[] = []

  async validate(vrm: any, config: any = VRM_TEMPLATE_CONFIG): Promise<VRMValidationResult> {
    this.reset()
    
    await this.checkVRMExists(vrm)
    await this.checkScaleConfiguration(vrm, config)
    await this.checkPositionConfiguration(vrm, config)
    await this.checkMaterialConfiguration(vrm, config)
    await this.checkExpressionSystem(vrm, config)
    await this.checkBoneStructure(vrm)
    await this.checkMeshConfiguration(vrm)
    await this.checkTextureConfiguration(vrm)
    await this.checkLightingConfiguration(vrm, config)
    
    return {
      isValid: this.errors.length === 0,
      checks: [...this.checks],
      errors: [...this.errors],
      warnings: [...this.warnings],
      metadata: this.getMetadata(vrm)
    }
  }

  private reset() {
    this.checks = []
    this.errors = []
    this.warnings = []
  }

  private addCheck(name: string, passed: boolean, message: string, details?: any) {
    this.checks.push({ name, passed, message, details })
    
    if (!passed && !message.includes('警告')) {
      this.errors.push(`${name}: ${message}`)
    } else if (message.includes('警告')) {
      this.warnings.push(`${name}: ${message}`)
    }
  }

  private async checkVRMExists(vrm: any): Promise<void> {
    const passed = vrm !== null && vrm !== undefined && vrm.scene !== undefined
    this.addCheck(
      'VRM模型加载',
      passed,
      passed ? 'VRM模型已成功加载' : 'VRM模型加载失败或模型场景未定义'
    )
  }

  private async checkScaleConfiguration(vrm: any, config: any): Promise<void> {
    if (!vrm?.scene) return

    const currentScale = vrm.scene.scale
    const expectedScale = config.scale
    const passed = Math.abs(currentScale.x - expectedScale) < 0.01 &&
                   Math.abs(currentScale.y - expectedScale) < 0.01 &&
                   Math.abs(currentScale.z - expectedScale) < 0.01

    this.addCheck(
      '缩放配置',
      passed,
      passed 
        ? `缩放比例配置正确 (${expectedScale})`
        : `缩放比例不匹配: 期望 ${expectedScale}, 实际 ${currentScale.x}`,
      { expected: expectedScale, actual: { x: currentScale.x, y: currentScale.y, z: currentScale.z } }
    )

    if (expectedScale < 0.1 || expectedScale > 10) {
      this.warnings.push('缩放比例超出正常范围 (0.1-10)，可能影响渲染效果')
    }
  }

  private async checkPositionConfiguration(vrm: any, config: any): Promise<void> {
    if (!vrm?.scene) return

    const currentPos = vrm.scene.position
    const expectedPos = config.position
    const tolerance = 0.01

    const passed = Math.abs(currentPos.x - expectedPos.x) < tolerance &&
                   Math.abs(currentPos.y - expectedPos.y) < tolerance &&
                   Math.abs(currentPos.z - expectedPos.z) < tolerance

    this.addCheck(
      '位置配置',
      passed,
      passed
        ? `位置配置正确 (${expectedPos.x}, ${expectedPos.y}, ${expectedPos.z})`
        : `位置不匹配: 期望 (${expectedPos.x}, ${expectedPos.y}, ${expectedPos.z}), 实际 (${currentPos.x}, ${currentPos.y}, ${currentPos.z})`,
      { expected: expectedPos, actual: { x: currentPos.x, y: currentPos.y, z: currentPos.z } }
    )
  }

  private async checkMaterialConfiguration(vrm: any, config: any): Promise<void> {
    if (!vrm?.scene) return

    let materialChecks = 0
    let materialPassed = 0

    vrm.scene.traverse((object: any) => {
      if (object.isMesh && object.material) {
        materialChecks++
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        
        materials.forEach((mat: any) => {
          if (mat.transparent === config.materialConfig.transparent) {
            materialPassed++
          }
        })
      }
    })

    const passed = materialChecks === 0 || materialPassed === materialChecks * (Array.isArray(vrm.scene) ? 1 : 1)

    this.addCheck(
      '材质配置',
      passed,
      passed
        ? `材质透明配置正确 (transparent: ${config.materialConfig.transparent})`
        : `材质配置存在问题 (${materialPassed}/${materialChecks} 正确)`,
      { checked: materialChecks, passed: materialPassed }
    )
  }

  private async checkExpressionSystem(vrm: any, config: any): Promise<void> {
    const hasExpressionManager = vrm?.expressionManager !== undefined && vrm?.expressionManager !== null
    
    this.addCheck(
      '表情系统',
      hasExpressionManager,
      hasExpressionManager
        ? `表情系统已启用 (${config.arkitConfig.enabled ? 'ARKit配置' : '标准配置'})`
        : '警告: VRM模型不支持表情系统'
    )

    if (hasExpressionManager && config.arkitConfig.enabled) {
      const expressions = vrm.expressionManager.expressions || []
      const hasRequiredExpressions = expressions.length > 0

      this.addCheck(
        'ARKit表情键',
        hasRequiredExpressions,
        hasRequiredExpressions
          ? `检测到 ${expressions.length} 个表情表达式`
          : '警告: 未检测到表情表达式',
        { count: expressions.length, expressions: expressions.map((e: any) => e.expressionName) }
      )

      const configKeys = config.arkitConfig.expressionKeys
      const availableKeys = expressions.map((e: any) => e.expressionName)
      
      const missingKeys = configKeys.filter((key: string) => !availableKeys.includes(key))
      
      if (missingKeys.length > 0) {
        this.warnings.push(`配置的表情键在模型中未找到: ${missingKeys.join(', ')}`)
      }
    }
  }

  private async checkBoneStructure(vrm: any): Promise<void> {
    if (!vrm?.humanoid) {
      this.warnings.push('警告: 未检测到人形骨骼系统')
      return
    }

    const boneNames = Object.keys(vrm.humanoid.humanBones || {})
    
    this.addCheck(
      '骨骼结构',
      boneNames.length > 0,
      boneNames.length > 0
        ? `检测到 ${boneNames.length} 个人体骨骼`
        : '警告: 未检测到人体骨骼',
      { boneCount: boneNames.length, bones: boneNames }
    )
  }

  private async checkMeshConfiguration(vrm: any): Promise<void> {
    if (!vrm?.scene) return

    let meshCount = 0
    let skinnedMeshCount = 0

    vrm.scene.traverse((object: any) => {
      if (object.isMesh) {
        meshCount++
        if (object.isSkinnedMesh) {
          skinnedMeshCount++
        }
      }
    })

    this.addCheck(
      '网格配置',
      meshCount > 0,
      meshCount > 0
        ? `检测到 ${meshCount} 个网格对象 (${skinnedMeshCount} 个骨骼网格)`
        : '错误: 未检测到网格对象',
      { total: meshCount, skinned: skinnedMeshCount }
    )
  }

  private async checkTextureConfiguration(vrm: any): Promise<void> {
    if (!vrm?.scene) return

    let textureCount = 0

    vrm.scene.traverse((object: any) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        
        materials.forEach((mat: any) => {
          if (mat.map) textureCount++
          if (mat.normalMap) textureCount++
          if (mat.specularMap) textureCount++
        })
      }
    })

    this.addCheck(
      '纹理配置',
      textureCount > 0,
      textureCount > 0
        ? `检测到 ${textureCount} 个纹理贴图`
        : '警告: 未检测到纹理贴图',
      { textureCount }
    )
  }

  private async checkLightingConfiguration(vrm: any, config: any): Promise<void> {
    const passed = config.lightingConfig !== undefined
    
    this.addCheck(
      '光照配置',
      passed,
      passed
        ? `光照参数配置正确 (环境光: ${config.lightingConfig.ambientIntensity}, 主光: ${config.lightingConfig.directionalIntensity}, 补光: ${config.lightingConfig.fillLightIntensity})`
        : '光照配置缺失',
      config.lightingConfig
    )
  }

  private getMetadata(vrm: any): VRMMetadata {
    return {
      modelName: 'puppy护士 1 侧边灰 arkit校正',
      author: '墨海徽',
      version: '1.0.0',
      expressions: vrm?.expressionManager?.expressions?.map((e: any) => e.expressionName) || [],
      boneCount: vrm?.humanoid ? Object.keys(vrm.humanoid.humanBones || {}).length : 0,
      meshCount: this.countMeshes(vrm),
      textureCount: this.countTextures(vrm)
    }
  }

  private countMeshes(vrm: any): number {
    if (!vrm?.scene) return 0
    
    let count = 0
    vrm.scene.traverse((object: any) => {
      if (object.isMesh) count++
    })
    return count
  }

  private countTextures(vrm: any): number {
    if (!vrm?.scene) return 0
    
    let count = 0
    vrm.scene.traverse((object: any) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((mat: any) => {
          if (mat.map) count++
          if (mat.normalMap) count++
          if (mat.specularMap) count++
        })
      }
    })
    return count
  }

  generateReport(result: VRMValidationResult): string {
    let report = '=== VRM模型验证报告 ===\n\n'
    
    report += `验证时间: ${new Date().toLocaleString()}\n`
    report += `验证结果: ${result.isValid ? '✅ 通过' : '❌ 失败'}\n\n`
    
    report += '--- 配置检查 ---\n'
    result.checks.forEach(check => {
      const status = check.passed ? '✅' : '❌'
      report += `${status} ${check.name}: ${check.message}\n`
    })
    
    if (result.errors.length > 0) {
      report += '\n--- 错误 ---\n'
      result.errors.forEach(error => {
        report += `❌ ${error}\n`
      })
    }
    
    if (result.warnings.length > 0) {
      report += '\n--- 警告 ---\n'
      result.warnings.forEach(warning => {
        report += `⚠️ ${warning}\n`
      })
    }
    
    report += '\n--- 模型元数据 ---\n'
    report += `模型名称: ${result.metadata.modelName}\n`
    report += `作者: ${result.metadata.author}\n`
    report += `版本: ${result.metadata.version}\n`
    report += `表情数量: ${result.metadata.expressions.length}\n`
    report += `骨骼数量: ${result.metadata.boneCount}\n`
    report += `网格数量: ${result.metadata.meshCount}\n`
    report += `纹理数量: ${result.metadata.textureCount}\n`
    
    if (result.metadata.expressions.length > 0) {
      report += `\n表情列表:\n`
      result.metadata.expressions.forEach(expr => {
        report += `  - ${expr}\n`
      })
    }
    
    return report
  }
}

export const vrmValidator = new VRMModelValidator()

export default VRMModelValidator
