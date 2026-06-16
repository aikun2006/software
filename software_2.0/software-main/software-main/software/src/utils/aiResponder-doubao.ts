// 接入豆包AI（通过本地代理）
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: (result: { answer: string; category: string; emotion: 'positive' | 'neutral' | 'negative'; source?: string }) => void
  onError?: (err: Error) => void
}

class DoubaoAIResponder {
  private apiKey: string
  private modelId: string
  private baseUrl: string
  private systemPrompt: string

  constructor() {
    this.apiKey = 'ark-6c40917b-c43a-4102-b524-fb472c88ca51-20741'
    this.modelId = 'doubao-seed-character-251128'
    this.baseUrl = '/api/chat'

    this.systemPrompt = `你是灵山胜境景区的AI导游"小乐"，专业、友好、有耐心。
你熟悉景区的一切：灵山大佛、九龙灌浴、梵宫、五印坛城、祥符禅寺等景点。
你也了解门票价格、开放时间、交通路线、素斋美食等服务信息。
请用中文回答游客问题，语气亲切自然，像朋友一样聊天。
回答要准确、有用，不要编造信息。`
  }

  async getResponseStream(question: string, callbacks: StreamCallbacks): Promise<void> {
    if (!this.apiKey || this.apiKey === 'your-api-key-here') {
      const fallback = this.fallbackResponse(question)
      callbacks.onChunk(fallback.answer)
      callbacks.onDone(fallback)
      return
    }

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: question }
      ]

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: messages,
          max_tokens: 500,
          temperature: 0.7,
          stream: false
        })
      })

      if (!response.ok) throw new Error(`API: ${response.status}`)

      const data = await response.json()
      const answer = data.choices?.[0]?.message?.content?.trim() || '抱歉，我没有听清楚，可以再说一遍吗？'

      callbacks.onChunk(answer)
      callbacks.onDone({
        answer,
        category: 'AI回复',
        emotion: 'positive',
        source: '豆包AI'
      })
    } catch (error) {
      console.error('豆包API失败:', error)
      const fallback = this.fallbackResponse(question)
      callbacks.onChunk(fallback.answer)
      callbacks.onDone(fallback)
    }
  }

  private fallbackResponse(question: string) {
    const q = question.toLowerCase()
    if (q.includes('美食') || q.includes('吃')) {
      return { answer: '推荐您品尝灵山素斋！这是景区的特色餐饮，以素食为主，菜品精致美味。', category: '服务信息', emotion: 'positive' as const, source: '本地规则' }
    }
    if (q.includes('门票') || q.includes('价格')) {
      return { answer: '灵山胜境成人票210元/人，学生票105元/人，网上提前购票有优惠。', category: '服务信息', emotion: 'neutral' as const, source: '本地规则' }
    }
    return { answer: '您好！我是小乐，有什么可以帮您的吗？您可以问我景点介绍、门票价格、美食推荐等问题。', category: '默认', emotion: 'neutral' as const, source: '本地规则' }
  }
}

export const aiResponder = new DoubaoAIResponder()
