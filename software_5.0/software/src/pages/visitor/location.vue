<template>
  <view class="map-page">
    <!-- 地图图片 -->
    <view class="map-wrapper">
      <image
        class="map-image"
        src="/static/lingshan-map.jpg"
        mode="scaleToFill"
      />

    <!-- 搜索按钮（放大镜） -->
    <view class="search-btn" @click="toggleSearch">
      <text class="search-icon">🔍</text>
    </view>

    <!-- 路线按钮 -->
    <view class="route-btn" @click="goToRoutes">
      <text class="route-icon">🧭</text>
    </view>

      <!-- 图例面板 -->
      <view class="legend-panel">
        <view class="legend-item" v-for="(item, idx) in legendItems" :key="idx">
          <text class="legend-label">{{ item.label }}</text>
          <view class="legend-line" :style="{ background: item.color }"></view>
          <text class="legend-name">{{ item.name }}</text>
        </view>
      </view>

    </view>

    <!-- 搜索弹窗 -->
    <view v-if="showSearch" class="search-overlay" @click.self="showSearch = false">
      <view class="search-modal">
        <view class="search-header">
          <text class="search-title">搜索景点</text>
          <view class="search-close" @click="showSearch = false">✕</view>
        </view>

        <!-- 搜索输入框 -->
        <view class="search-input-wrap">
          <text class="input-placeholder-icon">🔍</text>
          <input
            class="search-input"
            v-model="keyword"
            placeholder="请输入景点名称"
            placeholder-class="input-placeholder"
            confirm-type="search"
            @confirm="doSearch"
            :focus="showSearch"
          />
        </view>

        <!-- 搜索结果 / 全部景点列表 -->
        <scroll-view class="spot-list" scroll-y :scroll-top="scrollTop" style="height: calc(80vh - 220rpx);">
          <view
            v-for="spot in filteredSpots"
            :key="spot.id"
            class="spot-card"
            @click="selectSpot(spot)"
          >
            <view class="spot-info">
              <view class="spot-name-row">
                <text class="spot-name">{{ spot.name }}</text>
                <view class="spot-tag" :class="spot.tagClass">{{ spot.tag }}</view>
              </view>
              <text class="spot-desc">{{ spot.desc }}</text>
              <view class="spot-meta">
                <text v-if="spot.distance" class="meta-item">📍 {{ spot.distance }}</text>
                <text v-if="spot.time" class="meta-item">⏱ {{ spot.time }}</text>
              </view>
            </view>
            <view class="spot-nav-btn" @click.stop="navToSpot(spot)">
              <text class="nav-text">导航</text>
            </view>
          </view>

          <view v-if="filteredSpots.length === 0 && keyword" class="no-result">
            <text>未找到匹配的景点</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 景点详情/导航弹窗 -->
    <view v-if="selectedSpot" class="detail-overlay" @click="closeDetail">
      <view class="detail-modal" @click.stop>
        <view class="detail-image-area">
          <text class="detail-spot-name">{{ selectedSpot.name }}</text>
          <view class="detail-tag" :class="selectedSpot.tagClass">{{ selectedSpot.tag }}</view>
        </view>
        <view class="detail-body">
          <text class="detail-desc">{{ selectedSpot.fullDesc || selectedSpot.desc }}</text>

          <view class="detail-section">
            <text class="section-label">位置信息</text>
            <text class="section-value">{{ selectedSpot.locationInfo }}</text>
          </view>

          <view class="detail-section">
            <text class="section-label">游览建议</text>
            <text class="section-value">{{ selectedSpot.tips }}</text>
          </view>
        </view>
        <view class="detail-actions">
          <view class="action-btn secondary" @click="closeDetail">
            <text>返回地图</text>
          </view>
          <view class="action-btn primary" @click="navToSpot(selectedSpot)">
            <text class="nav-arrow">▶</text>
            <text>开始导航</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 首次进入引导弹窗：按年龄定制安全路线 -->
    <view class="age-prompt-mask" v-if="showAgePrompt" @click.self="skipPrompt">
      <view class="age-prompt-card" @click.stop>
        <text class="ap-title">为您规划更安心的路线</text>
        <text class="ap-desc">灵山景区部分路段含桥梁、陡坡与长阶梯。告诉我们您的年龄，导览将为您个性化推荐更贴心的游览路线——例如为年长游客尽量避开桥梁与陡峭路段，优先平缓步道。</text>
        <view class="ap-btns">
          <view class="ap-btn ap-btn-primary" @click="goCompleteInfo">去完善信息</view>
          <view class="ap-btn ap-btn-skip" :class="{ disabled: !canSkip }" @click="skipPrompt">
            <text>{{ canSkip ? '暂不，先逛逛地图' : '暂不，先逛逛地图（' + countdown + 's）' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

const showSearch = ref(false)
const keyword = ref('')
const scrollTop = ref(0)
const selectedSpot = ref<any>(null)

interface Spot {
  id: string
  name: string
  tag: string
  tagClass: string
  desc: string
  fullDesc?: string
  locationInfo: string
  tips: string
  distance?: string
  time?: string
}

// 灵山胜境景点数据（地图全部标注点）
const spots = ref<Spot[]>([
  {
    id: 'buddha',
    name: '灵山大佛',
    tag: '核心景点',
    tagClass: 'tag-core',
    desc: '88米高露天青铜释迦牟尼立像，灵山胜境标志性景观',
    fullDesc: '灵山大佛是灵山胜境的核心景观，高88米，由1560块青铜壁板拼装而成。大佛慈颜微笑，广视众生。右手"施无畏印"代表除却痛苦，左手"与愿印"代表给予快乐。1997年落成，是中国五方五佛之东方大佛。',
    locationInfo: '景区北部中心位置，从检票口步行约15分钟可达',
    tips: '建议上午参观，人少且光线最佳；可抱佛脚祈福，寓意好运连连',
    distance: '距入口约1.2km',
    time: '推荐游览30分钟'
  },
  {
    id: 'palm',
    name: '灵山佛手',
    tag: '核心景点',
    tagClass: 'tag-core',
    desc: '与灵山大佛同比例复制的巨型佛手，高11.7米',
    fullDesc: '灵山佛手为灵山大佛右手的复制件，高11.7米，宽5.5米，手指直径1米。佛手的形状为"施无畏印"，寓意为众生除去痛苦。游客可以抱一抱佛手，祈求平安吉祥。',
    locationInfo: '位于灵山大佛下方左侧区域',
    tips: '可与佛手合影留念，抱一抱佛手寓意平安吉祥；热门拍照打卡点'
  },
  {
    id: 'ayuwang',
    name: '阿育王柱',
    tag: '文化古迹',
    tagClass: 'tag-culture',
    desc: '仿古印度阿育王石柱，承载千年佛教文化记忆',
    fullDesc: '阿育王柱源于古印度孔雀王朝阿育王所立的石柱，柱身刻有佛教经文。灵山的阿育王柱仿照印度原柱建造，象征着佛法东传的悠久历史。',
    locationInfo: '灵山大佛右侧区域，近杏坛广场北侧',
    tips: ''
  },
  {
    id: 'wujinyi',
    name: '无尽意斋',
    tag: '文化展馆',
    tagClass: 'tag-culture',
    desc: '佛教文化艺术展览馆，展示佛教书画艺术珍品',
    fullDesc: '无尽意斋取自《妙法莲华经》观世音菩萨名号"无尽意"，是一处展示佛教文化艺术精品的场所。馆内陈列有历代高僧墨宝、佛教造像等珍贵文物。',
    locationInfo: '景区西北角，距大佛60米平替处（观光车停靠点附近）',
    tips: '喜欢佛教文化的游客不容错过'
  },
  {
    id: 'xingtan',
    name: '杏坛广场',
    tag: '集散广场',
    tagClass: 'tag-facility',
    desc: '景区核心集散休息广场，连接各主要景点的枢纽地带',
    fullDesc: '杏坛广场位于灵山脚下，是景区的中心集散地。广场开阔宽敞，四周环绕着祥符禅寺、九龙灌浴等核心景点，是团队集合、游客休憩的重要场所。',
    locationInfo: '灵山脚下中心区域，菩提大道北端',
    tips: '适合团队集合、拍照留念；有观光车站点和自动取款机',
    distance: '距入口约900m'
  },
  {
    id: 'xiangfu',
    name: '祥符禅寺',
    tag: '古寺',
    tagClass: 'tag-culture',
    desc: '千年古刹，始建于唐贞观年间，香烟缭绕梵音阵阵',
    fullDesc: '祥符禅寺原名"法华院"，始建于唐贞观年间，距今已有一千三百余年历史，历经兴废重建。现寺内有大雄宝殿、藏经楼等建筑，是灵山胜境中历史最悠久的佛教寺院。',
    locationInfo: '杏坛广场东侧',
    tips: '可入内参拜，感受千年古刹氛围；注意保持安静肃穆',
    distance: '距入口约800m',
    time: '推荐游览20分钟'
  },
  {
    id: 'fangsheng',
    name: '放生礼佛',
    tag: '核心景点',
    tagClass: 'tag-core',
    desc: '莲花水池景观区，以莲花池为中心的佛教放生文化体验区',
    fullDesc: '放生礼佛以大型莲花水池为核心，池中有精美的佛教雕塑装饰。这里是体现佛教"慈悲护生"理念的特色区域，环境清幽雅致，是静心祈福的好去处。',
    locationInfo: '祥符禅寺与九龙灌浴之间',
    tips: '环境优美，适合安静漫步；请勿向池内投掷杂物'
  },
  {
    id: 'jiulong',
    name: '九龙灌浴',
    tag: '核心景点',
    tagClass: 'tag-core',
    desc: '国内最大规模动态音乐喷泉铜雕，每整点表演太子佛诞生场景',
    fullDesc: '九龙灌浴是国内最大规模的音乐喷泉动态铜雕。高达7.2米的通体含苞待放的莲花铜像矗立于水池中央，四大天王托举莲花座，四周八龙四凤共舞。每整点表演时，莲花缓缓绽放，太子佛像从中冉冉升起，九龙同时喷水为太子沐浴，场面极为壮观震撼。',
    locationInfo: '位于景区中轴线，杏坛广场北侧',
    tips: '⭐ 整点开放表演（10:00-16:00），每场约8分钟！建议提前5分钟占位观看最佳位置',
    distance: '距入口约1.0km',
    time: '推荐游览20分钟'
  },
  {
    id: 'baizi',
    name: '百子戏弥勒',
    tag: '雕塑艺术',
    tagClass: 'tag-core',
    desc: '大型群雕——百名孩童嬉戏于弥勒佛周围，充满童趣与祥和',
    fullDesc: '百子戏弥勒是一座大型青铜群雕，弥勒佛袒胸露腹、笑口常开，周围一百个形态各异的孩童嬉戏玩耍，或攀爬、或拉扯、或骑在肩头，生动活泼，充满童趣。寓意"笑口常开，福气自来"。',
    locationInfo: '祥符禅寺东侧，九龙灌浴东南方向',
    tips: '充满童趣的雕塑，适合亲子互动拍照；每个小童神态各异值得细品'
  },
  {
    id: 'sushi',
    name: '蔬食馆',
    tag: '餐饮服务',
    tagClass: 'tag-service',
    desc: '素食餐厅及观光车就餐站点',
    fullDesc: '蔬食馆提供各式精致素斋餐品，融合了传统佛教饮食与现代烹饪技艺。同时也是观光车线路的重要停靠站点，方便游客用餐休憩。',
    locationInfo: '景区中部偏东，观光车线路沿线',
    tips: '提供特色素斋美食，推荐灵山素面和素包子；用餐高峰需排队'
  },
  {
    id: 'futan',
    name: '梵足坛',
    tag: '入口广场',
    tagClass: 'tag-facility',
    desc: '景区入口处的佛教文化主题广场，菩提大道起点',
    fullDesc: '梵足坛位于景区正门入口内侧，是游客进入灵山后的第一个重要节点。"梵足"意为佛陀足迹，象征踏入圣地。广场设计庄重大气，两侧有精美照壁和石狮。',
    locationInfo: '菩提大道南端，紧邻检票口',
    tips: '刚进景区可在此稍作停留，规划游览路线'
  },
  {
    id: 'wuyin',
    name: '五印坛城',
    tag: '核心景点',
    tagClass: 'tag-core',
    desc: '藏式佛教艺术殿堂，展示五方佛五种手印的宏伟建筑',
    fullDesc: '五印坛城以藏族文化为主题，外观宏伟壮观，内部装饰华丽至极。展示了五方佛的五种手印：法界印、金刚印、宝印、羯磨印、莲花印。内部有精美的唐卡、壁画和造像，色彩斑斓，令人叹为观止。',
    locationInfo: '景区南部偏东位置，观光车上山路线终点站附近',
    tips: '内部装修极其精美，宛如进入藏传佛教的艺术殿堂；注意保持安静，禁止触摸壁画',
    distance: '距入口约1.5km',
    time: '推荐游览40分钟'
  },
  {
    id: 'qifu',
    name: '祈福普缘',
    tag: '祈福体验',
    tagClass: 'tag-experience',
    desc: '祈福许愿场所，挂福牌系丝带寄托美好愿望',
    fullDesc: '祈福普缘是一处供游客许愿祈福的特色区域。在这里可以挂上写满愿望的祈福牌、系上红丝带，将美好的祝愿留在灵山圣地。红丝带随风飘扬，蔚为壮观。',
    locationInfo: '五印坛城北侧，近曼飞龙塔',
    tips: '可在此处挂祈福牌、系红丝带；祈福牌可在旁边的服务台购买'
  },
  {
    id: 'fangong',
    name: '灵山梵宫',
    tag: '核心景点',
    tagClass: 'tag-core',
    desc: '世界佛教论坛永久会址，建筑与艺术的完美结合',
    fullDesc: '灵山梵宫是世界佛教论坛的永久会址，建筑融合了中国佛教石窟艺术及传统建筑装饰精华，内部金碧辉煌令人叹为观止。廊厅内有巨幅琉璃浮雕《华藏世界》、精美的东阳木雕、敦煌壁画风格彩绘、扬州漆器等珍贵艺术品。每天还有《灵山吉祥颂》大型情景演出。',
    locationInfo: '景区东部中心区域，观光车终点附近',
    tips: '⭐ 必看景点！内部震撼程度不输任何顶级博物馆；留意《吉祥颂》演出时间安排；禁止闪光灯拍照',
    distance: '距入口约1.6km',
    time: '推荐游览60分钟+'
  },
  {
    id: 'manfeilong',
    name: '曼飞龙塔',
    tag: '建筑奇观',
    tagClass: 'tag-culture',
    desc: '傣族风格的群塔建筑，典型的南传佛教佛塔造型',
    fullDesc: '曼飞龙塔原型来自云南西双版纳，是一座典型的南传佛教（小乘佛教）群塔。主塔居中，八座小塔环绕，塔身洁白，造型优美，展现了傣族建筑的独特魅力。',
    locationInfo: '灵山梵宫东南侧',
    tips: '典型的南传佛教建筑风格，与梵宫形成汉藏傣三族佛教建筑对比'
  },
  {
    id: 'jingshe',
    name: '灵山精舍',
    tag: '住宿',
    tagClass: 'tag-service',
    desc: '景区内高端精品住宿，晨钟暮鼓中感受灵山静谧',
    fullDesc: '灵山精舍坐落于景区最东侧幽静之处，是一处融合传统与现代的高端精品酒店。入住此处可在清晨聆听梵音，夜晚仰望星空，深度体验灵山的宁静与祥和。',
    locationInfo: '景区最东侧，远离主干道的安静区域',
    tips: '需要提前预订；清晨和傍晚时分景色最美'
  },
  {
    id: 'talong',
    name: '灵山多宝塔',
    tag: '古建',
    tagClass: 'tag-culture',
    desc: '仿木结构九层琉璃塔，巍峨耸立于景区西侧',
    fullDesc: '灵山多宝塔是一座仿木结构的九层楼阁式琉璃塔，塔身采用中国传统建筑工艺，飞檐翘角，层层收分，巍峨壮观。登塔可俯瞰整个灵山胜境全貌。',
    locationInfo: '景区西部，观光车线路西端',
    tips: '如开放登塔，可俯瞰整个景区全景'
  },
  {
    id: 'shengshi',
    name: '盛凡斋',
    tag: '餐饮购物',
    tagClass: 'tag-service',
    desc: '素食餐饮店及文创商品专卖店',
    locationInfo: '祥符禅寺附近，观光车盛凡斋广场站',
    tips: '提供特色素斋美食和灵山主题文创纪念品'
  },
  {
    id: 'holiday-plaza',
    name: '景区出口假日广场',
    tag: '商业区',
    tagClass: 'tag-service',
    desc: '景区出口综合商业广场，餐饮购物一站式服务',
    fullDesc: '假日广场位于景区南部出口处，是一个综合性的商业休闲区域。汇集了各类餐饮店铺、纪念品超市、ATM取款机等服务设施，是游客离开前的最后一站补给区。',
    locationInfo: '景区正南方向出口处',
    tips: '离开前可在此购买灵山特产和纪念品；有多家ATM方便取现'
  },
  {
    id: 'ticket-gate',
    name: '检票口',
    tag: '出入口',
    tagClass: 'tag-facility',
    desc: '景区主出入口，由此进入灵山圣境',
    locationInfo: '景区最南侧正门位置',
    tips: '提前准备好电子或纸质门票；旺季排队时间较长建议早到'
  },
  {
    id: 'tourist-center',
    name: '游客中心',
    tag: '综合服务',
    tagClass: 'tag-service',
    desc: '景区综合服务中心，提供咨询、导览、寄存等一站式服务',
    fullDesc: '游客中心位于景区出口假日广场附近，是景区的综合服务中心。这里提供旅游咨询、导游预约、行李寄存、轮椅租赁、失物招领等各类服务，同时也可领取免费的景区导览图。',
    locationInfo: '景区出口假日广场西侧，近导游服务站',
    tips: '首次游览建议先来领取导览图并租借讲解器；有行李可在此寄存',
    distance: '距入口约50m'
  },
  {
    id: 'guide-service',
    name: '导游服务',
    tag: '专业服务',
    tagClass: 'tag-service',
    desc: '专业导游讲解服务点，提供多种语言导游陪同游览',
    fullDesc: '导游服务站提供持证专业导游服务，包括普通话、粤语、英语等多语种选择。导游将带领您深入了解每一处景点背后的历史文化故事，让游览更有收获。',
    locationInfo: '游客中心旁，检票口东侧不远处',
    tips: '建议首次游览聘请导游，能更深入了解各景点背后的故事和文化内涵'
  }
])

const legendItems = [
  { label: '观光车', color: '#e67e22', name: '观光车站点' },
  { label: '', background: 'linear-gradient(90deg, #3498db 40%, transparent 40%)', name: '观光车线路' },
  { label: '', background: 'linear-gradient(90deg, #e74c3c 20%, transparent 20%, transparent 25%, #e74c3c 25%, #e74c3c 45%, transparent 45%)', name: '观光车上山路' }
]

const filteredSpots = computed(() => {
  if (!keyword.value.trim()) return spots.value
  const kw = keyword.value.trim().toLowerCase()
  return spots.value.filter(s => s.name.toLowerCase().includes(kw) || s.desc.toLowerCase().includes(kw))
})

const toggleSearch = () => {
  showSearch.value = !showSearch.value
  if (!showSearch.value) keyword.value = ''
}

const doSearch = () => {
  scrollTop.value = scrollTop.value > 0 ? 0 : 1
}

const selectSpot = (spot: Spot) => {
  selectedSpot.value = spot
  showSearch.value = false
}

const closeDetail = () => {
  selectedSpot.value = null
}

const navToSpot = (spot: Spot) => {
  uni.navigateTo({
    url: `/pages/visitor/navigation?name=${encodeURIComponent(spot.name)}&dest=${spot.id}`
  })
  closeDetail()
  showSearch.value = false
}

const goToRoutes = () => {
  // 跳转到路线页（已从 tabBar 移除，用 navigateTo）
  uni.navigateTo({ url: '/pages/visitor/routes' })
}

// ===== 首次进入引导弹窗：按年龄定制安全路线 =====
const userStore = useUserStore()
const showAgePrompt = ref(false)
const countdown = ref(3)
const canSkip = ref(false)
let promptTimer: any = null

const startCountdown = () => {
  countdown.value = 3
  canSkip.value = false
  if (promptTimer) clearInterval(promptTimer)
  promptTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      canSkip.value = true
      if (promptTimer) { clearInterval(promptTimer); promptTimer = null }
    }
  }, 1000)
}

const skipPrompt = () => {
  if (!canSkip.value) return
  showAgePrompt.value = false
  if (promptTimer) { clearInterval(promptTimer); promptTimer = null }
}

const goCompleteInfo = () => {
  showAgePrompt.value = false
  if (promptTimer) { clearInterval(promptTimer); promptTimer = null }
  uni.navigateTo({ url: '/pages/visitor/register?from=map' })
}

onShow(() => {
  // 未登录且本设备首次进入地图页时弹一次，标记后永不再弹
  const shown = uni.getStorageSync('mapAgePromptShown')
  if (!shown && !userStore.isLoggedIn) {
    uni.setStorageSync('mapAgePromptShown', true)
    showAgePrompt.value = true
    startCountdown()
  }
})
</script>

<style lang="scss" scoped>
@import "@/styles/variables.scss";

$font-size-title: 38rpx;
$font-size-subtitle: 32rpx;
$font-size-body: 28rpx;
$font-size-caption: 24rpx;
$font-size-mini: 20rpx;

.map-page {
  min-height: 100vh;
  background: #f7f2e3;
  position: relative;
  overflow: hidden;
  font-family: $font-body;
}

.map-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.map-image {
  width: 100%;
  height: auto;
  aspect-ratio: 1677 / 1920;
  display: block;
  flex-shrink: 0;
}

/* 返回按钮 */
.back-btn {
  position: absolute;
  top: calc(env(safe-area-inset-top) + 24rpx);
  left: 24rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;

  &:active {
    transform: scale(0.92);
  }

  &:hover {
    transform: scale(1.15);
    filter: brightness(1.5);
  }

  .back-icon-img {
    font-size: 48rpx;
    color: #fff;
    line-height: 44rpx;
    font-weight: 300;
  }
}

/* 搜索按钮（放大镜） */
.search-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 24rpx);
  right: 124rpx;
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  box-shadow: 0 6rpx 20rpx rgba(139, 115, 85, 0.5);
  border: 2rpx solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.9);
  }

  .search-icon {
    font-size: 38rpx;
  }
}

/* 路线按钮 */
.route-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 24rpx);
  right: 24rpx;
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  box-shadow: 0 6rpx 20rpx rgba(139, 115, 85, 0.5);
  border: 2rpx solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.9);
  }

  .route-icon {
    font-size: 38rpx;
  }
}

/* 图例面板 */
.legend-panel {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 120rpx);
  right: 16rpx;
  background: rgba(255, 248, 230, 0.95);
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);
  z-index: 8;
  font-family: $font-decor;

  .legend-item {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-bottom: 10rpx;

    &:last-child {
      margin-bottom: 0;
    }

    .legend-label {
      font-size: $font-size-mini;
      color: #666;
      white-space: nowrap;
      flex-shrink: 0;
      font-family: $font-decor;
    }

    .legend-line {
      width: 60rpx;
      height: 6rpx;
      border-radius: 3rpx;
      flex-shrink: 0;
    }

    .legend-name {
      font-size: $font-size-mini;
      color: #333;
      font-family: $font-decor;
    }
  }
}

/* ====== 搜索弹窗 ====== */
.search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.search-modal {
  width: 100%;
  height: 80vh;
  background: #fffef8;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: $font-body;
}

.search-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #eee;

  .search-title {
    font-size: $font-size-title;
    color: #333;
    font-family: $font-plaque;
    letter-spacing: 4rpx;
  }

  .search-close {
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    color: #999;
    font-family: $font-nav;
  }
}

.search-input-wrap {
  margin: 20rpx 28rpx;
  padding: 18rpx 24rpx;
  background: #f5f2ed;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;

  .input-placeholder-icon {
    font-size: 28rpx;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    font-size: $font-size-body;
    color: #333;
    font-family: $font-body;
  }

  .input-placeholder {
    color: #bbb;
    font-size: $font-size-body;
    font-family: $font-body;
  }
}

.spot-list {
  flex: 1;
  padding: 0 24rpx 24rpx;
}

.spot-card {
  display: flex;
  align-items: center;
  padding: 24rpx 20rpx;
  background: #faf8f5;
  border-radius: 20rpx;
  margin-bottom: 16rpx;
  gap: 20rpx;
  transition: all 0.2s;

  &:active {
    background: #f0ebe3;
    transform: scale(0.98);
  }

  .spot-info {
    flex: 1;
    min-width: 0;

    .spot-name-row {
      display: flex;
      align-items: center;
      gap: 12rpx;
      margin-bottom: 10rpx;

      .spot-name {
        font-size: $font-size-subtitle;
        color: #333;
        font-family: $font-plaque;
        letter-spacing: 2rpx;
      }
    }

    .spot-desc {
      font-size: $font-size-caption;
      color: #777;
      line-height: 1.4;
      margin-bottom: 8rpx;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      font-family: $font-body;
    }

    .spot-meta {
      display: flex;
      gap: 16rpx;

      .meta-item {
        font-size: $font-size-mini;
        color: #a0522d;
        font-family: $font-nav;
      }
    }
  }

  .spot-nav-btn {
    width: 100rpx;
    height: 68rpx;
    background: linear-gradient(135deg, #8B7355, #A0522D);
    border-radius: 34rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .nav-text {
      font-size: $font-size-caption;
      color: #fff;
      font-family: $font-nav;
      letter-spacing: 2rpx;
    }
  }
}

.spot-tag {
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  font-size: $font-size-mini;
  flex-shrink: 0;
  font-family: $font-nav;

  &.tag-core   { background: rgba(227, 112, 38, 0.12); color: #e37026; }
  &.tag-culture { background: rgba(114, 93, 210, 0.1); color: #725dd2; }
  &.tag-facility { background: rgba(52, 152, 219, 0.1); color: #3498db; }
  &.tag-service { background: rgba(39, 174, 96, 0.1); color: #27ae60; }
  &.tag-experience { background: rgba(155, 89, 182, 0.1); color: #9b59b6; }
}

.no-result {
  text-align: center;
  padding: 80rpx 0;
  color: #bbb;
  font-size: $font-size-body;
  font-family: $font-decor;
}

/* ====== 详情/导航弹窗 ====== */
.detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 300;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.detail-modal {
  width: 100%;
  max-height: 82vh;
  background: #fffef8;
  border-radius: 36rpx 36rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: $font-body;

  .detail-image-area {
    background: linear-gradient(135deg, #8B7355, #A0522D);
    padding: 36rpx 32rpx;
    display: flex;
    align-items: center;
    gap: 16rpx;

    .detail-spot-name {
      font-size: $font-size-title + 4rpx;
      color: #fff;
      font-family: $font-plaque;
      letter-spacing: 4rpx;
    }

    .detail-tag {
      padding: 6rpx 18rpx;
      border-radius: 24rpx;
      font-size: $font-size-caption;
      background: rgba(255, 255, 255, 0.25);
      color: #fff;
      font-family: $font-nav;
    }
  }

  .detail-body {
    flex: 1;
    padding: 28rpx 32rpx;
    overflow-y: auto;

    .detail-desc {
      font-size: $font-size-body;
      color: #444;
      line-height: 1.4;
      margin-bottom: 24rpx;
      font-family: $font-body;
    }

    .detail-section {
      margin-bottom: 20rpx;
      background: #faf8f5;
      border-radius: 16rpx;
      padding: 20rpx;

      .section-label {
        font-size: $font-size-caption;
        color: #a0522d;
        display: block;
        margin-bottom: 10rpx;
        font-family: $font-plaque;
        letter-spacing: 2rpx;
      }

      .section-value {
        font-size: $font-size-caption + 2rpx;
        color: #555;
        line-height: 1.4;
        font-family: $font-body;
      }
    }
  }

  .detail-actions {
    display: flex;
    gap: 20rpx;
    padding: 20rpx 28rpx;
    padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
    border-top: 1rpx solid #eee;

    .action-btn {
      flex: 1;
      height: 88rpx;
      border-radius: 44rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8rpx;
      font-size: $font-size-subtitle;
      transition: transform 0.15s;
      font-family: $font-nav;
      letter-spacing: 2rpx;

      &:active {
        transform: scale(0.97);
      }

      &.secondary {
        background: #f5f2ed;
        color: #666;
      }

      &.primary {
        background: linear-gradient(135deg, #8B7355, #A0522D);
        color: #fff;
        box-shadow: 0 6rpx 20rpx rgba(160, 82, 45, 0.35);

        .nav-arrow {
          font-size: 24rpx;
        }
      }
    }
  }
}

/* ===== 首次进入引导弹窗 ===== */
.age-prompt-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8rpx);
  display: flex;
  align-items: center;
  justify-content: center;
}
.age-prompt-card {
  width: 560rpx;
  background: $bg-white;
  border-radius: $border-radius-xl;
  padding: 48rpx 40rpx 36rpx;
  box-shadow: $shadow-lg;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ap-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  text-align: center;
  margin-bottom: 20rpx;
}
.ap-desc {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.6;
  text-align: center;
  margin-bottom: 36rpx;
}
.ap-btns {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.ap-btn {
  width: 100%;
  height: 84rpx;
  border-radius: $border-radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}
.ap-btn-primary {
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  color: #fff;
}
.ap-btn-skip {
  background: $bg-gray;
  color: $text-secondary;
}
.ap-btn-skip.disabled {
  opacity: 0.5;
}
</style>
