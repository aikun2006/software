/**
 * 灵山周边美食数据
 * 基础数据（店名、图片、价格、距离）保留原 HTML 页面数据
 * 配套数据（评价、特色标签、简介、营业时间）参照景点格式自动补充
 */

export interface FoodReview {
  id: string
  nickname: string
  nicknameEn?: string
  rating: number
  content: string
  contentEn?: string
  createdAt: string
}

export interface FoodShop {
  id: string
  name: string
  nameEn?: string
  tag: string
  tagEn?: string
  tagClass: string
  desc: string
  descEn?: string
  fullDesc: string
  fullDescEn?: string
  locationInfo: string
  locationInfoEn?: string
  tips: string
  tipsEn?: string
  distance: string
  distanceEn?: string
  time: string
  timeEn?: string
  price: string
  image: string
  features: string[]
  featuresEn?: string[]
  rating: number
  reviews: FoodReview[]
}

export const foods: FoodShop[] = [
  {
    id: 'food-lijingxuan',
    name: '丽景轩渔蟹馆',
    nameEn: 'Lijingxuan Seafood Restaurant',
    tag: '农家菜',
    tagEn: 'Farmhouse Cuisine',
    tagClass: 'tag-core',
    desc: '灵山脚下的老牌农家菜馆，以太湖河鲜和地灶农家菜闻名',
    descEn: 'Traditional farmhouse restaurant famous for Taihu Lake seafood and clay-pot dishes',
    fullDesc: '丽景轩渔蟹馆紧邻灵山胜境景区，是一家经营多年的老牌农家菜馆。店内以太湖新鲜河鲜为主打，招牌菜清蒸太湖白鱼、银鱼炒蛋、农家土鸡煲深受游客喜爱。店面环境朴素温馨，食材新鲜，分量实在，是游览灵山后品尝地道农家风味的首选。',
    fullDescEn: 'Lijingxuan is a well-established farmhouse restaurant near Lingshan Scenic Area, famous for fresh Taihu Lake seafood. Signature dishes include steamed whitefish, scrambled eggs with silver fish, and chicken hot pot.',
    locationInfo: '灵山胜境景区入口东行约500米',
    locationInfoEn: '500m east of Lingshan Scenic Area entrance',
    tips: '饭点人较多，建议错峰前往；太湖三白季节性强，可提前电话咨询当日推荐',
    tipsEn: 'Busy during meal times, avoid peak hours; Taihu "three whites" are seasonal, call ahead for recommendations',
    distance: '距景区入口500米',
    distanceEn: '500m from entrance',
    time: '营业10:00-21:00',
    timeEn: 'Open 10:00-21:00',
    price: '人均¥50',
    image: '/static/food-shops/lijingxuan.jpg',
    features: ['太湖河鲜', '农家土菜', '地灶烹饪', '新鲜食材'],
    featuresEn: ['Taihu Seafood', 'Farmhouse Dishes', 'Clay Pot Cooking', 'Fresh Ingredients'],
    rating: 4.7,
    reviews: [
      { id: 'r1', nickname: '老饕食客', nicknameEn: 'Gourmet Expert', rating: 5, content: '清蒸太湖白鱼太鲜了，刚从湖里捞上来就下锅，肉质嫩滑得入口即化。老板人实在，推荐什么就做什么，没有踩雷。', contentEn: 'The steamed Taihu whitefish is incredibly fresh, caught from the lake and cooked immediately. The meat is tender and melts in your mouth. The owner is honest, everything recommended is great.', createdAt: '2026-06-28' },
      { id: 'r2', nickname: '江南旅人', nicknameEn: 'Jiangnan Traveler', rating: 4, content: '农家土鸡煲味道很赞，鸡是散养的走地鸡，炖出来的汤金黄浓郁。就是饭点要排队，建议早点去。', contentEn: 'The farmhouse chicken hot pot is excellent. The free-range chicken produces rich golden broth. Gets busy during meal times, recommend arriving early.', createdAt: '2026-06-25' },
      { id: 'r3', nickname: '美食猎人', nicknameEn: 'Food Hunter', rating: 5, content: '银鱼炒蛋是必点！蛋香和鱼鲜完美融合，下饭神器。分量很足，三个人五个菜吃得很饱。', contentEn: 'Silver fish scrambled eggs is a must-order! Perfect blend of egg aroma and fish freshness, great with rice. Generous portions, three people ate five dishes and were full.', createdAt: '2026-06-20' }
    ]
  },
  {
    id: 'food-yujia',
    name: '渔家私房菜',
    nameEn: 'Yujia Private Kitchen',
    tag: '中餐·私房菜',
    tagEn: 'Chinese·Private Dining',
    tagClass: 'tag-culture',
    desc: '隐于灵山脚下的私房菜馆，每道菜都是掌柜精心定制',
    descEn: 'Hidden private kitchen at the foot of Lingshan Mountain, every dish is carefully crafted by the chef',
    fullDesc: '渔家私房菜馆藏在灵山脚下的小巷中，门面不起眼，内里却别有洞天。掌柜曾是五星级酒店厨师，回乡开了这间私房菜馆，以"不设菜单、当日采买、时令定制"为理念。招牌菜私房红烧肉、太湖三白拼盘、手作鱼丸汤，每道菜都倾注了掌柜对食材的敬意和对味道的追求。',
    fullDescEn: 'Yujia Private Kitchen is hidden in an alley at the foot of Lingshan Mountain. The unassuming exterior belies an extraordinary interior. The chef, formerly a five-star hotel cook, returned home to open this private kitchen with the philosophy of "no fixed menu, daily fresh ingredients, seasonal customization." Signature dishes include house braised pork, Taihu Lake three whites platter, and hand-made fish ball soup.',
    locationInfo: '灵山胜境景区东侧约480米',
    locationInfoEn: 'Approximately 480m east of Lingshan Scenic Area',
    tips: '需提前预约，掌柜根据当日食材定制菜单；不接待临时散客',
    tipsEn: 'Reservations required, chef customizes menu based on daily ingredients; walk-ins not accepted',
    distance: '距景区入口480米',
    distanceEn: '480m from entrance',
    time: '营业11:00-14:00, 17:00-20:00',
    timeEn: 'Open 11:00-14:00, 17:00-20:00',
    price: '人均¥62',
    image: '/static/food-shops/yujia-sifangcai.jpg',
    features: ['私房定制', '时令食材', '主厨亲做', '需预约'],
    featuresEn: ['Private Customization', 'Seasonal Ingredients', 'Chef Made', 'Reservation Required'],
    rating: 4.6,
    reviews: [
      { id: 'r1', nickname: '寻味之旅', nicknameEn: 'Flavor Explorer', rating: 5, content: '私房红烧肉绝了！肥而不腻入口即化，酱汁浓郁得让人想拿米饭拌着吃。掌柜说每块肉都炖了三个小时，确实不一样。', contentEn: 'The private braised pork is incredible! Fat but not greasy, melts in your mouth. The rich sauce makes you want to mix it with rice. The chef said each piece simmers for three hours - truly special.', createdAt: '2026-06-27' },
      { id: 'r2', nickname: '安静的吃货', nicknameEn: 'Quiet Foodie', rating: 4, content: '手作鱼丸汤很惊艳，鱼丸Q弹有嚼劲，汤头清甜。就是需要预约有点麻烦，不过值得等待。', contentEn: 'The handmade fish ball soup is amazing. Fish balls are bouncy and chewy, broth is sweet and clear. Reservations required which is a bit inconvenient, but worth the wait.', createdAt: '2026-06-22' },
      { id: 'r3', nickname: '本地老王', nicknameEn: 'Local Regular', rating: 5, content: '带朋友来吃过好几次了，每次掌柜都根据时令换菜单，春天有荠菜春笋，夏天有荷叶粉蒸肉，每次都有惊喜。', contentEn: 'Brought friends here many times. The chef changes menu seasonally - shepherd\'s purse and bamboo shoots in spring, lotus leaf steamed pork in summer. Always a surprise.', createdAt: '2026-06-18' }
    ]
  },
  {
    id: 'food-jiajiajie',
    name: '佳佳姐私房菜',
    nameEn: 'Jiajiajie Private Kitchen',
    tag: '私房菜',
    tagEn: 'Private Dining',
    tagClass: 'tag-culture',
    desc: '佳佳姐主理的家庭式私房菜，家常味道温暖人心',
    descEn: 'Family-style private kitchen run by Sister Jiajia, home-cooked flavors that warm the heart',
    fullDesc: '佳佳姐私房菜是一间由本地阿姨佳佳姐主理的家庭式小馆。没有华丽装修，只有六张桌子，但每道菜都是佳佳姐亲手烹饪的家常味道。招牌菜有秘制酱鸭、家常红烧狮子头、时令蔬菜小炒。分量足、价格亲民，深受游客和本地人喜爱。',
    fullDescEn: 'Jiajiajie Private Kitchen is a family-run restaurant managed by local auntie Sister Jiajia. With simple decor and only six tables, every dish is cooked with care. Signature dishes include secret sauce duck, home-style braised meatballs, and seasonal vegetable stir-fries. Generous portions and affordable prices make it popular with both tourists and locals.',
    locationInfo: '灵山胜境景区北侧约600米',
    locationInfoEn: 'Approximately 600m north of Lingshan Scenic Area',
    tips: '店面较小，周末建议提前电话留位；家常口味，不辣',
    tipsEn: 'Small venue, call ahead for reservations on weekends; home-style taste, not spicy',
    distance: '距景区入口600米',
    distanceEn: '600m from entrance',
    time: '营业11:00-21:00',
    timeEn: 'Open 11:00-21:00',
    price: '人均¥45',
    image: '/static/food-shops/jiajiajie.jpg',
    features: ['家常私房', '本地风味', '分量十足', '价格亲民'],
    featuresEn: ['Home-style Private', 'Local Flavors', 'Generous Portions', 'Affordable'],
    rating: 4.5,
    reviews: [
      { id: 'r1', nickname: '温暖胃的人', nicknameEn: 'Warm-hearted Foodie', rating: 5, content: '佳佳姐做的红烧狮子头太好吃了！肉馅是手剁的，口感扎实又有弹性，汤汁拌饭简直是灵魂。感觉像在阿姨家里吃饭一样温暖。', contentEn: 'Sister Jiajia\'s braised meatballs are incredible! Hand-chopped meat with firm yet bouncy texture, the sauce is perfect with rice. Feels like eating at an aunt\'s home - so warm.', createdAt: '2026-06-26' },
      { id: 'r2', nickname: '环游食客', nicknameEn: 'World Traveler', rating: 4, content: '秘制酱鸭味道不错，咸甜适中。就是店面确实小了点，饭点去要等位。性价比很高，三个人吃了不到150。', contentEn: 'The secret sauce duck is delicious, perfect balance of salty and sweet. The venue is small though, need to wait during meal times. Great value - three people ate for less than 150.', createdAt: '2026-06-21' },
      { id: 'r3', nickname: '小确幸', nicknameEn: 'Little Happiness', rating: 5, content: '佳佳姐人超好！看我们带着老人和小孩，特意做了清淡口味的菜，还送了一碟小菜。这种用心是连锁餐厅比不了的。', contentEn: 'Sister Jiajia is so kind! She noticed we had elderly and kids, made light dishes specially and gave us complimentary side dishes. This kind of care can\'t be found in chain restaurants.', createdAt: '2026-06-16' }
    ]
  },
  {
    id: 'food-tanghe',
    name: '汤和无锡菜',
    nameEn: 'Tanghe Wuxi Cuisine',
    tag: '无锡菜',
    tagEn: 'Wuxi Cuisine',
    tagClass: 'tag-culture',
    desc: '正宗无锡本地菜，甜咸交织的经典锡帮味道',
    descEn: 'Authentic Wuxi local cuisine, classic sweet-savory Xibang flavors',
    fullDesc: '汤和无锡菜是一家经营无锡本地菜的老馆子，主打正宗锡帮菜。无锡菜以"甜出头、咸收口"为特色，招牌菜有无锡排骨、响油鳝糊、太湖银鱼羹。店内装修古朴雅致，墙上挂着无锡老照片，让人在品尝美食的同时感受江南文化的韵味。',
    fullDescEn: 'Tanghe Wuxi Cuisine is a long-established restaurant specializing in authentic Wuxi dishes. Wuxi cuisine is characterized by "sweet first, savory finish." Signature dishes include Wuxi pork ribs, sizzling eel paste, and Taihu Lake silver fish soup. The rustic elegant decor with old Wuxi photos creates a cultural dining experience.',
    locationInfo: '灵山胜境景区南侧约550米',
    locationInfoEn: 'Approximately 550m south of Lingshan Scenic Area',
    tips: '无锡菜偏甜，不喜甜的游客可提前告知厨师调整；招牌无锡排骨每日限量',
    tipsEn: 'Wuxi cuisine is sweet, inform chef in advance if you prefer less sweet; signature pork ribs limited daily',
    distance: '距景区入口550米',
    distanceEn: '550m from entrance',
    time: '营业11:00-21:00',
    timeEn: 'Open 11:00-21:00',
    price: '人均¥58',
    image: '/static/food-shops/tanghe-wuxi.jpg',
    features: ['正宗锡帮', '无锡排骨', '甜咸交织', '古朴环境'],
    featuresEn: ['Authentic Xibang', 'Wuxi Pork Ribs', 'Sweet-Savory Balance', 'Rustic Ambiance'],
    rating: 4.4,
    reviews: [
      { id: 'r1', nickname: '无锡土著', nicknameEn: 'Wuxi Local', rating: 5, content: '作为无锡本地人表示这家的无锡排骨很正宗！甜度刚刚好，肉质酥烂脱骨。响油鳝糊也是一绝，油温掌握得很好，鳝丝鲜嫩。', contentEn: 'As a Wuxi local, this Wuxi pork ribs is authentic! Perfect sweetness, meat falls off the bone. The sizzling eel paste is amazing too - perfect oil temperature, eel slices are tender.', createdAt: '2026-06-24' },
      { id: 'r2', nickname: '北方游客', nicknameEn: 'Northern Tourist', rating: 4, content: '第一次吃无锡菜，确实偏甜但越吃越上瘾。太湖银鱼羹很鲜，配上醋更开胃。环境也不错，有老无锡的味道。', contentEn: 'First time trying Wuxi cuisine, it\'s sweet but addictive. Taihu silver fish soup is fresh, even better with vinegar. Nice ambiance with old Wuxi charm.', createdAt: '2026-06-19' },
      { id: 'r3', nickname: '美食博主小林', nicknameEn: 'Food Blogger', rating: 4, content: '汤和的菜确实有功夫，红烧肉用冰糖炒色，色泽红亮。唯一缺点是旺季上菜稍慢，不过好菜不怕等。', contentEn: 'Tanghe\'s dishes are truly skillful - braised pork with rock sugar gives beautiful red color. Only downside is slow service during peak season, but good food is worth waiting for.', createdAt: '2026-06-14' }
    ]
  },
  {
    id: 'food-yuweifang',
    name: '渔味坊（拈花湾景区店）',
    nameEn: 'Yuweifang (Nianhuawan Branch)',
    tag: '中餐',
    tagEn: 'Chinese Cuisine',
    tagClass: 'tag-core',
    desc: '拈花湾景区内的河鲜主题餐厅，边赏景边品鲜',
    descEn: 'Seafood-themed restaurant inside Nianhuawan Scenic Area, enjoy views while dining',
    fullDesc: '渔味坊位于拈花湾景区核心区域，是一家以太湖河鲜为主题的中餐厅。餐厅临水而建，落地窗外是禅意园林水景。招牌菜清蒸白鱼、蟹粉豆腐、太湖三白宴，食材每日从太湖直采。用餐时可欣赏拈花湾的园林美景，是味觉与视觉的双重享受。',
    fullDescEn: 'Yuweifang is located in the heart of Nianhuawan Scenic Area, a seafood-themed Chinese restaurant built over water with zen garden views through floor-to-ceiling windows. Signature dishes include steamed whitefish, crab meat tofu, and Taihu Lake three whites feast, using fresh daily catches from the lake. Enjoy both culinary and visual delights.',
    locationInfo: '拈花湾景区内核心水景区旁',
    locationInfoEn: 'Next to the central water area in Nianhuawan Scenic Area',
    tips: '景区内餐厅价格略高，建议点套餐更划算；靠窗位置需提前到店',
    tipsEn: 'Prices slightly higher in scenic area, set meals recommended; arrive early for window seats',
    distance: '距景区入口464米',
    distanceEn: '464m from entrance',
    time: '营业11:00-21:30',
    timeEn: 'Open 11:00-21:30',
    price: '人均¥72',
    image: '/static/food-shops/yuweifang.jpg',
    features: ['景区内就餐', '太湖河鲜', '临水景观', '禅意环境'],
    featuresEn: ['Dining in Scenic Area', 'Taihu Seafood', 'Waterfront View', 'Zen Ambiance'],
    rating: 4.4,
    reviews: [
      { id: 'r1', nickname: '禅意食客', nicknameEn: 'Zen Foodie', rating: 5, content: '坐在窗边吃清蒸白鱼，看着外面拈花湾的园林水景，这体验太值了！鱼是现捞现做的，鲜得眉毛都要掉了。', contentEn: 'Eating steamed whitefish by the window, watching Nianhuawan garden water views - this experience is priceless! Fish is freshly caught and cooked, incredibly fresh.', createdAt: '2026-06-25' },
      { id: 'r2', nickname: '家庭出游', nicknameEn: 'Family Traveler', rating: 4, content: '蟹粉豆腐很惊艳，蟹粉给得足，豆腐嫩滑。就是景区内价格确实偏高，不过环境和食材对得起这个价。', contentEn: 'Crab meat tofu is amazing - generous crab meat and silky tofu. Prices are higher in scenic area, but environment and ingredients justify it.', createdAt: '2026-06-20' },
      { id: 'r3', nickname: '老饕笔记', nicknameEn: 'Gourmet Note', rating: 4, content: '太湖三白宴是特色，白鱼银鱼白虾一次全吃到。建议中午来，光线好拍照也好看，晚上人少但拍照效果差些。', contentEn: 'Taihu Three Whites feast is the specialty - whitefish, silver fish and white shrimp all in one meal. Recommend coming at noon for better lighting and photos.', createdAt: '2026-06-15' }
    ]
  },
  {
    id: 'food-wukouzao',
    name: '五口灶·现炒下饭小炒',
    nameEn: 'Wukouzao·Stir-Fry Express',
    tag: '小炒快餐',
    tagEn: 'Stir-Fry Fast Food',
    tagClass: 'tag-experience',
    desc: '大火爆炒的地道小炒馆，下饭神器集合地',
    descEn: 'Authentic stir-fry restaurant with blistering heat, perfect dishes for rice',
    fullDesc: '五口灶是一家主打现炒小炒的快餐式餐馆，名字取自"五口灶台同时开火"之意。店里用五个大灶台同时爆炒，烟火气十足。招牌菜有辣椒炒肉、农家小炒肉、酸辣土豆丝、西红柿炒蛋，都是最家常但最下饭的菜。价格实惠，出餐快，适合游览间隙快速解决一餐。',
    fullDescEn: 'Wukouzao is a fast-food style restaurant specializing in stir-fry dishes, named after "five stoves firing simultaneously." Five large woks cook simultaneously, creating abundant wok hei. Signature dishes include chili pork stir-fry, farmhouse pork stir-fry, spicy sour potato shreds, and tomato scrambled eggs - all home-style and highly appetizing. Affordable prices and quick service make it ideal for a quick meal during sightseeing.',
    locationInfo: '灵山胜境景区外围商业区约4公里',
    locationInfoEn: 'Approximately 4km from Lingshan Scenic Area in the commercial zone',
    tips: '快餐式就餐，适合赶时间的游客；菜品偏辣，可提前告知辣度',
    tipsEn: 'Fast-food style dining, ideal for time-pressed tourists; dishes are spicy, specify spice level in advance',
    distance: '距景区入口4公里',
    distanceEn: '4km from entrance',
    time: '营业10:30-22:00',
    timeEn: 'Open 10:30-22:00',
    price: '人均¥32',
    image: '/static/food-shops/wukouzao.jpg',
    features: ['大火爆炒', '出餐快速', '价格实惠', '下饭神器'],
    featuresEn: ['Blistering Wok', 'Quick Service', 'Affordable', 'Rice Companion'],
    rating: 4.4,
    reviews: [
      { id: 'r1', nickname: '打工人食评', nicknameEn: 'Worker Foodie', rating: 5, content: '辣椒炒肉太下饭了！猪肉煸得焦香，辣椒微辣带甜，一碗米饭不够吃又加了一碗。32块钱吃到撑，性价比天花板。', contentEn: 'Chili pork stir-fry is super appetizing! Pork is crispy and fragrant, chili is slightly spicy with sweetness - had two bowls of rice. 32 yuan for a full meal, best value ever.', createdAt: '2026-06-23' },
      { id: 'r2', nickname: '快手食客', nicknameEn: 'Quick Eater', rating: 4, content: '出餐确实快，点完单不到五分钟就上了。酸辣土豆丝酸爽脆口，很开胃。适合赶时间的朋友。', contentEn: 'Service is really fast, food served in under 5 minutes. Spicy sour potato shreds are crispy and refreshing. Perfect for time-pressed travelers.', createdAt: '2026-06-18' },
      { id: 'r3', nickname: '省钱达人', nicknameEn: 'Budget Saver', rating: 5, content: '在景区附近能找到这么便宜好吃的地方太难得了。三个菜加米饭才花了不到一百块，味道还不输大饭店。', contentEn: 'Hard to find such cheap and delicious food near scenic area. Three dishes plus rice for less than 100 yuan, tastes as good as upscale restaurants.', createdAt: '2026-06-13' }
    ]
  },
  {
    id: 'food-maji',
    name: '马姐菜饭',
    nameEn: 'Maji Vegetable Rice',
    tag: '快餐·菜饭',
    tagEn: 'Fast Food·Vegetable Rice',
    tagClass: 'tag-experience',
    desc: '马姐手作的上海风味菜饭，简单温暖的家常味',
    descEn: 'Shanghai-style vegetable rice made by Sister Ma, simple yet warm home-cooked taste',
    fullDesc: '马姐菜饭是一间由马姐经营的特色快餐小店，主打上海风味的菜饭。每碗菜饭都用新鲜青菜和猪油翻炒，米饭粒粒分明、翠绿油亮。配菜有红烧大排、酱蛋、油面筋塞肉等经典上海浇头。店面虽小但干净整洁，是游览灵山后快速填饱肚子的好选择。',
    fullDescEn: 'Maji Vegetable Rice is a specialty fast-food shop run by Sister Ma, specializing in Shanghai-style vegetable rice. Each bowl is stir-fried with fresh greens and lard, resulting in distinct grains with emerald-green luster. Classic Shanghai toppings include braised pork chop, soy sauce egg, and stuffed gluten puffs. Though small, the shop is clean and tidy - a great choice for a quick satisfying meal after sightseeing.',
    locationInfo: '灵山胜境景区东侧约700米',
    locationInfoEn: 'Approximately 700m east of Lingshan Scenic Area',
    tips: '早餐也供应菜饭泡饭；红烧大排每日限量，建议早到',
    tipsEn: 'Serves vegetable rice soup for breakfast; braised pork chop limited daily, arrive early',
    distance: '距景区入口700米',
    distanceEn: '700m from entrance',
    time: '营业07:00-20:00',
    timeEn: 'Open 07:00-20:00',
    price: '人均¥22',
    image: '/static/food-shops/maji-caifan.jpg',
    features: ['上海风味', '菜饭专营', '经济实惠', '早午供应'],
    featuresEn: ['Shanghai Style', 'Vegetable Rice Specialized', 'Budget Friendly', 'Breakfast & Lunch'],
    rating: 4.3,
    reviews: [
      { id: 'r1', nickname: '上海小囡', nicknameEn: 'Shanghai Native', rating: 5, content: '马姐的菜饭吃出了小时候外婆做的味道！猪油香得不行，青菜翠绿不黄。配个红烧大排，太满足了。', contentEn: 'Maji\'s vegetable rice tastes like grandma\'s cooking! Rich lard aroma, bright green vegetables. Paired with braised pork chop - so satisfying.', createdAt: '2026-06-22' },
      { id: 'r2', nickname: '早餐猎人', nicknameEn: 'Breakfast Hunter', rating: 4, content: '早上来的，菜饭泡饭配酱蛋，暖胃又暖心。马姐人很好，还给多加了一勺菜。22块钱吃到撑。', contentEn: 'Came for breakfast - vegetable rice soup with soy sauce egg, warms both stomach and heart. Sister Ma is kind, gave extra vegetables. 22 yuan for a full meal.', createdAt: '2026-06-17' },
      { id: 'r3', nickname: '路人甲', nicknameEn: 'Passing Traveler', rating: 4, content: '油面筋塞肉是惊喜！肉馅饱满，面筋吸足了汤汁。就是店面确实小了点，只能站着吃或者打包。', contentEn: 'Stuffed gluten puffs are a pleasant surprise! Plump meat filling, gluten absorbs all the sauce. Shop is small though, only standing room or takeout.', createdAt: '2026-06-12' }
    ]
  },
  {
    id: 'food-chengyuan',
    name: '澄园（灵福缘）',
    nameEn: 'Chengyuan Garden Restaurant',
    tag: '园林餐厅',
    tagEn: 'Garden Restaurant',
    tagClass: 'tag-culture',
    desc: '藏在园林中的雅致餐厅，美食与美景兼得',
    descEn: 'Elegant restaurant hidden in a garden, combining fine cuisine with beautiful scenery',
    fullDesc: '澄园是灵福缘景区内的一座园林式餐厅，依假山流水而建，用餐环境如苏州园林般雅致。餐厅主营精致锡帮菜和创意江南菜，招牌菜有澄园一品锅、蟹粉狮子头、荷叶粉蒸排骨。每道菜都注重摆盘美感，与窗外园林景致相映成趣，是品味与情调兼具的用餐之选。',
    fullDescEn: 'Chengyuan is a garden-style restaurant located within Lingfuyuan Scenic Area, built beside rockeries and flowing water, offering Suzhou garden-like elegance. Specializing in refined Xibang cuisine and creative Jiangnan dishes, signature items include Chengyuan Yipin Pot, crab meat lion\'s head, and lotus leaf steamed ribs. Each dish is beautifully presented, complementing the garden views outside - a dining choice that combines taste and ambiance.',
    locationInfo: '灵福缘景区内假山旁',
    locationInfoEn: 'Next to rockery in Lingfuyuan Scenic Area',
    tips: '园林内就餐需购买灵福缘门票或用餐免门票；建议预订靠窗位',
    tipsEn: 'Purchase Lingfuyuan ticket or dine for free entry; book window seats in advance',
    distance: '距景区入口450米',
    distanceEn: '450m from entrance',
    time: '营业11:00-21:00',
    timeEn: 'Open 11:00-21:00',
    price: '人均¥66',
    image: '/static/food-shops/chengyuan-lingfuyuan.jpg',
    features: ['园林就餐', '创意江南菜', '精致摆盘', '雅致环境'],
    featuresEn: ['Garden Dining', 'Creative Jiangnan', 'Exquisite Plating', 'Elegant Ambiance'],
    rating: 4.5,
    reviews: [
      { id: 'r1', nickname: '雅致生活家', nicknameEn: 'Elegant Lifer', rating: 5, content: '在假山流水旁吃饭的感觉太棒了！澄园一品锅分量足味道好，各种食材层层叠叠，每层都有不同的鲜味。园林环境加分太多。', contentEn: 'Dining beside rockeries and flowing water is amazing! Chengyuan Yipin Pot is generous and delicious, layers of ingredients each with unique flavors. Garden setting adds so much charm.', createdAt: '2026-06-24' },
      { id: 'r2', nickname: '美食摄影师', nicknameEn: 'Food Photographer', rating: 4, content: '蟹粉狮子头摆盘很美，配着园林背景拍照特别出片。味道也不错，蟹粉鲜美。价格稍高但环境和体验值这个价。', contentEn: 'Crab meat lion\'s head is beautifully plated, great photos with garden background. Taste is good too, fresh crab meat. Price is a bit high but the experience is worth it.', createdAt: '2026-06-19' },
      { id: 'r3', nickname: '江南慢生活', nicknameEn: 'Jiangnan Slow Lifer', rating: 5, content: '荷叶粉蒸排骨很有创意，荷叶的清香渗入肉中，吃起来不腻还带着荷香。坐在窗边看锦鲤游来游去，用餐变成了一种享受。', contentEn: 'Lotus leaf steamed ribs are creative - lotus fragrance infuses the meat, not greasy at all. Watching koi fish swim by the window, dining becomes a true pleasure.', createdAt: '2026-06-14' }
    ]
  },
  {
    id: 'food-xiaowuyue',
    name: '小吴越',
    nameEn: 'Little Wuyue',
    tag: '苏浙菜',
    tagEn: 'Jiangsu-Zhejiang Cuisine',
    tagClass: 'tag-culture',
    desc: '融合苏浙风味的精致餐厅，江南味道一网打尽',
    descEn: 'Refined restaurant blending Suzhou and Zhejiang flavors, all Jiangnan tastes in one place',
    fullDesc: '小吴越是一家融合苏州与浙江两地菜系特色的餐厅，以"吴越交融"为理念。店内装修以水墨江南为主题，素雅清幽。招牌菜有松鼠桂鱼、东坡肉、龙井虾仁，每道菜都体现了吴越菜的精致与讲究。适合对用餐品质有要求、想一站式品尝江南经典的游客。',
    fullDescEn: 'Little Wuyue blends Suzhou and Zhejiang culinary traditions with "Wuyue Integration" philosophy. Decorated in ink-wash Jiangnan style, elegant and serene. Signature dishes include squirrel-shaped mandarin fish, Dongpo pork, and Longjing shrimp. Ideal for discerning diners wanting a taste of classic Jiangnan cuisine.',
    locationInfo: '灵山胜境景区西侧约800米',
    locationInfoEn: 'Approximately 800m west of Lingshan Scenic Area',
    tips: '松鼠桂鱼制作耗时，建议提前预订；东坡肉每日限量',
    tipsEn: 'Squirrel fish takes time, book in advance; Dongpo pork limited daily',
    distance: '距景区入口800米',
    distanceEn: '800m from entrance',
    time: '营业11:00-21:00',
    timeEn: 'Open 11:00-21:00',
    price: '人均¥68',
    image: '/static/food-shops/xiaowuyue.jpg',
    features: ['苏浙融合', '精致江南', '水墨环境', '松鼠桂鱼'],
    featuresEn: ['Jiangsu-Zhejiang Fusion', 'Refined Jiangnan', 'Ink-wash Ambiance', 'Squirrel Fish'],
    rating: 4.6,
    reviews: [
      { id: 'r1', nickname: '江南食客', nicknameEn: 'Jiangnan Foodie', rating: 5, content: '松鼠桂鱼做得很正宗！外皮酥脆，浇上酸甜的番茄汁，鱼肉鲜嫩。造型也好看，鱼身翻翘如松鼠，色香味俱全。', contentEn: 'Squirrel fish is authentic! Crispy skin with sweet-sour tomato sauce, tender fish inside. Beautiful presentation - fish body curls like a squirrel. Perfect in color, aroma and taste.', createdAt: '2026-06-23' },
      { id: 'r2', nickname: '东坡肉爱好者', nicknameEn: 'Dongpo Pork Lover', rating: 5, content: '东坡肉是必点！肥瘦相间，用绍兴黄酒慢炖，入口即化。酱油的颜色红亮诱人，配一碗白饭绝了。', contentEn: 'Dongpo pork is a must-order! Perfect fat-to-meat ratio, slow-cooked in Shaoxing wine, melts in mouth. Beautiful red glossy color, perfect with white rice.', createdAt: '2026-06-18' },
      { id: 'r3', nickname: '龙井茶客', nicknameEn: 'Tea Lover', rating: 4, content: '龙井虾仁很有创意，茶叶的清香和虾仁的鲜甜搭配得很好。就是份量偏少，价格稍高。环境确实雅致，适合招待客人。', contentEn: 'Longjing shrimp is creative - tea fragrance pairs well with fresh shrimp sweetness. Portion is small though, price is a bit high. Elegant environment, great for entertaining.', createdAt: '2026-06-13' }
    ]
  },
  {
    id: 'food-zhuji',
    name: '朱記小館',
    nameEn: 'VERMILION HOUSE',
    tag: '创意中餐',
    tagEn: 'Creative Chinese',
    tagClass: 'tag-experience',
    desc: '融合东西方烹饪技法的创意中餐厅，匠心独具',
    descEn: 'Creative Chinese restaurant blending Eastern and Western culinary techniques',
    fullDesc: '朱記小館是一间主打创意中餐的小馆，将传统中式烹饪与西式摆盘技法融合。主理人曾在日本和法国进修，回国后开设此店。招牌菜有低温慢煮五花肉配中式酱汁、茶香熏鸭胸、黑松露炒饭。每道菜都是一件可食用的艺术品，适合追求新奇用餐体验的游客。',
    fullDescEn: 'VERMILION HOUSE is a creative Chinese restaurant that fuses traditional Chinese cooking with Western plating techniques. The chef trained in Japan and France before returning home. Signature dishes include sous-vide pork belly with Chinese sauce, tea-smoked duck breast, and truffle fried rice. Each dish is an edible work of art.',
    locationInfo: '灵山胜境景区北侧约900米',
    locationInfoEn: 'Approximately 900m north of Lingshan Scenic Area',
    tips: '创意菜品分量精致，适合慢品细尝；建议选择主理人推荐套餐',
    tipsEn: 'Creative dishes are delicately portioned, enjoy slowly; chef\'s recommended set menu suggested',
    distance: '距景区入口900米',
    distanceEn: '900m from entrance',
    time: '营业17:00-22:00（仅晚餐）',
    timeEn: 'Open 17:00-22:00 (dinner only)',
    price: '人均¥78',
    image: '/static/food-shops/zhuji-xiaoji.jpg',
    features: ['中西融合', '创意摆盘', '主理人亲做', '仅晚餐'],
    featuresEn: ['East-West Fusion', 'Creative Plating', 'Chef Made', 'Dinner Only'],
    rating: 4.7,
    reviews: [
      { id: 'r1', nickname: '创意美食家', nicknameEn: 'Creative Gourmet', rating: 5, content: '低温慢煮五花肉太惊艳了！西式技法做出的口感，配上中式酱汁，创意满分。摆盘像艺术品，不忍心下筷子。', contentEn: 'Sous-vide pork belly is amazing! Western technique with Chinese sauce, perfect creativity. Plating is like art - almost too beautiful to eat.', createdAt: '2026-06-25' },
      { id: 'r2', nickname: '黑松露控', nicknameEn: 'Truffle Lover', rating: 5, content: '黑松露炒饭是我吃过最好的！松露香气浓郁，米饭粒粒分明裹着蛋香。虽然78一位有点贵但真的很值。', contentEn: 'Truffle fried rice is the best I\'ve had! Strong truffle aroma, each grain of rice coated in egg. 78 yuan per person is pricey but truly worth it.', createdAt: '2026-06-20' },
      { id: 'r3', nickname: '慢食主义者', nicknameEn: 'Slow Food Enthusiast', rating: 4, content: '茶香熏鸭胸很有意思，用龙井茶熏制，鸭胸肉嫩皮脆。就是只有晚餐有点不方便，且份量确实偏少，适合品鉴不适合饱腹。', contentEn: 'Tea-smoked duck breast is interesting - Longjing tea smoked, tender meat with crispy skin. Dinner only is inconvenient though, portions are small - better for tasting than filling.', createdAt: '2026-06-15' }
    ]
  },
  {
    id: 'food-wulixiang',
    name: '屋里香私房菜',
    nameEn: 'Wulixiang Private Kitchen',
    tag: '私房菜·锡帮菜',
    tagEn: 'Private Dining·Xibang Cuisine',
    tagClass: 'tag-culture',
    desc: '锡帮私房菜代表，藏在巷子深处的无锡味道',
    descEn: 'Xibang private dining representative, authentic Wuxi flavors hidden in a deep alley',
    fullDesc: '屋里香私房菜藏在灵山脚下的小巷深处，是一间由本地夫妻经营的家庭私房菜馆。以锡帮菜为主打，招牌菜有无锡酱排骨、太湖白虾、梁溪脆鳝。老板娘亲手腌制的酱菜也是一绝，每桌免费赠送。店内只有四张桌子，需要提前预约，是体验地道无锡家庭味道的好去处。',
    fullDescEn: 'Wulixiang Private Kitchen is hidden deep in an alley at the foot of Lingshan Mountain, run by a local couple. Specializing in Xibang cuisine, signature dishes include Wuxi spareribs, Taihu white shrimp, and Liangxi crispy eel. The owner\'s homemade pickles are a must-try, complimentary for every table. Only 4 tables, reservations required.',
    locationInfo: '灵山胜境景区东南约650米',
    locationInfoEn: 'Approximately 650m southeast of Lingshan Scenic Area',
    tips: '仅四桌，必须提前预约；老板娘手作酱菜可外带购买',
    tipsEn: 'Only 4 tables, reservations required; owner\'s pickles available for takeout',
    distance: '距景区入口650米',
    distanceEn: '650m from entrance',
    time: '营业11:00-14:00, 17:00-20:30',
    timeEn: 'Open 11:00-14:00, 17:00-20:30',
    price: '人均¥55',
    image: '/static/food-shops/wulixiang-sifangcai.jpg',
    features: ['锡帮私房', '家庭经营', '限量四桌', '手作酱菜'],
    featuresEn: ['Xibang Private', 'Family Run', 'Limited 4 Tables', 'Homemade Pickles'],
    rating: 4.5,
    reviews: [
      { id: 'r1', nickname: '巷子里的猫', nicknameEn: 'Alley Cat', rating: 5, content: '无锡酱排骨太正宗了！酥烂脱骨，酱汁浓稠甜香。老板娘说这是她奶奶传下来的方子，果然家里做出来的味道不一样。', contentEn: 'Wuxi spareribs are authentic! Fall-off-the-bone tender, thick sweet sauce. Owner said it\'s her grandmother\'s recipe - truly home-made taste.', createdAt: '2026-06-24' },
      { id: 'r2', nickname: '酱菜爱好者', nicknameEn: 'Pickles Lover', rating: 5, content: '送的手作酱菜太好吃了！买了三罐带回家。太湖白虾也新鲜，个头大，水煮就很鲜甜。四桌的小店确实有家的感觉。', contentEn: 'Complimentary pickles are delicious! Bought three jars to take home. Taihu white shrimp is fresh, large size, simply boiled it\'s sweet. The 4-table shop feels like home.', createdAt: '2026-06-19' },
      { id: 'r3', nickname: '预约达人', nicknameEn: 'Reservation Expert', rating: 4, content: '梁溪脆鳝第一次吃，外脆里嫩，甜酸口味很开胃。就是预约有点麻烦，打了好几个电话才订到。不过值得。', contentEn: 'First time trying Liangxi crispy eel - crispy outside, tender inside, sweet-sour taste is refreshing. Reservations are a bit difficult, had to call multiple times. But worth it.', createdAt: '2026-06-14' }
    ]
  },
  {
    id: 'food-xufuniu',
    name: '许府牛',
    nameEn: 'Xufu Niu Hot Pot',
    tag: '牛杂火锅',
    tagEn: 'Beef Offal Hot Pot',
    tagClass: 'tag-core',
    desc: '以牛肉牛杂为主打的火锅专门店，鲜香麻辣',
    descEn: 'Beef and beef offal hot pot specialist, spicy and flavorful',
    fullDesc: '许府牛是一家以牛肉和牛杂为主打的火锅专门店，店内每日鲜宰黄牛，从牛骨汤底到牛杂涮菜一牛到底。招牌锅底有麻辣牛骨锅和番茄牛骨锅，特色涮菜包括鲜切牛舌、手打牛丸、牛杂拼盘。店内装修时尚年轻，深受年轻游客欢迎。',
    fullDescEn: 'Xufu Niu Hot Pot specializes in beef and beef offal. Freshly slaughtered yellow cattle daily, from beef bone broth to offal ingredients. Signature broths include spicy beef bone and tomato beef bone. Featured items: fresh sliced beef tongue, handmade beef balls, beef offal platter. Modern youthful decor popular among young tourists.',
    locationInfo: '灵山胜境景区外围商业区约3.5公里',
    locationInfoEn: 'Approximately 3.5km from Lingshan in commercial zone',
    tips: '鲜切牛肉每日限量，建议提前预订；麻辣锅底偏辣可选微辣',
    tipsEn: 'Fresh sliced beef limited daily, book in advance; spicy broth is hot, choose mild if prefer',
    distance: '距景区入口3.5公里',
    distanceEn: '3.5km from entrance',
    time: '营业11:00-22:00',
    timeEn: 'Open 11:00-22:00',
    price: '人均¥72',
    image: '/static/food-shops/xufuniu.jpg',
    features: ['鲜宰黄牛', '牛杂火锅', '麻辣鲜香', '年轻时尚'],
    featuresEn: ['Fresh Beef', 'Beef Offal Hot Pot', 'Spicy & Fragrant', 'Modern & Youthful'],
    rating: 4.3,
    reviews: [
      { id: 'r1', nickname: '火锅达人', nicknameEn: 'Hot Pot Expert', rating: 5, content: '鲜切牛舌太绝了！薄薄一片涮八秒，嫩滑得不像话。牛骨汤底熬了八个小时，喝一口就知道。手打牛丸弹牙有嚼劲。', contentEn: 'Fresh sliced beef tongue is incredible! Thin slices blanched for 8 seconds, incredibly tender. Beef bone broth simmered for 8 hours - one sip tells the difference. Handmade beef balls are bouncy and chewy.', createdAt: '2026-06-22' },
      { id: 'r2', nickname: '辣不怕', nicknameEn: 'Spice Lover', rating: 4, content: '麻辣牛骨锅够辣够爽！牛杂拼盘内容丰富，毛肚牛百叶牛筋都有。就是离景区有点远，需要开车过去。', contentEn: 'Spicy beef bone broth is fiery and satisfying! Beef offal platter has tripe, beef omasum and tendon. A bit far from scenic area though, need to drive.', createdAt: '2026-06-17' },
      { id: 'r3', nickname: '番茄控', nicknameEn: 'Tomato Lover', rating: 4, content: '番茄牛骨锅酸甜开胃，不辣的锅底很适合带小孩来吃。牛肉品质不错，就是价格稍高。环境装修很年轻化，适合拍照。', contentEn: 'Tomato beef bone broth is sweet-sour and appetizing, non-spicy perfect for kids. Good quality beef, price is a bit high. Modern youthful decor, great for photos.', createdAt: '2026-06-12' }
    ]
  },
  {
    id: 'food-chige',
    name: '吃个川川·猛火现炒',
    nameEn: 'Chige Chuanchuan·Wok Stir-Fry',
    tag: '川菜·麻辣',
    tagEn: 'Sichuan·Spicy',
    tagClass: 'tag-core',
    desc: '猛火爆炒的川味小馆，麻辣鲜香一口入魂',
    descEn: 'Sichuan-style stir-fry restaurant with blistering heat, spicy and numbing flavors',
    fullDesc: '吃个川川是一家主打川味猛火爆炒的快餐式小馆，以"猛火现炒、麻辣入魂"为口号。每道菜都用大火爆炒，镬气十足。招牌菜有辣子鸡、水煮牛肉、麻婆豆腐、干煸四季豆。价格实惠，出餐快，是喜欢重口味游客的不二选择。',
    fullDescEn: 'Chige Chuanchuan specializes in Sichuan wok stir-fry with "blistering heat, spicy soul" philosophy. Every dish is stir-fried over high flame with abundant wok hei. Signature dishes: spicy chicken cubes, Sichuan boiled beef, mapo tofu, dry-fried green beans. Affordable prices and quick service.',
    locationInfo: '灵山胜境景区外围商业区约4公里',
    locationInfoEn: 'Approximately 4km from Lingshan in commercial zone',
    tips: '菜品辣度可选；快餐式出餐适合赶时间；不建议带小孩前往',
    tipsEn: 'Spice level customizable; fast service ideal for time-pressed; not recommended for young children',
    distance: '距景区入口4公里',
    distanceEn: '4km from entrance',
    time: '营业10:30-22:00',
    timeEn: 'Open 10:30-22:00',
    price: '人均¥35',
    image: '/static/food-shops/chige-chuanchuan.jpg',
    features: ['猛火爆炒', '川味麻辣', '出餐快速', '价格实惠'],
    featuresEn: ['Blistering Wok', 'Sichuan Spicy', 'Fast Service', 'Affordable'],
    rating: 4.2,
    reviews: [
      { id: 'r1', nickname: '辣王争霸', nicknameEn: 'Spice King', rating: 5, content: '辣子鸡太香了！干辣椒花椒爆炒出来，鸡肉外酥里嫩。麻婆豆腐也很正宗，花椒的麻味很到位。35块钱吃到这么正宗的川菜值了。', contentEn: 'Spicy chicken cubes are fragrant! Stir-fried with dried chili and Sichuan pepper, crispy outside tender inside. Mapo tofu is authentic too, numbing spice is perfect. 35 yuan for authentic Sichuan food - worth it.', createdAt: '2026-06-21' },
      { id: 'r2', nickname: '干饭人', nicknameEn: 'Rice Eater', rating: 4, content: '水煮牛肉分量足，牛肉嫩滑，麻辣鲜香。就是油有点多，吃完嘴唇都红了。不过川菜就这样嘛，够味。', contentEn: 'Sichuan boiled beef has generous portions, tender beef with spicy fragrant broth. A bit oily though, lips turned red after eating. But that\'s Sichuan cuisine - full of flavor.', createdAt: '2026-06-16' },
      { id: 'r3', nickname: '干煸爱好者', nicknameEn: 'Dry-fry Lover', rating: 4, content: '干煸四季豆是我的最爱！豆角煸得起了虎皮，加上肉末和干辣椒，下饭神器。出餐很快，适合中午赶时间来。', contentEn: 'Dry-fried green beans is my favorite! Beans blistered with tiger skin pattern, mixed with minced meat and dried chili - perfect with rice. Fast service, great for quick lunch.', createdAt: '2026-06-11' }
    ]
  },
  {
    id: 'food-yuejun',
    name: '悦君食府',
    nameEn: 'Yuejun Restaurant',
    tag: '本帮菜',
    tagEn: 'Local Cuisine',
    tagClass: 'tag-culture',
    desc: '精致本帮菜馆，传统与创新并存的锡帮味道',
    descEn: 'Refined local cuisine restaurant, blending tradition and innovation in Xibang flavors',
    fullDesc: '悦君食府是一家中高端本帮菜馆，主打精致锡帮菜。店内装修典雅大气，适合宴请和家庭聚餐。招牌菜有悦君红烧肉、蟹粉狮子头、太湖三白宴、时令荷塘小炒。每道菜在保留传统风味的基础上，融入了现代烹饪技法，摆盘精美，是品味与档次兼具的用餐之选。',
    fullDescEn: 'Yuejun Restaurant is a mid-to-high-end local cuisine restaurant specializing in refined Xibang dishes. Elegant decor suitable for banquets and family gatherings. Signature dishes: Yuejun braised pork, crab meat lion\'s head, Taihu three whites feast, seasonal lotus pond stir-fry. Traditional flavors with modern techniques, beautifully presented.',
    locationInfo: '灵山胜境景区南侧约1公里',
    locationInfoEn: 'Approximately 1km south of Lingshan Scenic Area',
    tips: '中高端餐厅，建议着装整洁前往；宴请可预订包间',
    tipsEn: 'Mid-to-high-end restaurant, dress smartly; private rooms available for banquets',
    distance: '距景区入口1公里',
    distanceEn: '1km from entrance',
    time: '营业11:00-21:30',
    timeEn: 'Open 11:00-21:30',
    price: '人均¥62',
    image: '/static/food-shops/yuejun-shifu.jpg',
    features: ['精致本帮', '宴请首选', '包间可订', '摆盘精美'],
    featuresEn: ['Refined Local', 'Banquet Choice', 'Private Rooms', 'Exquisite Plating'],
    rating: 4.6,
    reviews: [
      { id: 'r1', nickname: '宴请达人', nicknameEn: 'Banquet Expert', rating: 5, content: '带客户来吃的，环境和服务都到位。悦君红烧肉用冰糖炒色，色泽红亮入口即化。客户赞不绝口，面子赚到了。', contentEn: 'Brought clients here - environment and service are excellent. Yuejun braised pork with rock sugar has beautiful red color, melts in mouth. Clients were very impressed.', createdAt: '2026-06-23' },
      { id: 'r2', nickname: '家庭聚餐', nicknameEn: 'Family Diner', rating: 5, content: '蟹粉狮子头是必点！蟹粉给得足，肉馅手剁的口感扎实。荷塘小炒清爽解腻，摆盘像画一样。适合带长辈来。', contentEn: 'Crab meat lion\'s head is a must-order! Generous crab meat, hand-chopped meat with firm texture. Lotus pond stir-fry is refreshing. Beautiful plating - perfect for dining with elders.', createdAt: '2026-06-18' },
      { id: 'r3', nickname: '美食评论家', nicknameEn: 'Food Critic', rating: 4, content: '太湖三白宴做工精细，每道菜都有创意。不过价格确实偏高，人均62但菜量不算大。适合品鉴不适合饱腹，追求品质的可以来。', contentEn: 'Taihu Three Whites feast is exquisitely prepared with creative dishes. Price is high though, 62 yuan per person with moderate portions. Better for tasting than filling, quality seekers will enjoy.', createdAt: '2026-06-13' }
    ]
  },
  {
    id: 'food-lingfuyuan',
    name: '灵福缘私房菜',
    nameEn: 'Lingfuyuan Private Kitchen',
    tag: '私房菜',
    tagEn: 'Private Dining',
    tagClass: 'tag-culture',
    desc: '灵福缘景区内的私房菜馆，园林深处的隐秘美味',
    descEn: 'Private dining within Lingfuyuan Scenic Area, hidden culinary treasure in garden depths',
    fullDesc: '灵福缘私房菜藏在灵福缘景区的园林深处，门面隐于假山之后，颇有"曲径通幽"之感。店内以精致私房菜为主打，招牌菜有灵福缘一品锅、手剥虾仁、松子桂鱼。用餐时可赏园林假山流水，是景区内难得的高品质用餐选择。',
    fullDescEn: 'Lingfuyuan Private Kitchen is hidden deep within the Lingfuyuan garden, behind a rockery. Specializing in exquisite private dining, signature dishes include Lingfuyuan Yipin Pot, hand-peeled shrimp, and pine nut mandarin fish. Enjoy garden rockery views while dining, a rare high-quality option within the scenic area.',
    locationInfo: '灵福缘景区内假山后',
    locationInfoEn: 'Behind rockery in Lingfuyuan Scenic Area',
    tips: '景区内餐厅需购票入内；建议预订靠窗观景位',
    tipsEn: 'Scenic area ticket required for entry; book window seats for garden views',
    distance: '距景区入口458米',
    distanceEn: '458m from entrance',
    time: '营业11:00-21:00',
    timeEn: 'Open 11:00-21:00',
    price: '人均¥66',
    image: '/static/food-shops/lingfuyuan.jpg',
    features: ['园林私房', '隐秘就餐', '景区内', '观景用餐'],
    featuresEn: ['Garden Private', 'Hidden Dining', 'In Scenic Area', 'View Dining'],
    rating: 4.5,
    reviews: [
      { id: 'r1', nickname: '寻味探险家', nicknameEn: 'Flavor Explorer', rating: 5, content: '穿过假山才找到这家店，有种寻宝的感觉！一品锅太惊艳了，各种食材层层叠加，每层都有不同的鲜味。环境超赞。', contentEn: 'Found this place after walking through rockeries - like a treasure hunt! Yipin Pot is amazing, layers of ingredients each with unique flavors. Environment is superb.', createdAt: '2026-06-22' },
      { id: 'r2', nickname: '虾仁控', nicknameEn: 'Shrimp Lover', rating: 5, content: '手剥虾仁太实在了！每只虾都是现剥的，口感Q弹鲜甜。坐在窗边看假山流水吃饭，这体验值回票价。', contentEn: 'Hand-peeled shrimp is incredible! Each shrimp is freshly peeled, bouncy and sweet. Dining by the window watching rockeries and flowing water - worth every penny.', createdAt: '2026-06-17' },
      { id: 'r3', nickname: '慢生活家', nicknameEn: 'Slow Lifer', rating: 4, content: '松子桂鱼做得精致，鱼肉嫩滑配上松子的香脆，口感丰富。就是价格偏高，不过景区内就餐加上环境，可以理解。', contentEn: 'Pine nut mandarin fish is exquisitely made, tender fish with crispy pine nuts - rich texture. Price is high but understandable given the scenic area location and ambiance.', createdAt: '2026-06-12' }
    ]
  }
]

export function getFoodById(id: string): FoodShop | undefined {
  return foods.find(f => f.id === id)
}

export function foodImage(shop: FoodShop): string {
  return shop.image
}

export function foodGallery(shop: FoodShop): string[] {
  return [shop.image, shop.image, shop.image]
}
