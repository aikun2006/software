/**
 * AI 统一调度抽象层 —— Provider 工厂
 *
 * 根据 AIModelConfig.provider_type 创建对应的 BaseAIProvider 实例。
 * 所有 Provider 继承 BaseAIProvider，差异仅在请求体构造格式
 * （由于统一走后端代理，默认格式一致，子类可按需覆写钩子方法扩展）。
 */
import { BaseAIProvider } from './BaseAIProvider'
import type { AIModelConfig, ProviderOptions, ProviderType } from './types'

// ==================== 具体 Provider 实现 ====================

/**
 * 智谱 GLM Provider
 * 适用于 GLM-4 / GLM-4V / GLM-4-Flash 等模型
 */
export class GLMProvider extends BaseAIProvider {
  // GLM 默认请求体与后端代理统一格式一致，无需额外定制
}

/**
 * DeepSeek Provider
 * 适用于 DeepSeek-V3 / DeepSeek-R1 等模型
 */
export class DeepSeekProvider extends BaseAIProvider {
  // DeepSeek 兼容 OpenAI 格式，后端代理统一处理，无需额外定制
}

/**
 * 通义千问 Qwen Provider
 * 适用于 Qwen-Max / Qwen-Plus / Qwen-VL 等模型
 */
export class QwenProvider extends BaseAIProvider {
  // Qwen 兼容 OpenAI 格式，后端代理统一处理，无需额外定制
}

/**
 * MiniMax Provider
 * 适用于 MiniMax-Text / MiniMax-Vision 等模型
 */
export class MiniMaxProvider extends BaseAIProvider {
  // MiniMax 格式由后端代理适配，前端无需额外定制
}

/**
 * Edge TTS Provider
 * 专用于语音合成（TTS）角色，微软 Edge TTS 通过本地 Python 代理
 */
export class EdgeTTSProvider extends BaseAIProvider {
  // Edge TTS 仅用于 tts 角色，识别/问答方法不会被调用
}

/**
 * 自定义 Provider
 * 兜底类型，适配未来新增的第三方模型
 */
export class CustomProvider extends BaseAIProvider {
  // 完全使用后端代理默认格式
}

// ==================== 工厂 ====================

/**
 * Provider 工厂
 *
 * 根据 AIModelConfig.provider_type 实例化对应的 Provider 子类。
 * 若 provider_type 不在已知列表中，回退到 CustomProvider。
 */
export class AIProviderFactory {
  /**
   * 创建 Provider 实例
   * @param config  模型配置
   * @param options 构造选项（超时、失败回调）
   */
  static create(config: AIModelConfig, options: ProviderOptions): BaseAIProvider {
    const providerType: ProviderType = config.provider_type
    switch (providerType) {
      case 'glm':
        return new GLMProvider(config, options)
      case 'deepseek':
        return new DeepSeekProvider(config, options)
      case 'qwen':
        return new QwenProvider(config, options)
      case 'minimax':
        return new MiniMaxProvider(config, options)
      case 'edge_tts':
        return new EdgeTTSProvider(config, options)
      case 'custom':
        return new CustomProvider(config, options)
      default:
        // 未知类型兜底，保证向后兼容
        return new CustomProvider(config, options)
    }
  }
}
