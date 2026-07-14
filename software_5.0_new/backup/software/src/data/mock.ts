import type { KnowledgeItem, AvatarConfig, TourRoute, DashboardData, VisitorReport } from '@/types'

export const mockKnowledge: KnowledgeItem[] = [
  {
    id: 'ls_1',
    title: '灵山胜境历史背景',
    content: '灵山胜境位于江苏省无锡市太湖国家旅游度假区，始建于1997年，是一座集佛教文化、自然景观与人文体验于一体的国家AAAAA级旅游景区。景区以88米高的灵山大佛为核心，背靠秦履峰，前临太湖，风景秀丽，气势恢宏。据史料记载，唐代玄奘法师曾在此讲经说法，留下"小灵山"美名；北宋年间，祥符禅寺正式得名，传承千年。1994年，灵山大佛建设工程启动，历时三年竣工，成为世界最高的青铜释迦牟尼佛像。',
    category: '景区概况',
    tags: ['历史', '概况', '灵山', '佛教', 'AAAAA'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'ls_2',
    title: '灵山大佛',
    content: '灵山大佛是世界上最高的佛铜像，高达88米（主体高度79米+莲花瓣高度9米），含台基总高101.5米，耗铜量达725吨，由2000余块铸铜面板拼接而成。大佛右手结"施无畏印"代表去除痛苦，左手结"施与愿印"代表给予快乐，整体形态庄严圆满，气势恢宏。大佛所在位置为唐玄奘命名的小灵山，故名"灵山大佛"。游客可乘坐电梯登上佛脚平台，近距离瞻仰大佛，俯瞰整个景区及太湖风光。',
    category: '景点介绍',
    tags: ['大佛', '灵山大佛', '铜像', '佛教', '地标'],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  },
  {
    id: 'ls_3',
    title: '灵山梵宫',
    content: '灵山梵宫建筑面积达72000平方米，最高处66.5米，整体呈"莲花环抱"之势，拥有五座错落分布的莲花圣塔。建筑外立面融合石材雕刻与玻璃幕墙，内部汇集东阳木雕、敦煌壁画、琉璃等非遗艺术瑰宝，被誉为"东方卢浮宫"。梵宫是第二届、第四界世界佛教论坛的举办地，宫内的《灵山吉祥颂》大型演出以先进的声光电技术呈现佛陀成道故事，每场时长约20分钟。',
    category: '景点介绍',
    tags: ['梵宫', '建筑', '艺术', '佛教', '东方卢浮宫'],
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z'
  },
  {
    id: 'ls_4',
    title: '祥符禅寺',
    content: '祥符禅寺始建于唐贞观年间，由玄奘法师弟子窥基大师开坛讲经，北宋年间正式更名为"祥符禅寺"，是江南地区重要的千年禅宗祖庭。寺占地约30亩，采用仿唐重檐歇山式建筑风格，红墙黛瓦、飞檐翘角。寺内有六角井、八角井、白莲池、千年古银杏等珍贵历史遗迹，钟楼内悬挂重12.8吨的"祥符禅钟"。每年香火旺盛，吸引大量信众前来礼佛祈福。',
    category: '文化历史',
    tags: ['祥符禅寺', '寺庙', '历史', '禅宗', '唐代'],
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z'
  },
  {
    id: 'ls_5',
    title: '九龙灌浴',
    content: '九龙灌浴是灵山胜境最具标志性的动态景观，总高27.2米，核心为鎏金太子佛高7.2米、重12吨，整体耗铜量达180吨。依据《本行经》中释迦牟尼诞生传说打造，生动再现"花开见佛，九龙沐浴"祥瑞景象。平日演出时间：10:00、11:30、13:30、15:00；每场时长约15分钟。表演时莲花缓缓绽放，太子佛升起并自转，九龙同时喷水，场面震撼。表演结束后游客可接取龙头流出的"圣水"祈福。',
    category: '景点介绍',
    tags: ['九龙灌浴', '表演', '喷泉', '佛陀', '动态景观'],
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z'
  },
  {
    id: 'ls_6',
    title: '五印坛城',
    content: '五印坛城是一座藏传佛教风格的建筑，融合了藏族传统建筑艺术与佛教文化。坛城外观为藏式白墙金顶，庄严精美，内部展示丰富的藏传佛教文化艺术品，包括精美的唐卡、壁画、法器、唐卡等。游客可在此体验藏传佛教的独特魅力，感受藏族人民的虔诚与智慧。',
    category: '景点介绍',
    tags: ['五印坛城', '藏传佛教', '建筑', '文化', '唐卡'],
    createdAt: '2024-01-06T00:00:00Z',
    updatedAt: '2024-01-06T00:00:00Z'
  },
  {
    id: 'ls_7',
    title: '佛教文化博览馆',
    content: '佛教文化博览馆位于灵山大佛座基内，共三层结构，总建筑面积10000平方米。一层展示五方五佛与中国佛教四大名山文化；二层介绍世界佛教发展史；三层为万佛殿，供奉9999尊小佛像，与室外灵山大佛合称"万佛朝宗"。馆内配备智能导览屏、沉浸式投影等现代化展陈设施。开放时间：8:00-17:00（冬季16:30），免费参观。',
    category: '景点介绍',
    tags: ['博览馆', '佛教文化', '博物馆', '万佛殿', '五方五佛'],
    createdAt: '2024-01-07T00:00:00Z',
    updatedAt: '2024-01-07T00:00:00Z'
  },
  {
    id: 'ls_8',
    title: '灵山大照壁',
    content: '灵山大照壁长39.8米、高7米，采用优质青石雕刻而成，被誉为"华夏第一壁"。正面鎏金"灵山胜境"四字由赵朴初先生亲笔题写，背面刻有《小灵山》诗，将无锡小灵山与印度灵鹫山相媲美。照壁两面与太湖碧波交相辉映，构成"湖光山色共一楼"壮美景观，是景区标志性打卡点。',
    category: '景点介绍',
    tags: ['照壁', '赵朴初', '书法', '华夏第一壁', '打卡'],
    createdAt: '2024-01-08T00:00:00Z',
    updatedAt: '2024-01-08T00:00:00Z'
  },
  {
    id: 'ls_9',
    title: '五明桥',
    content: '五明桥位于大照壁北侧，横跨香水海，5座石拱桥并列排布，桥身采用汉白玉雕刻而成，桥面与桥栏均刻有精美佛教图案。五明代表佛教五种核心智慧：声明（语言学）、因明（逻辑学）、内明（哲学）、医方明（医学）、工巧明（工艺学），寓意过桥即能开启智慧、走向觉悟。石桥倒映在香水海碧波中，如五条洁白玉带横卧水面，意境悠远。全天开放，免费通行。',
    category: '景点介绍',
    tags: ['五明桥', '智慧', '汉白玉', '佛教', '香水海'],
    createdAt: '2024-01-09T00:00:00Z',
    updatedAt: '2024-01-09T00:00:00Z'
  },
  {
    id: 'ls_10',
    title: '佛足坛',
    content: '佛足坛位于五明桥北侧，巨型佛足印一对左右对称摆放，每只足印长1.2米、宽0.6米，采用整块青铜铸造而成。佛足心刻有千辐轮相、宝瓶鱼纹等32种吉祥图案，象征"佛足所至，佛光普照"。相传佛祖涅槃前特意留下双足印并嘱托弟子："佛足所至，即为佛地"，这对佛足因此被称为"两足尊"，是佛教文化中福德与智慧圆满的象征。全天开放，游客可瞻仰祈福。',
    category: '景点介绍',
    tags: ['佛足坛', '祈福', '青铜', '佛教', '朝圣'],
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z'
  },
  {
    id: 'ls_11',
    title: '五智门',
    content: '五智门高16.8米、宽35米，为五门六柱石牌坊造型，采用优质汉白玉雕刻而成。五门象征五方五佛，代表佛教普度众生；六柱代表"六度波罗蜜"（布施、持戒、忍辱、精进、禅定、般若），门柱刻有对应佛教经文。穿过五智门便正式从"凡俗之境"踏入"禅意圣地"，是进入核心景区的标志，与灵山大佛在同一中轴线上。全天开放，夜间灯光点缀更具氛围。',
    category: '景点介绍',
    tags: ['五智门', '牌坊', '六度', '汉白玉', '中轴线'],
    createdAt: '2024-01-11T00:00:00Z',
    updatedAt: '2024-01-11T00:00:00Z'
  },
  {
    id: 'ls_12',
    title: '菩提大道',
    content: '菩提大道长约250米、宽约10米，两侧对称种植近百棵从印度引进的正宗菩提树，形成天然禅意拱廊。路面采用防滑耐磨特殊材料铺设，四季常绿。以菩提树为核心景观载体，象征佛陀在菩提树下悟道成佛的艰辛历程，营造清净悠远禅境。微风拂过，菩提叶沙沙作响，宛如佛音萦绕。漫步其间可忘却尘世喧嚣，身心归于清净。春季菩提花开时景致绝美，是景区最具禅意的步道之一。',
    category: '景点介绍',
    tags: ['菩提大道', '菩提树', '禅意', '步道', '印度'],
    createdAt: '2024-01-12T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z'
  },
  {
    id: 'ls_13',
    title: '降魔浮雕',
    content: '降魔浮雕长26米、高4.6米，采用整块优质花岗岩雕刻而成，立体感极强。生动再现佛陀在菩提树下静坐修行，战胜魔王波旬各种诱惑与威胁，最终觉悟成佛的艰辛历程。浮雕采用高浮雕与浅浮雕相结合手法，佛陀端坐其中神情坚定，目光如炬；两侧魔王波旬率魔女魔兵以美色、财富、武力诱惑威胁。人物表情、动作、服饰栩栩如生，是佛教艺术珍品。全天开放，适合亲子、文化爱好者细细品味。',
    category: '景点介绍',
    tags: ['降魔浮雕', '佛教故事', '艺术', '花岗岩', '八相成道'],
    createdAt: '2024-01-13T00:00:00Z',
    updatedAt: '2024-01-13T00:00:00Z'
  },
  {
    id: 'ls_14',
    title: '阿育王柱',
    content: '阿育王柱通高16.9米、直径1.8米、总重量180吨，采用整块优质花岗岩一次性雕刻而成。柱头雕刻四头朝向不同方向的狮子，象征佛法向世界各地传播。柱身刻有"阿育王柱"四字及相关梵文经文。阿育王是古印度历史上最著名的弘扬佛法的国王，统一印度后笃信佛教，将佛法传播至世界各地。柱子与灵山大佛、五智门形成呼应，构成景区中轴线核心景观序列。全天开放，是佛教文化传播的重要标志。',
    category: '景点介绍',
    tags: ['阿育王柱', '佛教传播', '石柱', '地标', '中轴线'],
    createdAt: '2024-01-14T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z'
  },
  {
    id: 'ls_15',
    title: '百子戏弥勒',
    content: '百子戏弥勒青铜群雕高3米、宽7.8米、总重量9吨，弥勒佛呈卧姿袒胸露腹、笑容满面，身上塑有百名嬉戏孩童，形态各异、生动活泼。弥勒佛是佛教中的未来佛，象征"欢喜、包容、慈悲"；百子寓意"多子多福、家庭和睦"。群雕完美融合佛教"慈悲喜舍"与民间祈福愿望，是景区最具亲和力的景观。游客可触摸弥勒佛肚皮祈福，寓意"摸弥勒肚皮，享一生福气"。全天开放，亲子拍照热门点位。',
    category: '景点介绍',
    tags: ['百子戏弥勒', '青铜', '民俗', '亲子', '祈福'],
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 'nh_1',
    title: '拈花湾禅意小镇概况',
    content: '拈花湾禅意小镇位于灵山胜境西侧，是灵山集团历时五年精心打造的禅意特色小镇，于2015年开放营业。小镇以"禅"为核心元素，集禅意文化体验、休闲度假、旅游观光于一体，主要包含拈花广场、香月花街、梵天花海、拈花堂、五灯湖、鹿鸣谷等核心景点。小镇建筑融合中式禅意与日式町屋特色，白墙黛瓦、木质门窗，被评为国家AAAAA级旅游景区。',
    category: '景区概况',
    tags: ['拈花湾', '禅意', '小镇', 'AAAAA', '休闲'],
    createdAt: '2024-01-16T00:00:00Z',
    updatedAt: '2024-01-16T00:00:00Z'
  },
  {
    id: 'nh_2',
    title: '拈花广场',
    content: '拈花广场是拈花湾小镇的主入口广场，面积约5000平方米，以"拈花"命名源自佛教"拈花悟禅"典故。广场中央设有标志性"拈花塔"，为唐风木质结构楼阁式塔，高十三丈，五层六角，层层飞檐翘角，顶层悬挂鎏金塔刹，白天古朴庄重，夜间灯光秀流光溢彩。广场周边配套游客中心、票务中心、餐饮商业等设施，是小镇的综合服务与文化展示核心区域。全天开放，夜间灯光秀尤为壮观。',
    category: '景点介绍',
    tags: ['拈花广场', '拈花塔', '禅意', '灯光秀', '地标'],
    createdAt: '2024-01-17T00:00:00Z',
    updatedAt: '2024-01-17T00:00:00Z'
  },
  {
    id: 'nh_3',
    title: '梵天花海',
    content: '梵天花海占地约100亩，位于小镇西侧缓坡地带，是小镇最具自然风光的景点。以"花海禅境"为核心设计理念，种植格桑花、硫华菊、波斯菊、薰衣草、马鞭草等十余种花卉，根据季节更替实现"四季有花、处处是景"。花海间设置木质观景平台、蜿蜒步道、禅意雕塑等设施，游客可漫步花海、拍摄美景，感受"花伴禅心"的意境。开放时间：9:00-21:30（冬季20:30）。免费开放。',
    category: '景点介绍',
    tags: ['梵天花海', '花海', '自然', '花卉', '禅意'],
    createdAt: '2024-01-18T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z'
  },
  {
    id: 'nh_4',
    title: '香月花街',
    content: '香月花街是拈花湾小镇的灵魂街巷，北接拈花广场，南连五灯湖，全长约800米、宽8米，地面铺设青石板，两侧建筑为中式禅意风格。街内汇聚50余家特色商铺，经营佛珠、香薰、禅服、茶道、花艺等禅意文创产品，以及素面、禅茶等特色餐饮。拒绝过度商业化，每一家商铺都是禅意生活的呈现。夜间188盏古风灯笼点亮，氛围感十足。开放时间：9:00-21:30（冬季20:30）。',
    category: '景点介绍',
    tags: ['香月花街', '商业街', '禅意', '文创', '美食'],
    createdAt: '2024-01-19T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z'
  },
  {
    id: 'nh_5',
    title: '拈花堂',
    content: '拈花堂是拈花湾小镇的"静心之地"，隐藏在一片翠竹、松柏之中，环境清幽。占地约1200平方米，为中式禅堂建筑，白墙黛瓦、朱红门窗，装修简洁大气。堂内设禅坐区、抄经区、禅茶区，提供免费禅坐冥想、抄经、禅茶品鉴等体验服务。禅意讲座每日10:30、15:30各一场。游客可在喧嚣中寻得内心宁静，感悟"心无杂念、回归本真"的禅理。开放时间：9:30-19:00（冬季18:00）。免费参与。',
    category: '景点介绍',
    tags: ['拈花堂', '禅修', '抄经', '禅茶', '冥想'],
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z'
  },
  {
    id: 'nh_6',
    title: '五灯湖',
    content: '五灯湖位于小镇南侧，香月花街南端，是小镇内最大的水景景观区，湖面面积约5000平方米。湖面设有木质栈道、景观桥、六角湖心亭，四周种植垂柳、翠竹、荷花。湖中央设大型灯光投影装置，是夜间《禅行》灯光秀的核心举办场地。夜间灯光秀每日19:00、20:00各一场，每场约30分钟，水雾装置同步开启。五灯象征"五智"，湖水象征"清净本心"，传递"心似湖水，澄澈无染"的禅理。免费开放。',
    category: '景点介绍',
    tags: ['五灯湖', '水景', '灯光秀', '禅行', '夜间'],
    createdAt: '2024-01-21T00:00:00Z',
    updatedAt: '2024-01-21T00:00:00Z'
  },
  {
    id: 'nh_7',
    title: '鹿鸣谷',
    content: '鹿鸣谷位于小镇西侧、梵天花海北侧，地处山林之间，是小镇最静谧的自然景观区。占地约20000平方米，植被覆盖率90%以上，种植香樟、松柏、翠竹等绿植，空气清新。谷内设木质步道总长约1.5公里，有多处休憩亭。设有"鹿鸣禅茶"体验区，游客可品禅茶、听流水、享禅意。春季可赏野花，夏季可避暑纳凉，秋季可观落叶，冬季可品雪景，是亲近自然、放松身心的绝佳去处。开放时间：9:00-21:30。',
    category: '景点介绍',
    tags: ['鹿鸣谷', '自然', '山林', '禅茶', '生态'],
    createdAt: '2024-01-22T00:00:00Z',
    updatedAt: '2024-01-22T00:00:00Z'
  },
  {
    id: 'ls_16',
    title: '开放时间与门票',
    content: '灵山胜境开放时间：7:30-17:30（冬季17:00）。门票价格：成人票210元/人，学生票105元/人，1.4米以下儿童免费，60-69岁老人半价，70岁以上免费。网上提前购票可享优惠价195元/人。拈花湾禅意小镇开放时间：9:00-21:30（冬季20:30），门票包含在灵山胜境联票内。详细票价及优惠政策请以景区官方公告为准。',
    category: '服务信息',
    tags: ['时间', '开放', '门票', '价格', '优惠'],
    createdAt: '2024-01-23T00:00:00Z',
    updatedAt: '2024-01-23T00:00:00Z'
  },
  {
    id: 'ls_17',
    title: '交通指南',
    content: '灵山胜境位于无锡市滨湖区太湖水度假区（详细地址：无锡市滨湖区灵山路1号），距无锡市区约20公里。公交：乘坐88路、89路公交可直达景区门口。自驾：导航搜索"灵山胜境停车场"，景区设有大型停车场，收费标准为小车15元/次。地铁+公交：乘坐无锡地铁2号线至梅园站，换乘88路或89路公交。出租车：无锡市区打车约50-70元。',
    category: '服务信息',
    tags: ['交通', '公交', '自驾', '停车', '地铁'],
    createdAt: '2024-01-24T00:00:00Z',
    updatedAt: '2024-01-24T00:00:00Z'
  },
  {
    id: 'ls_18',
    title: '灵山素斋',
    content: '灵山素斋是景区的特色餐饮，以素食为主，菜品精致美味，采用新鲜食材制作。景区内有多家素斋馆可供选择，包括灵山蔬食堂、梵宫素斋馆等，可同时容纳数千人用餐。素斋不仅适合佛教信徒，也受到广大游客喜爱。建议提前预订或错开高峰时段用餐。人均消费约50-100元。',
    category: '服务信息',
    tags: ['餐饮', '素斋', '美食', '特色'],
    createdAt: '2024-01-25T00:00:00Z',
    updatedAt: '2024-01-25T00:00:00Z'
  }
]

export const mockAvatars: AvatarConfig[] = [
  {
    id: '1',
    name: '古风导游',
    avatarUrl: '/static/avatars/avatar1.png',
    voiceType: 'female-gentle',
    clothing: 'traditional',
    expression: 'smile',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: '现代导游',
    avatarUrl: '/static/avatars/avatar2.png',
    voiceType: 'female-energetic',
    clothing: 'modern',
    expression: 'happy',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  },
  {
    id: '3',
    name: '亲切向导',
    avatarUrl: '/static/avatars/avatar3.png',
    voiceType: 'male-friendly',
    clothing: 'casual',
    expression: 'friendly',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z'
  }
]

export const mockRoutes: TourRoute[] = [
  {
    id: 'route_1',
    name: '经典朝圣之旅',
    description: '从检票口出发，经菩提大道、九龙灌浴、祥符禅寺，最终抵达灵山大佛，涵盖景区核心景观',
    duration: 230,
    distance: 3.8,
    difficulty: 'medium',
    suitableFor: ['初次来访', '佛教信徒', '一日游'],
    spots: [
      { id: 'futan', name: '梵足坛', description: '瞻仰佛祖真身脚印，32种吉祥图案祈福', imageUrl: '', duration: 15, order: 1 },
      { id: 'puti-dadao', name: '菩提大道', description: '漫步印度菩提树林，感受禅意清幽', imageUrl: '', duration: 10, order: 2 },
      { id: 'jiulong', name: '九龙灌浴', description: '观看"花开见佛"震撼动态表演', imageUrl: '', duration: 25, order: 3 },
      { id: 'baizi', name: '百子戏弥勒', description: '触摸弥勒佛肚皮祈福，亲子拍照热点', imageUrl: '', duration: 15, order: 4 },
      { id: 'xiangfu', name: '祥符禅寺', description: '千年古刹，聆听祥符禅钟', imageUrl: '', duration: 35, order: 5 },
      { id: 'xingtan', name: '杏坛广场', description: '大佛脚下广场，登高瞻仰最佳位置', imageUrl: '', duration: 15, order: 6 },
      { id: 'buddha', name: '灵山大佛', description: '世界最高青铜佛像，抱佛脚祈福', imageUrl: '', duration: 50, order: 7 },
      { id: 'fangong', name: '灵山梵宫', description: '东方卢浮宫，非遗艺术瑰宝', imageUrl: '', duration: 40, order: 8 },
      { id: 'scenic-exit', name: '景区出口', description: '游览结束，前往景区出口离园', imageUrl: '', duration: 5, order: 9 }
    ]
  },
  {
    id: 'route_2',
    name: '全景深度游',
    description: '完整覆盖灵山胜境所有主要景点，畅游坛城、梵宫、大佛等核心区，适合全天游玩',
    duration: 360,
    distance: 5.2,
    difficulty: 'medium',
    suitableFor: ['深度游客', '文化爱好者', '摄影打卡'],
    spots: [
      { id: 'futan', name: '梵足坛', description: '祈福朝圣第一站', imageUrl: '', duration: 15, order: 1 },
      { id: 'puti-dadao', name: '菩提大道', description: '菩提树下禅意漫步', imageUrl: '', duration: 10, order: 2 },
      { id: 'jiulong', name: '九龙灌浴', description: '九龙喷水，花开见佛', imageUrl: '', duration: 25, order: 3 },
      { id: 'wuyin', name: '五印坛城', description: '藏式佛教艺术殿堂，唐卡壁画', imageUrl: '', duration: 30, order: 4 },
      { id: 'fangong', name: '灵山梵宫', description: '世界佛教论坛会址，金碧辉煌', imageUrl: '', duration: 45, order: 5 },
      { id: 'manfeilong', name: '曼飞龙塔', description: '登塔远眺，太湖风光尽收眼底', imageUrl: '', duration: 20, order: 6 },
      { id: 'sushi', name: '蔬食馆', description: '品尝灵山素斋，特色素面', imageUrl: '', duration: 30, order: 7 },
      { id: 'baizi', name: '百子戏弥勒', description: '欢乐祈福，亲子互动', imageUrl: '', duration: 15, order: 8 },
      { id: 'xiangfu', name: '祥符禅寺', description: '千年禅宗祖庭，礼佛祈福', imageUrl: '', duration: 35, order: 9 },
      { id: 'palm', name: '灵山佛手', description: '天下第一掌，触摸祈福', imageUrl: '', duration: 15, order: 10 },
      { id: 'xingtan', name: '杏坛广场', description: '大佛脚下，仰望庄严圣像', imageUrl: '', duration: 15, order: 11 },
      { id: 'buddha', name: '灵山大佛', description: '88米青铜大佛，俯瞰太湖', imageUrl: '', duration: 50, order: 12 },
      { id: 'scenic-exit', name: '景区出口', description: '游览结束，前往景区出口离园', imageUrl: '', duration: 5, order: 13 }
    ]
  },
  {
    id: 'route_3',
    name: '休闲半日游',
    description: '精华景点串联，时间友好的半日行程，适合带老人小孩的轻松游览',
    duration: 150,
    distance: 2.4,
    difficulty: 'easy',
    suitableFor: ['家庭出游', '老人小孩', '时间有限'],
    spots: [
      { id: 'puti-dadao', name: '菩提大道', description: '菩提树荫下悠闲漫步', imageUrl: '', duration: 10, order: 1 },
      { id: 'jiulong', name: '九龙灌浴', description: '必看动态景观表演', imageUrl: '', duration: 25, order: 2 },
      { id: 'wuyin', name: '五印坛城', description: '藏传佛教文化体验', imageUrl: '', duration: 30, order: 3 },
      { id: 'fangong', name: '灵山梵宫', description: '东方卢浮宫艺术之旅', imageUrl: '', duration: 45, order: 4 },
      { id: 'sushi', name: '蔬食馆', description: '灵山素面，禅意午餐', imageUrl: '', duration: 30, order: 5 },
      { id: 'scenic-exit', name: '景区出口', description: '游览结束，前往景区出口离园', imageUrl: '', duration: 5, order: 6 }
    ]
  },
  {
    id: 'route_4',
    name: '礼佛祈福专线',
    description: '专为信众设计的朝圣路线，从佛足坛到灵山大佛，步步朝圣，虔诚礼佛',
    duration: 180,
    distance: 3.2,
    difficulty: 'medium',
    suitableFor: ['佛教信徒', '祈福朝圣', '老年信众'],
    spots: [
      { id: 'futan', name: '梵足坛', description: '瞻仰佛足，祈福开始', imageUrl: '', duration: 15, order: 1 },
      { id: 'jile-lifo', name: '极乐礼佛', description: '虔诚祈福，祈愿平安', imageUrl: '', duration: 20, order: 2 },
      { id: 'palm', name: '灵山佛手', description: '触摸佛手，承接福气', imageUrl: '', duration: 15, order: 3 },
      { id: 'baizi', name: '百子戏弥勒', description: '弥勒欢喜，家庭和睦', imageUrl: '', duration: 15, order: 4 },
      { id: 'xiangfu', name: '祥符禅寺', description: '千年古刹，虔诚礼佛', imageUrl: '', duration: 40, order: 5 },
      { id: 'xingtan', name: '杏坛广场', description: '登高，准备朝拜大佛', imageUrl: '', duration: 15, order: 6 },
      { id: 'buddha', name: '灵山大佛', description: '抱佛脚，圆满祈福', imageUrl: '', duration: 50, order: 7 },
      { id: 'sushi', name: '蔬食馆', description: '素斋祈福餐', imageUrl: '', duration: 30, order: 8 },
      { id: 'scenic-exit', name: '景区出口', description: '游览结束，前往景区出口离园', imageUrl: '', duration: 5, order: 9 }
    ]
  }
]

export const mockDashboardData: DashboardData = {
  todayServiceCount: 523,
  weeklyServiceCount: 3892,
  avgResponseTime: 1.8,
  satisfactionRate: 97.8,
  hotQuestions: [
    { question: '景区开放时间', count: 86 },
    { question: '门票价格', count: 72 },
    { question: '最佳游览路线', count: 58 },
    { question: '九龙灌浴表演时间', count: 45 },
    { question: '停车信息', count: 38 }
  ],
  emotionDistribution: {
    positive: 82,
    neutral: 16,
    negative: 2
  },
  topRoutes: [
    { name: '经典朝圣之旅', count: 1256 },
    { name: '深度文化之旅', count: 892 },
    { name: '亲子欢乐之旅', count: 678 },
    { name: '摄影打卡之旅', count: 456 }
  ]
}

export const mockWeeklyReports: VisitorReport[] = [
  { date: '2024-01-08', serviceCount: 423, satisfaction: 96.5, hotQuestions: ['开放时间', '门票', '停车'], emotionTrend: { positive: 78, neutral: 20, negative: 2 } },
  { date: '2024-01-09', serviceCount: 512, satisfaction: 97.2, hotQuestions: ['路线推荐', '表演时间', '餐饮'], emotionTrend: { positive: 82, neutral: 16, negative: 2 } },
  { date: '2024-01-10', serviceCount: 389, satisfaction: 95.8, hotQuestions: ['天气', '交通', '门票'], emotionTrend: { positive: 74, neutral: 24, negative: 2 } },
  { date: '2024-01-11', serviceCount: 623, satisfaction: 98.1, hotQuestions: ['门票', '路线', '表演'], emotionTrend: { positive: 85, neutral: 13, negative: 2 } },
  { date: '2024-01-12', serviceCount: 567, satisfaction: 97.3, hotQuestions: ['景点介绍', '开放时间', '停车'], emotionTrend: { positive: 80, neutral: 18, negative: 2 } },
  { date: '2024-01-13', serviceCount: 789, satisfaction: 96.8, hotQuestions: ['门票', '停车', '餐饮'], emotionTrend: { positive: 77, neutral: 21, negative: 2 } },
  { date: '2024-01-14', serviceCount: 712, satisfaction: 98.5, hotQuestions: ['路线', '表演时间', '拍照'], emotionTrend: { positive: 83, neutral: 15, negative: 2 } }
]