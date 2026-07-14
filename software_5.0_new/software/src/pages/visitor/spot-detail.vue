<template>
  <view class="detail-page">
    <!-- 顶部标题栏 -->
    <view class="detail-header">
      <view class="back-btn" @click="goBack"><text>‹</text></view>
      <text class="header-title">{{ currentLang === 'zh' ? spot?.name : spot?.nameEn || spot?.name || 'Spot Details' }}</text>
      <view class="header-placeholder"></view>
    </view>

    <scroll-view v-if="spot" class="detail-scroll" scroll-y>
      <!-- 封面图片（点击可全屏预览） -->
      <view class="cover-wrap" @click="openPreview">
        <swiper class="gallery" :indicator-dots="gallery.length > 1" :autoplay="true"
                :interval="4000" circular indicator-color="rgba(255,255,255,0.4)"
                indicator-active-color="#fff" @change="onSlideChange">
          <swiper-item v-for="(img, i) in gallery" :key="i">
            <image class="gallery-img" :src="img" mode="aspectFit" />
          </swiper-item>
        </swiper>
      </view>

      <!-- 名称与标签 -->
      <view class="info-card">
        <view class="info-main">
          <view class="title-row">
            <text class="spot-name">{{ currentLang === 'zh' ? spot.name : spot.nameEn || spot.name }}</text>
            <text class="spot-tag" :class="spot.tagClass">{{ currentLang === 'zh' ? spot.tag : spot.tagEn || spot.tag }}</text>
          </view>
          <view class="meta-row">
            <text class="meta-item" v-if="spot.distance">📍 {{ currentLang === 'zh' ? spot.distance : spot.distanceEn || spot.distance }}</text>
            <text class="meta-item" v-if="spot.time">⏱ {{ currentLang === 'zh' ? spot.time : spot.timeEn || spot.time }}</text>
          </view>
          <view class="loc-row" v-if="spot.locationInfo">
            <text class="loc-text">{{ currentLang === 'zh' ? spot.locationInfo : spot.locationInfoEn || spot.locationInfo }}</text>
          </view>
        </view>
        <view class="go-here-fab" @click="goHere">
          <text class="fab-icon">🧭</text>
          <text class="fab-label">{{ currentLang === 'zh' ? '去这里' : 'Navigate' }}</text>
        </view>
      </view>

      <view class="section-card" v-if="spot.fullDesc">
        <text class="section-title">{{ currentLang === 'zh' ? '景点介绍' : 'Introduction' }}</text>
        <text class="section-text">{{ currentLang === 'zh' ? spot.fullDesc : spot.fullDescEn || spot.fullDesc }}</text>
      </view>

      <view class="section-card tips-card" v-if="spot.tips">
        <text class="section-title">💡 {{ currentLang === 'zh' ? '游览贴士' : 'Travel Tips' }}</text>
        <text class="section-text">{{ currentLang === 'zh' ? spot.tips : spot.tipsEn || spot.tips }}</text>
      </view>

      <view class="qa-card section-card">
        <text class="section-title">💬 {{ currentLang === 'zh' ? '猜你想问' : 'You May Ask' }}</text>
        <view class="qa-list" :class="{ 'qa-fading': qaFading }">
          <view class="qa-item" v-for="item in qaDisplayed" :key="item.id" @click="qaToggleExpand(item.id)">
            <view class="qa-question">
              <view class="qa-q-icon"><text>Q</text></view>
              <text class="qa-q-text">{{ currentLang === 'zh' ? item.question : item.questionEn || item.question }}</text>
              <text class="qa-arrow" :class="{ expanded: qaExpandedId === item.id }">›</text>
            </view>
            <view class="qa-answer" v-if="qaExpandedId === item.id">
              <view class="qa-a-icon"><text>A</text></view>
              <text class="qa-a-text">{{ currentLang === 'zh' ? item.answer : item.answerEn || item.answer }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 游客评价 -->
      <view class="section-card reviews-card">
        <view class="reviews-head">
          <text class="section-title">{{ currentLang === 'zh' ? '游客评价' : 'Reviews' }}（{{ reviews.length }}）</text>
        </view>

        <!-- 评价列表 -->
        <view class="review-item" v-for="rv in reviews" :key="rv.id">
          <view class="review-top">
            <view class="review-avatar"><text>{{ (currentLang === 'zh' ? rv.nickname : rv.nicknameEn || rv.nickname).slice(0, 1) }}</text></view>
            <view class="review-info">
              <text class="review-name">{{ currentLang === 'zh' ? rv.nickname : rv.nicknameEn || rv.nickname }}</text>
              <view class="review-stars">
                <text v-for="s in 5" :key="s" class="star"
                      :class="{ filled: s <= rv.rating }">★</text>
              </view>
            </view>
            <view class="review-meta-right">
              <text class="review-date">{{ formatDate(rv.createdAt) }}</text>
              <text v-if="rv.userId === userStore.user?.id" class="review-del"
                    @click.stop="deleteReview(rv)">{{ currentLang === 'zh' ? '删除' : 'Delete' }}</text>
            </view>
          </view>
          <text class="review-content">{{ currentLang === 'zh' ? rv.content : rv.contentEn || rv.content }}</text>
        </view>
        <view class="empty-reviews" v-if="reviews.length === 0">
          <text>{{ currentLang === 'zh' ? '暂无评价，快来抢沙发~' : 'No reviews yet, be the first!' }}</text>
        </view>
      </view>

      <!-- 发表评价区 -->
      <view class="post-card">
        <template v-if="userStore.isLoggedIn">
          <text class="section-title">{{ currentLang === 'zh' ? '发表我的评价' : 'Write a Review' }}</text>
          <view class="rating-picker">
            <text class="rating-label">{{ currentLang === 'zh' ? '我的评分：' : 'My Rating: ' }}</text>
            <view class="stars-input">
              <text v-for="s in 5" :key="s" class="star big"
                    :class="{ filled: s <= myRating }"
                    @click="myRating = s">★</text>
            </view>
          </view>
          <textarea
            class="review-textarea"
            v-model="myContent"
            :placeholder="currentLang === 'zh' ? '分享你的游览感受（最多500字）' : 'Share your experience (max 500 characters)'"
            placeholder-class="ph"
            maxlength="500"
          />
          <button class="btn-submit" :disabled="posting" @click="submitReview">
            {{ posting ? (currentLang === 'zh' ? '提交中...' : 'Submitting...') : (currentLang === 'zh' ? '发布评价' : 'Post Review') }}
          </button>
        </template>
        <template v-else>
          <text class="login-tip">{{ currentLang === 'zh' ? '登录后即可发表评价，分享你的游览感受' : 'Login to write a review and share your experience' }}</text>
          <button class="btn-login" @click="goLogin">{{ currentLang === 'zh' ? '登录 / 注册' : 'Login / Register' }}</button>
        </template>
      </view>

      <view class="bottom-pad"></view>
    </scroll-view>

    <!-- 全屏图片预览遮罩 -->
    <view class="preview-overlay" :class="{ show: previewVisible }" @click="closePreview">
      <image class="preview-img" :src="previewSrc" mode="aspectFit" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getSpotById, spotGallery, type ScenicSpot } from '@/data/spots'
import { reviewApi, type Review } from '@/api/review'
import { useUserStore } from '@/stores/user'
import { spotQA, useQaRotation } from '@/data/qa-bank'
import { currentLang } from '@/i18n'

const userStore = useUserStore()

const spot = ref<ScenicSpot | undefined>(undefined)
const gallery = computed(() => (spot.value ? spotGallery(spot.value) : []))
const reviews = ref<Review[]>([])

const myRating = ref(0)
const myContent = ref('')
const posting = ref(false)

// 猜你想问
const { displayed: qaDisplayed, expandedId: qaExpandedId, fading: qaFading, toggleExpand: qaToggleExpand } = useQaRotation(spotQA)

// 封面图全屏预览
const previewVisible = ref(false)
const previewSrc = ref('')
const currentSlide = ref(0)

const onSlideChange = (e: any) => {
  currentSlide.value = e.detail.current
}

const openPreview = () => {
  if (gallery.value.length === 0) return
  previewSrc.value = gallery.value[currentSlide.value] || gallery.value[0]
  previewVisible.value = true
}

const closePreview = () => {
  previewVisible.value = false
}

onLoad((options: any) => {
  const id = options?.id || ''
  spot.value = getSpotById(id)
  if (!spot.value) {
    uni.showToast({ title: currentLang.value === 'zh' ? '景点不存在' : 'Spot not found', icon: 'none' })
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
    uni.showToast({ title: currentLang.value === 'zh' ? '请先选择评分' : 'Please select a rating', icon: 'none' })
    return
  }
  if (!myContent.value.trim()) {
    uni.showToast({ title: currentLang.value === 'zh' ? '请填写评价内容' : 'Please write your review', icon: 'none' })
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
    uni.showToast({ title: currentLang.value === 'zh' ? '评价已发布' : 'Review posted', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e.message || (currentLang.value === 'zh' ? '发布失败' : 'Post failed'), icon: 'none' })
  } finally {
    posting.value = false
  }
}

const deleteReview = (rv: Review) => {
  uni.showModal({
    title: currentLang.value === 'zh' ? '删除评价' : 'Delete Review',
    content: currentLang.value === 'zh' ? '确定要删除这条评价吗？' : 'Are you sure you want to delete this review?',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await reviewApi.delete(rv.id)
        reviews.value = reviews.value.filter(r => r.id !== rv.id)
        uni.showToast({ title: currentLang.value === 'zh' ? '已删除' : 'Deleted', icon: 'none' })
      } catch (e: any) {
        uni.showToast({ title: e.message || (currentLang.value === 'zh' ? '删除失败' : 'Delete failed'), icon: 'none' })
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

/* 封面图容器 */
.cover-wrap {
  margin: 24rpx 32rpx 0;
  border-radius: $border-radius-xl;
  overflow: hidden;
  box-shadow: $shadow-md;
}
.gallery {
  width: 100%;
  height: 440rpx;
}
.gallery-img {
  width: 100%;
  height: 440rpx;
  background: $bg-gray;
}

/* 全屏图片预览遮罩 */
.preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
  &.show {
    opacity: 1;
    visibility: visible;
  }
}
.preview-img {
  width: 100%;
  height: 100%;
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

/* 猜你想问 */
.qa-list {
  transition: opacity 0.2s ease;
  &.qa-fading {
    opacity: 0;
  }
}
.qa-item {
  padding: 20rpx 0;
  border-bottom: 1rpx solid $border-color;
  &:last-child {
    border-bottom: none;
  }
}
.qa-question {
  display: flex;
  align-items: center;
}
.qa-q-icon {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #8B7355 0%, #A0522D 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 700;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.qa-q-text {
  flex: 1;
  font-size: 28rpx;
  color: $text-primary;
  line-height: 1.5;
}
.qa-arrow {
  font-size: 36rpx;
  color: $text-light;
  transition: transform 0.2s ease;
  flex-shrink: 0;
  &.expanded {
    transform: rotate(90deg);
  }
}
.qa-answer {
  display: flex;
  align-items: flex-start;
  margin-top: 16rpx;
  padding-left: 56rpx;
  animation: qa-expand 0.2s ease;
}
@keyframes qa-expand {
  from { opacity: 0; transform: translateY(-8rpx); }
  to { opacity: 1; transform: translateY(0); }
}
.qa-a-icon {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #27ae60;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 700;
  flex-shrink: 0;
  margin-right: 16rpx;
  margin-top: 4rpx;
}
.qa-a-text {
  flex: 1;
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.7;
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
