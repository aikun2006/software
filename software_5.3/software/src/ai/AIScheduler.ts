/**
 * AI 统一调度抽象层 —— 调度器（单例）
 *
 * 职责：
 *   1. 管理当前选中的识别模型、QA 模型、TTS 模型
 *   2. 模型列表缓存与全局配置
 *   3. 切换模型时自动销毁旧 Provider（释放 AbortController 等资源）
 *   4. 容错降级：当前选中 AI 调用超时/失败，自动切回管理员设置的备用默认 AI
 *   5. 对外暴露 getRecognitionProvider / getQAProvider / getTTSProvider
 *
 * 后端管理接口（约定）：
 *   GET  /api/ai/models   获取可用模型列表（不含密钥）
 *   GET  /api/ai/config   获取全局配置（默认模型 ID、超时时间）
 */
import { BaseAIProvider } from './BaseAIProvider'
import { AIProviderFactory } from './AIProviderFactory'
import type {
  AIGlobalConfig,
  AIModelConfig,
  AIRole,
  BaseAIProviderLike
} from './types'

/** 后端管理接口端点 */
const MODELS_URL = '/api/ai/models'
const CONFIG_URL = '/api/ai/config'

/** 默认全局配置（后端未配置时兜底） */
const DEFAULT_GLOBAL_CONFIG: AIGlobalConfig = {
  default_recognition_model_id: null,
  default_qa_model_id: null,
  default_tts_model_id: null,
  timeout_seconds: 30
}

/** 默认超时秒数（兜底） */
const DEFAULT_TIMEOUT_SECONDS = 30

/**
 * AI 统一调度器（单例）
 *
 * 管理三个角色（识别/问答/TTS）的当前 Provider 实例，
 * 提供模型加载、切换、容错降级与资源清理能力。
 */
class AIScheduler {
  private static instance: AIScheduler | null = null

  /** 各角色当前 Provider */
  private recognitionProvider: BaseAIProvider | null = null
  private qaProvider: BaseAIProvider | null = null
  private ttsProvider: BaseAIProvider | null = null

  /** 模型列表缓存 */
  private models: AIModelConfig[] = []
  /** 全局配置 */
  private globalConfig: AIGlobalConfig = { ...DEFAULT_GLOBAL_CONFIG }
  /** 是否已加载 */
  private loaded = false
  /** 降级中标记，防止降级递归 */
  private failingOver = false

  private constructor() {}

  /** 获取单例实例 */
  static getInstance(): AIScheduler {
    if (!AIScheduler.instance) {
      AIScheduler.instance = new AIScheduler()
    }
    return AIScheduler.instance
  }

  // ==================== 模型加载 ====================

  /**
   * 从后端拉取可用模型列表与全局配置
   * 首次加载后自动初始化各角色的默认 Provider
   */
  async loadModels(): Promise<void> {
    // 并行拉取模型列表与全局配置
    const [modelsRes, configRes] = await Promise.allSettled([
      this.fetchJSON<{ models: AIModelConfig[] }>(MODELS_URL),
      this.fetchJSON<{ config: AIGlobalConfig }>(CONFIG_URL)
    ])

    // 模型列表 — 后端返回 { models: [...] } 格式
    if (modelsRes.status === 'fulfilled' && modelsRes.value?.models) {
      this.models = modelsRes.value.models.filter((m) => m.status === 'enabled')
    } else {
      this.models = []
    }

    // 全局配置 — 后端返回 { config: {...} } 格式
    if (configRes.status === 'fulfilled' && configRes.value?.config) {
      this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG, ...configRes.value.config }
    } else {
      this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG }
    }

    // 初始化各角色默认 Provider
    this.initDefaultProvider('recognition')
    this.initDefaultProvider('qa')
    this.initDefaultProvider('tts')

    this.loaded = true
  }

  // ==================== 模型查询 ====================

  /** 获取所有可用模型（可按角色过滤） */
  getModels(role?: AIRole): AIModelConfig[] {
    if (!role) return this.models
    return this.models.filter((m) => m.role === role)
  }

  /** 获取全局配置 */
  getGlobalConfig(): AIGlobalConfig {
    return this.globalConfig
  }

  /** 是否已加载 */
  isLoaded(): boolean {
    return this.loaded
  }

  // ==================== Provider 获取 ====================

  /** 获取当前识别 Provider */
  getRecognitionProvider(): BaseAIProvider {
    if (!this.recognitionProvider) {
      throw new Error('识别模型未初始化，请先调用 aiScheduler.loadModels()')
    }
    return this.recognitionProvider
  }

  /** 获取当前问答 Provider */
  getQAProvider(): BaseAIProvider {
    if (!this.qaProvider) {
      throw new Error('问答模型未初始化，请先调用 aiScheduler.loadModels()')
    }
    return this.qaProvider
  }

  /** 获取当前 TTS Provider */
  getTTSProvider(): BaseAIProvider {
    if (!this.ttsProvider) {
      throw new Error('TTS 模型未初始化，请先调用 aiScheduler.loadModels()')
    }
    return this.ttsProvider
  }

  // ==================== 模型切换 ====================

  /**
   * 切换指定角色的当前模型
   * 自动销毁旧 Provider（中断进行中的请求、释放资源），再创建新 Provider
   * @param role    角色
   * @param modelId 目标模型 ID
   */
  switchModel(role: AIRole, modelId: number): void {
    const model = this.models.find((m) => m.id === modelId && m.role === role)
    if (!model) {
      throw new Error(`未找到角色=${role} 且 id=${modelId} 的可用模型`)
    }

    // 销毁旧 Provider
    this.destroyProvider(role)

    // 创建新 Provider
    const provider = AIProviderFactory.create(model, {
      timeoutSeconds: this.globalConfig.timeout_seconds || DEFAULT_TIMEOUT_SECONDS,
      onFailure: (p, r) => this.handleFailure(p, r)
    })

    this.setProvider(role, provider)
  }

  // ==================== 资源清理 ====================

  /**
   * 清理所有 Provider 资源
   * 销毁后需重新 loadModels 才能再次使用
   */
  destroyAll(): void {
    this.destroyProvider('recognition')
    this.destroyProvider('qa')
    this.destroyProvider('tts')
    this.models = []
    this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG }
    this.loaded = false
  }

  // ==================== 内部方法 ====================

  /** 初始化指定角色的默认 Provider（使用全局配置中的默认模型 ID） */
  private initDefaultProvider(role: AIRole): void {
    const defaultId = this.getDefaultModelId(role)
    if (defaultId != null) {
      try {
        this.switchModel(role, defaultId)
        return
      } catch (err) {
        // 默认模型初始化失败，继续尝试回退
      }
    }
    // 无默认模型或默认模型不可用，回退到该角色第一个可用模型
    const fallback = this.models.find((m) => m.role === role)
    if (fallback) {
      try {
        this.switchModel(role, fallback.id)
      } catch (err) {
        // 回退模型也失败，该角色无可用 Provider
      }
    }
  }

  /** 获取指定角色的默认模型 ID */
  private getDefaultModelId(role: AIRole): number | null {
    switch (role) {
      case 'recognition':
        return this.globalConfig.default_recognition_model_id
      case 'qa':
        return this.globalConfig.default_qa_model_id
      case 'tts':
        return this.globalConfig.default_tts_model_id
      default:
        return null
    }
  }

  /**
   * 容错降级处理
   * 当前选中 AI 调用失败时，自动切回管理员设置的备用默认 AI
   */
  private handleFailure(provider: BaseAIProviderLike, role: AIRole): void {
    // 防止降级递归（降级过程中的失败不再触发降级）
    if (this.failingOver) return

    const defaultId = this.getDefaultModelId(role)
    const currentId = provider.config.id

    // 已是默认模型，无备用可降级
    if (defaultId == null || defaultId === currentId) {
      console.warn(`[AIScheduler] ${role} 当前已是默认模型(id=${currentId})，无备用可降级`)
      return
    }

    // 确认默认模型在可用列表中
    const defaultModel = this.models.find((m) => m.id === defaultId && m.role === role)
    if (!defaultModel) {
      console.warn(`[AIScheduler] 默认模型 id=${defaultId} 不在可用列表中，降级失败`)
      return
    }

    this.failingOver = true
    try {
      console.warn(
        `[AIScheduler] ${role} 模型 ${provider.config.name}(id=${currentId}) 调用失败，自动降级到 ${defaultModel.name}(id=${defaultId})`
      )
      this.switchModel(role, defaultId)
    } catch (err) {
      console.error(`[AIScheduler] 降级失败:`, err)
    } finally {
      this.failingOver = false
    }
  }

  /** 销毁指定角色的 Provider */
  private destroyProvider(role: AIRole): void {
    const provider = this.getProvider(role)
    if (provider) {
      provider.destroy()
      this.setProvider(role, null)
    }
  }

  /** 获取指定角色的 Provider（内部） */
  private getProvider(role: AIRole): BaseAIProvider | null {
    switch (role) {
      case 'recognition':
        return this.recognitionProvider
      case 'qa':
        return this.qaProvider
      case 'tts':
        return this.ttsProvider
      default:
        return null
    }
  }

  /** 设置指定角色的 Provider（内部） */
  private setProvider(role: AIRole, provider: BaseAIProvider | null): void {
    switch (role) {
      case 'recognition':
        this.recognitionProvider = provider
        break
      case 'qa':
        this.qaProvider = provider
        break
      case 'tts':
        this.ttsProvider = provider
        break
    }
  }

  /** 通用 JSON GET 请求 */
  private async fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  }
}

/** 调度器单例（全局唯一，供各页面直接导入使用） */
export const aiScheduler = AIScheduler.getInstance()

/** 暴露类本身，便于测试或需要手动实例化的场景 */
export { AIScheduler }
