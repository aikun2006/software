/**
 * 灵山胜境景点数据 —— 来源：地图搜索页全部标注点，仅保留「景点」
 * （排除餐饮、住宿、商业区、出入口、综合服务、主干道等非景点设施）。
 * 图片暂用占位图（寺庙主题渐变 + 景点名称），后续替换为实拍图。
 */

export interface ScenicSpot {
  id: string
  name: string
  nameEn?: string
  tag: string
  tagEn?: string
  tagClass: string
  desc: string
  descEn?: string
  fullDesc?: string
  fullDescEn?: string
  locationInfo: string
  locationInfoEn?: string
  tips: string
  tipsEn?: string
  distance?: string
  distanceEn?: string
  time?: string
  timeEn?: string
  images?: string[]
}

export const spots: ScenicSpot[] = [
  {
    id: 'buddha',
    name: '灵山大佛',
    nameEn: 'Grand Buddha at Ling Shan',
    tag: '核心景点',
    tagEn: 'Core Spot',
    tagClass: 'tag-core',
    desc: '88米高露天青铜释迦牟尼立像，灵山胜境标志性景观',
    descEn: '88m tall bronze Sakyamuni statue, iconic landmark of Lingshan',
    fullDesc: '灵山大佛是灵山胜境的核心景观，高88米，由1560块青铜壁板拼装而成。大佛慈颜微笑，广视众生。右手"施无畏印"代表除却痛苦，左手"与愿印"代表给予快乐。1997年落成，是中国五方五佛之东方大佛。',
    fullDescEn: 'The Grand Buddha at Ling Shan is the centerpiece of Lingshan Scenic Area, standing 88 meters tall and composed of 1560 bronze panels. Completed in 1997, it is one of the Five Directional Buddhas of China.',
    locationInfo: '景区北部中心位置，从检票口步行约15分钟可达',
    locationInfoEn: 'Central north area, 15-min walk from entrance',
    tips: '建议上午参观，人少且光线最佳；可抱佛脚祈福，寓意好运连连',
    tipsEn: 'Visit in the morning for best lighting; touching the Buddha\'s feet brings good luck',
    distance: '距入口约1.2km',
    distanceEn: '~1.2 km from entrance',
    time: '推荐游览30分钟',
    timeEn: 'Recommended: 30 mins',
    images: ['/static/spots/buddha-1.jpg', '/static/spots/buddha-2.jpg', '/static/spots/buddha-3.jpg']
  },
  {
    id: 'palm',
    name: '灵山佛手',
    nameEn: 'Buddha\'s Hand',
    tag: '核心景点',
    tagEn: 'Core Spot',
    tagClass: 'tag-core',
    desc: '与灵山大佛同比例复制的巨型佛手，高11.7米',
    descEn: '11.7m tall replica of the Buddha\'s right hand',
    fullDesc: '灵山佛手为灵山大佛右手的复制件，高11.7米，宽5.5米，手指直径1米。佛手的形状为"施无畏印"，寓意为众生除去痛苦。游客可以抱一抱佛手，祈求平安吉祥。',
    fullDescEn: 'A 11.7m tall replica of the Grand Buddha\'s right hand in the "Fearless Mudra" pose, symbolizing the removal of suffering.',
    locationInfo: '位于灵山大佛下方左侧区域',
    locationInfoEn: 'Below the Grand Buddha, left side',
    tips: '可与佛手合影留念，抱一抱佛手寓意平安吉祥；热门拍照打卡点',
    tipsEn: 'Popular photo spot; hugging the hand brings peace and good fortune',
    images: ['/static/spots/palm-1.jpg', '/static/spots/palm-2.jpg', '/static/spots/palm-3.jpg']
  },
  {
    id: 'ayuwang',
    name: '阿育王柱',
    nameEn: 'Ashoka Pillar',
    tag: '文化古迹',
    tagEn: 'Cultural Relic',
    tagClass: 'tag-culture',
    desc: '仿古印度阿育王石柱，承载千年佛教文化记忆',
    descEn: 'Replica of ancient Indian Ashoka Pillar with Buddhist scriptures',
    fullDesc: '阿育王柱源于古印度孔雀王朝阿育王所立的石柱，柱身刻有佛教经文。灵山的阿育王柱仿照印度原柱建造，象征着佛法东传的悠久历史。',
    fullDescEn: 'Modeled after pillars erected by Ashoka the Great in ancient India, symbolizing the eastward spread of Buddhism.',
    locationInfo: '灵山大佛右侧区域，近杏坛广场北侧',
    locationInfoEn: 'Right side of Grand Buddha, near Xingtan Square',
    tips: '柱身刻有佛教经文，可驻足细看感受佛法东传的历史厚重感',
    tipsEn: 'Read the Buddhist scriptures inscribed on the pillar',
    images: ['/static/spots/ayuwang-1.jpg', '/static/spots/ayuwang-2.jpg', '/static/spots/ayuwang-3.jpg']
  },
  {
    id: 'wujinyi',
    name: '无尽意斋',
    nameEn: 'Endless Meaning Hall',
    tag: '文化展馆',
    tagEn: 'Exhibition Hall',
    tagClass: 'tag-culture',
    desc: '佛教文化艺术展览馆，展示佛教书画艺术珍品',
    descEn: 'Buddhist art exhibition hall with calligraphy and paintings',
    fullDesc: '无尽意斋取自《妙法莲华经》观世音菩萨名号"无尽意"，是一处展示佛教文化艺术精品的场所。馆内陈列有历代高僧墨宝、佛教造像等珍贵文物。',
    fullDescEn: 'Named after the Bodhisattva Avalokiteshvara, displaying precious Buddhist artifacts and calligraphy.',
    locationInfo: '景区西北角，距大佛60米平替处（观光车停靠点附近）',
    locationInfoEn: 'Northwest corner, near sightseeing bus stop',
    tips: '喜欢佛教文化的游客不容错过',
    tipsEn: 'Must-see for Buddhist art enthusiasts',
    images: ['/static/spots/wujinyi-1.jpg']
  },
  {
    id: 'xiangfu',
    name: '祥符禅寺',
    nameEn: 'Xiangfu Temple',
    tag: '古寺',
    tagEn: 'Ancient Temple',
    tagClass: 'tag-culture',
    desc: '千年古刹，始建于唐贞观年间，香烟缭绕梵音阵阵',
    descEn: 'Ancient temple founded in Tang Dynasty, over 1300 years old',
    fullDesc: '祥符禅寺原名"法华院"，始建于唐贞观年间，距今已有一千三百余年历史，历经兴废重建。现寺内有大雄宝殿、藏经楼等建筑，是灵山胜境中历史最悠久的佛教寺院。',
    fullDescEn: 'Originally built in the Tang Dynasty (627-649), this 1300-year-old temple is the oldest Buddhist site in Lingshan.',
    locationInfo: '杏坛广场东侧',
    locationInfoEn: 'East of Xingtan Square',
    tips: '可入内参拜，感受千年古刹氛围；注意保持安静肃穆',
    tipsEn: 'Enter and worship respectfully; maintain silence',
    distance: '距入口约800m',
    distanceEn: '~800 m from entrance',
    time: '推荐游览20分钟',
    timeEn: 'Recommended: 20 mins',
    images: ['/static/spots/xiangfu-1.jpg', '/static/spots/xiangfu-2.jpg', '/static/spots/xiangfu-3.jpg']
  },
  {
    id: 'fangsheng',
    name: '放生礼佛',
    nameEn: 'Release Ceremony',
    tag: '核心景点',
    tagEn: 'Core Spot',
    tagClass: 'tag-core',
    desc: '莲花水池景观区，以莲花池为中心的佛教放生文化体验区',
    descEn: 'Lotus pond area for Buddhist animal release ceremony',
    fullDesc: '放生礼佛以大型莲花水池为核心，池中有精美的佛教雕塑装饰。这里是体现佛教"慈悲护生"理念的特色区域，环境清幽雅致，是静心祈福的好去处。',
    fullDescEn: 'A peaceful lotus pond area dedicated to Buddhist compassion and animal release ceremonies.',
    locationInfo: '祥符禅寺与九龙灌浴之间',
    locationInfoEn: 'Between Xiangfu Temple and Nine Dragon Bath',
    tips: '环境优美，适合安静漫步；请勿向池内投掷杂物',
    tipsEn: 'Beautiful peaceful area; do not litter in the pond',
    images: ['/static/spots/fangsheng-1.jpg', '/static/spots/fangsheng-2.jpg', '/static/spots/fangsheng-3.jpg']
  },
  {
    id: 'jiulong',
    name: '九龙灌浴',
    nameEn: 'Nine Dragon Bath',
    tag: '核心景点',
    tagEn: 'Core Spot',
    tagClass: 'tag-core',
    desc: '国内最大规模动态音乐喷泉铜雕，每整点表演太子佛诞生场景',
    descEn: 'Largest music fountain in China with bronze sculptures',
    fullDesc: '九龙灌浴是国内最大规模的音乐喷泉动态铜雕。高达7.2米的通体含苞待放的莲花铜像矗立于水池中央，四大天王托举莲花座，四周八龙四凤共舞。每整点表演时，莲花缓缓绽放，太子佛像从中冉冉升起，九龙同时喷水为太子沐浴，场面极为壮观震撼。',
    fullDescEn: 'The largest musical fountain in China. A 7.2m lotus sculpture opens to reveal a baby Buddha statue, with nine dragons spraying water during performances.',
    locationInfo: '位于景区中轴线，杏坛广场北侧',
    locationInfoEn: 'Central axis, north of Xingtan Square',
    tips: '⭐ 整点开放表演（10:00-16:00），每场约8分钟！建议提前5分钟占位观看最佳位置',
    tipsEn: '⭐ Hourly shows (10:00-16:00), 8 mins each! Arrive 5 mins early for best view',
    distance: '距入口约1.0km',
    distanceEn: '~1.0 km from entrance',
    time: '推荐游览20分钟',
    timeEn: 'Recommended: 20 mins',
    images: ['/static/spots/jiulong-1.jpg', '/static/spots/jiulong-2.jpg', '/static/spots/jiulong-3.jpg']
  },
  {
    id: 'baizi',
    name: '百子戏弥勒',
    nameEn: 'Children Playing with Maitreya',
    tag: '雕塑艺术',
    tagEn: 'Sculpture Art',
    tagClass: 'tag-core',
    desc: '大型群雕——百名孩童嬉戏于弥勒佛周围，充满童趣与祥和',
    descEn: 'Large bronze sculpture of 100 children playing around Maitreya',
    fullDesc: '百子戏弥勒是一座大型青铜群雕，弥勒佛袒胸露腹、笑口常开，周围一百个形态各异的孩童嬉戏玩耍，或攀爬、或拉扯、或骑在肩头，生动活泼，充满童趣。寓意"笑口常开，福气自来"。',
    fullDescEn: 'A large bronze sculpture featuring Maitreya Buddha surrounded by 100 playful children in various poses.',
    locationInfo: '祥符禅寺东侧，九龙灌浴东南方向',
    locationInfoEn: 'East of Xiangfu Temple, southeast of Nine Dragon Bath',
    tips: '充满童趣的雕塑，适合亲子互动拍照；每个小童神态各异值得细品',
    tipsEn: 'Great for family photos; each child has unique expressions',
    images: ['/static/spots/baizi-1.jpg', '/static/spots/baizi-2.jpg', '/static/spots/baizi-3.jpg']
  },
  {
    id: 'wuyin',
    name: '五印坛城',
    nameEn: 'Five Seal Mandala',
    tag: '核心景点',
    tagEn: 'Core Spot',
    tagClass: 'tag-core',
    desc: '藏式佛教艺术殿堂，展示五方佛五种手印的宏伟建筑',
    descEn: 'Tibetan Buddhist art hall showcasing five Buddha mudras',
    fullDesc: '五印坛城以藏族文化为主题，外观宏伟壮观，内部装饰华丽至极。展示了五方佛的五种手印：法界印、金刚印、宝印、羯磨印、莲花印。内部有精美的唐卡、壁画和造像，色彩斑斓，令人叹为观止。',
    fullDescEn: 'A magnificent Tibetan-style building showcasing five Buddha hand seals (mudras), with exquisite thangka paintings and murals inside.',
    locationInfo: '景区南部偏东位置，观光车上山路线终点站附近',
    locationInfoEn: 'Southeast area, near sightseeing bus terminal',
    tips: '内部装修极其精美，宛如进入藏传佛教的艺术殿堂；注意保持安静，禁止触摸壁画',
    tipsEn: 'Stunning interior like a Tibetan Buddhist art palace; no touching murals',
    distance: '距入口约1.5km',
    distanceEn: '~1.5 km from entrance',
    time: '推荐游览40分钟',
    timeEn: 'Recommended: 40 mins',
    images: ['/static/spots/wuyin-1.jpg', '/static/spots/wuyin-2.jpg', '/static/spots/wuyin-3.jpg']
  },
  {
    id: 'qifu',
    name: '祈福普缘',
    nameEn: 'Wishing Area',
    tag: '祈福体验',
    tagEn: 'Wishing Experience',
    tagClass: 'tag-experience',
    desc: '祈福许愿场所，挂福牌系丝带寄托美好愿望',
    descEn: 'Make wishes by hanging plaques and red ribbons',
    fullDesc: '祈福普缘是一处供游客许愿祈福的特色区域。在这里可以挂上写满愿望的祈福牌、系上红丝带，将美好的祝愿留在灵山圣地。红丝带随风飘扬，蔚为壮观。',
    fullDescEn: 'A special area for making wishes. Hang a plaque or tie a red ribbon to leave your wishes at Lingshan.',
    locationInfo: '五印坛城北侧，近曼飞龙塔',
    locationInfoEn: 'North of Five Seal Mandala, near Manfeilong Pagoda',
    tips: '可在此处挂祈福牌、系红丝带；祈福牌可在旁边的服务台购买',
    tipsEn: 'Buy wishing plaques at the service counter nearby',
    images: ['/static/spots/qifu-1.jpg']
  },
  {
    id: 'fangong',
    name: '灵山梵宫',
    nameEn: 'Lingshan Brahma Palace',
    tag: '核心景点',
    tagEn: 'Core Spot',
    tagClass: 'tag-core',
    desc: '世界佛教论坛永久会址，建筑与艺术的完美结合',
    descEn: 'Permanent venue of World Buddhist Forum',
    fullDesc: '灵山梵宫是世界佛教论坛的永久会址，建筑融合了中国佛教石窟艺术及传统建筑装饰精华，内部金碧辉煌令人叹为观止。廊厅内有巨幅琉璃浮雕《华藏世界》、精美的东阳木雕、敦煌壁画风格彩绘、扬州漆器等珍贵艺术品。每天还有《灵山吉祥颂》大型情景演出。',
    fullDescEn: 'The permanent venue of the World Buddhist Forum, featuring stunning architecture with glazed reliefs, Dongyang wood carvings, Dunhuang-style murals, and Yangzhou lacquerware.',
    locationInfo: '景区东部中心区域，观光车终点附近',
    locationInfoEn: 'Central east area, near sightseeing bus terminal',
    tips: '⭐ 必看景点！内部震撼程度不输任何顶级博物馆；留意《吉祥颂》演出时间安排；禁止闪光灯拍照',
    tipsEn: '⭐ Must-see! Like a top museum inside; check "Auspicious Ode" show times; no flash photography',
    distance: '距入口约1.6km',
    distanceEn: '~1.6 km from entrance',
    time: '推荐游览60分钟+',
    timeEn: 'Recommended: 60+ mins',
    images: ['/static/spots/fangong-1.jpg', '/static/spots/fangong-2.jpg', '/static/spots/fangong-3.jpg']
  },
  {
    id: 'manfeilong',
    name: '曼飞龙塔',
    nameEn: 'Manfeilong Pagoda',
    tag: '建筑奇观',
    tagEn: 'Architectural Wonder',
    tagClass: 'tag-culture',
    desc: '傣族风格的群塔建筑，典型的南传佛教佛塔造型',
    descEn: 'Dai-style pagoda, typical Theravada Buddhist architecture',
    fullDesc: '曼飞龙塔原型来自云南西双版纳，是一座典型的南传佛教（小乘佛教）群塔。主塔居中，八座小塔环绕，塔身洁白，造型优美，展现了傣族建筑的独特魅力。',
    fullDescEn: 'Modeled after the pagoda in Xishuangbanna, this is a classic Theravada Buddhist multi-tower structure with eight smaller towers surrounding the main one.',
    locationInfo: '灵山梵宫东南侧',
    locationInfoEn: 'Southeast of Brahma Palace',
    tips: '典型的南传佛教建筑风格，与梵宫形成汉藏傣三族佛教建筑对比',
    tipsEn: 'Compare with Brahma Palace for Han-Tibetan-Dai Buddhist architecture contrast',
    images: ['/static/spots/manfeilong-1.jpg', '/static/spots/manfeilong-2.jpg', '/static/spots/manfeilong-3.jpg']
  },
  {
    id: 'talong',
    name: '灵山多宝塔',
    nameEn: 'Multi-treasure Pagoda',
    tag: '古建',
    tagEn: 'Ancient Architecture',
    tagClass: 'tag-culture',
    desc: '仿木结构九层琉璃塔，巍峨耸立于景区西侧',
    descEn: 'Nine-story glazed pagoda in traditional Chinese style',
    fullDesc: '灵山多宝塔是一座仿木结构的九层楼阁式琉璃塔，塔身采用中国传统建筑工艺，飞檐翘角，层层收分，巍峨壮观。登塔可俯瞰整个灵山胜境全貌。',
    fullDescEn: 'A nine-story glazed pagoda built in traditional Chinese architectural style with upturned eaves.',
    locationInfo: '景区西部，观光车线路西端',
    locationInfoEn: 'West area, end of sightseeing bus route',
    tips: '如开放登塔，可俯瞰整个景区全景',
    tipsEn: 'Climb for panoramic view of the entire scenic area',
    images: ['/static/spots/talong-1.jpg', '/static/spots/talong-2.jpg', '/static/spots/talong-3.jpg']
  }
]

/**
 * 占位图生成 —— 寺庙主题渐变背景 + 景点名称。
 * 无实拍图的景点回退到此 SVG 占位图。
 */
export function spotImage(spot: ScenicSpot, subtitle?: string): string {
  if (spot.images && spot.images.length > 0) {
    return spot.images[0]
  }
  const sub = subtitle || spot.tag
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='#8B7355'/><stop offset='1' stop-color='#5C4A38'/>` +
    `</linearGradient></defs>` +
    `<rect width='600' height='400' fill='url(#g)'/>` +
    `<text x='300' y='200' font-size='42' fill='#fffdf5' text-anchor='middle' ` +
    `font-family='serif' letter-spacing='4'>${spot.name}</text>` +
    `<text x='300' y='248' font-size='20' fill='#e8d9bf' text-anchor='middle' ` +
    `font-family='serif'>${sub}</text>` +
    `<text x='300' y='340' font-size='64' fill='#e8d9bf' opacity='0.35' ` +
    `text-anchor='middle'>⛩</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

/** 详情页轮播图：有实拍图返回实拍图数组，否则回退占位图 */
export function spotGallery(spot: ScenicSpot): string[] {
  if (spot.images && spot.images.length > 0) {
    return spot.images
  }
  return [
    spotImage(spot, '主景'),
    spotImage(spot, '近景细节'),
    spotImage(spot, '周边环境')
  ]
}

export function getSpotById(id: string): ScenicSpot | undefined {
  return spots.find(s => s.id === id)
}
