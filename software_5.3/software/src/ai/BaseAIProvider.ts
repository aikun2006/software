/**
 * AI 统一调度抽象层 —— Provider 抽象基类
 *
 * 所有 AI 调用通过后端代理（不直接调第三方 API，密钥安全保存在后端）：
 *   - 图像识别  → POST /api/ai/proxy/recognize  返回 JSON
 *   - 景区问答  → POST /api/ai/proxy/qa          返回 SSE 流式响应
 *   - 语音合成  → POST /api/ai/proxy/tts         返回二进制音频(audio/mpeg)
 *
 * 后端代理请求体统一格式：
 *   { model_id, image_base64?, question?, knowledge_context?, text? }
 *
 * SSE 流式响应格式（与现有 /api/chat 一致）：
 *   data: {choices:[{delta:{content:"..."}}]}
 */
import type {
  AIModelConfig,
  BaseAIProviderLike,
  ProviderOptions,
  QAResult,
  RecognitionResult,
  StreamCallbacks
} from './types'

/** 后端代理端点 */
const PROXY_RECOGNIZE_URL = '/api/ai/proxy/recognize'
const PROXY_QA_URL = '/api/ai/proxy/qa'
const PROXY_TTS_URL = '/api/ai/proxy/tts'

/**
 * AI Provider 抽象基类
 *
 * 所有具体 Provider（GLM/DeepSeek/Qwen/MiniMax/EdgeTTS/Custom）继承本类。
 * 由于所有调用都经后端代理统一转发，请求体格式一致，差异仅在子类
 * 可覆写 protected 钩子方法（如 buildRequestBody）做定制化扩展。
 */
export abstract class BaseAIProvider implements BaseAIProviderLike {
  /** 当前模型配置 */
  readonly config: AIModelConfig
  /** 超时时间（秒） */
  protected timeoutSeconds: number
  /** 调用失败回调（由调度器注入，用于容错降级） */
  protected onFailure?: (provider: BaseAIProviderLike, role: AIModelConfig['role']) => void
  /** 当前请求的中断控制器 */
  protected abortController: AbortController | null = null
  /** 是否已销毁（销毁后拒绝所有新调用） */
  protected destroyed = false

  constructor(config: AIModelConfig, options: ProviderOptions) {
    this.config = config
    this.timeoutSeconds = options.timeoutSeconds
    this.onFailure = options.onFailure
  }

  // ==================== 三个标准化方法 ====================

  /**
   * 图像识图 —— 识别画面景点
   * 调用 POST /api/ai/proxy/recognize，返回 JSON
   * @param imageBase64 图像 base64 字符串（不含 data:image 前缀）
   */
  async scene_recognition_ai(imageBase64: string): Promise<RecognitionResult> {
    this.ensureAlive()
    this.abortController = new AbortController()

    // 整体超时控制（非流式接口直接用固定超时）
    const timeoutId = setTimeout(
      () => this.abortController?.abort(),
      this.timeoutSeconds * 1000
    )

    try {
      const body = this.buildRecognizeBody(imageBase64)
      const res = await fetch(PROXY_RECOGNIZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      })

      if (!res.ok) {
        throw new Error(`识别接口 HTTP ${res.status}`)
      }

      const data = await res.json()
      return {
        spot_id: String(data.spot_id ?? ''),
        spot_name: String(data.spot_name ?? ''),
        confidence: Number(data.confidence ?? 0),
        description: String(data.description ?? '')
      }
    } catch (err) {
      this.notifyFailure()
      throw err
    } finally {
      clearTimeout(timeoutId)
      this.abortController = null
    }
  }

  /**
   * 景区问答 —— 结合知识库回答景区问题（支持 SSE 流式）
   * 调用 POST /api/ai/proxy/qa
   * @param question      用户问题
   * @param knowledgeContext 知识库上下文
   * @param imageBase64   可选图片（多模态问答）
   * @param callbacks     流式回调
   */
  async scenic_qa_ai(
    question: string,
    knowledgeContext: string,
    imageBase64?: string,
    callbacks?: StreamCallbacks
  ): Promise<QAResult> {
    this.ensureAlive()
    this.abortController = new AbortController()

    // 流式接口使用"空闲超时"：连接建立后每个 chunk 之间若超过超时时间则中断
    let timeoutId = setTimeout(
      () => this.abortController?.abort(),
      this.timeoutSeconds * 1000
    )

    try {
      const body = this.buildQABody(question, knowledgeContext, imageBase64)
      const res = await fetch(PROXY_QA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      })

      if (!res.ok) throw new Error(`问答接口 HTTP ${res.status}`)
      if (!res.body) throw new Error('问答接口无响应体')

      // 连接已建立，清除连接超时，后续改为空闲超时
      clearTimeout(timeoutId)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // 每收到数据重置空闲超时
        clearTimeout(timeoutId)
        timeoutId = setTimeout(
          () => this.abortController?.abort(),
          this.timeoutSeconds * 1000
        )

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const jsonStr = trimmed.slice(5).trim()
          if (jsonStr === '[DONE]') continue
          try {
            const chunk = JSON.parse(jsonStr)
            const delta = chunk.choices?.[0]?.delta?.content
            if (delta) {
              fullText += delta
              callbacks?.onChunk?.(delta)
            }
          } catch (_) {
            // 忽略单行解析错误
          }
        }
      }

      if (!fullText) throw new Error('问答接口空响应')

      const result: QAResult = {
        answer: fullText,
        emotion: 'neutral',
        source: this.config.name
      }
      callbacks?.onDone?.(result)
      return result
    } catch (err) {
      this.notifyFailure()
      callbacks?.onError?.(err as Error)
      throw err
    } finally {
      clearTimeout(timeoutId)
      this.abortController = null
    }
  }

  /**
   * AI 文字转语音 —— 朗读景点讲解
   * 调用 POST /api/ai/proxy/tts，返回二进制音频(audio/mpeg)
   * @param text 待合成文本
   */
  async voice_tts(text: string): Promise<ArrayBuffer> {
    this.ensureAlive()
    this.abortController = new AbortController()

    const timeoutId = setTimeout(
      () => this.abortController?.abort(),
      this.timeoutSeconds * 1000
    )

    try {
      const body = this.buildTTSBody(text)
      const res = await fetch(PROXY_TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      })

      if (!res.ok) {
        // TTS 错误体可能是 JSON
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const err = await res.json()
          throw new Error(err.error || `TTS 接口 HTTP ${res.status}`)
        }
        throw new Error(`TTS 接口 HTTP ${res.status}`)
      }

      const buf = await res.arrayBuffer()
      if (!buf || buf.byteLength === 0) throw new Error('TTS 接口返回空音频')
      return buf
    } catch (err) {
      this.notifyFailure()
      throw err
    } finally {
      clearTimeout(timeoutId)
      this.abortController = null
    }
  }

  // ==================== 资源释放 ====================

  /**
   * 销毁 Provider，释放资源
   * 中断所有进行中的请求，标记为已销毁，后续调用将被拒绝
   */
  destroy(): void {
    this.destroyed = true
    if (this.abortController) {
      try {
        this.abortController.abort()
      } catch (_) {
        // 忽略 abort 异常
      }
      this.abortController = null
    }
  }

  // ==================== 子类可覆写的请求体构造钩子 ====================

  /**
   * 构造识别请求体（子类可覆写以添加额外字段）
   * 默认输出后端代理统一格式
   */
  protected buildRecognizeBody(imageBase64: string): Record<string, unknown> {
    return {
      model_id: this.config.id,
      image_base64: imageBase64
    }
  }

  /**
   * 构造问答请求体（子类可覆写以添加额外字段）
   */
  protected buildQABody(
    question: string,
    knowledgeContext: string,
    imageBase64?: string
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model_id: this.config.id,
      question,
      knowledge_context: knowledgeContext
    }
    if (imageBase64) {
      body.image_base64 = imageBase64
    }
    return body
  }

  /**
   * 构造 TTS 请求体（子类可覆写以添加额外字段）
   */
  protected buildTTSBody(text: string): Record<string, unknown> {
    return {
      model_id: this.config.id,
      text
    }
  }

  // ==================== 内部工具方法 ====================

  /** 检查 Provider 是否可用（未被销毁） */
  protected ensureAlive(): void {
    if (this.destroyed) {
      throw new Error(`Provider [${this.config.name}] 已销毁，不可再用`)
    }
  }

  /** 通知调度器当前 Provider 调用失败（触发容错降级） */
  protected notifyFailure(): void {
    this.onFailure?.(this, this.config.role)
  }
}
