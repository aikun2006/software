import { VRM_TEMPLATE_CONFIG } from './vrmModelConfig'
import { vrmValidator } from './vrmModelValidator'

export interface TemplateValidationReport {
  templateConfig: typeof VRM_TEMPLATE_CONFIG
  validationResult: any
  timestamp: number
  recommendation: string[]
}

class TemplateValidator {
  async validateTemplate(vrm: any): Promise<TemplateValidationReport> {
    const validationResult = await vrmValidator.validate(vrm)
    const report = vrmValidator.generateReport(validationResult)
    
    console.log('='.repeat(50))
    console.log('VRM模板验证报告')
    console.log('='.repeat(50))
    console.log(report)
    console.log('='.repeat(50))
    
    const recommendation = this.generateRecommendations(validationResult)
    
    return {
      templateConfig: VRM_TEMPLATE_CONFIG,
      validationResult,
      timestamp: Date.now(),
      recommendation
    }
  }

  private generateRecommendations(result: any): string[] {
    const recommendations: string[] = []
    
    if (result.errors.length > 0) {
      recommendations.push('存在配置错误，请修复后再继续')
    }
    
    if (result.warnings.length > 0) {
      recommendations.push('存在配置警告，建议检查')
    }
    
    if (result.metadata.expressions.length === 0) {
      recommendations.push('警告: 模型不支持表情系统，可能影响交互体验')
    }
    
    if (result.metadata.boneCount === 0) {
      recommendations.push('警告: 未检测到骨骼结构，动画可能无法正常工作')
    }
    
    if (result.metadata.textureCount === 0) {
      recommendations.push('信息: 未检测到纹理贴图，使用默认材质')
    }
    
    if (result.isValid && result.warnings.length === 0) {
      recommendations.push('✅ 模板验证通过，所有配置与模板文件一致')
    }
    
    return recommendations
  }

  printConfigSummary() {
    console.log('='.repeat(50))
    console.log('模板配置摘要')
    console.log('='.repeat(50))
    console.log(`模型路径: ${VRM_TEMPLATE_CONFIG.modelPath}`)
    console.log(`缩放比例: ${VRM_TEMPLATE_CONFIG.scale}`)
    console.log(`位置: (${VRM_TEMPLATE_CONFIG.position.x}, ${VRM_TEMPLATE_CONFIG.position.y}, ${VRM_TEMPLATE_CONFIG.position.z})`)
    console.log(`旋转: (${VRM_TEMPLATE_CONFIG.rotation.x}, ${VRM_TEMPLATE_CONFIG.rotation.y}, ${VRM_TEMPLATE_CONFIG.rotation.z})`)
    console.log(`\nARKit配置:`)
    console.log(`  启用: ${VRM_TEMPLATE_CONFIG.arkitConfig.enabled}`)
    console.log(`  表情键数量: ${VRM_TEMPLATE_CONFIG.arkitConfig.expressionKeys.length}`)
    console.log(`  表情键: ${VRM_TEMPLATE_CONFIG.arkitConfig.expressionKeys.join(', ')}`)
    console.log(`\n材质配置:`)
    console.log(`  透明: ${VRM_TEMPLATE_CONFIG.materialConfig.transparent}`)
    console.log(`  渲染面: ${VRM_TEMPLATE_CONFIG.materialConfig.side === 2 ? '双面' : '单面'}`)
    console.log(`\n动画配置:`)
    console.log(`  空闲动画: ${VRM_TEMPLATE_CONFIG.animationConfig.idleAnimation}`)
    console.log(`  过渡时长: ${VRM_TEMPLATE_CONFIG.animationConfig.transitionDuration}s`)
    console.log(`\n光照配置:`)
    console.log(`  环境光强度: ${VRM_TEMPLATE_CONFIG.lightingConfig.ambientIntensity}`)
    console.log(`  主光强度: ${VRM_TEMPLATE_CONFIG.lightingConfig.directionalIntensity}`)
    console.log(`  补光强度: ${VRM_TEMPLATE_CONFIG.lightingConfig.fillLightIntensity}`)
    console.log('='.repeat(50))
  }
}

export const templateValidator = new TemplateValidator()

export default TemplateValidator
