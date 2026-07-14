<template>
  <view class="routes-container">
    <!-- 返回按钮 -->
    <view class="back-btn" @click="goBack">
      <text class="back-icon">‹</text>
    </view>
    <view class="routes-header">
      <text class="header-title">{{ t('routes.title') }}</text>
      <text class="header-subtitle">{{ t('routes.sub') }}</text>
    </view>

    <view class="interest-selector">
      <view class="selector-title">{{ t('routes.select') }}</view>
      <view class="interest-list">
        <view 
          class="interest-item" 
          v-for="interest in interests" 
          :key="interest"
          :class="{ active: selectedInterests.includes(interest) }"
          @click="toggleInterest(interest)"
        >
          <text>{{ interest }}</text>
        </view>
      </view>
      <view v-if="selectedInterests.length > 0" class="recommend-btn" @click="getRecommend">
        <text>{{ t('routes.recommend') }}</text>
      </view>
    </view>

    <view class="routes-list">
      <view 
        class="route-card" 
        v-for="route in routes" 
        :key="route.id"
        @click="showRouteDetail(route)"
      >
        <view class="route-header">
          <view class="route-icon">
            <text>{{ getRouteIcon(route.name) }}</text>
          </view>
          <view class="route-info">
            <text class="route-name">{{ route.name }}</text>
            <text class="route-desc">{{ route.description }}</text>
          </view>
        </view>
        <view class="route-meta">
          <view class="meta-item">
            <text class="meta-icon">⏱️</text>
            <text class="meta-value">{{ route.duration }} {{ t('routes.duration') }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-icon">📍</text>
            <text class="meta-value">{{ route.distance }} {{ t('routes.distance') }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-icon">{{ getDifficultyIcon(route.difficulty) }}</text>
            <text class="meta-value">{{ getDifficultyText(route.difficulty) }}</text>
          </view>
        </view>
        <view class="route-tags">
          <view class="tag" v-for="tag in route.suitableFor" :key="tag">
            <text>{{ tag }}</text>
          </view>
        </view>
        <view class="route-spots">
          <text class="spots-title">{{ t('routes.spots') }}</text>
          <view class="spots-list">
            <view class="spot-item" v-for="(spot, index) in route.spots.slice(0, 3)" :key="spot.id">
              <view class="spot-order">{{ index + 1 }}</view>
              <text class="spot-name">{{ spot.name }}</text>
            </view>
            <view v-if="route.spots.length > 3" class="spot-more">
              <text>+{{ route.spots.length - 3 }}{{ currentLang === 'zh' ? '个景点' : ' more' }}</text>
            </view>
          </view>
        </view>
        <view class="route-action" @click.stop="startTour(route)">
          <text>{{ t('routes.start') }}</text>
        </view>
      </view>
    </view>

    <view v-if="showDetail" class="detail-modal" @click="closeDetail">
      <view class="detail-content" @click.stop>
        <view class="detail-header">
          <text class="detail-title">{{ selectedRoute?.name }}</text>
          <view class="close-btn" @click="closeDetail">
            <text>✕</text>
          </view>
        </view>
        <scroll-view class="detail-body" scroll-y>
          <view class="detail-desc">{{ selectedRoute?.description }}</view>
          <view class="detail-meta">
            <view class="detail-meta-item">
              <text class="detail-meta-icon">⏱️</text>
              <text class="detail-meta-value">{{ selectedRoute?.duration }} {{ t('routes.duration') }}</text>
            </view>
            <view class="detail-meta-item">
              <text class="detail-meta-icon">📍</text>
              <text class="detail-meta-value">{{ selectedRoute?.distance }} {{ t('routes.distance') }}</text>
            </view>
            <view class="detail-meta-item">
              <text class="detail-meta-icon">{{ getDifficultyIcon(selectedRoute?.difficulty || 'easy') }}</text>
              <text class="detail-meta-value">{{ getDifficultyText(selectedRoute?.difficulty || 'easy') }}</text>
            </view>
          </view>
          <view class="detail-section">
            <text class="detail-section-title">{{ t('routes.suitable-for') }}</text>
            <view class="detail-tags">
              <view class="detail-tag" v-for="tag in selectedRoute?.suitableFor" :key="tag">
                <text>{{ tag }}</text>
              </view>
            </view>
          </view>
          <view class="detail-section">
            <text class="detail-section-title">{{ t('routes.tour-route') }}</text>
            <view class="detail-spots">
              <view 
                class="detail-spot-item" 
                v-for="(spot, index) in selectedRoute?.spots" 
                :key="spot.id"
              >
                <view class="detail-spot-order">{{ index + 1 }}</view>
                <view class="detail-spot-info">
                  <text class="detail-spot-name">{{ spot.name }}</text>
                  <text class="detail-spot-desc">{{ spot.description }}</text>
                  <text class="detail-spot-time">⏱️ {{ spot.duration }} {{ t('routes.duration') }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="detail-footer">
          <button class="btn btn-primary btn-lg btn-block" @click="selectedRoute && startTour(selectedRoute)">
            <text>{{ t('routes.start') }}</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TourRoute } from '@/types'
import { mockRoutes } from '@/data/mock'
import { currentLang, t } from '@/i18n'

const interestsZh = ['历史文化', '自然风光', '亲子活动', '摄影打卡', '徒步登山']
const interestsEn = ['History & Culture', 'Natural Scenery', 'Family Activities', 'Photo Spots', 'Hiking']
const interests = computed(() => currentLang.value === 'zh' ? interestsZh : interestsEn)

const routesZh = mockRoutes
const routesEn: TourRoute[] = [
  {
    id: 'route_1',
    name: 'Classic Pilgrimage Tour',
    description: 'Starting from the ticket gate, walk through Bodhi Avenue, Nine Dragons Bathing, Xiangfu Temple, and finally reach the Grand Buddha. Covers all core attractions.',
    duration: 230,
    distance: 3.8,
    difficulty: 'medium',
    suitableFor: ['First Time Visitors', 'Buddhist Devotees', 'Day Trip'],
    spots: [
      { id: 'futan', name: 'Buddha Footprints Plaza', description: 'Admire the Buddha\'s footprints with 32 auspicious patterns', imageUrl: '', duration: 15, order: 1 },
      { id: 'puti-dadao', name: 'Bodhi Avenue', description: 'Walk through Indian bodhi trees, feel the Zen atmosphere', imageUrl: '', duration: 10, order: 2 },
      { id: 'jiulong', name: 'Nine Dragons Bathing', description: 'Watch the spectacular "Lotus Opens to Reveal Buddha" performance', imageUrl: '', duration: 25, order: 3 },
      { id: 'baizi', name: 'Hundred Children Playing with Maitreya', description: 'Touch Maitreya\'s belly for blessings, popular photo spot', imageUrl: '', duration: 15, order: 4 },
      { id: 'xiangfu', name: 'Xiangfu Temple', description: 'Millennium-old temple, hear the sacred bell', imageUrl: '', duration: 35, order: 5 },
      { id: 'xingtan', name: 'Xingtan Plaza', description: 'Plaza at the Buddha\'s feet, best viewing position', imageUrl: '', duration: 15, order: 6 },
      { id: 'buddha', name: 'Grand Buddha', description: 'World\'s tallest bronze Buddha, touch the feet for blessings', imageUrl: '', duration: 50, order: 7 },
      { id: 'fangong', name: 'Lingshan Buddhist Palace', description: 'Oriental Louvre, treasure of intangible cultural heritage', imageUrl: '', duration: 40, order: 8 },
      { id: 'scenic-exit', name: 'Exit', description: 'Tour ends, proceed to exit', imageUrl: '', duration: 5, order: 9 }
    ]
  },
  {
    id: 'route_2',
    name: 'Full Experience Tour',
    description: 'Complete coverage of all major attractions including Mandala, Buddhist Palace, and Grand Buddha. Perfect for a full-day visit.',
    duration: 360,
    distance: 5.2,
    difficulty: 'medium',
    suitableFor: ['Deep Travelers', 'Culture Enthusiasts', 'Photography'],
    spots: [
      { id: 'futan', name: 'Buddha Footprints Plaza', description: 'First stop for pilgrimage', imageUrl: '', duration: 15, order: 1 },
      { id: 'puti-dadao', name: 'Bodhi Avenue', description: 'Zen walk under bodhi trees', imageUrl: '', duration: 10, order: 2 },
      { id: 'jiulong', name: 'Nine Dragons Bathing', description: 'Dragons spray water, lotus opens to reveal Buddha', imageUrl: '', duration: 25, order: 3 },
      { id: 'wuyin', name: 'Five Seal Mandala', description: 'Tibetan Buddhist art hall with Thangkas and murals', imageUrl: '', duration: 30, order: 4 },
      { id: 'fangong', name: 'Lingshan Buddhist Palace', description: 'World Buddhist Forum venue, magnificent interior', imageUrl: '', duration: 45, order: 5 },
      { id: 'manfeilong', name: 'Manfeilong Pagoda', description: 'Climb for panoramic views of Taihu Lake', imageUrl: '', duration: 20, order: 6 },
      { id: 'sushi', name: 'Vegetarian Restaurant', description: 'Try Lingshan vegetarian cuisine', imageUrl: '', duration: 30, order: 7 },
      { id: 'baizi', name: 'Hundred Children Playing with Maitreya', description: 'Joyful blessings, family interaction', imageUrl: '', duration: 15, order: 8 },
      { id: 'xiangfu', name: 'Xiangfu Temple', description: 'Millennium Zen temple, worship and pray', imageUrl: '', duration: 35, order: 9 },
      { id: 'palm', name: 'Buddha Palm', description: 'The largest palm replica, touch for blessings', imageUrl: '', duration: 15, order: 10 },
      { id: 'xingtan', name: 'Xingtan Plaza', description: 'At the Buddha\'s feet, admire the sacred image', imageUrl: '', duration: 15, order: 11 },
      { id: 'buddha', name: 'Grand Buddha', description: '88m bronze Buddha, overlook Taihu Lake', imageUrl: '', duration: 50, order: 12 },
      { id: 'scenic-exit', name: 'Exit', description: 'Tour ends, proceed to exit', imageUrl: '', duration: 5, order: 13 }
    ]
  },
  {
    id: 'route_3',
    name: 'Casual Half-Day Tour',
    description: 'Essential attractions in a time-friendly half-day itinerary. Perfect for families with elderly and children.',
    duration: 150,
    distance: 2.4,
    difficulty: 'easy',
    suitableFor: ['Family Tour', 'Seniors & Kids', 'Time Constrained'],
    spots: [
      { id: 'puti-dadao', name: 'Bodhi Avenue', description: 'Leisure walk under bodhi trees', imageUrl: '', duration: 10, order: 1 },
      { id: 'jiulong', name: 'Nine Dragons Bathing', description: 'Must-see dynamic performance', imageUrl: '', duration: 25, order: 2 },
      { id: 'wuyin', name: 'Five Seal Mandala', description: 'Tibetan Buddhist cultural experience', imageUrl: '', duration: 30, order: 3 },
      { id: 'fangong', name: 'Lingshan Buddhist Palace', description: 'Art tour at Oriental Louvre', imageUrl: '', duration: 45, order: 4 },
      { id: 'sushi', name: 'Vegetarian Restaurant', description: 'Lingshan vegetarian noodles, Zen lunch', imageUrl: '', duration: 30, order: 5 },
      { id: 'scenic-exit', name: 'Exit', description: 'Tour ends, proceed to exit', imageUrl: '', duration: 5, order: 6 }
    ]
  },
  {
    id: 'route_4',
    name: 'Buddhist Pilgrimage Route',
    description: 'Specially designed for devotees. From Buddha Footprints to the Grand Buddha, every step is a pilgrimage.',
    duration: 180,
    distance: 3.2,
    difficulty: 'medium',
    suitableFor: ['Buddhist Devotees', 'Pilgrimage', 'Senior Devotees'],
    spots: [
      { id: 'futan', name: 'Buddha Footprints Plaza', description: 'Admire footprints, start of pilgrimage', imageUrl: '', duration: 15, order: 1 },
      { id: 'jile-lifo', name: 'Life Release Pond', description: 'Devoutly pray for peace', imageUrl: '', duration: 20, order: 2 },
      { id: 'palm', name: 'Buddha Palm', description: 'Touch the palm, receive blessings', imageUrl: '', duration: 15, order: 3 },
      { id: 'baizi', name: 'Hundred Children Playing with Maitreya', description: 'Maitreya joy, family harmony', imageUrl: '', duration: 15, order: 4 },
      { id: 'xiangfu', name: 'Xiangfu Temple', description: 'Millennium-old temple, devout worship', imageUrl: '', duration: 40, order: 5 },
      { id: 'xingtan', name: 'Xingtan Plaza', description: 'Ascend, prepare to worship the Buddha', imageUrl: '', duration: 15, order: 6 },
      { id: 'buddha', name: 'Grand Buddha', description: 'Touch the feet, complete blessings', imageUrl: '', duration: 50, order: 7 },
      { id: 'sushi', name: 'Vegetarian Restaurant', description: 'Blessing vegetarian meal', imageUrl: '', duration: 30, order: 8 },
      { id: 'scenic-exit', name: 'Exit', description: 'Tour ends, proceed to exit', imageUrl: '', duration: 5, order: 9 }
    ]
  }
]

const routes = computed(() => currentLang.value === 'zh' ? routesZh : routesEn)
const selectedInterests = ref<string[]>([])
const showDetail = ref(false)
const selectedRoute = ref<TourRoute | null>(null)

const goBack = () => {
  uni.navigateBack()
}

const toggleInterest = (interest: string) => {
  const index = selectedInterests.value.indexOf(interest)
  if (index > -1) {
    selectedInterests.value.splice(index, 1)
  } else {
    selectedInterests.value.push(interest)
  }
}

const getRecommend = () => {
  if (selectedInterests.value.length === 0) {
    uni.showToast({ title: t('routes.select-interests'), icon: 'none' })
    return
  }
  uni.showToast({ title: t('routes.recommend-done'), icon: 'none' })
}

const getRouteIcon = (name: string) => {
  if (currentLang.value === 'zh') {
    if (name.includes('文化')) return '🏛️'
    if (name.includes('自然')) return '🌿'
    if (name.includes('亲子')) return '👨👩👧👦'
  } else {
    if (name.includes('Culture') || name.includes('Pilgrimage')) return '🏛️'
    if (name.includes('Natural') || name.includes('Experience')) return '🌿'
    if (name.includes('Family') || name.includes('Casual')) return '👨👩👧👦'
  }
  return '🗺️'
}

const getDifficultyIcon = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return '😊'
    case 'medium': return '😐'
    case 'hard': return '😰'
    default: return '😊'
  }
}

const getDifficultyText = (difficulty: string) => {
  if (currentLang.value === 'en') {
    switch (difficulty) {
      case 'easy': return 'Easy'
      case 'medium': return 'Medium'
      case 'hard': return 'Challenging'
      default: return 'Easy'
    }
  }
  switch (difficulty) {
    case 'easy': return '轻松'
    case 'medium': return '中等'
    case 'hard': return '挑战'
    default: return '轻松'
  }
}

const showRouteDetail = (route: TourRoute) => {
  selectedRoute.value = route
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  selectedRoute.value = null
}

const startTour = (route: TourRoute) => {
  if (!route.spots || route.spots.length === 0) return
  const spotIds = route.spots.map(s => s.id).join(',')
  const lastName = route.spots[route.spots.length - 1].name
  const lastId = route.spots[route.spots.length - 1].id
  uni.navigateTo({
    url: `/pages/visitor/navigation?name=${encodeURIComponent(route.name)}&dest=${lastId}&waypoints=${spotIds}`
  })
}
</script>

<style lang="scss" scoped>
.routes-container {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 120rpx;
}

/* 返回按钮 */
.back-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 24rpx);
  left: 24rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;

  &:active {
    transform: scale(0.92);
  }

  .back-icon {
    font-size: 48rpx;
    color: #fff;
    line-height: 44rpx;
    font-weight: 300;
  }
}

.routes-header {
  background: linear-gradient(135deg, $primary-color 0%, $primary-dark 100%);
  padding: $spacing-xl $spacing-lg;
  text-align: center;
}

.header-title {
  display: block;
  font-size: $font-size-title;
  font-weight: 700;
  color: #fff;
  margin-bottom: $spacing-xs;
}

.header-subtitle {
  font-size: $font-size-base;
  color: rgba(255, 255, 255, 0.8);
}

.interest-selector {
  background: #fff;
  margin: $spacing-base;
  padding: $spacing-base;
  border-radius: $border-radius-lg;
  box-shadow: $shadow-sm;
}

.selector-title {
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-base;
}

.interest-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.interest-item {
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: 100rpx;
  transition: $transition-fast;
  
  text {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
  
  &.active {
    background: $primary-color;
    
    text {
      color: #fff;
    }
  }
}

.recommend-btn {
  margin-top: $spacing-base;
  background: $primary-light;
  padding: $spacing-base;
  border-radius: $border-radius;
  text-align: center;
  
  text {
    font-size: $font-size-base;
    color: $primary-color;
    font-weight: 500;
  }
}

.routes-list {
  padding: 0 $spacing-base;
}

.route-card {
  background: #fff;
  border-radius: $border-radius-lg;
  padding: $spacing-base;
  margin-bottom: $spacing-base;
  box-shadow: $shadow-sm;
}

.route-header {
  display: flex;
  gap: $spacing-base;
  margin-bottom: $spacing-base;
}

.route-icon {
  width: 80rpx;
  height: 80rpx;
  background: $primary-light;
  border-radius: $border-radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: 40rpx;
  }
}

.route-info {
  flex: 1;
}

.route-name {
  display: block;
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.route-desc {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.route-meta {
  display: flex;
  gap: $spacing-lg;
  margin-bottom: $spacing-base;
  padding-bottom: $spacing-base;
  border-bottom: 2rpx solid $bg-gray;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.meta-icon {
  font-size: 24rpx;
}

.meta-value {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.route-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  margin-bottom: $spacing-base;
}

.tag {
  padding: $spacing-xs $spacing-sm;
  background: rgba(196, 164, 90, 0.15);
  border-radius: $border-radius;
  
  text {
    font-size: $font-size-xs;
    color: $primary-color;
  }
}

.route-spots {
  margin-bottom: $spacing-base;
}

.spots-title {
  display: block;
  font-size: $font-size-sm;
  color: $text-light;
  margin-bottom: $spacing-sm;
}

.spots-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.spot-item {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.spot-order {
  width: 36rpx;
  height: 36rpx;
  background: $primary-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: $font-size-xs;
    color: #fff;
  }
}

.spot-name {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.spot-more {
  padding-left: $spacing-xs;
  
  text {
    font-size: $font-size-xs;
    color: $text-light;
  }
}

.route-action {
  text-align: center;
  padding-top: $spacing-base;
  border-top: 2rpx solid $bg-gray;
  
  text {
    font-size: $font-size-base;
    color: $primary-color;
    font-weight: 500;
  }
}

.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.detail-content {
  width: 100%;
  max-height: 85vh;
  background: #fff;
  border-radius: $border-radius-xl $border-radius-xl 0 0;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: $spacing-lg;
  border-bottom: 2rpx solid $bg-gray;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-title {
  font-size: $font-size-xl;
  font-weight: 600;
  color: $text-primary;
}

.close-btn {
  width: 64rpx;
  height: 64rpx;
  background: $bg-gray;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: $font-size-lg;
    color: $text-secondary;
  }
}

.detail-body {
  flex: 1;
  padding: $spacing-lg;
  overflow-y: auto;
}

.detail-desc {
  font-size: $font-size-base;
  color: $text-secondary;
  line-height: 1.6;
  margin-bottom: $spacing-lg;
}

.detail-meta {
  display: flex;
  justify-content: space-around;
  background: $bg-gray;
  padding: $spacing-base;
  border-radius: $border-radius-lg;
  margin-bottom: $spacing-lg;
}

.detail-meta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
}

.detail-meta-icon {
  font-size: 36rpx;
}

.detail-meta-value {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.detail-section {
  margin-bottom: $spacing-lg;
}

.detail-section-title {
  display: block;
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-base;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.detail-tag {
  padding: $spacing-sm $spacing-base;
  background: $primary-light;
  border-radius: 100rpx;
  
  text {
    font-size: $font-size-sm;
    color: $primary-color;
  }
}

.detail-spots {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.detail-spot-item {
  display: flex;
  gap: $spacing-base;
  padding: $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius-lg;
}

.detail-spot-order {
  width: 48rpx;
  height: 48rpx;
  background: $primary-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  text {
    font-size: $font-size-base;
    color: #fff;
    font-weight: 600;
  }
}

.detail-spot-info {
  flex: 1;
}

.detail-spot-name {
  display: block;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.detail-spot-desc {
  display: block;
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
}

.detail-spot-time {
  font-size: $font-size-xs;
  color: $text-light;
}

.detail-footer {
  padding: $spacing-lg;
  border-top: 2rpx solid $bg-gray;
}

/* ====== 英文模式文本适配 ====== */
:global(body.en-mode) {
  .header-title {
    font-size: 40rpx;
  }
  .header-subtitle {
    font-size: 26rpx;
  }
  .route-name {
    font-size: 30rpx;
    line-height: 1.3;
  }
  .route-desc {
    font-size: 24rpx;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .interest-item text {
    font-size: 24rpx;
  }
  .detail-title {
    font-size: 34rpx;
  }
  .detail-desc {
    font-size: 26rpx;
    line-height: 1.6;
  }
}

/* ====== 响应式设计：桌面端宽屏适配 ====== */
@media screen and (min-width: 768px) {
  .routes-container {
    max-width: 750px;
    margin: 0 auto;
  }
  .back-btn {
    left: calc(50% - 375px + 24rpx);
  }
}

@media screen and (min-width: 1200px) {
  .routes-container {
    max-width: 900px;
  }
  .back-btn {
    left: calc(50% - 450px + 24rpx);
  }
  .route-card {
    padding: $spacing-lg;
  }
  .route-meta {
    gap: $spacing-xl;
  }
}

/* ====== 交互增强：悬停与选中状态 ====== */
.interest-item {
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  &:hover {
    transform: translateY(-2rpx);
    box-shadow: 0 4rpx 12rpx rgba(196, 164, 90, 0.15);
  }
  &.active {
    transform: scale(1.03);
    box-shadow: 0 4rpx 16rpx rgba(196, 164, 90, 0.3);
  }
}

.route-card {
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  &:hover {
    transform: translateY(-4rpx);
    box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
  }
  &:active {
    transform: translateY(-2rpx);
  }
}

.recommend-btn {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    transform: scale(1.02);
    box-shadow: 0 4rpx 12rpx rgba(196, 164, 90, 0.2);
  }
  &:active {
    transform: scale(0.98);
  }
}

.route-action {
  cursor: pointer;
  transition: color 0.2s ease;
  &:hover {
    text { color: $primary-dark; }
  }
}

.close-btn {
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
  &:hover {
    background: darken($bg-gray, 5%);
    transform: rotate(90deg);
  }
}

/* ====== 路线卡片入场动画 ====== */
.route-card {
  animation: card-fade-in 0.4s ease-out backwards;
  @for $i from 1 through 6 {
    &:nth-child(#{$i}) {
      animation-delay: #{$i * 0.06}s;
    }
  }
}
@keyframes card-fade-in {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ====== 详情弹窗过渡动画 ====== */
.detail-modal {
  animation: overlay-fade-in 0.25s ease-out;
}
.detail-content {
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes overlay-fade-in {
  from { background: rgba(0, 0, 0, 0); }
  to { background: rgba(0, 0, 0, 0.5); }
}
@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
