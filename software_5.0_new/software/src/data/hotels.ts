/**
 * 灵山周边住宿数据
 * 基础数据（酒店名、图片、价格、距离）保留原 HTML 页面数据
 * 配套数据（评价、特色标签、简介、营业时间）参照景点格式自动补充
 */

export interface HotelReview {
  id: string
  nickname: string
  nicknameEn?: string
  rating: number
  content: string
  contentEn?: string
  createdAt: string
}

export interface HotelShop {
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
  reviews: HotelReview[]
}

export const hotels: HotelShop[] = [
  {
    id: 'hotel-jingshe',
    name: '无锡灵山精舍',
    nameEn: 'Lingshan Boutique Hotel',
    tag: '精品酒店',
    tagEn: 'Boutique Hotel',
    tagClass: 'tag-core',
    desc: '灵山脚下的禅意精品酒店，江南园林与禅修文化的完美融合',
    descEn: 'Zen boutique hotel at the foot of Lingshan, perfect blend of Jiangnan garden and meditation culture',
    fullDesc: '无锡灵山精舍位于灵山景区旁，是一座集禅意与现代于一体的精品酒店。酒店设计融合江南园林风格，青瓦白墙、竹林流水，营造出宁静祥和的氛围。客房宽敞舒适，配备高档设施，部分房间可直望灵山大佛。酒店还提供禅修体验课程和素斋餐厅，是追求心灵宁静游客的理想下榻之处。',
    fullDescEn: 'Lingshan Boutique Hotel is located beside Lingshan Scenic Area. Its design blends Jiangnan garden style with modern Zen aesthetics. Some rooms offer views of the Grand Buddha. The hotel also provides meditation experience courses and vegetarian dining.',
    locationInfo: '灵山胜境景区旁，步行约10分钟可达景区入口',
    locationInfoEn: 'Beside Lingshan Scenic Area, 10-min walk to entrance',
    tips: '含双早房型性价比最高；禅修体验需提前预约；素斋餐厅口碑极佳',
    tipsEn: 'Best value with breakfast; meditation experiences require advance booking; vegetarian restaurant highly recommended',
    distance: '距灵山胜境约1公里',
    distanceEn: '~1 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥580起',
    image: '/static/hotel-imgs/hotel-01.jpg',
    features: ['禅意设计', '园林风格', '素斋美食', '禅修体验'],
    featuresEn: ['Zen Design', 'Garden Style', 'Vegetarian Cuisine', 'Meditation Experience'],
    rating: 4.8,
    reviews: [
      { id: 'r1', nickname: '禅心旅者', nicknameEn: 'Zen Traveler', rating: 5, content: '住了两晚，每天早晨在竹林里散步，听着远处灵山梵宫的钟声，整个人都静了下来。房间设计很有禅意，推开窗就是园林，太治愈了。', contentEn: 'Stayed two nights, walked in the bamboo forest every morning, listening to the bell from Lingshan Fan Palace in the distance, my mind became completely calm. The room design is very Zen, opening the window reveals the garden - so healing.', createdAt: '2026-06-28' },
      { id: 'r2', nickname: '品质出行', nicknameEn: 'Quality Traveler', rating: 5, content: '素斋餐厅太惊喜了！完全不是那种敷衍的素食，每道菜都做得精致入味。禅修体验课也很好，师父讲得很通透。580含双超值。', contentEn: 'The vegetarian restaurant was amazing! Not the perfunctory vegetarian food at all, every dish was exquisitely prepared. The meditation experience class was also great, the master explained everything clearly. 580 with breakfast is great value.', createdAt: '2026-06-25' },
      { id: 'r3', nickname: '蜜月旅行', nicknameEn: 'Honeymoon Traveler', rating: 4, content: '房间能看到灵山大佛，清晨云雾缭绕时特别美。服务很好，前台推荐了最佳观佛时间。唯一缺点是离商业区稍远，但这也保证了安静。', contentEn: 'The room has a view of Lingshan Grand Buddha, especially beautiful in the early morning mist. Service was excellent, the front desk recommended the best time to view the Buddha. The only downside is it\'s a bit far from commercial areas, but this ensures peace and quiet.', createdAt: '2026-06-20' }
    ]
  },
  {
    id: 'hotel-nianhua-inn',
    name: '拈花湾拈花客栈',
    nameEn: 'Nianhua Bay Zen Inn',
    tag: '古镇客栈',
    tagEn: 'Ancient Town Inn',
    tagClass: 'tag-culture',
    desc: '拈花湾景区内的禅意客栈，白墙黛瓦的江南水乡韵味',
    descEn: 'Zen inn within Nianhua Bay Scenic Area, showcasing Jiangnan water town charm',
    fullDesc: '拈花湾拈花客栈位于拈花湾景区内，是一座充满禅意的中式客栈。客栈依水而建，白墙黛瓦、木格窗棂，尽显江南水乡韵味。客房布置典雅温馨，选用天然材质家具，配备现代设施。客栈紧邻拈花湾禅意花海和灯光秀区域，晚上散步赏景极为方便。',
    fullDescEn: 'Nianhua Bay Zen Inn is located within Nianhua Bay Scenic Area. Built alongside water with white walls and dark tiles, it captures the essence of Jiangnan water towns. Rooms feature elegant decor with natural materials and modern amenities. Conveniently located near the Zen flower sea and light show area.',
    locationInfo: '拈花湾景区内核心水景区旁',
    locationInfoEn: 'Near central water area in Nianhua Bay',
    tips: '住客可享景区门票优惠；夜晚灯光秀最佳观赏位置；含双早房型推荐',
    tipsEn: 'Discounted tickets for guests; best viewing spot for night light show; recommended with breakfast',
    distance: '距灵山胜境约1公里',
    distanceEn: '~1 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥480起',
    image: '/static/hotel-imgs/hotel-02.jpg',
    features: ['古镇风情', '禅意生活', '依水而建', '中式风格'],
    featuresEn: ['Ancient Town Charm', 'Zen Lifestyle', 'Waterfront', 'Chinese Style'],
    rating: 4.7,
    reviews: [
      { id: 'r1', nickname: '古镇爱好者', nicknameEn: 'Ancient Town Lover', rating: 5, content: '住在拈花湾里面太方便了！晚上灯光秀就在门口，白天逛灵山晚上逛拈花湾，不用奔波。客栈的木格窗棂推开就是小桥流水。', contentEn: 'Living inside Nianhua Bay is so convenient! The night light show is right at the door, visit Lingshan during the day and Nianhua Bay at night without rushing. The wooden lattice window opens to a small bridge and flowing water.', createdAt: '2026-06-27' },
      { id: 'r2', nickname: '慢生活家', nicknameEn: 'Slow Lifer', rating: 5, content: '房间虽然不大但布置得很用心，天然材质的家具散发着淡淡木香。早上在院子里喝茶听流水声，这才是度假该有的样子。', contentEn: 'The room is not big but carefully decorated. The natural wood furniture gives off a subtle wood fragrance. Drinking tea in the courtyard listening to flowing water in the morning - this is what vacation should be like.', createdAt: '2026-06-22' },
      { id: 'r3', nickname: '亲子出游', nicknameEn: 'Family Traveler', rating: 4, content: '孩子特别喜欢古镇的感觉，在巷子里跑来跑去。客栈提供免费的禅意手工课，做了一次扎染很有趣。就是隔音一般。', contentEn: 'The kids loved the ancient town feel, running around the alleys. The inn offers free Zen craft classes, did a tie-dye session which was fun. Soundproofing is average though.', createdAt: '2026-06-17' }
    ]
  },
  {
    id: 'hotel-taihu-xiandao',
    name: '无锡太湖仙岛度假酒店',
    nameEn: 'Taihu Fairy Island Resort Hotel',
    tag: '度假酒店',
    tagEn: 'Resort Hotel',
    tagClass: 'tag-core',
    desc: '太湖之滨的高端度假酒店，湖光山色尽收眼底',
    descEn: 'High-end resort hotel on the shores of Taihu Lake, breathtaking lake and mountain views',
    fullDesc: '无锡太湖仙岛度假酒店坐落在太湖之滨，是一家以湖景为主题的高端度假酒店。酒店拥有无敌湖景房和独栋别墅两种房型，每间房都可欣赏太湖日出日落。酒店配备室内外泳池、SPA中心、健身俱乐部等完善设施。餐厅主打太湖湖鲜，食材每日从太湖直采。',
    fullDescEn: 'Taihu Fairy Island Resort Hotel is situated on the shores of Taihu Lake, offering lake-view rooms and private villas. Every room overlooks Taihu Lake sunrise and sunset. Facilities include indoor/outdoor pools, SPA center, and fitness club. Restaurant specializes in fresh Taihu seafood.',
    locationInfo: '太湖国家旅游度假区核心区域',
    locationInfoEn: 'Core area of Taihu National Tourist Resort',
    tips: '湖景房需提前预订；日出观景推荐东向房间；含晚餐套餐更划算',
    tipsEn: 'Lake-view rooms require advance booking; east-facing rooms for sunrise; dinner package recommended',
    distance: '距灵山胜境约3公里',
    distanceEn: '~3 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥680起',
    image: '/static/hotel-imgs/hotel-03.jpg',
    features: ['无敌湖景', '独栋别墅', 'SPA中心', '太湖湖鲜'],
    featuresEn: ['Panoramic Lake View', 'Private Villa', 'SPA Center', 'Taihu Seafood'],
    rating: 4.6,
    reviews: [
      { id: 'r1', nickname: '日出猎人', nicknameEn: 'Sunrise Hunter', rating: 5, content: '专门来看太湖日出的，早上五点半拉开窗帘，湖面金光闪闪美哭了！房间阳台正对太湖，拍照完全不用P。设施也齐全。', contentEn: 'Came specifically to see the Taihu sunrise. At 5:30 AM, I opened the curtains and the lake was shimmering with golden light - breathtaking! The room balcony faces Taihu Lake directly, no photo editing needed. Facilities are complete.', createdAt: '2026-06-26' },
      { id: 'r2', nickname: 'SPA爱好者', nicknameEn: 'SPA Lover', rating: 5, content: 'SPA中心太赞了！做完SPA直接去室外泳池，泡在温水里看太湖日落，人生巅峰。湖鲜餐厅的清蒸白鱼也是必吃。', contentEn: 'The SPA center is amazing! After the SPA, went straight to the outdoor pool and soaked in warm water watching the Taihu sunset - peak life experience. The steamed whitefish at the lake seafood restaurant is a must-try.', createdAt: '2026-06-21' },
      { id: 'r3', nickname: '商务度假', nicknameEn: 'Business Vacationer', rating: 4, content: '住了独栋别墅，私密性很好，院子里有私家泳池。就是价格不便宜，但偶尔奢侈一把还是值得的。离灵山有点距离，需要开车。', contentEn: 'Stayed in a private villa, great privacy with a private pool in the yard. It\'s not cheap, but worth splurging on occasionally. A bit far from Lingshan, need to drive.', createdAt: '2026-06-16' }
    ]
  },
  {
    id: 'hotel-lingshan-zhuangyuan',
    name: '无锡灵山庄园',
    nameEn: 'Lingshan Manor',
    tag: '度假酒店',
    tagEn: 'Resort Hotel',
    tagClass: 'tag-core',
    desc: '灵山脚下的庄园式度假酒店，静谧田园风光',
    descEn: 'Manor-style resort hotel at the foot of Lingshan, serene pastoral scenery',
    fullDesc: '无锡灵山庄园是一家坐落在灵山脚下的庄园式度假酒店，占地面积广阔，拥有大片园林和田园景观。酒店以"回归自然"为理念，客房散布于园林之中，每间房都有独立观景阳台。酒店还提供农场采摘、骑行漫游等田园体验活动，适合家庭亲子出游。',
    fullDescEn: 'Lingshan Manor is a sprawling estate resort nestled at the foot of Lingshan Mountain. Rooms are scattered throughout the gardens, each with private balcony. Activities include farm picking and cycling tours, ideal for family vacations.',
    locationInfo: '灵山胜境景区南侧，车程约5分钟',
    locationInfoEn: 'South of Lingshan Scenic Area, ~5 min drive',
    tips: '亲子房型含儿童乐园门票；农场采摘季节性开放；自行车免费租借',
    tipsEn: 'Family rooms include kids park tickets; farm picking seasonal; free bike rental',
    distance: '距灵山胜境约1.5公里',
    distanceEn: '~1.5 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥520起',
    image: '/static/hotel-imgs/hotel-04.jpg',
    features: ['庄园度假', '田园风光', '亲子友好', '采摘体验'],
    featuresEn: ['Manor Resort', 'Pastoral Scenery', 'Family Friendly', 'Picking Experience'],
    rating: 4.5,
    reviews: [
      { id: 'r1', nickname: '亲子游达人', nicknameEn: 'Family Travel Expert', rating: 5, content: '带孩子来的，太对了！农场采摘孩子玩了一下午，还骑了自行车在庄园里转。房间阳台能看到灵山大佛，早上云雾缭绕特别美。', contentEn: 'Brought the kids here - perfect choice! They spent the whole afternoon farm picking and cycling around the manor. The room balcony has a view of Lingshan Grand Buddha, especially beautiful in the morning mist.', createdAt: '2026-06-25' },
      { id: 'r2', nickname: '田园生活家', nicknameEn: 'Pastoral Lifer', rating: 4, content: '庄园环境很好，到处都是花草树木，空气清新。房间很大，阳台对着田园，晚上看星星很惬意。就是离景区有点距离需要开车。', contentEn: 'The manor has a great environment with lots of flowers and trees, fresh air. The room is spacious with a balcony facing the farmland, watching stars at night is very enjoyable. A bit far from the scenic area, need to drive.', createdAt: '2026-06-20' },
      { id: 'r3', nickname: '团建组织者', nicknameEn: 'Team Building Organizer', rating: 5, content: '公司团建选的这里，庄园大活动空间多。安排了采摘和骑行，大家都很开心。会议室设施也不错，工作和休闲两不误。', contentEn: 'Chose this for company team building. The manor is large with plenty of activity space. Organized picking and cycling activities, everyone had fun. Meeting room facilities are good too - work and leisure in one place.', createdAt: '2026-06-15' }
    ]
  },
  {
    id: 'hotel-fangong',
    name: '无锡梵宫度假酒店',
    nameEn: 'Fan Palace Resort Hotel',
    tag: '高端酒店',
    tagEn: 'Luxury Hotel',
    tagClass: 'tag-core',
    desc: '毗邻灵山梵宫的高端酒店，佛教艺术氛围浓厚',
    descEn: 'Luxury hotel adjacent to Lingshan Fan Palace, rich Buddhist art ambiance',
    fullDesc: '无锡梵宫度假酒店紧邻灵山梵宫，是一家以佛教艺术为主题的高端度假酒店。酒店内部装饰融合了佛教元素与现代设计，大堂的敦煌风格壁画和东阳木雕令人叹为观止。客房宽敞豪华，部分房间可直望灵山梵宫。酒店还设有禅修室、茶道室等文化体验空间。',
    fullDescEn: 'Fan Palace Resort Hotel is adjacent to Lingshan Fan Palace, featuring Buddhist art decor. The lobby showcases Dunhuang-style murals and Dongyang wood carvings. Spacious luxury rooms with some offering views of Fan Palace. Includes meditation room and tea ceremony space.',
    locationInfo: '灵山梵宫东侧步行约5分钟',
    locationInfoEn: 'East of Lingshan Fan Palace, ~5 min walk',
    tips: '梵宫观景房需提前预订；禅修室免费开放；含下午茶套餐推荐',
    tipsEn: 'Fan Palace view rooms require advance booking; meditation room free; afternoon tea package recommended',
    distance: '距灵山胜境约1.2公里',
    distanceEn: '~1.2 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥880起',
    image: '/static/hotel-imgs/hotel-05.jpg',
    features: ['梵宫景观', '佛教艺术', '高端奢华', '禅修茶道'],
    featuresEn: ['Fan Palace View', 'Buddhist Art', 'Luxury', 'Meditation & Tea'],
    rating: 4.7,
    reviews: [
      { id: 'r1', nickname: '艺术鉴赏家', nicknameEn: 'Art Connoisseur', rating: 5, content: '大堂的壁画和木雕简直是艺术品！住一晚像在博物馆里过夜。梵宫观景房推开窗就是灵山梵宫，金碧辉煌太震撼了。880值这个价。', contentEn: 'The murals and wood carvings in the lobby are true works of art! Staying here feels like spending the night in a museum. The Fan Palace view room opens to the magnificent Lingshan Fan Palace - truly breathtaking. 880 is worth every penny.', createdAt: '2026-06-24' },
      { id: 'r2', nickname: '茶道爱好者', nicknameEn: 'Tea Ceremony Lover', rating: 5, content: '茶道室太雅致了！茶具都是精品，还有茶艺师现场泡茶。晚上在禅修室静坐听着梵音，整个人都放松了。服务也是五星级标准。', contentEn: 'The tea ceremony room is exquisite! All tea sets are fine quality, with tea masters brewing on-site. Sitting in the meditation room at night listening to Buddhist chants was very relaxing. Service is 5-star standard.', createdAt: '2026-06-19' },
      { id: 'r3', nickname: '奢华体验控', nicknameEn: 'Luxury Seeker', rating: 4, content: '房间确实豪华，卫浴设施都是顶级品牌。就是价格偏高，但考虑到紧邻梵宫和酒店品质，还是物有所值的。含下午茶套餐推荐。', contentEn: 'The room is truly luxurious with top-brand bathroom fixtures. It\'s pricey, but considering the proximity to Fan Palace and hotel quality, it\'s good value. Recommend the afternoon tea package.', createdAt: '2026-06-14' }
    ]
  },
  {
    id: 'hotel-boluo',
    name: '无锡拈花湾波罗蜜多酒店',
    nameEn: 'Paramita Hotel',
    tag: '禅意酒店',
    tagEn: 'Zen Hotel',
    tagClass: 'tag-core',
    desc: '拈花湾核心区的禅意主题酒店，沉浸式禅生活体验',
    descEn: 'Zen-themed hotel in Nianhua Bay core area, immersive Zen lifestyle experience',
    fullDesc: '无锡拈花湾波罗蜜多酒店位于拈花湾景区核心区域，是一家以"禅生活"为主题的特色酒店。酒店整体设计以禅意为基调，大堂以枯山水庭院为装饰，客房以不同禅意主题打造。酒店提供抄经、花道、香道等禅修体验活动，是远离喧嚣、净化心灵的理想之所。',
    fullDescEn: 'Paramita Hotel is located in the heart of Nianhua Bay. The entire hotel is designed with Zen aesthetics, featuring a karesansui rock garden in the lobby. Rooms are themed around different Zen concepts. Offers sutra copying, flower arrangement, and incense ceremony experiences.',
    locationInfo: '拈花湾景区核心区域，灯光秀主场地旁',
    locationInfoEn: 'Core area of Nianhua Bay, beside light show venue',
    tips: '禅修体验活动需到店预约；含双早+禅修套餐性价比高；夜景最佳',
    tipsEn: 'Zen experiences require on-site booking; breakfast + Zen package recommended; best at night',
    distance: '距灵山胜境约1.5公里',
    distanceEn: '~1.5 km from Lingshan',
    time: '入住15:00 / 退房11:00',
    timeEn: 'Check-in 15:00 / Check-out 11:00',
    price: '¥780起',
    image: '/static/hotel-imgs/hotel-06.jpg',
    features: ['禅意主题', '抄经花道', '灯光秀旁', '沉浸体验'],
    featuresEn: ['Zen Theme', 'Sutra Copying', 'Near Light Show', 'Immersive Experience'],
    rating: 4.8,
    reviews: [
      { id: 'r1', nickname: '禅修初体验', nicknameEn: 'Zen Beginner', rating: 5, content: '第一次体验抄经，静下心来专注每一个字，写完整个人都平静了。房间设计很禅意，枯山水庭院太美了。晚上灯光秀就在门口。', contentEn: 'First time experiencing sutra copying. Calming down and focusing on each character, I felt completely peaceful after finishing. The room design is very Zen, the karesansui garden is beautiful. The night light show is right at the door.', createdAt: '2026-06-26' },
      { id: 'r2', nickname: '花香生活', nicknameEn: 'Flower Lover', rating: 5, content: '花道课太好看了！老师教得很认真，插出来的花可以带走。香道体验也很特别，闻着沉香打坐，身心都放松了。780含双早+禅修超值。', contentEn: 'The flower arrangement class was wonderful! The teacher was very thorough, and I could take my arrangement home. The incense ceremony was special too - meditating while smelling sandalwood, both body and mind relaxed. 780 with breakfast + Zen experience is great value.', createdAt: '2026-06-21' },
      { id: 'r3', nickname: '逃离都市', nicknameEn: 'City Escapee', rating: 5, content: '来这里就是为了远离喧嚣。酒店没有电视，只有茶具和经书，反而让人觉得清净。晚上的灯光秀配上禅意建筑，如梦如幻。', contentEn: 'Came here to escape the city bustle. The hotel has no TV, only tea sets and sutras, which makes it feel very peaceful. The night light show combined with the Zen architecture feels like a dream.', createdAt: '2026-06-16' }
    ]
  },
  {
    id: 'hotel-shuxiang',
    name: '无锡灵山书香府邸',
    nameEn: 'Scholarly Residence',
    tag: '文化主题酒店',
    tagEn: 'Cultural Theme Hotel',
    tagClass: 'tag-culture',
    desc: '书香文化主题精品酒店，文人雅士的下榻之选',
    descEn: 'Literary-themed boutique hotel, perfect for scholars and intellectuals',
    fullDesc: '无锡灵山书香府邸是一家以书香文化为主题的精品酒店。酒店以"书香门第"为设计理念，大堂设有开放式书房，陈列古籍善本和文房四宝。客房以不同诗词主题装饰，每间房都有独立阅读角。酒店还提供书法体验和国学讲座，是文化爱好者的理想选择。',
    fullDescEn: 'Scholarly Residence is a literary-themed boutique hotel. The lobby features an open study with ancient books and calligraphy supplies. Rooms are decorated with different poetry themes, each with a reading corner. Offers calligraphy experience and Chinese culture lectures.',
    locationInfo: '灵山胜境景区西侧步行约8分钟',
    locationInfoEn: 'West of Lingshan Scenic Area, ~8 min walk',
    tips: '书法体验免费；书房24小时开放；含早+书房下午茶套餐推荐',
    tipsEn: 'Calligraphy experience free; study open 24h; breakfast + afternoon tea package recommended',
    distance: '距灵山胜境约800米',
    distanceEn: '~800m from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥680起',
    image: '/static/hotel-imgs/hotel-07.jpg',
    features: ['书香主题', '书法体验', '国学讲座', '阅读空间'],
    featuresEn: ['Literary Theme', 'Calligraphy Experience', 'Chinese Culture', 'Reading Space'],
    rating: 4.6,
    reviews: [
      { id: 'r1', nickname: '书虫一枚', nicknameEn: 'Bookworm', rating: 5, content: '大堂的书房太赞了！有很多古籍善本，坐在那里翻书喝茶，感觉自己穿越到了古代书院。房间也有阅读角，晚上伴着书香入眠。', contentEn: 'The study in the lobby is amazing! Lots of ancient rare books, sitting there reading and drinking tea felt like traveling back to an ancient academy. The room also has a reading corner, fell asleep with the fragrance of books at night.', createdAt: '2026-06-25' },
      { id: 'r2', nickname: '书法爱好者', nicknameEn: 'Calligraphy Lover', rating: 5, content: '书法体验太有意思了！老师是书法协会的，教得很好。房间以诗词主题装饰，我住的"采菊东篱下"，很有意境。', contentEn: 'The calligraphy experience was fascinating! The teacher is from the calligraphy association and taught very well. The room is decorated with poetry themes, mine was "Picking chrysanthemums under the eastern hedge" - very poetic.', createdAt: '2026-06-20' },
      { id: 'r3', nickname: '文化深度游', nicknameEn: 'Culture Explorer', rating: 4, content: '国学讲座很精彩，讲的是灵山佛教文化的历史。酒店处处体现文化底蕴，文房四宝摆在桌上随时可用。价格稍高但文化体验值。', contentEn: 'The Chinese culture lecture was excellent, covering the history of Lingshan Buddhist culture. The hotel embodies cultural depth everywhere, withFour Treasures of Study ready on the desk. Price is a bit high but the cultural experience is worth it.', createdAt: '2026-06-15' }
    ]
  },
  {
    id: 'hotel-jinyuan',
    name: '无锡太湖锦园酒店',
    nameEn: 'Taihu Garden Hotel',
    tag: '园林度假酒店',
    tagEn: 'Garden Resort Hotel',
    tagClass: 'tag-core',
    desc: '太湖畔的园林式度假酒店，假山流水花木扶疏',
    descEn: 'Garden-style resort hotel on Taihu Lake, featuring rockeries and flowing water',
    fullDesc: '无锡太湖锦园酒店坐落在太湖之畔，是一家以江南园林为主题的度假酒店。酒店内假山流水、花木扶疏，处处展现江南园林之美。客房围绕中心园林布局，每间房都可赏园景或湖景。酒店配备室外温泉、网球场等休闲设施，是度假放松的绝佳选择。',
    fullDescEn: 'Taihu Garden Hotel is situated on Taihu Lake, designed in Jiangnan garden style with rockeries, flowing water, and abundant greenery. Rooms overlook either the garden or the lake. Facilities include outdoor hot spring and tennis courts.',
    locationInfo: '太湖度假区，距灵山胜境约2公里',
    locationInfoEn: 'Taihu Resort Area, ~2 km from Lingshan',
    tips: '室外温泉夜间开放；园景房性价比高于湖景房；网球拍可租借',
    tipsEn: 'Outdoor hot spring open at night; garden view rooms better value; tennis racket rental available',
    distance: '距灵山胜境约2公里',
    distanceEn: '~2 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥620起',
    image: '/static/hotel-imgs/hotel-08.jpg',
    features: ['江南园林', '室外温泉', '网球设施', '湖景园景'],
    featuresEn: ['Jiangnan Garden', 'Outdoor Hot Spring', 'Tennis Facilities', 'Lake/Garden View'],
    rating: 4.5,
    reviews: [
      { id: 'r1', nickname: '温泉达人', nicknameEn: 'Hot Spring Expert', rating: 5, content: '室外温泉太赞了！泡在温泉里看太湖夜景，星空下热气腾腾，太惬意了。园林设计也很美，走在假山流水间像在画里。', contentEn: 'The outdoor hot spring is amazing! Soaking in the hot spring watching the Taihu night view, steam rising under the starry sky - so relaxing. The garden design is beautiful too, walking among rockeries and flowing water feels like being in a painting.', createdAt: '2026-06-24' },
      { id: 'r2', nickname: '园林迷', nicknameEn: 'Garden Enthusiast', rating: 4, content: '酒店就是一座大园林，到处都是亭台楼阁花木扶疏。园景房推窗就是假山流水，比湖景房便宜性价比高。网球设施也维护得不错。', contentEn: 'The hotel is a large garden itself, with pavilions, towers and abundant greenery everywhere. The garden view room opens to rockeries and flowing water, better value than the lake view room. Tennis facilities are well maintained.', createdAt: '2026-06-19' },
      { id: 'r3', nickname: '度假家庭', nicknameEn: 'Holiday Family', rating: 5, content: '一家人来的，孩子特别喜欢在园林里探险。室外温泉晚上开了就去了，一边泡温泉一边看星星。620的价格含早，很值。', contentEn: 'Came as a family, the kids loved exploring the garden. The outdoor hot spring was open at night, soaked while watching the stars. 620 with breakfast is great value.', createdAt: '2026-06-14' }
    ]
  },
  {
    id: 'hotel-jushi',
    name: '无锡灵山居士林酒店',
    nameEn: 'Lingshan Lay Buddhist Hotel',
    tag: '居士文化酒店',
    tagEn: 'Lay Buddhist Hotel',
    tagClass: 'tag-culture',
    desc: '以居士文化为主题的经济型禅意酒店，清静简朴',
    descEn: 'Economy Zen hotel themed on lay Buddhist culture, simple and tranquil',
    fullDesc: '无锡灵山居士林酒店是一家以佛教居士文化为主题的经济型酒店。酒店装修简朴清雅，以原木和素色为主调，不设电视等娱乐设施，提倡简朴生活。客房虽不豪华但整洁舒适，每间房配有佛经和禅修垫。酒店有公共茶室和打坐室，是虔诚佛教徒和追求简朴生活游客的理想选择。',
    fullDescEn: 'Lingshan Lay Buddhist Hotel focuses on simplicity and Buddhist culture. Decorated with natural wood and plain colors, no TV or entertainment facilities. Each room has sutras and meditation cushions. Features public tea room and meditation hall, ideal for devout Buddhists.',
    locationInfo: '灵山胜境景区北侧步行约10分钟',
    locationInfoEn: 'North of Lingshan Scenic Area, ~10 min walk',
    tips: '无电视等娱乐设施；提供免费早课体验；素斋餐厅口碑好',
    tipsEn: 'No TV/entertainment; free morning chanting; vegetarian restaurant recommended',
    distance: '距灵山胜境约500米',
    distanceEn: '~500m from Lingshan',
    time: '入住14:00 / 退房11:00',
    timeEn: 'Check-in 14:00 / Check-out 11:00',
    price: '¥480起',
    image: '/static/hotel-imgs/hotel-09.jpg',
    features: ['居士文化', '简朴生活', '早课体验', '素斋餐厅'],
    featuresEn: ['Lay Buddhist Culture', 'Simple Living', 'Morning Chanting', 'Vegetarian Dining'],
    rating: 4.4,
    reviews: [
      { id: 'r1', nickname: '修行旅者', nicknameEn: 'Spiritual Traveler', rating: 5, content: '没有电视没有Wi-Fi干扰，反而让我真正静了下来。早上四点半参加早课，听着梵呗诵经，心灵得到了洗涤。这就是我需要的旅行。', contentEn: 'No TV or Wi-Fi interference allowed me to truly calm down. Joined morning chanting at 4:30 AM, listening to Buddhist chants - my soul was purified. This is the kind of travel I need.', createdAt: '2026-06-23' },
      { id: 'r2', nickname: '简朴生活家', nicknameEn: 'Simple Lifer', rating: 4, content: '房间很简朴但很干净，原木家具配上素色布艺，有种禅意美感。佛经和禅修垫是惊喜，晚上打坐了一会儿特别放松。性价比高。', contentEn: 'The room is simple but clean, natural wood furniture with plain fabrics creates a Zen aesthetic. The sutras and meditation cushions were a nice surprise, meditating at night was very relaxing. Good value for money.', createdAt: '2026-06-18' },
      { id: 'r3', nickname: '素斋爱好者', nicknameEn: 'Vegetarian Food Lover', rating: 5, content: '素斋餐厅的菜太好吃了！全是素食但做法精致，比很多荤菜餐厅都好吃。480的价格在灵山附近算很实惠了。适合追求安静的人。', contentEn: 'The vegetarian restaurant food is delicious! All vegetarian but exquisitely prepared, better than many meat restaurants. 480 is quite affordable near Lingshan. Perfect for those seeking peace.', createdAt: '2026-06-13' }
    ]
  },
  {
    id: 'hotel-hujing',
    name: '无锡马山湖景酒店',
    nameEn: 'Mashan Lake View Hotel',
    tag: '经济型酒店',
    tagEn: 'Budget Hotel',
    tagClass: 'tag-experience',
    desc: '经济实惠的湖景酒店，性价比之选',
    descEn: 'Affordable lake view hotel, great value for money',
    fullDesc: '无锡马山湖景酒店是一家经济型酒店，以实惠的价格和不错的湖景为卖点。酒店装修简洁实用，客房干净整洁，部分房间可欣赏太湖景色。虽然没有高端酒店的那些配套，但基本的住宿需求都能满足，是预算有限游客的明智选择。',
    fullDescEn: 'Mashan Lake View Hotel offers affordable accommodation with decent lake views. Rooms are clean and functional. While lacking luxury amenities, it meets basic needs. Ideal choice for budget-conscious travelers.',
    locationInfo: '马山镇中心，距灵山胜境约2.5公里',
    locationInfoEn: 'Mashan Town Center, ~2.5 km from Lingshan',
    tips: '高楼层湖景房视野更好；周边餐饮便利；免费停车',
    tipsEn: 'Higher floors better lake view; dining nearby; free parking',
    distance: '距灵山胜境约2.5公里',
    distanceEn: '~2.5 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥380起',
    image: '/static/hotel-imgs/hotel-10.jpg',
    features: ['经济实惠', '湖景房可选', '免费停车', '周边便利'],
    featuresEn: ['Affordable', 'Lake View Option', 'Free Parking', 'Convenient Location'],
    rating: 4.3,
    reviews: [
      { id: 'r1', nickname: '省钱小能手', nicknameEn: 'Budget Saver', rating: 5, content: '380一晚还要什么自行车！房间干净，有窗有湖景，热水给力。楼下就是餐馆和便利店，吃饭购物都方便。穷游首选。', contentEn: '380 a night - what more could you ask for! Room is clean, has windows with lake view, hot water is great. Restaurants and convenience stores right downstairs, convenient for eating and shopping. First choice for budget travel.', createdAt: '2026-06-22' },
      { id: 'r2', nickname: '实用主义', nicknameEn: 'Pragmatist', rating: 4, content: '没什么花哨的，但该有的都有。空调给力，床还算舒服，卫生间干净。高楼层确实能看到太湖，性价比很高。', contentEn: 'Nothing fancy, but has everything you need. AC is powerful, bed is comfortable enough, bathroom is clean. Higher floors do have Taihu Lake view, great value for money.', createdAt: '2026-06-17' },
      { id: 'r3', nickname: '自驾游客', nicknameEn: 'Self-drive Traveler', rating: 4, content: '免费停车太方便了！离灵山开车十分钟，周边吃饭选择也多。就是隔音一般，走廊有人说话能听到。但380的价格不挑了。', contentEn: 'Free parking is very convenient! 10 minutes drive from Lingshan, lots of dining options nearby. Soundproofing is average though, can hear people talking in the hallway. But for 380, can\'t complain.', createdAt: '2026-06-12' }
    ]
  },
  {
    id: 'hotel-chanxiu',
    name: '无锡灵山禅修中心住宿部',
    nameEn: 'Lingshan Meditation Center',
    tag: '禅修住宿',
    tagEn: 'Meditation Retreat',
    tagClass: 'tag-culture',
    desc: '专业禅修中心的住宿部，深度禅修体验',
    descEn: 'Professional meditation center accommodation, deep meditation experience',
    fullDesc: '无锡灵山禅修中心住宿部是灵山禅修中心附属的住宿设施，专门为参加禅修课程的学员提供住宿。住宿条件为标准间，简朴整洁，每间房配有禅修垫和佛经。中心每日安排早课、坐禅、行禅等禅修活动，住宿费用包含一日三餐素斋。适合想要深度体验禅修生活的游客。',
    fullDescEn: 'Lingshan Meditation Center provides accommodation for meditation course participants. Standard rooms with meditation cushions and sutras. Daily schedule includes morning chanting, seated meditation, and walking meditation. Meals include three vegetarian meals daily. Ideal for deep meditation experience.',
    locationInfo: '灵山胜境景区内禅修中心区域',
    locationInfoEn: 'Meditation Center area within Lingshan Scenic Area',
    tips: '需提前报名禅修课程方可住宿；全程素食；保持止语',
    tipsEn: 'Meditation course registration required; vegetarian only; silence observed',
    distance: '距灵山胜境约1公里',
    distanceEn: '~1 km from Lingshan',
    time: '入住14:00 / 退房10:00',
    timeEn: 'Check-in 14:00 / Check-out 10:00',
    price: '¥360起',
    image: '/static/hotel-imgs/hotel-11.jpg',
    features: ['深度禅修', '全程素食', '早课坐禅', '止语环境'],
    featuresEn: ['Deep Meditation', 'Vegetarian Only', 'Morning Practice', 'Silence Environment'],
    rating: 4.9,
    reviews: [
      { id: 'r1', nickname: '禅修深度控', nicknameEn: 'Deep Meditation Enthusiast', rating: 5, content: '三天的禅修体验改变了我！从坐不下去到能静坐一小时，师父的引导很专业。全程止语刚开始不习惯，后来发现不说话反而更自在。', contentEn: 'Three-day meditation experience changed me! From being unable to sit still to meditating for an hour, the master\'s guidance was professional. The silence was uncomfortable at first, but later I found peace in not speaking.', createdAt: '2026-06-26' },
      { id: 'r2', nickname: '心灵净化者', nicknameEn: 'Soul Purifier', rating: 5, content: '素斋一日三餐都很好吃，简单的食材做出丰富的味道。早课四点半开始，听着晨钟起来打坐，感觉一天被拉长了。360还包三餐太值了。', contentEn: 'The vegetarian meals three times a day are all delicious, simple ingredients with rich flavors. Morning chanting starts at 4:30 AM, waking up to the bell and meditating makes the day feel longer. 360 includes three meals - great value.', createdAt: '2026-06-21' },
      { id: 'r3', nickname: '减压逃离', nicknameEn: 'Stress Relief Escapee', rating: 5, content: '工作压力太大来的，三天不碰手机不说话，只是打坐吃饭散步。走的时候整个人都轻了。推荐给所有需要停下来喘口气的人。', contentEn: 'Came due to work stress, didn\'t touch phone or speak for three days, just meditated, ate and walked. Left feeling lighter. Recommend to anyone who needs to pause and catch their breath.', createdAt: '2026-06-16' }
    ]
  },
  {
    id: 'hotel-nengren',
    name: '无锡太湖能仁寺旁客栈',
    nameEn: 'Nengren Temple Inn',
    tag: '寺庙客栈',
    tagEn: 'Temple Inn',
    tagClass: 'tag-culture',
    desc: '能仁寺旁的清幽客栈，晨钟暮鼓伴眠',
    descEn: 'Serene inn beside Nengren Temple, woken by morning bell and evening drum',
    fullDesc: '无锡太湖能仁寺旁客栈坐落在能仁寺旁边，是一家以佛教文化为背景的小型客栈。客栈只有十间房，装修古朴雅致，以木质结构为主。最大的特色是清晨可以听到能仁寺的晨钟，傍晚有暮鼓相伴，营造出远离尘世的清幽氛围。客栈提供素斋早餐，住客还可免费入寺参观。',
    fullDescEn: 'Nengren Temple Inn is a small Buddhist-themed inn located beside Nengren Temple. With only 10 rooms featuring traditional wooden decor. Woken by the temple\'s morning bell and accompanied by evening drum. Offers vegetarian breakfast and free temple access.',
    locationInfo: '太湖能仁寺旁，距灵山胜境约3公里',
    locationInfoEn: 'Beside Nengren Temple, ~3 km from Lingshan',
    tips: '住客免费入寺参观；素斋早餐含在房费内；仅十间房需提前预订',
    tipsEn: 'Free temple entry for guests; vegetarian breakfast included; only 10 rooms, book in advance',
    distance: '距灵山胜境约3公里',
    distanceEn: '~3 km from Lingshan',
    time: '入住14:00 / 退房11:00',
    timeEn: 'Check-in 14:00 / Check-out 11:00',
    price: '¥420起',
    image: '/static/hotel-imgs/hotel-12.jpg',
    features: ['寺院旁', '晨钟暮鼓', '免费入寺', '素斋早餐'],
    featuresEn: ['Near Temple', 'Morning Bell', 'Free Temple Visit', 'Vegetarian Breakfast'],
    rating: 4.5,
    reviews: [
      { id: 'r1', nickname: '晨钟爱好者', nicknameEn: 'Morning Bell Lover', rating: 5, content: '清晨被寺院的钟声唤醒，比任何闹钟都温柔。推开窗就能看到古寺飞檐，空气里带着檀香。素斋早餐简单但好吃，这种体验太难得了。', contentEn: 'Woken by the temple bell in the morning - gentler than any alarm clock. Opening the window reveals the ancient temple eaves, the air carries sandalwood fragrance. Vegetarian breakfast is simple but delicious, this experience is truly rare.', createdAt: '2026-06-25' },
      { id: 'r2', nickname: '古寺探寻', nicknameEn: 'Ancient Temple Explorer', rating: 5, content: '住客可以免费参观能仁寺，寺里的师父还带我们看了平常不开放的后院。客栈只有十间房很安静，木结构建筑有古意。420超值。', contentEn: 'Guests can visit Nengren Temple for free, the monks even showed us the normally closed backyard. Only 10 rooms, very quiet, the wooden structure has ancient charm. 420 is great value.', createdAt: '2026-06-20' },
      { id: 'r3', nickname: '慢游旅人', nicknameEn: 'Slow Traveler', rating: 4, content: '傍晚在寺旁散步，听着暮鼓声声，感觉时间都慢了下来。客栈装修古朴很有味道。就是离灵山有点距离需要开车，不过这份清幽值得。', contentEn: 'Walking beside the temple in the evening, listening to the evening drum - time seems to slow down. The inn has a rustic charm. A bit far from Lingshan, need to drive, but the serenity is worth it.', createdAt: '2026-06-15' }
    ]
  },
  {
    id: 'hotel-qinzi',
    name: '无锡灵山亲子田园酒店',
    nameEn: 'Lingshan Family Farm Hotel',
    tag: '亲子度假酒店',
    tagEn: 'Family Resort Hotel',
    tagClass: 'tag-experience',
    desc: '专为亲子家庭设计的田园主题酒店，孩子天堂',
    descEn: 'Family-friendly farm-themed hotel, paradise for kids',
    fullDesc: '无锡灵山亲子田园酒店是一家专为亲子家庭设计的主题酒店。酒店拥有亲子主题房、家庭套房等多种房型，房间内配有儿童床、儿童卫浴和玩具角。酒店设有室内外儿童乐园、萌宠喂养区、手工DIY教室等亲子设施。周边还有大片田园可供采摘漫步，是带娃出游的完美选择。',
    fullDescEn: 'Lingshan Family Farm Hotel is specially designed for families. Offers family rooms and suites with kids beds, child-friendly bathrooms and play corners. Features indoor/outdoor kids park, petting zoo, and DIY craft studio. Surrounded by farmland for picking and walking.',
    locationInfo: '灵山胜境景区南侧约2公里',
    locationInfoEn: 'South of Lingshan Scenic Area, ~2 km',
    tips: '亲子套餐含乐园门票；萌宠喂养区免费开放；婴儿床免费提供',
    tipsEn: 'Family package includes park tickets; petting zoo free; baby cot free',
    distance: '距灵山胜境约2公里',
    distanceEn: '~2 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥580起',
    image: '/static/hotel-imgs/hotel-13.jpg',
    features: ['亲子主题', '儿童乐园', '萌宠喂养', '田园采摘'],
    featuresEn: ['Family Theme', 'Kids Park', 'Petting Zoo', 'Farm Picking'],
    rating: 4.6,
    reviews: [
      { id: 'r1', nickname: '带娃达人', nicknameEn: 'Parenting Expert', rating: 5, content: '孩子的天堂！室内外乐园玩了一整天还不够，萌宠喂养区有小兔子小羊，孩子开心得不想走。房间有儿童床和玩具角，设计太贴心了。', contentEn: 'A paradise for kids! Played in the indoor/outdoor playground all day and still wanted more. The petting zoo has bunnies and lambs, kids didn\'t want to leave. The room has kids beds and play corner - very thoughtful design.', createdAt: '2026-06-24' },
      { id: 'r2', nickname: '二胎妈妈', nicknameEn: 'Mom of Two', rating: 5, content: '家庭套房很实用，大人小孩都有独立空间。婴儿床免费提供太方便了！DIY教室做了陶艺，孩子带回了一件作品。580含乐园门票超值。', contentEn: 'The family suite is very practical, both adults and kids have their own space. Free baby cot is very convenient! Did pottery in the DIY classroom, kids brought home their creations. 580 with park tickets is great value.', createdAt: '2026-06-19' },
      { id: 'r3', nickname: '田园亲子游', nicknameEn: 'Farm Family Traveler', rating: 4, content: '田园采摘孩子很喜欢，摘了草莓和番茄。酒店设施对小朋友很友好，儿童卫浴的高度刚好。就是周末人多需要排队玩设施。', contentEn: 'The kids loved farm picking, picked strawberries and tomatoes. Hotel facilities are very kid-friendly, the children\'s bathroom height is perfect. Just busy on weekends, need to queue for facilities.', createdAt: '2026-06-14' }
    ]
  },
  {
    id: 'hotel-yujia',
    name: '无锡太湖渔家客栈',
    nameEn: 'Taihu Fisherman Inn',
    tag: '渔家客栈',
    tagEn: 'Fisherman Inn',
    tagClass: 'tag-experience',
    desc: '太湖畔的渔家风格客栈，质朴水乡生活体验',
    descEn: 'Taihu Lake fisherman-style inn, authentic water village living experience',
    fullDesc: '无锡太湖渔家客栈是一家以太湖渔家文化为主题的特色客栈。客栈以渔船和渔网为装饰元素，营造出质朴的渔村氛围。客房以不同鱼类主题命名装饰，简朴但有特色。客栈餐厅主打太湖渔家菜，食材由店主每日清晨从太湖渔民手中采购。适合喜欢特色住宿体验的游客。',
    fullDescEn: 'Taihu Fisherman Inn is a themed accommodation showcasing Taihu Lake fisherman culture. Decorated with fishing boats and nets, creating an authentic fishing village atmosphere. Rooms are themed after different fish species. Restaurant serves fresh Taihu seafood, sourced daily from local fishermen.',
    locationInfo: '太湖渔村区域，距灵山胜境约3.5公里',
    locationInfoEn: 'Taihu Fishing Village Area, ~3.5 km from Lingshan',
    tips: '可体验渔船出湖（需提前预约）；渔家菜餐厅含在房费优惠中',
    tipsEn: 'Fishing boat experience available (advance booking); restaurant discount included',
    distance: '距灵山胜境约3.5公里',
    distanceEn: '~3.5 km from Lingshan',
    time: '入住14:00 / 退房12:00',
    timeEn: 'Check-in 14:00 / Check-out 12:00',
    price: '¥350起',
    image: '/static/hotel-imgs/hotel-14.jpg',
    features: ['渔家主题', '太湖渔家菜', '渔船体验', '水乡氛围'],
    featuresEn: ['Fisherman Theme', 'Taihu Seafood', 'Fishing Boat', 'Water Village'],
    rating: 4.4,
    reviews: [
      { id: 'r1', nickname: '渔村体验控', nicknameEn: 'Fishing Village Lover', rating: 5, content: '房间用渔网和船桨装饰，很有渔村味道！早上跟着老板出了湖，看他收网捞鱼，太有意思了。渔家菜的清蒸白鱼是湖里现捞的。', contentEn: 'The room is decorated with fishing nets and oars, very authentic fishing village style! Went out on the lake with the owner in the morning, watched him pull in the nets - fascinating. The steamed whitefish in the fisherman\'s meal is freshly caught from the lake.', createdAt: '2026-06-23' },
      { id: 'r2', nickname: '特色住宿党', nicknameEn: 'Unique Stay Seeker', rating: 4, content: '客栈不大但处处有渔家元素，每个房间以不同鱼命名，我住的是"银鱼房"。餐厅的鱼丸汤太鲜了，手打的鱼丸弹牙。350值了。', contentEn: 'The inn is small but full of fisherman elements, each room named after a different fish - I stayed in "Silver Fish Room". The fish ball soup at the restaurant is extremely fresh, hand-made fish balls are bouncy. 350 is worth it.', createdAt: '2026-06-18' },
      { id: 'r3', nickname: '水乡慢游', nicknameEn: 'Water Village Wanderer', rating: 4, content: '太湖边上小渔村的感觉，晚上在湖边散步看渔船灯火，很治愈。渔家菜便宜好吃，四个人才吃了120。就是设施简朴，追求豪华的别来。', contentEn: 'Feels like a small fishing village on Taihu Lake. Walking by the lake at night watching fishing boat lights is very healing. Fisherman food is cheap and delicious - four people ate for only 120. Facilities are simple though, not for luxury seekers.', createdAt: '2026-06-13' }
    ]
  },
  {
    id: 'hotel-minsu',
    name: '无锡灵山精品民宿聚落',
    nameEn: 'Lingshan Boutique Homestay Cluster',
    tag: '精品民宿',
    tagEn: 'Boutique Homestay',
    tagClass: 'tag-culture',
    desc: '多栋精品民宿组成的聚落，每栋都是独特的设计作品',
    descEn: 'Cluster of boutique homestays, each a unique design masterpiece',
    fullDesc: '无锡灵山精品民宿聚落由多栋独立设计民宿组成，每栋民宿由不同设计师操刀，风格各异但都融入了灵山本地文化元素。有日式枯山水主题、中式庭院主题、现代极简主题等多种风格可选。每栋民宿配备独立庭院和厨房，可自炊。聚落内还设有公共茶室、露天泳池和星空观景台。',
    fullDescEn: 'Lingshan Boutique Homestay Cluster consists of multiple independently designed homestays, each crafted by different designers with Lingshan cultural elements. Styles include Japanese karesansui, Chinese courtyard, and modern minimalist themes. Each homestay has private courtyard and kitchen for self-catering. Features shared tea room, outdoor pool, and star-gazing platform.',
    locationInfo: '灵山胜境景区东侧民宿聚落区',
    locationInfoEn: 'Homestay cluster east of Lingshan Scenic Area',
    tips: '每栋风格不同建议提前查看选房；含管家服务；可自炊',
    tipsEn: 'Check room styles before booking; butler service included; self-catering allowed',
    distance: '距灵山胜境约1.2公里',
    distanceEn: '~1.2 km from Lingshan',
    time: '入住15:00 / 退房11:00',
    timeEn: 'Check-in 15:00 / Check-out 11:00',
    price: '¥680起',
    image: '/static/hotel-imgs/hotel-15.jpg',
    features: ['独立设计', '风格各异', '独立庭院', '星空观景'],
    featuresEn: ['Independent Design', 'Varied Styles', 'Private Courtyard', 'Star Gazing'],
    rating: 4.7,
    reviews: [
      { id: 'r1', nickname: '设计爱好者', nicknameEn: 'Design Lover', rating: 5, content: '选了日式枯山水主题的民宿，太美了！庭院里的枯山水造景很精致，房间设计也很有格调。晚上在星空观景台看银河，绝了。', contentEn: 'Chose the Japanese karesansui themed homestay - beautiful! The karesansui garden is exquisitely crafted, the room design is very stylish. Watching the Milky Way from the star-gazing platform at night was incredible.', createdAt: '2026-06-25' },
      { id: 'r2', nickname: '私密度假', nicknameEn: 'Private Vacationer', rating: 5, content: '每栋都是独立的，有私人庭院和厨房，隐私性极好。管家服务很贴心但不打扰。自己在厨房做了顿太湖买的鲜鱼晚餐，太惬意了。', contentEn: 'Each building is independent with private courtyard and kitchen - excellent privacy. Butler service is attentive but unobtrusive. Cooked a fresh fish dinner from Taihu in the kitchen - very relaxing.', createdAt: '2026-06-20' },
      { id: 'r3', nickname: '闺蜜出游', nicknameEn: 'Girlfriends Traveler', rating: 4, content: '选了中式庭院主题，拍照太好看了！在庭院里喝茶聊天，公共茶室也很雅致。就是价格偏高但设计和体验确实好，偶尔奢侈一把。', contentEn: 'Chose the Chinese courtyard theme - great for photos! Drank tea and chatted in the courtyard, the shared tea room is also elegant. Price is high but the design and experience are worth it, an occasional splurge.', createdAt: '2026-06-15' }
    ]
  }
]

export function getHotelById(id: string): HotelShop | undefined {
  return hotels.find(h => h.id === id)
}

export function hotelImage(shop: HotelShop): string {
  return shop.image
}

export function hotelGallery(shop: HotelShop): string[] {
  return [shop.image, shop.image, shop.image]
}
