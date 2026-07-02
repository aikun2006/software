<template>
  <view class="detail-page">
    <!-- 顶部标题栏 -->
    <view class="detail-header">
      <view class="back-btn" @click="goBack"><text>‹</text></view>
      <text class="header-title">{{ spot?.name || '景点详情' }}</text>
      <view class="header-placeholder"></view>
    </view>

    <scroll-view v-if="spot" class="detail-scroll" scroll-y>
      <!-- 图片轮播 -->
      <swiper class="gallery" :indicator-dots="gallery.length > 1" :autoplay="true"
              :interval="4000" circular indicator-color="rgba(255,255,255,0.4)"
              indicator-active-color="#fff">
        <swiper-item v-for="(img, i) in gallery" :key="i">
          <image class="gallery-img" :src="img" mode="aspectFill" />
        </swiper-item>
      </swiper>

      <!-- 名称与标签 -->
      <view class="info-card">
        <view class="info-main">
          <view class="title-row">
            <text class="spot-name">{{ spot.name }}</text>
            <text class="spot-tag" :class="spot.tagClass">{{ spot.tag }}</text>
          </view>
          <view class="meta-row">
            <text class="meta-item" v-if="spot.distance">📍 {{ spot.distance }}</text>
            <text class="meta-item" v-if="spot.time">⏱ {{ spot.time }}</text>
          </view>
          <view class="loc-row" v-if="spot.locationInfo">
            <text class="loc-text">{{ spot.locationInfo }}</text>
          </view>
        </view>
        <!-- 圆形「去这里」按钮，放在信息卡右侧 -->
        <view class="go-here-fab" @click="goHere">
          <text class="fab-icon">🧭</text>
          <text class="fab-label">去这里</text>
        </view>
      </view>

      <!-- 景点介绍 -->
      <view class="section-card" v-if="spot.fullDesc">
        <text class="section-title">景点介绍</text>
        <text class="section-text">{{ spot.fullDesc }}</text>
      </view>

      <!-- 游览贴士 -->
      <view class="section-card tips-card" v-if="spot.tips">
        <text class="section-title">💡 游览贴士</text>
        <text class="section-text">{{ spot.tips }}</text>
      </view>

      <!-- 游客评价 -->
      <view class="section-card reviews-card">
        <view class="reviews-head">
          <text class="section-title">游客评价（{{ reviews.length }}）</text>
        </view>

        <!-- 评价列表 -->
        <view class="review-item" v-for="rv in reviews" :key="rv.id">
          <view class="review-top">
            <view class="review-avatar"><text>{{ rv.nickname.slice(0, 1) }}</text></view>
            <view class="review-info">
              <text class="review-name">{{ rv.nickname }}</text>
              <view class="review-stars">
                <text v-for="s in 5" :key="s" class="star"
                      :class="{ filled: s <= rv.rating }">★</text>
              </view>
            </view>
            <view class="review-meta-right">
              <text class="review-date">{{ formatDate(rv.createdAt) }}</text>
              <text v-if="rv.userId === userStore.user?.id" class="review-del"
                    @click.stop="deleteReview(rv)">删除</text>
            </view>
          </view>
          <text class="review-content">{{ rv.content }}</text>
        </view>
        <view class="empty-reviews" v-if="reviews.length === 0">
          <text>暂无评价，快来抢沙发~</text>
        </view>
      </view>

      <!-- 发表评价区 -->
      <view class="post-card">
        <template v-if="userStore.isLoggedIn">
          <text class="section-title">发表我的评价</text>
          <view class="rating-picker">
            <text class="rating-label">我的评分：</text>
            <view class="stars-input">
              <text v-for="s in 5" :key="s" class="star big"
                    :class="{ filled: s <= myRating }"
                    @click="myRating = s">★</text>
            </view>
          </view>
          <textarea
            class="review-textarea"
            v-model="myContent"
            placeholder="分享你的游览感受（最多500字）"
            placeholder-class="ph"
            maxlength="500"
          />
          <button class="btn-submit" :disabled="posting" @click="submitReview">
            {{ posting ? '提交中...' : '发布评价' }}
          </button>
        </template>
        <template v-else>
          <text class="login-tip">登录后即可发表评价，分享你的游览感受</text>
          <button class="btn-login" @click="goLogin">登录 / 注册</button>
        </template>
      </view>

      <view class="bottom-pad"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getSpotById, spotGallery, type ScenicSpot } from '@/data/spots'
import { reviewApi, type Review } from '@/api/review'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const spot = ref<ScenicSpot | undefined>(undefined)
const gallery = computed(() => (spot.value ? spotGallery(spot.value) : []))
const reviews = ref<Review[]>([])

const myRating = ref(0)
const myContent = ref('')
const posting = ref(false)

onLoad((options: any) => {
  const id = options?.id || ''
  spot.value = getSpotById(id)
  if (!spot.value) {
    uni.showToast({ title: '景点不存在', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  loadReviews()
})

// 返回详情页时刷新评价与登录态（从登录页 navigateBack 回来）
onShow(() => {
  if (spot.value) loadReviews()
})

const loadReviews = async () => {
  try {
    const res = await reviewApi.list(spot.value!.id)
    reviews.value = res.reviews
  } catch (e) {
    /* 静默忽略，评价列表非关键路径 */
  }
}

const submitReview = async () => {
  if (myRating.value < 1) {
    uni.showToast({ title: '请先选择评分', icon: 'none' })
    return
  }
  if (!myContent.value.trim()) {
    uni.showToast({ title: '请填写评价内容', icon: 'none' })
    return
  }
  posting.value = true
  try {
    const res = await reviewApi.create({
      spot_id: spot.value!.id,
      rating: myRating.value,
      content: myContent.value.trim()
    })
    reviews.value.unshift(res.review)
    myContent.value = ''
    myRating.value = 0
    uni.showToast({ title: '评价已发布', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e.message || '发布失败', icon: 'none' })
  } finally {
    posting.value = false
  }
}

const deleteReview = (rv: Review) => {
  uni.showModal({
    title: '删除评价',
    content: '确定要删除这条评价吗？',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await reviewApi.delete(rv.id)
        reviews.value = reviews.value.filter(r => r.id !== rv.id)
        uni.showToast({ title: '已删除', icon: 'none' })
      } catch (e: any) {
        uni.showToast({ title: e.message || '删除失败', icon: 'none' })
      }
    }
  })
}

// 未登录 → 跳登录页，成功后返回本详情页（from=spot:<id>）
const goLogin = () => {
  uni.navigateTo({ url: '/pages/visitor/login?from=spot:' + spot.value!.id })
}

const goBack = () => uni.navigateBack()

// 去这里：直接进入导航页（navigation 按 dest 自动计算路线），返回即回到本景点详情页
const goHere = () => {
  if (!spot.value) return
  uni.navigateTo({
    url: `/pages/visitor/navigation?name=${encodeURIComponent(spot.value.name)}&dest=${spot.value.id}`
  })
}

const formatDate = (s: string) => (s ? s.slice(5, 10) : '')
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: $bg-color;
  display: flex;
  flex-direction: column;
}

/* 顶部标题栏 */
.detail-header {
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  padding: calc(env(safe-area-inset-top) + 24rpx) 32rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.back-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 52rpx;
}
.header-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.header-placeholder {
  width: 64rpx;
}

.detail-scroll {
  flex: 1;
}

/* 图片轮播 */
.gallery {
  width: 100%;
  height: 440rpx;
}
.gallery-img {
  width: 100%;
  height: 440rpx;
  background: $bg-gray;
}

/* 信息卡 */
.info-card {
  background: $bg-white;
  margin: 24rpx 32rpx;
  border-radius: $border-radius-xl;
  padding: 32rpx;
  box-shadow: $shadow-md;
  display: flex;
  align-items: center;
}
.info-main {
  flex: 1;
  min-width: 0;
}
/* 圆形「去这里」按钮，放在信息卡右侧 */
.go-here-fab {
  flex-shrink: 0;
  margin-left: 24rpx;
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  box-shadow: $shadow-md;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  &:active {
    transform: scale(0.92);
  }
}
.fab-icon {
  font-size: 40rpx;
  line-height: 1;
}
.fab-label {
  font-size: 20rpx;
  margin-top: 4rpx;
}
.title-row {
  display: flex;
  align-items: center;
  margin-bottom: 18rpx;
}
.spot-name {
  font-size: 42rpx;
  font-weight: 700;
  color: $text-primary;
  margin-right: 20rpx;
}
.spot-tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  color: #fff;
  background: $primary-color;
}
.tag-core {
  background: #c0392b;
}
.tag-culture {
  background: #8e44ad;
}
.tag-experience {
  background: #27ae60;
}
.meta-row {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12rpx;
}
.meta-item {
  font-size: 24rpx;
  color: $text-secondary;
  margin-right: 24rpx;
}
.loc-row {
  margin-top: 8rpx;
}
.loc-text {
  font-size: 24rpx;
  color: $text-light;
}

/* 通用段落卡 */
.section-card {
  background: $bg-white;
  margin: 24rpx 32rpx;
  border-radius: $border-radius-xl;
  padding: 32rpx;
  box-shadow: $shadow-md;
}
.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $text-primary;
  display: block;
  margin-bottom: 20rpx;
}
.section-text {
  font-size: 28rpx;
  color: $text-secondary;
  line-height: 1.7;
}
.tips-card {
  border-left: 8rpx solid $warning-color;
}

/* 评价 */
.reviews-head {
  margin-bottom: 8rpx;
}
.review-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid $border-color;
  &:last-child {
    border-bottom: none;
  }
}
.review-top {
  display: flex;
  align-items: center;
  margin-bottom: 14rpx;
}
.review-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $primary-light;
  color: $primary-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 700;
  margin-right: 16rpx;
  flex-shrink: 0;
}
.review-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.review-name {
  font-size: 26rpx;
  font-weight: 600;
  color: $text-primary;
}
.review-stars {
  margin-top: 4rpx;
}
.star {
  font-size: 24rpx;
  color: $border-color;
  &.filled {
    color: #f5a623;
  }
  &.big {
    font-size: 44rpx;
  }
}
.review-date {
  font-size: 22rpx;
  color: $text-light;
}
.review-meta-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}
.review-del {
  font-size: 22rpx;
  color: $error-color;
  margin-top: 8rpx;
  padding: 4rpx 12rpx;
  &:active {
    opacity: 0.6;
  }
}
.review-content {
  font-size: 28rpx;
  color: $text-primary;
  line-height: 1.6;
}
.empty-reviews {
  text-align: center;
  color: $text-light;
  font-size: 26rpx;
  padding: 40rpx 0;
}

/* 发表评价 */
.post-card {
  background: $bg-white;
  margin: 24rpx 32rpx;
  border-radius: $border-radius-xl;
  padding: 32rpx;
  box-shadow: $shadow-md;
}
.rating-picker {
  display: flex;
  align-items: center;
  margin: 20rpx 0;
}
.rating-label {
  font-size: 26rpx;
  color: $text-secondary;
  margin-right: 16rpx;
}
.stars-input {
  display: flex;
}
.stars-input .star {
  margin-right: 8rpx;
}
.review-textarea {
  width: 100%;
  min-height: 160rpx;
  background: $bg-color;
  border-radius: $border-radius-lg;
  padding: 20rpx;
  font-size: 26rpx;
  color: $text-primary;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}
.ph {
  color: $text-placeholder;
}
.btn-submit {
  width: 100%;
  height: 84rpx;
  border: none;
  border-radius: $border-radius-lg;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  color: #fff;
  font-size: 30rpx;
  &::after {
    border: none;
  }
  &[disabled] {
    opacity: 0.6;
  }
}
.login-tip {
  text-align: center;
  font-size: 26rpx;
  color: $text-secondary;
  display: block;
  padding: 16rpx 0 28rpx;
}
.btn-login {
  width: 100%;
  height: 84rpx;
  border: 2rpx solid $primary-color;
  border-radius: $border-radius-lg;
  background: transparent;
  color: $primary-color;
  font-size: 30rpx;
  &::after {
    border: none;
  }
}

.bottom-pad {
  height: 160rpx;
}
</style>
