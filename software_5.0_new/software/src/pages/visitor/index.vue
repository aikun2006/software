<template>
  <view class="home-screen" @touchmove.stop.prevent>
    <!-- 沉浸式背景 -->
    <view class="scene-bg">
      <view class="mountain far"></view>
      <view class="mountain mid"></view>
      <view class="mountain near"></view>
      <view class="water"></view>
      <view class="mist m1"></view>
      <view class="mist m2"></view>
      <view class="stars">
        <view class="star" v-for="i in 20" :key="i" :class="'s' + i"></view>
      </view>
      <view class="firefly" v-for="i in 8" :key="'f'+i" :class="'f' + i"></view>
    </view>

    <!-- ============ 左侧：数字人区域（背景板整合：stage 包裹 glow + Avatar3D，双重居中） ============ -->
    <view class="avatar-area" @click="onAvatarClick">
      <view class="avatar-stage">
        <view class="avatar-glow"></view>
        <Avatar3D ref="avatarRef" :show-name="false" :disable-zoom="true" :vertical-offset-ratio="1/4" :model-path="activeAvatarConfig.vrm_path" :model-scale="activeAvatarConfig.model_scale" :model-rotation-y="activeAvatarConfig.rotation_y" class="enlarged-avatar" />
      </view>
      <view class="click-hint" :class="{ pulse: showHint }">
        <text class="hint-text">{{ currentLang === 'zh' ? '点击开始导览' : 'Click the digital guide' }}</text>
        <view class="hint-arrow">
          <view class="arrow-line"></view>
        </view>
      </view>
    </view>

    <!-- ============ 新增：右侧面板（景点轮播 + 信息卡片） ============ -->
    <view class="right-panel">
      <!-- ====== 右上：灵山景点轮播图 ====== -->
      <view class="carousel-section" @mouseenter="pauseCarousel" @mouseleave="resumeCarousel">
        <view class="carousel-viewport">
          <view class="carousel-track" :style="{ transform: `translateX(-${currentSlide * 100}%)` }">
            <view class="carousel-slide" v-for="(spot, idx) in spots" :key="idx">
              <!-- 轮播图片 -->
              <view class="carousel-image-area" @click="openCarouselPreview">
                <image v-if="spot.image" class="carousel-img" :src="spot.image" mode="aspectFill" />
              </view>
              <!-- 景点名称与描述 -->
              <view class="carousel-caption">
                <text class="carousel-spot-name">{{ spot.name }}</text>
                <text class="carousel-spot-desc">{{ spot.desc }}</text>
              </view>
            </view>
          </view>
        </view>
        <!-- 手动切换按钮 -->
        <view class="carousel-nav prev" @click="prevSlide">
          <text class="nav-arrow">‹</text>
        </view>
        <view class="carousel-nav next" @click="nextSlide">
          <text class="nav-arrow">›</text>
        </view>
        <!-- 指示点 -->
        <view class="carousel-dots">
          <view class="carousel-dot" v-for="(spot, idx) in spots" :key="idx"
                :class="{ active: idx === currentSlide }" @click="goToSlide(idx)"></view>
        </view>
      </view>

      <!-- ====== 右下：2×2 APP图标圆角方块按钮 ====== -->
      <view class="cards-section">
        <view class="app-btn" v-for="(card, idx) in infoCards" :key="idx"
              @click="onCardClick(idx)">
          <view class="app-btn-icon-box">
            <text class="app-btn-icon">{{ card.icon }}</text>
          </view>
          <text class="app-btn-label">{{ card.title }}</text>
        </view>
      </view>
    </view>
    <!-- ============ 新增结束 ============ -->

    <!-- ============ 新增：卡片详情弹窗 ============ -->
    <view class="card-modal-mask" v-if="showCardModal" @click="closeCardDetail">
      <view class="card-modal" @click.stop>
        <view class="modal-header">
          <view class="modal-header-left">
            <text class="modal-icon">{{ activeCardData?.icon }}</text>
            <text class="modal-title">{{ activeCardData?.title }}</text>
          </view>
          <view class="modal-close" @click="closeCardDetail">
            <text class="close-x">✕</text>
          </view>
        </view>
        <view class="modal-body" v-if="activeCardData">
          <view class="modal-detail-item" v-for="(item, i) in activeCardData.details" :key="i">
            <text class="detail-label">{{ item.label }}</text>
            <text class="detail-text">{{ item.text }}</text>
          </view>
        </view>
      </view>
    </view>
    <!-- ============ 弹窗结束 ============ -->

    <!-- ======== 顶部切换按钮组 ========= -->
    <view class="top-toggle-btn-group">
      <!-- ======== English切换按钮（全站唯一切换入口）======== -->
      <view class="lang-toggle-btn" @click="onToggleLang">
        <text class="lang-toggle-text">{{ currentLang === 'zh' ? 'English' : '中文' }}</text>
      </view>

      <!-- ======== 大字版切换按钮（全站唯一切换入口）======== -->
      <view class="font-toggle-btn" @click="toggleLargeFont">
        <text class="font-toggle-text">{{ isLargeFont ? (currentLang === 'zh' ? '标准版' : 'Standard') : (currentLang === 'zh' ? '大字版' : 'Large Font') }}</text>
      </view>
    </view>

    <!-- 管理员入口 -->
    <view class="admin-entry" @click="goToAdmin">
      <text class="admin-icon">⚙</text>
    </view>

    <!-- ======== 轮播图全屏图片预览 ======== -->
    <view class="carousel-preview-overlay" v-if="showCarouselPreview" @click="closeCarouselPreview">
      <image class="carousel-preview-img" :src="previewImage" mode="aspectFit" @click.stop />
      <view class="carousel-preview-close" @click="closeCarouselPreview">✕</view>
    </view>

    <!-- ======== 用户须知弹窗（仅首页加载时弹出，仅×可关闭）======== -->
    <view class="notice-overlay" v-if="showNotice">
      <view class="notice-popup" @click.stop>
        <view class="notice-close" @click="closeNotice">✕</view>
        <text class="notice-title">{{ isEnMode ? 'User Notice' : '用户须知' }}</text>
        <view class="notice-list">
          <view class="notice-item" v-for="(item, i) in (isEnMode ? noticeItemsEn : noticeItems)" :key="i">
            <text class="notice-num">{{ i + 1 }}.</text>
            <text class="notice-text">{{ item }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import Avatar3D from '@/components/Avatar3D.vue'
import { currentLang, toggleLang, initLang } from '@/i18n'

const avatarRef = ref()
const showHint = ref(true)

// D5：当前启用的数字人形象配置（从后端获取，控制 VRM 模型路径/缩放/旋转）
const activeAvatarConfig = ref<{
  vrm_path: string
  model_scale: number
  rotation_y: number
}>({ vrm_path: '', model_scale: 3.25, rotation_y: 0 })

// D5：获取当前启用的数字人形象配置（页面可见时自动刷新）
async function fetchActiveAvatar() {
  try {
    const res = await fetch('/api/avatars/active', { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    if (data && data.avatar) {
      const newConfig = {
        vrm_path: data.avatar.vrm_path || '',
        model_scale: data.avatar.model_scale || 3.25,
        rotation_y: data.avatar.rotation_y || 0,
      }
      // 仅在配置实际变化时更新，避免不必要的模型重载
      const cur = activeAvatarConfig.value
      if (cur.vrm_path !== newConfig.vrm_path ||
          cur.model_scale !== newConfig.model_scale ||
          cur.rotation_y !== newConfig.rotation_y) {
        activeAvatarConfig.value = newConfig
      }
    }
  } catch (e) {
    // 静默失败，不影响页面其他功能
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    fetchActiveAvatar()
  }
}

// ============ 大字版模式：localStorage持久化 + body class切换 ============
const isLargeFont = ref(false)
const FONT_STORAGE_KEY = 'lingshan_large_font'

const applyLargeFont = (enable: boolean) => {
  if (typeof document !== 'undefined' && document.body) {
    if (enable) {
      document.body.classList.add('large-font-mode')
    } else {
      document.body.classList.remove('large-font-mode')
    }
  }
  // 直接操作tabbar元素内联样式，绕过CSS优先级问题
  applyTabBarLargeFont(enable)
}

// 延迟操作tabbar（等框架渲染完）
const applyTabBarLargeFont = (enable: boolean) => {
  const doApply = () => {
    const icons = document.querySelectorAll('.uni-tabbar__icon')
    const labels = document.querySelectorAll('.uni-tabbar__label')
    if (icons.length === 0) {
      setTimeout(doApply, 300)
      return
    }
    icons.forEach((el) => {
      ;(el as HTMLElement).style.cssText = enable
        ? 'display:none !important;'
        : ''
    })
    labels.forEach((el) => {
      if (enable) {
        const cur = window.getComputedStyle(el).fontSize
        const num = parseFloat(cur) || 12
        ;(el as HTMLElement).style.cssText =
          `font-size:${num + 8}px !important;` +
          `font-weight:bold !important;` +
          `width:100% !important;` +
          `height:100% !important;` +
          `display:flex !important;` +
          `align-items:center !important;` +
          `justify-content:center !important;` +
          `text-align:center !important;` +
          `line-height:1 !important;`
      } else {
        ;(el as HTMLElement).style.cssText = ''
      }
    })
    const styleId = 'large-font-tabbar-divider'
    const existing = document.getElementById(styleId)
    if (enable) {
      if (!existing) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent =
          '.uni-tabbar__bd::before,.uni-tabbar__bd::after{' +
          'width:6px !important;' +
          '}' +
          '.uni-tabbar__item.tab-active .uni-tabbar__bd::before,' +
          '.uni-tabbar__item.tab-active .uni-tabbar__bd::after{' +
          'width:6px !important;' +
          '}'
        document.head.appendChild(style)
      }
    } else {
      if (existing) existing.remove()
    }
  }
  setTimeout(doApply, 100)
}

const toggleLargeFont = () => {
  isLargeFont.value = !isLargeFont.value
  try {
    localStorage.setItem(FONT_STORAGE_KEY, isLargeFont.value ? '1' : '0')
  } catch (e) { /* 忽略存储异常 */ }
  applyLargeFont(isLargeFont.value)
}

// 语音定时播放
let audioCtx: any = null
let promptTimer: any = null
let firstPlayTimer: any = null
const PROMPT_INTERVAL = 15000 // 每15秒播放一次提示语音
let audioStarted = false

const playPromptAudio = () => {
  try {
    // #ifdef H5
    if (!audioCtx) {
      audioCtx = new Audio('/static/prompt.mp3')
    }
    audioCtx.currentTime = 0
    audioCtx.play().catch(() => {})

    // #endif

    // #ifndef H5
    const innerAudio = uni.createInnerAudioContext()
    innerAudio.src = '/static/prompt.mp3'
    innerAudio.play()
    innerAudio.onEnded(() => {
      innerAudio.destroy()
    })
    innerAudio.onError(() => {
      innerAudio.destroy()
    })
    // #endif
  } catch (e) {
    // 音频播放失败时静默处理
  }
}

const startAudioLoop = () => {
  if (audioStarted) return
  audioStarted = true
  // 首次进入3秒后播放第一次语音提示
  firstPlayTimer = setTimeout(() => {
    playPromptAudio()
  }, 3000)
  // 定时播放
  promptTimer = setInterval(() => {
    playPromptAudio()
  }, PROMPT_INTERVAL)
}

const stopAudioLoop = () => {
  audioStarted = false
  if (firstPlayTimer) {
    clearTimeout(firstPlayTimer)
    firstPlayTimer = null
  }
  if (promptTimer) {
    clearInterval(promptTimer)
    promptTimer = null
  }
  if (audioCtx) {
    audioCtx.pause()
    audioCtx = null
  }
}

const onAvatarClick = () => {
  // 点击后停止语音提示
  stopAudioLoop()
  // 跳转到导览对话页
  uni.switchTab({ url: '/pages/visitor/chat' })
}

const goToAdmin = () => {
  uni.navigateTo({ url: '/pages/admin/login' })
}

// ============ 新增：景点轮播数据与逻辑 ============
const spotsZh = [
  { name: '灵山大佛', desc: '88米青铜释迦牟尼立像，灵山胜境标志性景观', image: '/static/spots/lingshan-dafo.jpg' },
  { name: '梵宫广场', desc: '灵山梵宫前开阔广场，气势恢宏', image: '/static/spots/fangong-square.jpg' },
  { name: '五印坛城', desc: '藏传佛教艺术殿堂，金碧辉煌', image: '/static/spots/wuyin-tancheng.jpg' },
  { name: '灵山梵宫', desc: '世界佛教论坛会址，东方佛教艺术宝库', image: '/static/spots/lingshan-fangong.jpg' },
  { name: '灵山精舍', desc: '禅意主题精品酒店，静心之所', image: '/static/spots/lingshan-jingshe.jpg' },
  { name: '曼飞龙塔', desc: '南传佛教金色佛塔，异域风情', image: '/static/spots/manfeilong-ta.jpg' },
  { name: '百子戏弥勒', desc: '欢喜弥勒百童嬉戏，生动有趣', image: '/static/spots/baizi-mile.jpg' },
  { name: '祥符禅寺', desc: '千年古刹禅宗道场，清幽静谧', image: '/static/spots/xiangfu-temple.jpg' },
  { name: '九龙灌浴', desc: '太子诞生浴佛盛典，每日定时演出', image: '/static/spots/jiulong-guanyu.jpg' },
  { name: '佛足坛', desc: '佛陀足印圣地，庄严神圣', image: '/static/spots/fozu-tan.jpg' }
]
const spotsEn = [
  { name: 'Grand Buddha', desc: '88m bronze Sakyamuni statue, iconic landmark of Lingshan', image: '/static/spots/lingshan-dafo.jpg' },
  { name: 'Buddhist Palace Plaza', desc: 'Magnificent square in front of Lingshan Buddhist Palace', image: '/static/spots/fangong-square.jpg' },
  { name: 'Five Seal Mandala', desc: 'Tibetan Buddhist art hall, resplendent in gold', image: '/static/spots/wuyin-tancheng.jpg' },
  { name: 'Lingshan Buddhist Palace', desc: 'World Buddhist Forum venue, treasure of Eastern Buddhist art', image: '/static/spots/lingshan-fangong.jpg' },
  { name: 'Lingshan Jingshe', desc: 'Zen-themed boutique hotel, a place for tranquility', image: '/static/spots/lingshan-jingshe.jpg' },
  { name: 'Manfeilong Pagoda', desc: 'Golden stupa of Southern Buddhism, exotic charm', image: '/static/spots/manfeilong-ta.jpg' },
  { name: 'Hundred Children Playing with Maitreya', desc: 'Joyful Maitreya with playful children, vivid and fun', image: '/static/spots/baizi-mile.jpg' },
  { name: 'Xiangfu Temple', desc: 'Ancient thousand-year-old Zen temple, serene and tranquil', image: '/static/spots/xiangfu-temple.jpg' },
  { name: 'Nine Dragons Bathing', desc: 'Prince Siddhartha bathing ceremony, performed daily', image: '/static/spots/jiulong-guanyu.jpg' },
  { name: 'Buddha Footprints', desc: 'Sacred site of Buddha\'s footprints, solemn and divine', image: '/static/spots/fozu-tan.jpg' }
]
const spots = computed(() => currentLang.value === 'zh' ? spotsZh : spotsEn)

const currentSlide = ref(0)
let carouselTimer: any = null
const CAROUSEL_INTERVAL = 4000 // 自动轮播间隔4秒

const nextSlide = () => {
  currentSlide.value = (currentSlide.value + 1) % spots.value.length
}
const prevSlide = () => {
  currentSlide.value = (currentSlide.value - 1 + spots.value.length) % spots.value.length
}
const goToSlide = (idx: number) => {
  currentSlide.value = idx
}
const startCarousel = () => {
  if (carouselTimer) clearInterval(carouselTimer)
  carouselTimer = setInterval(nextSlide, CAROUSEL_INTERVAL)
}
const pauseCarousel = () => {
  if (carouselTimer) {
    clearInterval(carouselTimer)
    carouselTimer = null
  }
}
const resumeCarousel = () => {
  startCarousel()
}

// ============ 新增：轮播图全屏预览 ============
const showCarouselPreview = ref(false)
const previewImage = ref('')

const openCarouselPreview = () => {
  const spot = spots.value[currentSlide.value]
  if (spot && spot.image) {
    previewImage.value = spot.image
    showCarouselPreview.value = true
  }
}

const closeCarouselPreview = () => {
  showCarouselPreview.value = false
}
// ============ 新增结束 ============

// ============ 新增：信息卡片数据 ============
const infoCardsZh = [
  { icon: '🎫', title: '景区购票', value: '¥210/人', link: '/static/pages/ticket.html', type: 'html' },
  { icon: '🌤', title: '今日天气', value: '晴 26°C', link: '/static/pages/weather.html', type: 'html' },
  { icon: '🍜', title: '周边美食', value: '素斋·禅茶', link: '/pages/visitor/foods', type: 'vue' },
  { icon: '🏨', title: '住宿推荐', value: '灵山精舍', link: '/pages/visitor/hotels', type: 'vue' }
]
const infoCardsEn = [
  { icon: '🎫', title: 'Ticket Purchase', value: '¥210/person', link: '/static/pages/ticket-en.html', type: 'html' },
  { icon: '🌤', title: "Today's Weather", value: 'Sunny 26°C', link: '/static/pages/weather-en.html', type: 'html' },
  { icon: '🍜', title: 'Local Food', value: 'Vegetarian', link: '/pages/visitor/foods', type: 'vue' },
  { icon: '🏨', title: 'Accommodation', value: 'Jingshe Hotel', link: '/pages/visitor/hotels', type: 'vue' }
]
const infoCards = computed(() => currentLang.value === 'zh' ? infoCardsZh : infoCardsEn)

// ============ 新增：APP按钮点击跳转逻辑 ============
const onCardClick = (idx: number) => {
  const card = infoCards.value[idx]
  if (card.type === 'vue') {
    uni.navigateTo({ url: card.link })
  } else {
    // #ifdef H5
    window.location.href = card.link
    // #endif
    // #ifndef H5
    uni.navigateTo({ url: card.link })
    // #endif
  }
}

// ============ 新增：卡片详情弹窗数据与逻辑 ============
const showCardModal = ref(false)
const activeCardIdx = ref(0)

const cardDetailsZh = [
  {
    icon: '🎫',
    title: '景区购票',
    details: [
      { label: '成人票', text: '¥210/人（含灵山胜境大门票，可游览灵山大佛、梵宫、五印坛城等全部景点）' },
      { label: '优待票', text: '¥105/人（60周岁以上老人凭身份证、全日制学生凭学生证、身高1.2米以上未成年人）' },
      { label: '儿童票', text: '免费（身高1.2米以下儿童免票；1.2米以上按优待票执行）' },
      { label: '年票', text: '¥580/年（灵山胜境全年不限次入园，含九龙灌浴演出观看权）' },
      { label: '购票须知', text: '建议官方公众号或景区售票处购票，电子票扫码入园，门票当日有效，出园后再次入园需重新购票' },
      { label: '开放时间', text: '旺季（3月-10月）07:30-17:30；淡季（11月-次年2月）08:00-17:00；九龙灌浴每日10:00、11:30、14:00、16:00各一场' }
    ]
  },
  {
    icon: '🌤',
    title: '今日天气',
    details: [
      { label: '常年气候', text: '无锡属亚热带季风气候，四季分明，灵山胜境濒临太湖，微气候湿润宜人，年平均气温15-16°C' },
      { label: '春季（3-5月）', text: '气温10-22°C，万物复苏，山花烂漫，适合踏青赏景，建议携带薄外套' },
      { label: '夏季（6-8月）', text: '气温25-35°C，偶有高温，绿意盎然，建议防晒遮阳，携带饮用水，午后可于梵宫内避暑参观' },
      { label: '秋季（9-11月）', text: '气温15-25°C，秋高气爽，层林尽染，是最佳游玩季节，建议穿着舒适长袖' },
      { label: '冬季（12-2月）', text: '气温0-8°C，偶有降雪，梵宫雪景别具禅意，建议穿着保暖羽绒服，室内外温差大注意增减衣物' },
      { label: '出行穿搭建议', text: '全程步行较多，建议穿舒适运动鞋；梵宫等室内场所需脱鞋参观，建议穿易穿脱鞋款；夏季备遮阳帽，冬季备围巾手套' }
    ]
  },
  {
    icon: '🍜',
    title: '周边美食',
    details: [
      { label: '灵山素面', text: '灵山胜境招牌素面，以菌菇、笋干、面筋等素食食材熬制汤底，面条筋道爽滑，位于无尽意斋可品尝' },
      { label: '禅茶体验', text: '灵山精舍及祥符禅寺提供禅茶体验，选用太湖翠竹、碧螺春等本地名茶，在禅意环境中品茗静心' },
      { label: '灵山素斋', text: '梵宫内素斋餐厅提供精致素食自助，融合淮扬菜与佛教素食传统，菜品造型精美，营养丰富' },
      { label: '无锡小笼包', text: '无锡传统名点，皮薄馅大汁多味甜，景区周边餐馆均可品尝，是来锡必尝美食' },
      { label: '太湖三白', text: '白鱼、白虾、银鱼为太湖特产，景区周边农家乐可品尝新鲜的太湖湖鲜料理' },
      { label: '无锡酱排骨', text: '无锡传统名菜，色泽酱红骨酥肉烂甜咸适口，是馈赠亲友的佳品' }
    ]
  },
  {
    icon: '🏨',
    title: '住宿推荐',
    details: [
      { label: '灵山精舍', text: '景区内禅意主题精品酒店，紧邻灵山梵宫，提供禅修体验、素斋早餐，客房融入佛教元素，参考价位¥680-1280/晚' },
      { label: '灵山君澜温泉酒店', text: '景区周边五星级酒店，配套天然温泉、室内泳池，距景区步行10分钟，参考价位¥580-980/晚' },
      { label: '周边民宿', text: '灵山脚下及周边村落有众多特色民宿，环境清幽价格亲民，参考价位¥200-500/晚，适合家庭出行' },
      { label: '无锡市区酒店', text: '距景区约30公里，品牌酒店选择丰富，交通便利适合商务出行，参考价位¥300-800/晚' },
      { label: '配套服务', text: '景区内酒店提供免费班车接送、行李寄存、禅修课程预约等服务；周边民宿多提供停车场、早餐及旅游咨询服务' },
      { label: '预订建议', text: '旺季及节假日建议提前7天以上预订；灵山精舍房型有限建议提前2周预订；可通过景区官方公众号获取最新优惠信息' }
    ]
  }
]

const cardDetailsEn = [
  {
    icon: '🎫',
    title: 'Ticket Purchase',
    details: [
      { label: 'Adult Ticket', text: '¥210/person (includes Lingshan Scenic Area entrance ticket, valid for Grand Buddha, Buddhist Palace, Five Seal Mandala and all attractions)' },
      { label: 'Discount Ticket', text: '¥105/person (seniors over 60 with ID, full-time students with student ID, children over 1.2m)' },
      { label: 'Child Ticket', text: 'Free (children under 1.2m; children over 1.2m require discount ticket)' },
      { label: 'Annual Pass', text: '¥580/year (unlimited access to Lingshan Scenic Area, includes Nine Dragons Bathing show)' },
      { label: 'Ticket Notice', text: 'Purchase via official WeChat account or scenic area ticket office. E-tickets scanned at entrance. Tickets valid for one day. Re-entry requires new ticket.' },
      { label: 'Opening Hours', text: 'Peak season (Mar-Oct): 07:30-17:30; Off-season (Nov-Feb): 08:00-17:00; Nine Dragons Bathing shows at 10:00, 11:30, 14:00, 16:00 daily' }
    ]
  },
  {
    icon: '🌤',
    title: "Today's Weather",
    details: [
      { label: 'Year-round Climate', text: 'Wuxi has a subtropical monsoon climate with four distinct seasons. Lingshan Scenic Area is near Taihu Lake with humid microclimate, average annual temperature 15-16°C' },
      { label: 'Spring (Mar-May)', text: 'Temp 10-22°C, nature revives with blooming flowers. Ideal for spring outing. Bring light jacket.' },
      { label: 'Summer (Jun-Aug)', text: 'Temp 25-35°C, occasional heat waves. Lush green scenery. Bring sunscreen and water. Visit Buddhist Palace for afternoon shelter.' },
      { label: 'Autumn (Sep-Nov)', text: 'Temp 15-25°C, clear skies with autumn foliage. Best season for visiting. Wear comfortable long sleeves.' },
      { label: 'Winter (Dec-Feb)', text: 'Temp 0-8°C, occasional snow. Beautiful snow scenery at Buddhist Palace. Wear warm down jacket. Watch temperature changes between indoor/outdoor.' },
      { label: 'Outfit Suggestions', text: 'Lots of walking, wear comfortable sneakers. Remove shoes for indoor sites like Buddhist Palace. Bring sun hat in summer, scarf/gloves in winter.' }
    ]
  },
  {
    icon: '🍜',
    title: 'Local Food',
    details: [
      { label: 'Lingshan Vegetarian Noodles', text: 'Signature vegetarian noodles with mushroom, bamboo shoot, and gluten broth. Located at Wu Jin Yi Zhai.' },
      { label: 'Zen Tea Experience', text: 'Zen tea ceremony at Lingshan Jingshe and Xiangfu Temple. Try local teas like Taihu Cuizhu and Biluochun in a tranquil setting.' },
      { label: 'Lingshan Vegetarian Buffet', text: 'Exquisite vegetarian buffet in Buddhist Palace, combining Huaiyang cuisine with Buddhist vegetarian traditions.' },
      { label: 'Wuxi Soup Dumplings', text: 'Traditional Wuxi delicacy with thin skin and rich soup filling. Available at restaurants near the scenic area.' },
      { label: 'Taihu Three Whites', text: 'Whitefish, white shrimp, and silverfish - Taihu Lake specialties. Fresh lake cuisine at nearby farm restaurants.' },
      { label: 'Wuxi Braised Ribs', text: 'Traditional Wuxi dish with glossy red sauce, tender meat on the bone. Perfect gift for friends and family.' }
    ]
  },
  {
    icon: '🏨',
    title: 'Accommodation',
    details: [
      { label: 'Lingshan Jingshe', text: 'Zen-themed boutique hotel within the scenic area, adjacent to Buddhist Palace. Offers meditation sessions and vegetarian breakfast. Prices from ¥680-1280/night.' },
      { label: 'Lingshan Junlan Hot Spring Hotel', text: '5-star hotel near the scenic area with natural hot spring and indoor pool. 10-min walk from entrance. Prices from ¥580-980/night.' },
      { label: 'Nearby Guesthouses', text: 'Charming homestays at the foot of Lingshan Mountain and surrounding villages. Peaceful environment at affordable prices ¥200-500/night. Ideal for families.' },
      { label: 'Wuxi City Hotels', text: 'About 30km from scenic area. Wide selection of brand hotels with convenient transportation. Suitable for business travelers. Prices from ¥300-800/night.' },
      { label: 'Facilities', text: 'On-site hotels offer free shuttle service, luggage storage, and meditation class reservations. Nearby guesthouses provide parking, breakfast, and travel advice.' },
      { label: 'Booking Tips', text: 'Book 7+ days in advance during peak seasons and holidays. Lingshan Jingshe has limited rooms, book 2 weeks ahead. Check official WeChat for latest promotions.' }
    ]
  }
]

const cardDetails = ref(cardDetailsZh)
const activeCardData = ref(cardDetailsZh[0])

const openCardDetail = (idx: number) => {
  activeCardIdx.value = idx
  activeCardData.value = cardDetails.value[idx]
  showCardModal.value = true
}
const closeCardDetail = () => {
  showCardModal.value = false
}

const onToggleLang = () => {
  toggleLang()
}

watch(currentLang, (newLang) => {
  // infoCards / spots 是 computed，自动跟随 currentLang 响应，无需手动赋值
  cardDetails.value = newLang === 'zh' ? cardDetailsZh : cardDetailsEn
  activeCardData.value = cardDetails.value[activeCardIdx.value] || cardDetails.value[0]
})

onMounted(() => {
  initLang()
  // infoCards / spots 是 computed，自动跟随 currentLang 响应，无需手动赋值
  cardDetails.value = currentLang.value === 'zh' ? cardDetailsZh : cardDetailsEn
  activeCardData.value = cardDetails.value[0]
  startAudioLoop()
  startCarousel()
  // D5：获取当前启用的数字人形象配置
  fetchActiveAvatar()
  document.addEventListener('visibilitychange', onVisibilityChange)
  try {
    const saved = localStorage.getItem(FONT_STORAGE_KEY)
    if (saved === '1') {
      isLargeFont.value = true
      applyLargeFont(true)
    }
  } catch (e) { /* 忽略读取异常 */ }
  setInterval(() => {
    showHint.value = !showHint.value
  }, 2500)
  if (!noticeShownInSession) {
    showNotice.value = true
  }
})

// tabBar 切换：离开首页时停止语音，回到首页时恢复
onHide(() => {
  stopAudioLoop()
  pauseCarousel() // 新增：暂停轮播
})

onShow(() => {
  startAudioLoop()
  resumeCarousel() // 新增：恢复轮播
  // D5：页面重新显示时刷新数字人配置（管理后台切换后即时生效）
  fetchActiveAvatar()
})

onUnmounted(() => {
  stopAudioLoop()
  pauseCarousel() // 新增：清理轮播定时器
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

// ============ 新增：用户须知弹窗 ============
// 模块级变量：SPA会话内只弹一次，刷新后重新弹出
let noticeShownInSession = false

const showNotice = ref(false)
const isEnMode = computed(() => currentLang.value === 'en')

const noticeItems = [
  '本灵山导览系统仅供游客免费查询景区游玩信息，禁止商用、爬虫、高频恶意请求接口。',
  '景点、餐饮、民宿价格与营业时间仅作参考，出行前建议电话核实。',
  '智能对话禁止发送广告、辱骂、低俗、敏感违规内容，违规将限制访问权限。',
  '请勿上传身份证、他人肖像、隐私、商业机密等敏感图文资料。',
  '图片预览、问答咨询功能全部免费，页面卡顿可刷新重试。',
  '未成年人使用需监护人陪同，不建议长时间单独操作系统。',
  '若发现信息错误、功能故障，可在对话页面反馈，后台会及时更新修正。'
]

const noticeItemsEn = [
  'This Lingshan guide system is for tourists to query scenic information free of charge. Commercial use, crawling, and malicious API requests are prohibited.',
  'Prices and business hours for attractions, dining, and lodging are for reference only. Please verify by phone before visiting.',
  'The AI chat prohibits advertisements, abusive language, vulgar content, and sensitive material. Violations will restrict access.',
  'Do not upload ID cards, portraits of others, private information, or trade secrets.',
  'Image preview and Q&A features are completely free. If the page is slow, please refresh and retry.',
  'Minors must be accompanied by a guardian. Prolonged unsupervised use is not recommended.',
  'If you find errors or bugs, please report them on the chat page. The backend will fix them promptly.'
]

const closeNotice = () => {
  showNotice.value = false
  noticeShownInSession = true
}

// isEnMode 已改为 computed，自动跟随 currentLang 响应
// ============ 用户须知弹窗结束 ============
</script>

<style lang="scss" scoped>
/* 全屏禁止滚动：使用 fixed + dvh/dvw 适配移动端地址栏伸缩，保证3D数字人在视口几何中心稳定显示 */
.home-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  width: 100dvw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: flex-start; /* 改动：center → flex-start，左对齐布局 */
  padding: 0 3%;               /* 新增：左右内边距 */
  box-sizing: border-box;       /* 新增 */
  gap: 3%;                     /* 新增：左右板块间距 */
}

/* ========== 沉浸式景区背景 ========== */
.scene-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  /* —— 本次改动：背景全局替换为米黄色 —— */
  background: linear-gradient(175deg, #f7f2e3 0%, #f0e8d2 20%, #e8dcc0 40%, #e0d4ae 60%, #d8c99c 80%, #d0be8a 100%);
}

/* 远山 */
.mountain {
  position: absolute;
  bottom: 0;
  border-radius: 50% 50% 0 0;
}
.mountain.far {
  left: -10%;
  width: 70%;
  height: 45%;
  /* —— 本次改动：山体配色适配米黄背景 —— */
  background: linear-gradient(180deg, rgba(205,195,170,0.7) 0%, rgba(185,175,145,0.9) 100%);
  opacity: 0.5;
}
.mountain.mid {
  right: -15%;
  width: 80%;
  height: 40%;
  /* —— 本次改动：山体配色适配米黄背景 —— */
  background: linear-gradient(180deg, rgba(195,182,155,0.6) 0%, rgba(175,165,135,0.85) 100%);
  opacity: 0.6;
}
.mountain.near {
  left: 10%;
  width: 90%;
  height: 32%;
  /* —— 本次改动：山体配色适配米黄背景 —— */
  background: linear-gradient(180deg, rgba(180,168,140,0.8) 0%, rgba(160,148,118,0.95) 100%);
  opacity: 0.75;
}

/* 水面 */
.water {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 15%;
  /* —— 本次改动：水面配色适配米黄背景 —— */
  background: linear-gradient(180deg, rgba(210,198,168,0.4) 0%, rgba(190,175,140,0.6) 50%, rgba(170,155,120,0.8) 100%);
  animation: waterShimmer 6s ease-in-out infinite;
}
@keyframes waterShimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.8; }
}

/* 雾气 */
.mist {
  position: absolute;
  border-radius: 50%;
  filter: blur(60rpx);
  opacity: 0.15;
}
.mist.m1 {
  width: 120%;
  height: 200rpx;
  bottom: 30%;
  left: -10%;
  /* —— 本次改动：雾气配色适配米黄背景 —— */
  background: rgba(240, 232, 210, 0.6);
  animation: drift 20s ease-in-out infinite;
}
.mist.m2 {
  width: 100%;
  height: 160rpx;
  bottom: 20%;
  left: 0;
  /* —— 本次改动：雾气配色适配米黄背景 —— */
  background: rgba(235, 225, 200, 0.5);
  animation: drift 25s ease-in-out infinite reverse;
}
@keyframes drift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(40rpx); }
}

/* 星星 */
.stars {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
}
.star {
  position: absolute;
  width: 4rpx;
  height: 4rpx;
  /* —— 本次改动：星星配色适配米黄背景 —— */
  background: rgba(180, 160, 110, 0.8);
  border-radius: 50%;
  animation: twinkle 3s ease-in-out infinite;
}
@for $i from 1 through 20 {
  .s#{$i} {
    $x: ($i * 37) % 100;
    $y: ($i * 23) % 100;
    $d: ($i * 0.3) + 1;
    left: #{$x}%;
    top: #{$y}%;
    width: #{2 + ($i % 3) * 2}rpx;
    height: #{2 + ($i % 3) * 2}rpx;
    animation-delay: #{$d}s;
  }
}
@keyframes twinkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* 萤火虫 */
.firefly {
  position: absolute;
  width: 8rpx;
  height: 8rpx;
  /* —— 本次改动：萤火虫配色适配米黄背景 —— */
  background: radial-gradient(circle, rgba(200,175,120,0.7) 0%, rgba(180,155,90,0) 70%);
  border-radius: 50%;
  box-shadow: 0 0 12rpx rgba(200,175,120,0.4);
}
@for $i from 1 through 8 {
  .f#{$i} {
    $x: 10 + ($i * 11) % 80;
    $y: 40 + ($i * 9) % 40;
    left: #{$x}%;
    top: #{$y}%;
    animation: firefly#{$i} #{6 + $i * 2}s ease-in-out infinite;
  }
}
@for $i from 1 through 8 {
  @keyframes firefly#{$i} {
    0%, 100% {
      transform: translate(0, 0);
      opacity: 0.3;
    }
    25% {
      transform: translate(#{20 + $i * 5}rpx, #{-15 - $i * 3}rpx);
      opacity: 1;
    }
    50% {
      transform: translate(#{-10 - $i * 3}rpx, #{20 + $i * 4}rpx);
      opacity: 0.6;
    }
    75% {
      transform: translate(#{15 + $i * 4}rpx, #{10 + $i * 2}rpx);
      opacity: 1;
    }
  }
}

/* ========== 数字人区域（背景板整合：.avatar-area 作为定位容器，.avatar-stage 作为统一背景板） ========== */
.avatar-area {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
  width: 38%;
  /* 与 .home-screen 等高，垂直方向由父级 flex align-items:center 控制居中 */
  align-self: stretch;
  overflow: hidden;
}

/* 背景板：数字人与光晕的统一容器，是双重居中的稳定锚点。
   宽高比锁定 3:4（与全身数字人画布比例接近），保证模型在画布内完整显示且不变形。
   通过 inset:0 + margin:auto 在 .avatar-area 内绝对居中，且不依赖 transform，
   页面缩放/滚动/窗口变化时相对位置固定不变。 */
.avatar-stage {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  /* 限制背景板尺寸：宽度 66.67%，高度按 3:4 比例由 width 派生，保证不溢出 .avatar-area */
  width: 66.67%;
  /* 高度上限为 .avatar-area 的 80%，留出顶部空间避免与 click-hint 重叠 */
  max-height: 80%;
  /* 通过 aspect-ratio 锁定 3:4 比例；不支持的浏览器回退到 padding-top 技巧（下方 hack） */
  aspect-ratio: 3 / 4;
  /* 视觉融合：圆角 + 渐变背景 + 阴影 + 微边框，使光晕与数字人形成统一整体 */
  border-radius: 24rpx;
  background: radial-gradient(ellipse at 50% 55%, rgba(167,139,250,0.16) 0%, rgba(167,139,250,0.05) 50%, transparent 82%);
  box-shadow:
    0 12rpx 60rpx rgba(167,139,250,0.18),
    inset 0 0 40rpx rgba(255,255,255,0.04);
  border: 1rpx solid rgba(167,139,250,0.18);
  overflow: hidden;
  /* 背景板入场过渡，使融合呈现自然协调 */
  transition: box-shadow 0.4s ease, transform 0.4s ease;
}

.avatar-glow {
  position: absolute;
  /* 完全填满 .avatar-stage，与数字人画布像素级重合，实现视觉融合 */
  inset: 0;
  margin: auto;
  width: 100%;
  height: 100%;
  /* 椭圆光晕匹配背景板形状，避免圆形渐变与矩形容器不协调 */
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(167,139,250,0.3) 0%, rgba(167,139,250,0.1) 40%, transparent 70%);
  animation: glowPulse 4s ease-in-out infinite;
  pointer-events: none;
  /* 与 .avatar-stage 圆角融合，避免光晕溢出圆角 */
  overflow: hidden;
}
@keyframes glowPulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}

/* 数字人容器：与 .avatar-glow 完全重合（同样 inset:0 + 100%×100%），
   使数字人画布几何中心 = 背景板几何中心，实现水平+垂直双重精确居中。
   模型缩放与取景由 Three.js computeFitDistance + clampDistanceToBounds 自动适配，
   保证任何窗口尺寸下模型完整显示且不溢出画布边界。 */
.enlarged-avatar {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 100%;
  height: 100%;
  z-index: 2;
}

/* 点击提示：改为绝对定位到底部，不占用 flex 空间，
   这样 Avatar3D 能真正在 .avatar-area 垂直中心，与光晕框对齐 */
.click-hint {
  position: absolute;
  bottom: 40rpx;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.8s ease;
}
.click-hint.pulse {
  animation: hintPulse 2.5s ease-in-out infinite;
}
@keyframes hintPulse {
  /* translateX(-50%) 必须合并进动画，否则 pulse 时水平居中会失效 */
  0%, 100% { opacity: 0.5; transform: translateX(-50%) translateY(0); }
  50% { opacity: 1; transform: translateX(-50%) translateY(-8rpx); }
}

.hint-text {
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  letter-spacing: 4rpx;
  text-shadow: 0 2rpx 12rpx rgba(167, 139, 250, 0.5);
}

.hint-arrow {
  margin-top: 12rpx;
}
.arrow-line {
  width: 40rpx;
  height: 4rpx;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 2rpx;
  position: relative;
  animation: arrowBounce 1.5s ease-in-out infinite;
}
@keyframes arrowBounce {
  0%, 100% { transform: scaleX(0.6); opacity: 0.3; }
  50% { transform: scaleX(1); opacity: 0.8; }
}

/* ========== 管理员入口 ========== */
.admin-entry {
  position: fixed;
  top: 60rpx;
  right: 30rpx;
  z-index: 20;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  backdrop-filter: blur(10rpx);
  border: 1rpx solid rgba(255, 255, 255, 0.1);

  .admin-icon {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.3);
  }
}

/* ========== 语言切换按钮（English，左侧） ========== */
.lang-toggle-btn {
  position: fixed;
  top: 56rpx;
  right: 460rpx;
  z-index: 20;
  height: 56rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.25);
  border-radius: 28rpx;
  backdrop-filter: blur(10rpx);
  border: 1rpx solid rgba(167, 139, 250, 0.35);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.3s ease;

  &:active {
    background: rgba(167, 139, 250, 0.45);
  }

  .lang-toggle-text {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 600;
    letter-spacing: 2rpx;
    white-space: nowrap;
  }
}

/* ========== 大字版切换按钮（右侧，紧邻管理员入口左侧） ========== */
.font-toggle-btn {
  position: fixed;
  top: 56rpx;
  right: 110rpx;
  z-index: 20;
  height: 56rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.25);
  border-radius: 28rpx;
  backdrop-filter: blur(10rpx);
  border: 1rpx solid rgba(167, 139, 250, 0.35);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.3s ease;

  &:active {
    background: rgba(167, 139, 250, 0.45);
  }

  .font-toggle-text {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 600;
    letter-spacing: 2rpx;
    white-space: nowrap;
  }
}

/* ====================================================================== */
/* ====== 新增：右侧面板（景点轮播 + 信息卡片）全部为新增代码，不覆盖任何原有样式 ====== */
/* ====================================================================== */

.right-panel {
  position: relative;
  z-index: 10;
  flex: 1;
  height: 86vh;
  display: flex;
  flex-direction: column;
  /* —— 本次改动：拉开轮播与按钮间距 36rpx → 52rpx —— */
  gap: 52rpx;
  /* —— 本次改动：右侧面板顶部留间距，不贴顶 —— */
  padding-top: 20rpx;
  /* —— 本次改动：底部留更大空白 —— */
  padding-bottom: 40rpx;
}

/* ====== 右上：景点轮播 ====== */
.carousel-section {
  position: relative;
  /* —— 本次改动：轮播高度缩小 58% → 48% —— */
  flex: 0 0 48%;
  border-radius: 20rpx;
  overflow: hidden;
  background: rgba(20, 25, 60, 0.45);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20rpx);
  /* 新增：hover 柔和淡蓝色外阴影 */
  transition: box-shadow 0.4s ease;
}
.carousel-section:hover {
  box-shadow: 0 0 50rpx rgba(100, 140, 230, 0.25);
}

.carousel-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 20rpx;
}

.carousel-track {
  display: flex;
  height: 100%;
  /* 新增：柔和顺滑的切换过渡动画 */
  transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: transform;
}

.carousel-slide {
  flex: 0 0 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* 轮播图片占位区域 */
.carousel-image-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(45, 55, 100, 0.35) 0%, rgba(25, 32, 70, 0.55) 100%);
}
/* 轮播图片样式 */
.carousel-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.carousel-img-placeholder {
  font-size: 40rpx;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 8rpx;
}

/* 景点标题与描述 */
.carousel-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 28rpx 32rpx 32rpx;
  background: linear-gradient(to top, rgba(10, 14, 39, 0.85) 0%, rgba(10, 14, 39, 0) 100%);
  display: flex;
  flex-direction: column;
}
.carousel-spot-name {
  font-size: 34rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 2rpx;
}
.carousel-spot-desc {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 8rpx;
}

/* 手动切换按钮 */
.carousel-nav {
  position: absolute;
  top: 42%;
  transform: translateY(-50%);
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 25, 60, 0.55);
  border-radius: 50%;
  cursor: pointer;
  z-index: 5;
  transition: background 0.3s ease;
}
.carousel-nav:hover {
  background: rgba(45, 55, 110, 0.8);
}
.carousel-nav.prev {
  left: 18rpx;
}
.carousel-nav.next {
  right: 18rpx;
}
.nav-arrow {
  font-size: 44rpx;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1;
}

/* 指示点 */
.carousel-dots {
  position: absolute;
  bottom: 18rpx;
  /* —— 本次改动：从 right:24rpx 改为水平居中 —— */
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10rpx;
  z-index: 5;
}
.carousel-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: all 0.3s ease;
}
.carousel-dot.active {
  background: rgba(167, 139, 250, 0.8);
  width: 32rpx;
  border-radius: 6rpx;
}

/* ====== 右下：2×2 APP图标圆角方块按钮 ====== */
.cards-section {
  flex: 1;
  display: grid;
  /* —— 本次改动：四按钮横向单行排列（2×2 → 1×4）—— */
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: 1fr;
  /* —— 本次改动：按钮间距 —— */
  gap: 32rpx;
  /* —— 本次改动：底部预留空白 —— */
  margin-bottom: 30rpx;
  /* —— 本次改动：整体向下偏移 —— */
  margin-top: 16rpx;
  /* —— 本次改动：水平居中对齐 —— */
  justify-items: center;
  align-items: center;
}

/* —— 本次新增：APP图标圆角方块按钮样式 —— */
.app-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  width: 100%;
  height: 100%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.app-btn:hover {
  transform: translateY(-6rpx);
}
.app-btn:hover .app-btn-icon-box {
  box-shadow: 0 12rpx 40rpx rgba(80, 110, 200, 0.25);
}

.app-btn-icon-box {
  width: 140rpx;
  height: 140rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 28rpx;
  background: linear-gradient(145deg, rgba(45, 55, 110, 0.55) 0%, rgba(25, 32, 70, 0.65) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(15rpx);
  transition: box-shadow 0.3s ease;
}
.app-btn-icon {
  font-size: 60rpx;
  line-height: 1;
}
.app-btn-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 2rpx;
}

/* ====== 新增：卡片详情弹窗样式 ====== */
.card-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: rgba(10, 14, 39, 0.7);
  backdrop-filter: blur(8rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: modalFadeIn 0.3s ease;
}
@keyframes modalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.card-modal {
  width: 600rpx;
  max-height: 80vh;
  overflow-y: auto;
  border-radius: 20rpx;
  background: linear-gradient(180deg, rgba(30, 38, 80, 0.95) 0%, rgba(20, 25, 60, 0.95) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20rpx 80rpx rgba(0, 0, 0, 0.5);
  animation: modalSlideUp 0.35s ease;
}
@keyframes modalSlideUp {
  from { transform: translateY(30rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 36rpx 24rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}
.modal-header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.modal-icon {
  font-size: 40rpx;
}
.modal-title {
  font-size: 34rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 2rpx;
}
.modal-close {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 0.3s ease;
}
.modal-close:hover {
  background: rgba(255, 255, 255, 0.12);
}
.close-x {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1;
}

.modal-body {
  padding: 24rpx 36rpx 36rpx;
}
.modal-detail-item {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.04);
}
.modal-detail-item:last-child {
  border-bottom: none;
}
.detail-label {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(167, 139, 250, 0.85);
  flex-shrink: 0;
}
.detail-text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.6;
}

/* ====== 新增：移动端自适应（窄屏竖向排列） ====== */
@media screen and (max-width: 768px) {
    .home-screen {
      flex-direction: column;
      justify-content: flex-start;
      padding: 0 4%;
      gap: 20rpx;
    }
    .avatar-area {
      width: 100%;
      /* 窄屏下给数字人区域固定高度，避免 flex 流挤压导致背景板变形 */
      height: 60vh;
      max-height: 540rpx;
      padding-top: 40rpx;
      padding-bottom: 80rpx;
      align-self: stretch;
    }
    /* 窄屏下背景板宽度放大到 80%，保持 3:4 比例居中显示 */
    .avatar-stage {
      width: 80%;
      max-height: 100%;
    }
    .right-panel {
      width: 100%;
      height: auto;
      flex: 1;
      min-height: 400rpx;
    }
    /* —— 本次改动：窄屏时四按钮回退为2×2排列 —— */
    .cards-section {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
    }
  }

  /* ====== 超窄屏（<375px，iPhone SE 等小屏）进一步压缩 ====== */
  @media screen and (max-width: 374px) {
    .avatar-area {
      height: 50vh;
      max-height: 460rpx;
      padding-top: 20rpx;
    }
    .avatar-stage {
      width: 86%;
    }
  }

  /* ====== 平板竖屏（768px ~ 1024px）背景板微调 ====== */
  @media screen and (min-width: 769px) and (max-width: 1024px) {
    .avatar-stage {
      width: 72%;
    }
  }

  /* =========== 轮播图全屏图片预览（POV第一人称观景视角） =========== */
  .carousel-preview-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    /* 半透明底色 + 高斯模糊，虚化底层页面背景 */
    background: rgba(10, 14, 39, 0.45);
    backdrop-filter: blur(30rpx);
    -webkit-backdrop-filter: blur(30rpx);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    animation: previewOverlayIn 0.4s ease;
  }
  @keyframes previewOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .carousel-preview-img {
    /* 居中显示，60vw × 60vh */
    max-width: 60vw;
    max-height: 60vh;
    object-fit: contain;
    /* 美化：柔和圆角 */
    border-radius: 24rpx;
    /* 美化：渐变阴影 + 精致边框，提升画面质感 */
    border: 2rpx solid rgba(255, 255, 255, 0.12);
    box-shadow:
      0 8rpx 120rpx rgba(0, 0, 0, 0.55),
      0 0 80rpx rgba(167, 139, 250, 0.12),
      inset 0 0 60rpx rgba(255, 255, 255, 0.03);
    cursor: pointer;
    /* 图片微调色，提升观感 */
    filter: contrast(1.03) saturate(1.06);
    animation: previewImgIn 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  @keyframes previewImgIn {
    from { transform: scale(0.93) translateY(16rpx); opacity: 0; }
    to { transform: scale(1) translateY(0); opacity: 1; }
  }
  .carousel-preview-close {
    position: fixed;
    top: 28rpx;
    right: 28rpx;
    z-index: 10000;
    width: 68rpx;
    height: 68rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    /* 美化关闭按钮：毛玻璃质感 */
    background: rgba(255, 255, 255, 0.1);
    border: 1rpx solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12rpx);
    -webkit-backdrop-filter: blur(12rpx);
    color: rgba(255, 255, 255, 0.78);
    font-size: 34rpx;
    cursor: pointer;
    transition: all 0.3s ease;
    pointer-events: auto;
  }
  .carousel-preview-close:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  /* ======== 用户须知弹窗样式（暖色融合版）======== */
  .notice-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99999;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .notice-popup {
    position: relative;
    width: 60vw;
    max-width: 720px;
    max-height: 75vh;
    overflow-y: auto;
    padding: 0 0 36rpx;
    border-radius: 28rpx;
    background-color: rgba(255, 252, 245, 0.96);
    border: 1rpx solid rgba(160, 120, 80, 0.25);
    box-shadow: 0 12rpx 52rpx rgba(120, 90, 60, 0.18);
    animation: noticeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes noticeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .notice-close {
    position: absolute;
    top: 16rpx;
    right: 16rpx;
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: 1rpx solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    font-size: 36rpx;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 2;
  }

  .notice-close:hover {
    background: rgba(255, 255, 255, 0.35);
    color: #ffffff;
    transform: scale(1.12);
  }

  .notice-title {
    display: block;
    text-align: center;
    font-size: 40rpx;
    font-weight: bold;
    letter-spacing: 4rpx;
    color: #ffffff;
    margin-bottom: 0;
    padding: 28rpx 48rpx 24rpx;
    background: linear-gradient(90deg, #b89678, #a07b5c);
    border-bottom: 1rpx solid rgba(160, 120, 80, 0.2);
    border-radius: 28rpx 28rpx 0 0;
  }

  .notice-list {
    display: flex;
    flex-direction: column;
    gap: 22rpx;
    padding: 28rpx 40rpx 0;
  }

  .notice-item {
    display: flex;
    align-items: flex-start;
    gap: 10rpx;
    padding-left: 8rpx;
  }

  .notice-num {
    font-size: 26rpx;
    font-weight: bold;
    color: #a07b5c;
    flex-shrink: 0;
    min-width: 36rpx;
  }

  .notice-text {
    font-size: 26rpx;
    color: #33281e;
    line-height: 1.75;
    flex: 1;
    word-spacing: 1rpx;
  }
</style>
