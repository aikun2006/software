/**
 * AI 统一调度抽象层 —— 类型定义
 *
 * 程序本地无内置 AI、无预设 API 密钥，出厂空白。
 * 所有大模型适配层统一对外暴露 3 个标准化方法：
 *   - scene_recognition_ai(imageBase64)   图像识图，识别画面景点
 *   - scenic_qa_ai(question, ctx, img?)   结合知识库回答景区问题
 *   - voice_tts(text)                      AI 文字转语音朗读景点讲解
 */

/** AI 模型角色：识别 / 问答 / 语音合成 */
export type AIRole = 'recognition' | 'qa' | 'tts'

/** AI 模型提供商类型 */
export type ProviderType = 'glm' | 'deepseek' | 'qwen' | 'minimax' | 'edge_tts' | 'custom'

/** AI 模型配置（从后端获取，不含密钥，密钥安全保存在后端） */
export interface AIModelConfig {
  id: number
  name: string
  provider_type: ProviderType
  role: AIRole
  api_url: string
  model_name: string
  context_limit: number
  status: 'enabled' | 'disabled'
  created_at: string
}

/** 全局配置（管理员设置，含各角色默认备用模型 ID 与超时时间） */
export interface AIGlobalConfig {
  default_recognition_model_id: number | null
  default_qa_model_id: number | null
  default_tts_model_id: number | null
  timeout_seconds: number
}

/** 图像识别结果 */
export interface RecognitionResult {
  spot_id: string
  spot_name: string
  confidence: number
  description: string
}

/** 问答结果 */
export interface QAResult {
  answer: string
  emotion: 'positive' | 'neutral' | 'negative'
  source: string
}

/** 流式回调（QA 接口使用） */
export interface StreamCallbacks {
  onChunk?: (text: string) => void
  onDone?: (result: QAResult) => void
  onError?: (err: Error) => void
}

/** Provider 构造选项 */
export interface ProviderOptions {
  /** 超时时间（秒），从全局配置获取 */
  timeoutSeconds: number
  /** 调用失败时的回调，由调度器注入，用于触发容错降级 */
  onFailure?: (provider: BaseAIProviderLike, role: AIRole) => void
}

/**
 * Provider 最小契约接口（用于解耦类型引用，避免循环依赖）
 * BaseAIProvider 实现此接口。
 */
export interface BaseAIProviderLike {
  readonly config: AIModelConfig
  scene_recognition_ai(imageBase64: string): Promise<RecognitionResult>
  scenic_qa_ai(
    question: string,
    knowledgeContext: string,
    imageBase64?: string,
    callbacks?: StreamCallbacks
  ): Promise<QAResult>
  voice_tts(text: string): Promise<ArrayBuffer>
  destroy(): void
}
