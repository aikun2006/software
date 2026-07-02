export type LLMProvider = 'openai' | 'baidu' | 'aliyun' | 'zhipu'

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  baseUrl?: string
  model: string
  temperature?: number
  maxTokens?: number
  timeout?: number
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
}

export interface LLMRequest {
  messages: LLMMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface LLMResponse {
  id: string
  model: string
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finishReason: string
  }[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  created: number
}

export interface LLMError {
  code: string
  message: string
  type: 'network' | 'api' | 'timeout' | 'rate_limit' | 'invalid_request' | 'unknown'
  retryable: boolean
}

export interface CachedResult {
  key: string
  response: LLMResponse
  timestamp: number
  ttl: number
  hitCount: number
}

export interface PromptTemplate {
  id: string
  name: string
  description: string
  systemPrompt: string
  userPromptTemplate?: string
  temperature?: number
  maxTokens?: number
  examples?: {
    input: string
    output: string
  }[]
}

export interface ConversationContext {
  userId: string
  sessionId: string
  history: LLMMessage[]
  createdAt: number
  updatedAt: number
}

export interface StreamChunk {
  delta: string
  done: boolean
}