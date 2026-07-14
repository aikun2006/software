import { ref, onMounted, onUnmounted, watch } from 'vue'
import { currentLang } from '@/i18n'

export interface QAItem {
  id: number
  question: string
  questionEn: string
  answer: string
  answerEn: string
}

/* ============================== 灵山景点通用题库 ============================== */
export const spotQA: QAItem[] = [
  {
    id: 0,
    question: '灵山大佛开放时间是几点？',
    questionEn: 'What are the opening hours of Lingshan Grand Buddha?',
    answer: '灵山胜境景区开放时间为 07:30-17:30（夏季可能延长至18:00），灵山大佛区域全天可参观，建议上午前往光线最佳。',
    answerEn: 'Lingshan Scenic Area is open 07:30-17:30 (extended to 18:00 in summer). The Grand Buddha area is open all day. Morning light is best for visiting.'
  },
  {
    id: 1,
    question: '景区门票多少钱，有没有优惠？',
    questionEn: 'How much is the ticket? Any discounts?',
    answer: '成人票210元/人，儿童1.2米以下免票，1.2-1.5米半价；65岁以上老人凭身份证半价；学生凭学生证享8折优惠；团体10人以上可享团体票。',
    answerEn: 'Adult ticket: 210 RMB/person. Children under 1.2m free, 1.2-1.5m half price. Seniors 65+ with ID: half price. Students with ID: 20% off. Groups of 10+: group discount.'
  },
  {
    id: 2,
    question: '景区停车收费标准是什么？',
    questionEn: 'Parking fee and availability?',
    answer: '小型车辆10元/次（当日有效），大型车辆20元/次；停车场位于景区入口两侧，节假日车位紧张建议早到。',
    answerEn: 'Car: 10 RMB/time (valid all day). Bus: 20 RMB/time. Parking lots are located at both sides of the entrance. Arrive early during holidays.'
  },
  {
    id: 3,
    question: '景区游览全程大概需要多久？',
    questionEn: 'How long does it take to explore Lingshan?',
    answer: '全程步行游览约需4-5小时，乘坐观光车约3小时；建议预留半天时间，重点游览灵山大佛、九龙灌浴、灵山梵宫等核心景点。',
    answerEn: 'Walking tour: 4-5 hours. With shuttle bus: 3 hours. Suggest reserving half a day. Key spots: Grand Buddha, Nine Dragons Bathing, Lingshan Buddhist Palace.'
  },
  {
    id: 4,
    question: '景区内有没有素食餐厅？',
    questionEn: 'Vegetarian restaurants inside the park?',
    answer: '景区内设有多处素食餐厅，灵山梵宫内有无自助素斋餐厅，祥符禅寺附近有素面馆；推荐品尝灵山特色素斋，人均50-80元。',
    answerEn: 'Multiple vegetarian restaurants inside the park: buffet in Lingshan Palace, noodle shop near Xiangfu Temple. Average 50-80 RMB/person.'
  },
  {
    id: 5,
    question: '带老人小孩游玩路线推荐？',
    questionEn: 'Easy route for seniors and children?',
    answer: '推荐乘坐观光车游览：入口 → 阿育王柱 → 灵山大佛 → 九龙灌浴 → 灵山梵宫 → 五印坛城，全程约2小时，步行较少，老少皆宜。',
    answerEn: 'Take the shuttle bus: Entrance → Ashoka Pillar → Grand Buddha → Nine Dragons Bathing → Lingshan Palace → Five Seal Mandala. About 2 hours with minimal walking.'
  },
  {
    id: 6,
    question: '景区祈福流程有什么讲究？',
    questionEn: 'Prayer etiquette at Lingshan?',
    answer: '灵山祈福建议顺时针绕佛三圈，双手合十虔诚礼拜；可在祥符禅寺请香祈福，在祈福普缘挂祈福牌；抱佛脚寓意好运，佛手前祈求平安吉祥。',
    answerEn: 'Walk clockwise around the Buddha three times, bow with hands clasped. Incense available at Xiangfu Temple. Hanging prayer plaques and touching the Buddha\'s feet bring good luck.'
  },
  {
    id: 7,
    question: '景区周边有什么平价民宿？',
    questionEn: 'Budget-friendly accommodations nearby?',
    answer: '灵山胜境周边有多家平价民宿，价格150-300元/晚不等，建议提前在平台预订；景区入口处的灵山小镇也有精品客栈可选。',
    answerEn: 'Budget options: 150-300 RMB/night. Book in advance online. Lingshan Town near the entrance also offers boutique inns.'
  },
  {
    id: 8,
    question: '景区节假日人流量大吗？',
    questionEn: 'Crowds during holidays?',
    answer: '春节、五一、国庆等重大节假日人流量较大，建议错峰出行或上午9点前入园；平日游览体验更佳，拍照打卡无需排队。',
    answerEn: 'Very crowded during Spring Festival, May Day, and National Day. Arrive before 9 AM or visit on weekdays for better experience and no queues.'
  },
  {
    id: 9,
    question: '灵山内部观光车怎么收费？',
    questionEn: 'Shuttle bus fare and routes?',
    answer: '观光车单程30元/人，通票50元/人（当日不限次数），覆盖景区主要景点；建议购买通票，省力省时，尤其适合带老人小孩的游客。',
    answerEn: 'One-way: 30 RMB/person. All-day pass: 50 RMB/person. Covers all major attractions. Recommended for seniors and families.'
  }
]

/* ============================== 周边美食通用题库 ============================== */
export const foodQA: QAItem[] = [
  {
    id: 0,
    question: '这家店人均消费多少？',
    questionEn: 'What is the average price per person?',
    answer: '人均消费约60-120元，具体根据点菜数量有所不同；招牌菜价格适中，丰俭由人。',
    answerEn: 'Average 60-120 RMB/person, depending on dishes ordered. Signature dishes are reasonably priced.'
  },
  {
    id: 1,
    question: '需不需要提前电话预约？',
    questionEn: 'Do I need to make reservations?',
    answer: '周末及节假日建议提前1-2小时电话预约，平日通常无需预约；大桌聚餐（6人以上）建议提前预订。',
    answerEn: 'Reservations recommended 1-2 hours in advance on weekends/holidays. No reservation needed on weekdays. Groups of 6+: book in advance.'
  },
  {
    id: 2,
    question: '特色招牌菜是什么？',
    questionEn: 'What are the signature dishes?',
    answer: '店内招牌菜为灵山特色素斋和太湖三白（白鱼、白虾、银鱼），均选用本地新鲜食材，口味鲜美独特。',
    answerEn: 'Signature dishes: Lingshan vegetarian cuisine and Taihu "Three Whites" (whitefish, white shrimp, silver fish), all using fresh local ingredients.'
  },
  {
    id: 3,
    question: '营业时间到几点关门？',
    questionEn: 'What are the opening hours?',
    answer: '营业时间为 10:00-21:00，午餐高峰 11:30-13:00，晚餐高峰 17:30-19:00，建议错峰用餐。',
    answerEn: 'Open 10:00-21:00. Lunch rush: 11:30-13:00. Dinner rush: 17:30-19:00. Avoid peak hours for better service.'
  },
  {
    id: 4,
    question: '有没有免费停车位？',
    questionEn: 'Free parking available?',
    answer: '店门前有免费停车位约10个，先到先得；对面公共停车场也可停放，前2小时免费。',
    answerEn: 'About 10 free parking spots in front, first-come first-served. Public parking opposite: free for first 2 hours.'
  },
  {
    id: 5,
    question: '适合多人聚餐吗？',
    questionEn: 'Good for group dining?',
    answer: '店内设有大桌和包间，最多可容纳15人同时就餐；聚餐建议提前预订包间，环境舒适私密。',
    answerEn: 'Large tables and private rooms available, accommodating up to 15 people. Book private rooms in advance for group dinners.'
  },
  {
    id: 6,
    question: '菜品口味偏淡还是偏浓？',
    questionEn: 'Are dishes light or strong in flavor?',
    answer: '菜品以苏帮菜为主，口味偏清淡鲜甜，注重食材本味；可根据需求向店家说明调整口味浓淡。',
    answerEn: 'Dishes are mainly Su cuisine, light and sweet, emphasizing natural flavors. Request adjustments for stronger flavors.'
  },
  {
    id: 7,
    question: '有没有儿童清淡菜品？',
    questionEn: 'Kid-friendly dishes available?',
    answer: '店内有儿童套餐和清淡蒸蛋、小馄饨等适合儿童的菜品，少油少盐，营养均衡。',
    answerEn: 'Kids menu available with steamed eggs and small wontons, low in oil and salt, balanced nutrition.'
  },
  {
    id: 8,
    question: '距离灵山景区多远？',
    questionEn: 'Distance to Lingshan Scenic Area?',
    answer: '距灵山胜境景区入口约1-3公里，车程5-10分钟；步行约15-20分钟，沿路风景优美。',
    answerEn: '1-3 km from Lingshan entrance, 5-10 minutes by car, 15-20 minutes on foot. Beautiful scenery along the way.'
  },
  {
    id: 9,
    question: '可以打包外带吗？',
    questionEn: 'Takeout available?',
    answer: '支持打包外带，提供环保餐盒；部分热菜建议堂食口感更佳，外带可能影响风味。',
    answerEn: 'Takeout available with eco-friendly containers. Some hot dishes are better enjoyed on-site as takeout may affect taste.'
  }
]

/* ============================== 住宿民宿通用题库 ============================== */
export const hotelQA: QAItem[] = [
  {
    id: 0,
    question: '民宿一晚价格多少，有无淡旺季差价？',
    questionEn: 'What is the room rate? Any seasonal price differences?',
    answer: '标准间平日价格200-350元/晚，周末上浮约30%；五一、国庆等旺季价格翻倍，建议提前预订锁定价格。',
    answerEn: 'Standard room: 200-350 RMB/night on weekdays, 30% higher on weekends. Peak seasons (May Day, National Day) double price. Book in advance for best rates.'
  },
  {
    id: 1,
    question: '民宿距离灵山景区车程多久？',
    questionEn: 'Distance from Lingshan Scenic Area?',
    answer: '距灵山胜境景区约5-15分钟车程，步行约20-30分钟；部分民宿提供免费接送服务，预订时可咨询。',
    answerEn: '5-15 minutes by car from Lingshan, 20-30 minutes on foot. Some accommodations offer free shuttle service, inquire when booking.'
  },
  {
    id: 2,
    question: '房间包含早餐吗？',
    questionEn: 'Does the room include breakfast?',
    answer: '部分房型含双早，具体以预订页面为准；不含早的房型可加购早餐，人均30-50元，提供中式和西式两种选择。',
    answerEn: 'Some rooms include breakfast for two, check booking details. Add-on breakfast: 30-50 RMB/person, Chinese or Western options.'
  },
  {
    id: 3,
    question: '入住、退房时间规定？',
    questionEn: 'Check-in and check-out times?',
    answer: '入住时间为14:00后，退房时间为12:00前；如需延迟退房请联系前台，视房态可能免费延至14:00。',
    answerEn: 'Check-in: after 14:00. Check-out: before 12:00. Late check-out may be extended to 14:00 free of charge depending on availability.'
  },
  {
    id: 4,
    question: '可以携带宠物入住吗？',
    questionEn: 'Pets allowed?',
    answer: '部分房型允许携带小型宠物（10kg以下），需提前告知并缴纳清洁费50元；大型宠物建议咨询宠物友好型民宿。',
    answerEn: 'Small pets under 10kg allowed in some rooms with prior notice and 50 RMB cleaning fee. Large pets: inquire about pet-friendly accommodations.'
  },
  {
    id: 5,
    question: '民宿有没有停车场？',
    questionEn: 'Parking available?',
    answer: '民宿提供免费停车位，先到先得；车位不足时可在周边公共停车场停放，步行约3分钟。',
    answerEn: 'Free parking available on a first-come first-served basis. Public parking nearby if full, 3-minute walk.'
  },
  {
    id: 6,
    question: '房间有无独立卫浴？',
    questionEn: 'Private bathroom in the room?',
    answer: '所有房型均配备独立卫浴，24小时热水供应；部分高级房型配备浴缸，可在预订时选择。',
    answerEn: 'All rooms have private bathrooms with 24-hour hot water. Some premium rooms have bathtubs, select when booking.'
  },
  {
    id: 7,
    question: '有没有双人/家庭套房？',
    questionEn: 'Double rooms or family suites available?',
    answer: '提供大床房、双床房及家庭套房（1大床+1小床），家庭套房适合3-4人入住，面积宽敞舒适。',
    answerEn: 'King rooms, twin rooms, and family suites (1 king + 1 single bed) available. Family suites accommodate 3-4 people comfortably.'
  },
  {
    id: 8,
    question: '民宿周边吃饭方便吗？',
    questionEn: 'Dining options nearby?',
    answer: '民宿周边500米内有多家餐馆和便利店，步行5分钟可达；前台可推荐附近特色美食，部分民宿提供管家服务。',
    answerEn: 'Multiple restaurants and convenience stores within 500m, 5-minute walk. Front desk can recommend local specialties. Some offer concierge service.'
  },
  {
    id: 9,
    question: '能否开具住宿发票？',
    questionEn: 'Can I get a receipt?',
    answer: '可开具增值税普通发票或专用发票，退房时告知前台即可；如需专票请提前提供企业开票信息。',
    answerEn: 'VAT invoices available, inform front desk at check-out. Special VAT invoices require company information provided in advance.'
  }
]

/* ============================== 猜你想问轮换组合式函数 ============================== */

// ---- 详情页用：固定3条，保留第1条常驻 ----
const DETAIL_DISPLAY = 3
const DETAIL_INTERVAL = 60000
const DETAIL_FADE = 200

export function useQaRotation(qaList: QAItem[]) {
  const displayed = ref<QAItem[]>([])
  const expandedId = ref<number>(-1)
  const fading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null
  let cursor = DETAIL_DISPLAY

  const initDisplay = () => {
    displayed.value = qaList.slice(0, DETAIL_DISPLAY)
    expandedId.value = -1
  }

  const rotate = () => {
    fading.value = true
    setTimeout(() => {
      const keep = displayed.value[0]
      const pool = qaList.filter(q => q.id !== keep.id)
      const idx1 = cursor % pool.length
      const idx2 = (cursor + 1) % pool.length
      cursor += 2
      displayed.value = [keep, pool[idx1], pool[idx2]]
      expandedId.value = -1
      fading.value = false
    }, DETAIL_FADE)
  }

  const toggleExpand = (id: number) => {
    expandedId.value = expandedId.value === id ? -1 : id
  }

  onMounted(() => {
    initDisplay()
    timer = setInterval(rotate, DETAIL_INTERVAL)
  })

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  })

  return {
    displayed,
    expandedId,
    fading,
    toggleExpand
  }
}

// ---- 首页 chat 用：固定6条，保留前2条高权重，随机替换4条 ----
export const chatQA: QAItem[] = [
  { id: 0,  question: '灵山景区门票多少钱，老人学生有优惠吗？', questionEn: 'How much is the ticket? Any discounts for seniors and students?', answer: '成人票210元/人，儿童1.2米以下免票，1.2-1.5米半价；65岁以上老人凭身份证半价；学生凭学生证享8折优惠；团体10人以上可享团体票。', answerEn: 'Adult ticket: 210 RMB/person. Children under 1.2m free, 1.2-1.5m half price. Seniors 65+ with ID: half price. Students with ID: 20% off. Groups of 10+: group discount.' },
  { id: 1,  question: '灵山大佛开放和闭园时间是几点？', questionEn: 'What are the opening hours of Lingshan Grand Buddha?', answer: '灵山胜境景区开放时间为 07:30-17:30（夏季可能延长至18:00），建议上午前往光线最佳，闭园前1小时停止入园。', answerEn: 'Lingshan Scenic Area is open 07:30-17:30 (extended to 18:00 in summer). Last entry 1 hour before closing. Morning light is best for visiting.' },
  { id: 2,  question: '灵山停车场收费标准，有没有免费车位？', questionEn: 'Parking fee and availability at Lingshan?', answer: '小型车辆10元/次（当日有效），大型车辆20元/次；停车场位于景区入口两侧，节假日车位紧张建议早到；景区周边部分酒店住客可享免费停车。', answerEn: 'Car: 10 RMB/time (valid all day). Bus: 20 RMB/time. Parking lots are located at both sides of the entrance. Arrive early during holidays. Some nearby hotels offer free parking for guests.' },
  { id: 3,  question: '完整游览灵山景区大概需要多久？', questionEn: 'How long does it take to explore Lingshan fully?', answer: '全程步行游览约需4-5小时，乘坐观光车约3小时；建议预留半天时间，重点游览灵山大佛、九龙灌浴、灵山梵宫等核心景点。', answerEn: 'Walking tour: 4-5 hours. With shuttle bus: 3 hours. Suggest reserving half a day. Key spots: Grand Buddha, Nine Dragons Bathing, Lingshan Buddhist Palace.' },
  { id: 4,  question: '灵山周边好吃的农家菜饭店推荐？', questionEn: 'Recommended local restaurants near Lingshan?', answer: '灵山周边推荐：灵山小镇拈花湾内的素斋餐厅、马山农家乐聚集区的太湖三白馆、以及景区出口处的灵山食府，人均60-120元不等。', answerEn: 'Recommended: Vegetarian restaurants in Nianhuawan Town, Taihu Lake seafood restaurants in Mashan area, and Lingshan Restaurant near the exit. Average 60-120 RMB/person.' },
  { id: 5,  question: '灵山附近平价高性价比民宿有哪些？', questionEn: 'Budget-friendly accommodations near Lingshan?', answer: '灵山附近平价民宿推荐：灵山小镇民宿（150-300元/晚）、太湖边精品客栈（200-400元/晚）、马山村民宿（100-200元/晚），建议提前平台预订。', answerEn: 'Budget options: Lingshan Town Guesthouses (150-300 RMB/night), Taihu Lake Boutique Inns (200-400 RMB/night), Mashan Village Homestays (100-200 RMB/night). Book in advance online.' },
  { id: 6,  question: '带老人小孩游玩灵山省力路线怎么规划？', questionEn: 'Easy route for seniors and children?', answer: '推荐乘坐观光车游览：入口 → 阿育王柱 → 灵山大佛（抱佛脚） → 九龙灌浴（整点表演） → 灵山梵宫 → 五印坛城，全程约3小时，步行较少。', answerEn: 'Take the shuttle bus: Entrance → Ashoka Pillar → Grand Buddha → Nine Dragons Bathing (on the hour) → Lingshan Palace → Five Seal Mandala. About 3 hours with minimal walking.' },
  { id: 7,  question: '景区观光车怎么收费，有哪些停靠站点？', questionEn: 'Shuttle bus fare and stops?', answer: '观光车单程30元/人，通票50元/人（当日不限次数）；停靠站点：入口广场、阿育王柱、灵山大佛、九龙灌浴、灵山梵宫、五印坛城，覆盖全部核心景点。', answerEn: 'One-way: 30 RMB/person. All-day pass: 50 RMB/person. Stops: Entrance Plaza, Ashoka Pillar, Grand Buddha, Nine Dragons Bathing, Lingshan Palace, Five Seal Mandala.' },
  { id: 8,  question: '节假日灵山人流量大吗，需要错峰入园吗？', questionEn: 'Crowds during holidays? Best time to visit?', answer: '春节、五一、国庆等重大节假日人流量较大，建议错峰出行或上午9点前入园；平日游览体验更佳，拍照打卡无需排队。', answerEn: 'Very crowded during Spring Festival, May Day, and National Day. Arrive before 9 AM or visit on weekdays for better experience and no queues.' },
  { id: 9,  question: '景区内素食餐厅人均价位怎么样？', questionEn: 'Vegetarian restaurant prices inside the park?', answer: '灵山梵宫内有无自助素斋餐厅（人均80元），祥符禅寺附近有素面馆（人均30元），推荐使用灵山APP提前查看菜单并预订。', answerEn: 'Buffet vegetarian in Lingshan Palace: 80 RMB/person. Vegetarian noodles near Xiangfu Temple: 30 RMB/person. Check Lingshan APP for menus and reservations.' },
  { id: 10, question: '灵山大佛祈福有什么礼仪和讲究？', questionEn: 'Prayer etiquette at Lingshan Grand Buddha?', answer: '灵山祈福建议顺时针绕佛三圈，双手合十虔诚礼拜；可在祥符禅寺请香祈福，在祈福普缘挂祈福牌；抱佛脚寓意好运，佛手前祈求平安吉祥。', answerEn: 'Walk clockwise around the Buddha three times, bow with hands clasped. Incense available at Xiangfu Temple. Hanging prayer plaques and touching the Buddha\'s feet bring good luck.' },
  { id: 11, question: '无锡市区到灵山怎么坐公交/地铁？', questionEn: 'Public transport from Wuxi city center?', answer: '从无锡市区可乘坐地铁2号线至梅园站，换乘89路公交直达灵山胜境；或乘坐乐游2号线（旅游专线）直达景区，全程约1小时。', answerEn: 'Take Metro Line 2 to Meiyuan Station, transfer to Bus 89 direct to Lingshan. Or take Tourist Line 2 direct to the scenic area. About 1 hour total.' },
  { id: 12, question: '进景区可以自带零食和饮用水吗？', questionEn: 'Can I bring snacks and water into the park?', answer: '可以自带零食和饮用水入园，景区内设有多个休息区和直饮水点；但请注意不要在殿堂内饮食，保持安静肃穆。', answerEn: 'Yes, you can bring snacks and water. There are rest areas and water refill stations inside. Please do not eat/drink in halls; maintain quiet and respect.' },
  { id: 13, question: '适合多人聚餐的灵山周边饭店有哪些？', questionEn: 'Group dining restaurants near Lingshan?', answer: '推荐灵山梵宫素斋大厅（可容纳100人同时就餐）、灵山食府包间（适合10-20人聚餐）、以及拈花湾小镇内的太湖渔家（主打太湖三白，适合家庭聚餐）。', answerEn: 'Recommend: Lingshan Palace Vegetarian Hall (up to 100 people), Lingshan Restaurant private rooms (10-20 people), Taihu Fisherman in Nianhuawan (family dining, famous for Taihu seafood).' },
  { id: 14, question: '附近民宿能不能携带宠物入住？', questionEn: 'Pet-friendly accommodations nearby?', answer: '部分民宿允许携带小型宠物（10kg以下），需提前告知并缴纳清洁费50元；推荐预订时筛选"宠物友好"标签的民宿。', answerEn: 'Some guesthouses allow small pets (under 10kg) with prior notice and 50 RMB cleaning fee. Filter for "pet-friendly" when booking.' },
  { id: 15, question: '灵山哪个时间段拍照光线最好看？', questionEn: 'Best time for photography at Lingshan?', answer: '上午8:00-10:00和下午15:30-17:00光线最柔和，适合拍照；灵山大佛正面朝南，上午拍摄逆光较少；九龙灌浴喷泉表演时（整点）拍摄效果最佳。', answerEn: 'Best light: 8:00-10:00 AM and 15:30-17:00 PM. The Buddha faces south, so morning avoids backlighting. Best photos during Nine Dragons Bathing fountain shows (on the hour).' },
  { id: 16, question: '景区有行李寄存处吗，收费多少钱？', questionEn: 'Luggage storage available? How much?', answer: '景区入口处设有行李寄存处，小件行李免费寄存，大件行李收费10元/件（当日有效），开放时间与景区一致。', answerEn: 'Luggage storage at the entrance. Small bags free, large items 10 RMB/piece (valid all day). Hours match park hours.' },
  { id: 17, question: '周边饭店需要提前打电话预约吗？', questionEn: 'Do restaurants require reservations?', answer: '周末及节假日建议提前1-2小时电话预约，平日通常无需预约；大桌聚餐（6人以上）建议提前预订，部分热门餐厅需提前1天预约。', answerEn: 'Reservations recommended 1-2 hours in advance on weekends/holidays. No reservation needed on weekdays. Groups of 6+: book in advance, popular restaurants may need 1 day ahead.' },
  { id: 18, question: '民宿标准入住、退房时间是几点？', questionEn: 'Check-in and check-out times?', answer: '入住时间为14:00后，退房时间为12:00前；如需延迟退房请联系前台，视房态可能免费延至14:00，部分民宿收取半天房费。', answerEn: 'Check-in: after 14:00. Check-out: before 12:00. Late check-out may be extended to 14:00 free of charge depending on availability, some charge half-day fee.' },
  { id: 19, question: '灵山大佛高度多少，建造历史介绍？', questionEn: 'Height and history of Lingshan Grand Buddha?', answer: '灵山大佛高88米（含莲花座），由1560块青铜壁板拼装而成，1997年落成，是中国五方五佛之东方大佛，右手"施无畏印"代表除却痛苦，左手"与愿印"代表给予快乐。', answerEn: 'The Buddha stands 88 meters tall (including lotus pedestal), made of 1560 bronze panels. Completed in 1997, it is one of China\'s Five Great Buddhas (Eastern Buddha). Right hand: "Fearless Mudra" (removes suffering). Left hand: "Wish-granting Mudra" (gives happiness).' },
  { id: 20, question: '下雨天去灵山游玩体验好不好？', questionEn: 'Is Lingshan good to visit in the rain?', answer: '下雨天景区人少，氛围更清幽，但部分户外项目体验受限；建议携带雨具，灵山梵宫等室内景点不受天气影响，雨中游览别有一番意境。', answerEn: 'Less crowded and peaceful in the rain, though some outdoor activities may be limited. Bring rain gear. Indoor attractions like Lingshan Palace are unaffected. Rainy days offer unique scenery.' },
  { id: 21, question: '景区人工讲解、电子讲解怎么收费？', questionEn: 'Guided tour and audio guide fees?', answer: '人工讲解服务200元/批次（1-10人），电子讲解器租赁20元/台（押金200元），灵山APP提供免费语音讲解，推荐提前下载离线包。', answerEn: 'Guided tour: 200 RMB/group (1-10 people). Audio guide rental: 20 RMB/device (200 RMB deposit). Free audio guide on Lingshan APP, download offline content in advance.' },
  { id: 22, question: '灵山周边饭店招牌特色菜品是什么？', questionEn: 'Signature dishes at nearby restaurants?', answer: '周边饭店招牌菜：灵山素斋（香菇面筋、素蟹黄）、太湖三白（白鱼、白虾、银鱼）、无锡小笼包、酱排骨，均为当地特色美食。', answerEn: 'Signature dishes: Lingshan vegetarian (mushroom gluten, vegetarian crab roe), Taihu Three Whites (whitefish, white shrimp, silver fish), Wuxi steamed buns, braised pork ribs.' },
  { id: 23, question: '预订民宿是否包含免费早餐？', questionEn: 'Does accommodation include breakfast?', answer: '部分房型含双早，具体以预订页面为准；不含早的房型可加购早餐，人均30-50元，提供中式和西式两种选择，儿童早餐享半价优惠。', answerEn: 'Some rooms include breakfast for two, check booking details. Add-on breakfast: 30-50 RMB/person, Chinese or Western options. Children get half price.' },
  { id: 24, question: '灵山避人流游玩路线攻略？', questionEn: 'Less crowded route at Lingshan?', answer: '避人流路线：从入口左侧步道直达灵山梵宫（开园时人少） → 五印坛城 → 曼飞龙塔 → 午餐后前往九龙灌浴（避开整点表演高峰） → 最后参观灵山大佛，全程人少体验佳。', answerEn: 'Avoid crowds: enter via left path to Lingshan Palace (less crowded at opening) → Five Seal Mandala → Manfeilong Pagoda → After lunch, visit Nine Dragons Bathing (avoid on-the-hour shows) → Finally the Grand Buddha. Enjoy with fewer people.' },
  { id: 25, question: '景区周边餐饮人均消费大概多少？', questionEn: 'Average food cost around Lingshan?', answer: '灵山周边餐饮人均消费约60-120元，素斋餐厅人均80-100元，农家乐约50-80元/人，太湖三白等特色菜价格稍高，建议根据预算选择。', answerEn: 'Average 60-120 RMB/person. Vegetarian restaurants: 80-100 RMB. Farm stays: 50-80 RMB. Taihu seafood dishes cost more. Choose according to your budget.' },
  { id: 26, question: '哪家民宿可以开具正规住宿发票？', questionEn: 'Which accommodations provide official receipts?', answer: '灵山小镇内正规民宿均可开具增值税普通发票，部分支持专用发票；预订时请在订单备注中注明开票需求，退房时向前台提供开票信息即可。', answerEn: 'All registered guesthouses in Lingshan Town provide VAT invoices, some support special VAT invoices. Note your invoicing needs when booking, provide details at check-out.' },
  { id: 27, question: '景区内有无香火售卖，价格贵不贵？', questionEn: 'Incense available for purchase? Prices?', answer: '祥符禅寺内设香火流通处，普通线香10-20元/把，祈福香50-100元不等；景区提倡文明敬香，建议随缘请购，不在校外购买高价香。', answerEn: 'Incense available at Xiangfu Temple. Regular incense: 10-20 RMB/bundle. Prayer incense: 50-100 RMB. Practice respectful incense burning. Avoid buying expensive incense outside the temple.' },
  { id: 28, question: '距离灵山10分钟车程内住宿推荐？', questionEn: 'Recommendations within 10 minutes drive?', answer: '灵山小镇拈花湾内有多家精品客栈（步行5分钟入园），马山镇上平价民宿（车程8分钟），太湖边度假酒店（车程10分钟，部分房型可观湖景）。', answerEn: 'Nianhuawan Town boutique inns (5 min walk to entrance), Mashan budget homestays (8 min drive), Taihu Lake resorts (10 min drive, some with lake views).' },
  { id: 29, question: '景区内有无遮阳休息的座椅区域？', questionEn: 'Shaded rest areas with seating?', answer: '景区内设有多个遮阳休息区和木质座椅，主要分布在灵山梵宫广场、九龙灌浴观景台、五印坛城庭院；夏季建议携带遮阳帽和防晒用品。', answerEn: 'Multiple shaded rest areas with wooden benches throughout the park: Lingshan Palace Plaza, Nine Dragons Bathing viewing platform, Five Seal Mandala courtyard. Bring sun hat and sunscreen in summer.' },
]

const CHAT_DISPLAY = 6
const CHAT_INTERVAL = 60000
const CHAT_FADE = 200

/**
 * 首页猜你想问轮换逻辑
 * - 固定展示 6 条
 * - 每 60 秒自动轮换：保留前 2 条最高权重，随机替换剩余 4 条
 * - 搭配 0.2s 淡入淡出过渡
 * - 点击问题直接填充输入框并自动发送
 * - 语言切换时立即刷新为当前语言版本（无需等待下一次轮换）
 */
export function useChatQaRotation() {
  const displayed = ref<string[]>([])
  const fading = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const getQuestion = (q: QAItem): string => {
    return currentLang.value === 'zh' ? q.question : q.questionEn
  }

  const getRandomItems = (pool: QAItem[], count: number): QAItem[] => {
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, count)
  }

  const initDisplay = () => {
    const pool = chatQA.slice(2)
    const random4 = getRandomItems(pool, 4)
    displayed.value = [getQuestion(chatQA[0]), getQuestion(chatQA[1]), ...random4.map(getQuestion)]
  }

  const rotate = () => {
    fading.value = true
    setTimeout(() => {
      const pool = chatQA.slice(2)
      const random4 = getRandomItems(pool, 4)
      displayed.value = [getQuestion(chatQA[0]), getQuestion(chatQA[1]), ...random4.map(getQuestion)]
      fading.value = false
    }, CHAT_FADE)
  }

  /**
   * 语言切换时立即刷新推荐词：用短淡出过渡刷新为当前语言版本。
   * 不重置定时器——下一次轮换仍按原节奏进行。
   */
  const refreshOnLangChange = () => {
    fading.value = true
    setTimeout(() => {
      initDisplay()
      fading.value = false
    }, CHAT_FADE)
  }

  onMounted(() => {
    initDisplay()
    timer = setInterval(rotate, CHAT_INTERVAL)
  })

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  })

  // 语言切换时立即刷新推荐词语言版本
  watch(currentLang, () => {
    refreshOnLangChange()
  })

  return {
    displayed,
    fading,
  }
}
