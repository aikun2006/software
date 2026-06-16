export interface ReplyRule {
  id: string
  keywords: string[]
  responses: string[]
  category: string
  priority: number
}

export interface ConversationContext {
  lastQuestion: string
  lastAnswer: string
  conversationHistory: Array<{ question: string; answer: string }>
  emotion?: 'positive' | 'neutral' | 'negative'
  topic?: string
}

export interface KnowledgeItem {
  id: string
  title: string
  content: string
  category: string
  keywords: string[]
  relatedTopics: string[]
}

class AIResponder {
  private replyRules: ReplyRule[] = []
  private knowledgeBase: KnowledgeItem[] = []
  private context: ConversationContext = {
    lastQuestion: '',
    lastAnswer: '',
    conversationHistory: []
  }

  constructor() {
    this.initDefaultRules()
    this.initKnowledgeBase()
  }

  private initDefaultRules() {
    this.replyRules = [
      {
        id: 'greeting',
        keywords: ['你好', '您好', 'hi', 'hello', '嗨', '早上好', '下午好', '晚上好', '欢迎'],
        responses: [
          '您好！欢迎来到灵山胜境，我是您的AI导游，很高兴为您服务！😊',
          '您好！欢迎来到灵山胜境，有什么我可以帮助您的吗？',
          '嗨！欢迎您来到灵山胜境，让我陪您一起探索这座佛教文化圣地吧！',
          '您好呀！请问需要我帮您介绍灵山胜境的景点吗？'
        ],
        category: '问候',
        priority: 10
      },
      {
        id: 'thanks',
        keywords: ['谢谢', '感谢', '多谢', 'thank', 'thanks', '辛苦了'],
        responses: [
          '不客气！这是我应该做的~ 😊',
          '很高兴能帮到您！',
          '您太客气了，还有其他问题吗？',
          '能为您服务是我的荣幸！'
        ],
        category: '感谢',
        priority: 10
      },
      {
        id: 'opening_hours',
        keywords: ['开放', '开门', '时间', '几点', '什么时候', '关门', '闭园', '营业'],
        responses: [
          '灵山胜境全年开放，每日开放时间为7:30-17:30。节假日期间可能会调整开放时间，请提前关注官方公告。',
          '灵山胜境每天7:30开门，17:30闭园。建议您早点到达，可以充分游览各个景点。',
          '开放时间：每日7:30-17:30，九龙灌浴表演每天定时举行，具体时间以景区公告为准。',
          '节假日期间景区可能会延长开放时间，建议出行前查看官方通知。'
        ],
        category: '服务信息',
        priority: 8
      },
      {
        id: 'ticket_price',
        keywords: ['门票', '票价', '多少钱', '价格', '费用', '买票', '购票', '优惠'],
        responses: [
          '灵山胜境成人票210元/人，学生票105元/人，儿童1.4米以下免费，60-69岁老人半价，70岁以上老人免费。网上提前一天购票享195元优惠价！',
          '门票价格：成人210元，学生凭学生证105元。建议提前在官方渠道购票，避免现场排队。',
          '优惠政策：儿童1.4米以下免费，60岁以上老人享相应优惠，网上购票更划算哦！',
          '灵山胜境门票包含景区内所有主要景点，购买一次即可游览全部景点。'
        ],
        category: '服务信息',
        priority: 8
      },
      {
        id: 'route_recommend',
        keywords: ['路线', '怎么走', '游览路线', '游览攻略', '行程规划', '先去', '路线规划', '一日游', '半日游', '游览顺序'],
        responses: [
          '推荐您走经典朝圣之旅：入口广场 → 九龙灌浴 → 祥符禅寺 → 灵山大佛 → 梵宫，全程约3小时，涵盖景区核心景点。',
          '如果您对佛教文化感兴趣，可以选择深度文化之旅，细细品味灵山的历史与文化内涵。',
          '带小朋友的话，亲子欢乐之旅是个不错的选择，轻松愉快还能体验田园乐趣！',
          '摄影爱好者推荐摄影打卡之旅，精选最佳拍摄角度，记录灵山最美瞬间！',
          '建议预留一整天时间游览，可以更从容地欣赏每个景点的独特魅力。'
        ],
        category: '路线推荐',
        priority: 8
      },
      {
        id: 'scenic_intro',
        keywords: ['介绍', '景点', '这个地方', '这里', '有什么', '好玩', '特色', '著名'],
        responses: [
          '欢迎来到灵山胜境！这里是集自然风光与佛教文化于一体的大型文化景区，核心景点包括88米高的灵山大佛、气势恢宏的梵宫、神圣的九龙灌浴表演等。',
          '灵山胜境以佛教文化、自然山水、艺术奇观为三大特色，拥有世界最高的佛铜像，是中国最具影响力的宗教文化旅游胜地之一。',
          '景区内有祥符禅寺、五印坛城、佛手广场等众多景点，每个景点都承载着深厚的历史文化内涵，值得细细品味！',
          '灵山胜境不仅是宗教朝圣的圣地，也是休闲观光、文化体验的绝佳去处，四季景色各有特色。'
        ],
        category: '景点介绍',
        priority: 7
      },
      {
        id: 'food_recommend',
        keywords: ['吃', '吃饭', '餐厅', '美食', '推荐吃', '附近', '哪里吃', '特色菜', '有什么吃', '好吃的', '素斋', '餐饮'],
        responses: [
          '推荐您品尝灵山素斋！这是景区的特色餐饮，以素食为主，菜品精致美味，采用新鲜食材制作，不仅适合佛教信徒，也受到广大游客的喜爱。',
          '灵山胜境有多家素斋馆可供选择，素斋菜品丰富，口味独特，是体验健康饮食的好去处。',
          '逛累了可以去灵山素斋馆享用一顿健康美味的素食，为您的旅程补充能量！',
          '灵山素斋融合了江南美食的精致与佛教文化的内涵，值得一试！'
        ],
        category: '服务信息',
        priority: 7
      },
      {
        id: 'toilet_location',
        keywords: ['厕所', '卫生间', '洗手间', '方便', 'wc', 'toilet'],
        responses: [
          '卫生间在每个主要景点附近都有指示牌，您注意看标识就能找到！',
          '最近的厕所在前方50米处，有明显的指示标志。',
          '游客中心旁边就有卫生间，干净整洁~',
          '景区内每隔200米左右就有一个卫生间，非常方便。'
        ],
        category: '服务信息',
        priority: 9
      },
      {
        id: 'parking',
        keywords: ['停车', '停车场', '车位', '车停', '开车', '收费'],
        responses: [
          '景区有两个大型停车场，南门停车场车位充足，导航"景区南门停车场"即可。',
          '停车很方便的，我们有1000+车位，小车10元/次。',
          '建议您早点来，节假日停车位可能比较紧张~',
          '电动车也有专门的停车区域和充电设施哦！'
        ],
        category: '服务信息',
        priority: 7
      },
      {
        id: 'weather',
        keywords: ['天气', '下雨', '温度', '冷', '热', '明天', '今天', '预报'],
        responses: [
          '今天天气不错，很适合游玩！建议您做好防晒，多喝水~',
          '出行前建议您查看一下天气预报，有备无患！',
          '这个季节来游玩最舒服了，气温适宜，风景正好！',
          '最近天气多变，建议随身带把伞以防万一。'
        ],
        category: '其他',
        priority: 6
      },
      {
        id: 'complaint',
        keywords: ['投诉', '不满', '太差', '糟糕', '生气', '不满意', '服务差', '问题'],
        responses: [
          '非常抱歉让您不满意了！请您告诉我具体是什么问题，我们一定会认真改进。',
          '对不起给您带来不好的体验，您能详细说说情况吗？',
          '非常抱歉！您的反馈对我们很重要，我们会立即处理。',
          '感谢您的反馈，我们会尽快解决您的问题！'
        ],
        category: '投诉处理',
        priority: 10
      },
      {
        id: 'compliment',
        keywords: ['好', '棒', '赞', '不错', '喜欢', '漂亮', '美丽', '开心', '满意'],
        responses: [
          '谢谢您的夸奖！很高兴您喜欢这里~ 😊',
          '能让您开心是我最大的荣幸！',
          '谢谢！您的满意是对我们最大的肯定！',
          '听到您这么说我太开心了！欢迎常来！'
        ],
        category: '感谢',
        priority: 9
      },
      {
        id: 'goodbye',
        keywords: ['再见', '拜拜', 'bye', '走了', '离开', '下次', '结束'],
        responses: [
          '再见！祝您旅途愉快，期待您的下次光临！👋',
          '拜拜！玩得开心点，欢迎常来！',
          '再见啦！美好的回忆永远留在心中~',
          '感谢您的光临，欢迎下次再来！'
        ],
        category: '问候',
        priority: 9
      },
      {
        id: 'help',
        keywords: ['帮助', '求助', '需要', '怎么办', '怎么弄', '操作'],
        responses: [
          '请问需要什么帮助？我可以帮您解答景区相关的问题。',
          '有什么问题尽管问我，我会尽力帮助您！',
          '别担心，告诉我您的问题，我来帮您解决！',
          '需要帮助吗？我可以帮您查询路线、景点信息等。'
        ],
        category: '其他',
        priority: 8
      },
      {
        id: 'default',
        keywords: [],
        responses: [
          '这个问题很有趣！让我想想...其实您可以看看景区导览地图，上面有很多有用的信息哦！',
          '您的问题我收到了，我正在学习更多知识中。要不您试试问我一些关于景区的问题？',
          '感谢您的提问！虽然我现在还不能完美回答，但我会努力学习的~ 您可以问问开放时间、门票价格等问题哦！',
          '很抱歉，这个问题我还不太了解，您可以尝试询问其他问题。'
        ],
        category: '默认',
        priority: 0
      }
    ]
  }

  private initKnowledgeBase() {
    this.knowledgeBase = [
      {
        id: 'ls_kb_1',
        title: '灵山胜境',
        content: '灵山胜境位于江苏省无锡市，始建于1997年，是一个集自然风光与佛教文化于一体的大型文化景区。景区以88米高的灵山大佛为核心，融合了源远流长的佛教历史与博大精深的传统文化，是中国最具影响力的宗教文化旅游胜地之一。',
        category: '景区概况',
        keywords: ['灵山', '灵山胜境', '无锡', '佛教', '文化', '景区'],
        relatedTopics: ['历史', '文化', '宗教']
      },
      {
        id: 'ls_kb_2',
        title: '灵山大佛',
        content: '灵山大佛是世界上最高的佛铜像，高达88米，相当于30层楼高。大佛右手"施无畏印"代表去除痛苦，左手"施与愿印"代表给予快乐，整个佛像形态庄严圆满，气势恢宏。大佛所在位置为唐玄奘命名的小灵山，故名灵山大佛。',
        category: '景点介绍',
        keywords: ['灵山大佛', '大佛', '铜像', '88米', '佛教', '玄奘'],
        relatedTopics: ['佛教', '建筑', '景点']
      },
      {
        id: 'ls_kb_3',
        title: '灵山梵宫',
        content: '灵山梵宫是一座气势磅礴的佛教艺术殿堂，建筑面积达7万余平方米。宫内汇集了大量佛教艺术珍品，包括东阳木雕、敦煌壁画、景泰蓝须弥灯等，融合了中国传统建筑与佛教文化精髓，被誉为"东方卢浮宫"。',
        category: '景点介绍',
        keywords: ['梵宫', '灵山梵宫', '艺术', '建筑', '木雕', '壁画'],
        relatedTopics: ['建筑', '艺术', '佛教']
      },
      {
        id: 'ls_kb_4',
        title: '九龙灌浴',
        content: '九龙灌浴是灵山胜境的标志性景观之一，再现了佛陀诞生时"九龙吐水、天女散花"的神圣场景。每天定时表演，喷泉随着音乐节奏变幻，莲花缓缓绽放，太子佛从中升起，场面壮观震撼，是游客必看的精彩表演。',
        category: '景点介绍',
        keywords: ['九龙灌浴', '表演', '喷泉', '佛陀', '莲花'],
        relatedTopics: ['表演', '佛教', '景点']
      },
      {
        id: 'ls_kb_5',
        title: '五印坛城',
        content: '五印坛城是一座藏传佛教风格的建筑，融合了藏族传统建筑艺术与佛教文化。坛城内部展示了丰富的藏传佛教文化艺术品，包括唐卡、壁画、法器等，是了解藏传佛教文化的重要场所。',
        category: '景点介绍',
        keywords: ['五印坛城', '藏传佛教', '坛城', '唐卡', '文化'],
        relatedTopics: ['建筑', '宗教', '文化']
      },
      {
        id: 'ls_kb_6',
        title: '祥符禅寺',
        content: '祥符禅寺始建于唐代，是灵山胜境的核心宗教场所。寺内保存着众多历史文物和佛教珍品，包括宋代的古钟、明代的石碑等。每年香火旺盛，吸引了大量信众前来朝拜祈福。',
        category: '景点介绍',
        keywords: ['祥符禅寺', '寺庙', '唐代', '祈福', '佛教'],
        relatedTopics: ['历史', '宗教', '建筑']
      },
      {
        id: 'ls_kb_7',
        title: '灵山文化',
        content: '灵山胜境承载着深厚的佛教文化内涵。据记载，唐代玄奘法师曾在此讲经说法，留下了"小灵山"的美名。景区内的祥符禅寺历史悠久，始建于唐代，是江南著名的古刹之一。每年的浴佛节、腊八节等佛教节日都会举办盛大的法会活动。',
        category: '文化历史',
        keywords: ['文化', '历史', '玄奘', '佛教', '法会', '浴佛节'],
        relatedTopics: ['历史', '文化', '宗教']
      },
      {
        id: 'ls_kb_8',
        title: '灵山素斋',
        content: '灵山素斋是景区的特色餐饮，以素食为主，菜品精致美味。素斋采用新鲜食材，制作精美，不仅适合佛教信徒，也受到广大游客的喜爱。景区内有多家素斋馆可供选择，是体验健康饮食的好去处。',
        category: '服务信息',
        keywords: ['素斋', '餐饮', '素食', '美食', '灵山素斋'],
        relatedTopics: ['餐饮', '美食', '服务']
      },
      {
        id: 'ls_kb_9',
        title: '佛手广场',
        content: '佛手广场上矗立着一只巨大的佛手，高11.7米，宽5.5米，是按灵山大佛右手1:1比例复制的。佛手象征着"施无畏印"，寓意着去除痛苦、给予快乐。游客可以触摸佛手，祈求平安吉祥。',
        category: '景点介绍',
        keywords: ['佛手', '佛手广场', '手印', '祈福', '平安'],
        relatedTopics: ['佛教', '景点', '祈福']
      },
      {
        id: 'ls_kb_10',
        title: '灵山开放时间',
        content: '灵山胜境全年开放，每日开放时间为7:30-17:30。节假日期间可能会调整开放时间，建议提前关注官方公告。九龙灌浴表演每天定时举行，具体时间以景区公告为准。',
        category: '服务信息',
        keywords: ['开放时间', '时间', '表演时间', '节假日'],
        relatedTopics: ['服务', '时间']
      },
      {
        id: 'ls_kb_11',
        title: '灵山门票',
        content: '成人票：210元/人，学生票：105元/人，儿童票：免费（1.4米以下），60-69岁老人半价优惠，70岁以上老人免费。网上提前一天购票可享受优惠价195元/人。建议提前在官方渠道购票，避免现场排队。',
        category: '服务信息',
        keywords: ['门票', '价格', '优惠', '购票', '学生', '老人'],
        relatedTopics: ['服务', '票务']
      },
      {
        id: 'ls_kb_12',
        title: '灵山交通',
        content: '灵山胜境位于无锡市滨湖区，距无锡市区约20公里。可乘坐公交88路、89路直达景区，也可自驾前往，景区设有大型停车场。从无锡火车站可乘坐地铁2号线至梅园站，再转乘公交前往。',
        category: '服务信息',
        keywords: ['交通', '公交', '自驾', '停车', '地铁'],
        relatedTopics: ['服务', '交通']
      }
    ]
  }

  getResponse(question: string, emotion?: 'positive' | 'neutral' | 'negative'): {
    answer: string
    category: string
    emotion: 'positive' | 'neutral' | 'negative'
    source?: string
  } {
    const normalizedQuestion = question.toLowerCase()

    let matchedRule: ReplyRule | null = null
    let matchedKnowledge: KnowledgeItem | null = null
    let bestScore = 0
    let bestKeywordLen = 0

    for (const rule of this.replyRules) {
      if (rule.keywords.length === 0 && !matchedRule) {
        matchedRule = rule
        continue
      }

      let matchCount = 0
      let keywordScore = 0   // 关键词长度加权，长词更具体
      for (const keyword of rule.keywords) {
        if (normalizedQuestion.includes(keyword.toLowerCase())) {
          matchCount++
          keywordScore += keyword.length * keyword.length  // 长度平方加权
        }
      }

      // 按加权分数排序，分数相同看关键词总长度（优先更具体的匹配）
      const score = keywordScore * 10 + matchCount
      if (matchCount > 0 && score > bestScore) {
        bestScore = score
        bestKeywordLen = keywordScore
        matchedRule = rule
      } else if (matchCount > 0 && score === bestScore && rule.priority > (matchedRule?.priority || 0)) {
        // 分数相同时按优先级
        matchedRule = rule
      }
    }

    for (const knowledge of this.knowledgeBase) {
      let matchCount = 0
      let keywordScore = 0
      for (const keyword of knowledge.keywords) {
        if (normalizedQuestion.includes(keyword.toLowerCase())) {
          matchCount++
          keywordScore += keyword.length
        }
      }

      if (matchCount >= 2 || keywordScore >= 6) {
        matchedKnowledge = knowledge
        break
      }
    }

    let answer = ''
    let category = ''
    let responseEmotion: 'positive' | 'neutral' | 'negative' = 'neutral'
    let source: string | undefined

    if (matchedKnowledge) {
      answer = matchedKnowledge.content
      category = matchedKnowledge.category
      source = `知识库: ${matchedKnowledge.title}`
      responseEmotion = 'neutral'
    } else if (matchedRule) {
      const responses = matchedRule.responses
      const randomIndex = Math.floor(Math.random() * responses.length)
      answer = responses[randomIndex]
      category = matchedRule.category

      if (matchedRule.id === 'complaint') {
        responseEmotion = 'negative'
      } else if (matchedRule.id === 'compliment' || matchedRule.id === 'thanks' || matchedRule.id === 'greeting') {
        responseEmotion = 'positive'
      }
    } else {
      const defaultRule = this.replyRules.find(r => r.id === 'default')!
      answer = defaultRule.responses[Math.floor(Math.random() * defaultRule.responses.length)]
      category = defaultRule.category
    }

    answer = this.applyContext(answer, question)
    this.updateContext(question, answer)

    return {
      answer,
      category,
      emotion: responseEmotion,
      source
    }
  }

  private applyContext(answer: string, question: string): string {
    if (this.context.topic) {
      if (question.includes('更多') || question.includes('详细') || question.includes('具体')) {
        answer = `关于${this.context.topic}的详细信息：${answer}`
      }
    }
    return answer
  }

  private updateContext(question: string, answer: string) {
    this.context.lastQuestion = question
    this.context.lastAnswer = answer
    
    const topics = ['景点', '路线', '门票', '时间', '服务', '美食']
    for (const topic of topics) {
      if (question.includes(topic)) {
        this.context.topic = topic
        break
      }
    }

    this.context.conversationHistory.push({ question, answer })
    
    if (this.context.conversationHistory.length > 15) {
      this.context.conversationHistory.shift()
    }
  }

  addRule(rule: ReplyRule) {
    this.replyRules.unshift(rule)
  }

  addKnowledge(item: KnowledgeItem) {
    this.knowledgeBase.push(item)
  }

  loadFromKnowledgeBase(items: Array<{
    title: string
    content: string
    category: string
    keywords?: string[]
  }>) {
    items.forEach((item, index) => {
      const keywords = item.keywords || [item.title, ...item.title.split('')]
      this.addKnowledge({
        id: `kb_${Date.now()}_${index}`,
        title: item.title,
        content: item.content,
        category: item.category,
        keywords,
        relatedTopics: []
      })
    })
  }

  getConversationHistory() {
    return [...this.context.conversationHistory]
  }

  clearContext() {
    this.context = {
      lastQuestion: '',
      lastAnswer: '',
      conversationHistory: [],
      topic: undefined
    }
  }

  getKnowledgeBase() {
    return [...this.knowledgeBase]
  }

  getRelatedKnowledge(topic: string): KnowledgeItem[] {
    return this.knowledgeBase.filter(kb => 
      kb.relatedTopics.includes(topic) || 
      kb.keywords.some(kw => topic.includes(kw))
    )
  }
}

export const aiResponder = new AIResponder()
