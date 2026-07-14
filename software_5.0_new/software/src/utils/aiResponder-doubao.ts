/**
 * AI 导游响应器 —— 双模型架构
 *
 * 文本对话 → 智谱 GLM-4-Flash  (/api/chat)
 * 多模态   → 智谱 GLM-4V-Flash (/api/chat-vision)
 *
 * 文本与多模态均走智谱免费模型。API 故障自动降级到本地知识库。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: (result: { answer: string; category: string; emotion: 'positive' | 'neutral' | 'negative'; source?: string }) => void
  onError?: (err: Error) => void
}

const CHAT_TEXT_URL = '/api/chat'
const CHAT_VISION_URL = '/api/chat-vision'

const TEXT_MODEL = 'glm-4-flash'
const ZHIPU_MODEL = 'glm-4v-flash'

const BASE_SYSTEM_PROMPT = `你是灵山胜境景区的AI导游"小乐"，专业、热情、善解人意。

景区核心知识：
- 灵山大佛：88米露天青铜释迦牟尼立像，世界最大立像之一
- 梵宫：世界佛教论坛永久会址，"东方卢浮宫"
- 九龙灌浴：音乐喷泉铜雕，10:00-16:00整点表演约8分钟
- 五印坛城：藏式佛教艺术殿堂
- 祥符禅寺：唐代千年古刹
- 门票：成人210元，学生105元，1.4米以下/70岁以上免票
- 开放：旺季7:30-17:30，淡季8:00-17:00
- 交通：88路公交、自驾停车场、无锡站打车50分钟
- 素斋：梵宫素食餐厅、祥符禅寺素斋馆，人均50-150元

回答要求：简洁亲切3-5句，自然口语化，不用markdown格式。`

/** 按游客年龄动态拼装系统提示词：年长游客追加无障碍/平缓路线指引 */
function buildSystemPrompt(age: number | null): string {
  if (age != null && age >= 60) {
    return BASE_SYSTEM_PROMPT + `\n\n【当前游客画像】年长游客，约${age}岁。作答时请：优先推荐平缓、台阶少的无障碍游览路线；主动告知无障碍设施、电梯、轮椅通道、休息点与无障碍卫生间位置；避开长阶梯与陡坡路段；步行节奏放缓、多提示中途休息；语气更耐心体贴。`
  }
  if (age != null) {
    return BASE_SYSTEM_PROMPT + `\n\n【当前游客画像】年龄约${age}岁，可按常规游览节奏推荐。`
  }
  return BASE_SYSTEM_PROMPT
}


// ---- 本地知识库（API 故障时 fallback） ----

interface Rule { keywords: string[]; answer: string; category: string; emotion: 'positive' | 'neutral' | 'negative' }

const KNOWLEDGE: Rule[] = [
  { keywords: ['大佛','灵山大佛','佛像','释迦牟尼'], answer:'灵山大佛高88米，由1560块青铜壁板拼装而成，是世界最大的释迦牟尼立像之一。右手指天为"施无畏印"，左手垂地为"与愿印"。建议上午参观，光线最佳，还可抱佛脚祈福~', category:'景点', emotion:'positive' },
  { keywords: ['梵宫','灵山梵宫'], answer:'梵宫被誉为"东方卢浮宫"，是世界佛教论坛永久会址。建筑面积7万多平方米，内部金碧辉煌，有《灵山吉祥颂》大型演出。号称必看景点，震撼程度不输顶级博物馆！', category:'景点', emotion:'positive' },
  { keywords: ['九龙灌浴','九龙','灌浴','太子'], answer:'九龙灌浴是国内最大规模音乐喷泉动态铜雕。每整点表演时莲花绽放、太子像升起、九龙喷水，场面震撼。10:00-16:00每小时一场，每场约8分钟，建议提前5分钟占位~', category:'景点', emotion:'positive' },
  { keywords: ['五印坛城','坛城','藏式'], answer:'五印坛城是藏式佛教艺术殿堂，展示了五方佛的五种手印。内部有精美唐卡、壁画和造像，色彩斑斓。注意保持安静，禁止触摸壁画。', category:'景点', emotion:'positive' },
  { keywords: ['祥符禅寺','禅寺','寺庙','和尚'], answer:'祥符禅寺始建于唐代，是灵山大佛的母寺。寺内有大雄宝殿、天王殿等，可入内参拜。注意保持安静肃穆。', category:'景点', emotion:'neutral' },
  { keywords: ['门票','票价','多少钱','价格','费用'], answer:'灵山胜境成人票210元/人，学生票105元（凭学生证），1.4米以下儿童及70岁以上老人免票。建议提前在公众号或OTA平台购票更优惠~', category:'服务', emotion:'neutral' },
  { keywords: ['时间','几点','开放','关门','营业'], answer:'旺季（3-10月）7:30-17:30，淡季（11-2月）8:00-17:00。九龙灌浴表演10:00、11:30、14:00、15:30，梵宫演出时间请以当日公告为准。', category:'服务', emotion:'neutral' },
  { keywords: ['素斋','吃饭','美食','餐饮','午饭','餐厅'], answer:'灵山素斋精致美味，推荐梵宫素食餐厅和祥符禅寺素斋馆，人均50-150元。灵山素面和素包子是必尝特色~', category:'服务', emotion:'positive' },
  { keywords: ['怎么去','交通','地铁','公交','自驾','高铁','停车'], answer:'自驾导航"灵山胜境"有大型停车场，小车10元/次。公交88路从无锡火车站出发约1.5小时。地铁2号线到梅园站换88/89路。高铁无锡站打车约50分钟。', category:'交通', emotion:'neutral' },
  { keywords: ['路线','游览','怎么玩','攻略','推荐'], answer:'推荐路线（4-5小时）：大门→杏坛广场→九龙灌浴→灵山大佛→祥符禅寺→梵宫→五印坛城→曼飞龙塔→出园。上午看九龙灌浴，下午参观梵宫~', category:'建议', emotion:'positive' },
  { keywords: ['多久','多长时间','几个小时'], answer:'完整游览约4-5小时，走马观花约3小时，深度游建议一天。穿舒适运动鞋，带饮用水和防晒~', category:'建议', emotion:'neutral' },
  { keywords: ['拜佛','礼佛','烧香','上香','礼仪'], answer:'着装得体勿穿吊带拖鞋，进殿左脚先跨不踩门槛，上香三支代表佛法僧三宝，殿内不拍照不大声喧哗，顺时针绕佛右绕三圈为佳。', category:'文化', emotion:'neutral' },
  { keywords: ['曼飞龙塔','白塔','塔'], answer:'曼飞龙塔是仿云南曼飞龙塔建造的小乘佛教建筑，白色塔身金顶装饰，是灵山胜境的独特景观，适合拍照打卡~', category:'景点', emotion:'positive' },
  { keywords: ['杏坛','广场','入口'], answer:'杏坛广场是灵山胜境入口处的第一个广场，有古银杏树和石刻经文，是游览起点和集合点~', category:'景点', emotion:'neutral' },
  { keywords: ['百子戏弥勒','弥勒','百子'], answer:'百子戏弥勒是一组青铜雕塑，100个顽童围绕在弥勒佛周围嬉戏，造型生动有趣，是亲子拍照热门打卡点~', category:'景点', emotion:'positive' },
  { keywords: ['照壁','灵山照壁'], answer:'灵山照壁是景区入口的大型石雕照壁，刻有佛教故事和祥瑞图案，是灵山胜境的标志性入口景观~', category:'景点', emotion:'neutral' },
  { keywords: ['洗手间','卫生间','厕所','wc'], answer:'景区内各主要景点附近均设有免费卫生间，入口处、梵宫旁、大佛脚下、九龙灌浴旁都有，并设有无障碍卫生间~', category:'服务', emotion:'neutral' },
  { keywords: ['寄存','行李','存包'], answer:'景区入口游客服务中心提供免费行李寄存服务，大件行李也可寄存，游览结束后取回即可~', category:'服务', emotion:'neutral' },
  { keywords: ['轮椅','无障碍','残疾人','推车'], answer:'景区提供免费轮椅租赁（押金200元），主要景点均有无障碍通道和电梯。年长游客推荐走无障碍路线：入口→电瓶车→大佛→梵宫→出口~', category:'服务', emotion:'positive' },
  { keywords: ['婴儿车','亲子','小孩','儿童','孩子'], answer:'景区允许推婴儿车，推荐百子戏弥勒和九龙灌浴两个亲子打卡点。儿童1.4米以下免票，建议带防晒和饮用水~', category:'服务', emotion:'positive' },
  { keywords: ['天气','下雨','防晒','穿衣'], answer:'灵山景区多为户外，建议晴天游览。夏季注意防晒带帽子和水，雨天景区有雨伞租赁（20元/把）。穿舒适运动鞋最佳~', category:'服务', emotion:'neutral' },
  { keywords: ['拍照','摄影','照片','打卡'], answer:'推荐拍照点：大佛脚下仰拍、梵宫内部金顶、九龙灌浴全景、曼飞龙塔白塔、百子戏弥勒互动照。梵宫内部分区域禁止拍照请注意提示~', category:'建议', emotion:'positive' },
  { keywords: ['酒店','住宿','住','民宿','客栈'], answer:'景区周边有灵山精舍（禅意主题酒店）、灵山元一希尔顿逸林酒店等，从经济型到高端均有。建议提前预订，旺季房源紧张~', category:'服务', emotion:'neutral' },
  { keywords: ['纪念品','购物','特产','礼物'], answer:'梵宫内有文创商店，推荐灵山素饼、佛珠手串、明信片等特色纪念品。景区出口处也有商店，价格适中~', category:'服务', emotion:'neutral' },
  { keywords: ['电瓶车','观光车','车'], answer:'景区提供电瓶车服务，20元/人/次，可在入口处购票。路线覆盖主要景点，适合体力有限的游客。全程步行约4-5小时，电瓶车可缩短至2-3小时~', category:'服务', emotion:'neutral' },
]


class DualModelResponder {
  private history: ChatMessage[] = []
  private userProfile: { age?: number | null } = {}

  /** 注入当前游客画像（年龄），用于动态拼装系统提示词 */
  setUserProfile(profile: { age?: number | null } | null) {
    this.userProfile = profile ? { age: profile.age ?? null } : {}
  }

  private get systemPrompt(): string {
    return buildSystemPrompt(this.userProfile.age ?? null)
  }

  /** RAG检索：根据用户问题搜索本地知识库，返回匹配的知识上下文 */
  private searchKnowledge(question: string): string {
    const lower = question.toLowerCase()
    const matched: string[] = []
    for (const rule of KNOWLEDGE) {
      for (const kw of rule.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          matched.push(rule.answer)
          break // 每条规则只匹配一次
        }
      }
    }
    if (matched.length === 0) return ''
    // 拼接匹配的知识条目，最多取3条避免prompt过长
    return '\n\n【知识库参考】\n' + matched.slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join('\n')
  }

  /** 构建带知识库上下文的system prompt */
  private buildContextAwarePrompt(question: string): string {
    const knowledge = this.searchKnowledge(question)
    return this.systemPrompt + (knowledge ? `\n请优先参考以上知识库内容回答游客问题，确保信息准确。` : '')
  }

  /**
   * 纯文本对话 — 走智谱 GLM-4-Flash
   */
  async getResponseStream(question: string, callbacks: StreamCallbacks): Promise<void> {
    await this._callAI(
      CHAT_TEXT_URL,
      TEXT_MODEL,
      [{ role: 'system', content: this.buildContextAwarePrompt(question) }, ...this.history.slice(-8), { role: 'user', content: question }],
      callbacks,
      'GLM-4-Flash',
      question
    )
  }

  /**
   * 多模态对话（图片+文字）— 走智谱 GLM-4V-Flash
   * @param question 文字问题
   * @param imageUrls base64 或 http URL 的图片数组
   */
  async getResponseStreamWithImages(
    question: string,
    imageUrls: string[],
    callbacks: StreamCallbacks
  ): Promise<void> {
    // 智谱 content 多段格式：[{type:'text',text:...},{type:'image_url',image_url:{url:...}}]
    const userContent: any[] = [{ type: 'text', text: question }]
    for (const url of imageUrls) {
      userContent.push({ type: 'image_url', image_url: { url } })
    }

    await this._callAI(
      CHAT_VISION_URL,
      ZHIPU_MODEL,
      [
        { role: 'system', content: this.buildContextAwarePrompt(question) },
        ...this.history.slice(-8),
        { role: 'user', content: userContent as any }
      ],
      callbacks,
      'GLM-4V-Flash',
      question
    )
  }

  /**
   * 通用 AI 调用 + SSE 流式解析 + 降级
   */
  private async _callAI(
    url: string,
    model: string,
    messages: any[],
    callbacks: StreamCallbacks,
    sourceLabel: string,
    fallbackQuestion: string
  ) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true, max_tokens: 1024, temperature: 0.7 })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error('No body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
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
              callbacks.onChunk(delta)
            }
          } catch (_) {}
        }
      }

      if (!fullText) throw new Error('空响应')

      // 记录历史
      this.history.push({ role: 'user', content: fallbackQuestion })
      this.history.push({ role: 'assistant', content: fullText })
      if (this.history.length > 20) this.history = this.history.slice(-20)

      callbacks.onDone({ answer: fullText, category: '对话', emotion: 'positive', source: sourceLabel })

    } catch (err) {
      console.error(`[${sourceLabel}] 失败，降级本地:`, err)
      callbacks.onError?.(err as Error)
      const local = this.matchLocal(fallbackQuestion)
      callbacks.onChunk(local.answer)
      callbacks.onDone(local)
    }
  }

  private matchLocal(q: string): { answer: string; category: string; emotion: 'positive' | 'neutral' | 'negative'; source?: string } {
    const lower = q.toLowerCase()
    for (const rule of KNOWLEDGE) {
      for (const kw of rule.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          return { answer: rule.answer, category: rule.category, emotion: rule.emotion, source: '本地知识库(离线)' }
        }
      }
    }
    return { answer: '您好！我是灵山胜境AI导游小乐，目前网络不太稳定，我先用基础模式为您服务。您可以问我景点介绍、门票价格、开放时间、交通路线、素斋餐饮、游览建议等问题~', category: '默认', emotion: 'neutral', source: '本地知识库(离线)' }
  }

  clearHistory() { this.history = [] }
}

export const aiResponder = new DualModelResponder()
