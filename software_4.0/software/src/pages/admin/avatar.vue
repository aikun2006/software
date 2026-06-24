<template>
  <view class="avatar-container">
    <view class="page-header">
      <view class="header-left" @click="goBack">
        <text>← 返回</text>
      </view>
      <text class="header-title">数字人管理</text>
      <view class="header-right">
        <view class="add-btn" @click="showAddModal = true">
          <text>+ 添加</text>
        </view>
      </view>
    </view>

    <scroll-view class="avatar-list" scroll-y>
      <view 
        class="avatar-card" 
        v-for="avatar in avatarList" 
        :key="avatar.id"
        :class="{ active: avatar.id === activeAvatarId }"
      >
        <view class="avatar-preview">
          <image class="avatar-img" :src="avatar.avatarUrl" mode="aspectFill" />
          <view v-if="avatar.id === activeAvatarId" class="active-badge">
            <text>当前使用</text>
          </view>
        </view>
        <text class="avatar-name">{{ avatar.name }}</text>
        <view class="avatar-info">
          <view class="info-row">
            <text class="info-label">声音类型:</text>
            <text class="info-value">{{ getVoiceText(avatar.voiceType) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">服装风格:</text>
            <text class="info-value">{{ getClothingText(avatar.clothing) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">表情:</text>
            <text class="info-value">{{ getExpressionText(avatar.expression) }}</text>
          </view>
        </view>
        <view class="avatar-actions">
          <view 
            class="action-btn" 
            :class="{ active: avatar.id === activeAvatarId }"
            @click="setActive(avatar.id)"
          >
            <text>{{ avatar.id === activeAvatarId ? '已启用' : '启用' }}</text>
          </view>
          <view class="action-btn edit" @click="editAvatar(avatar)">
            <text>编辑</text>
          </view>
          <view 
            class="action-btn delete" 
            :class="{ disabled: avatar.id === activeAvatarId }"
            @click="deleteAvatar(avatar.id)"
          >
            <text>删除</text>
          </view>
        </view>
      </view>

      <view v-if="avatarList.length === 0" class="empty-state">
        <text class="empty-icon">🎭</text>
        <text class="empty-text">暂无数字人形象</text>
      </view>
    </scroll-view>

    <view v-if="showAddModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ isEditing ? '编辑数字人' : '添加数字人' }}</text>
          <view class="modal-close" @click="closeModal">
            <text>✕</text>
          </view>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">名称</text>
            <input class="form-input" v-model="formData.name" placeholder="请输入数字人名称" />
          </view>
          <view class="form-item">
            <text class="form-label">声音类型</text>
            <picker :value="voiceIndex" :range="voiceTypes" @change="handleVoiceChange">
              <view class="picker-value">
                <text>{{ voiceTypes[voiceIndex] || '请选择' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">服装风格</text>
            <picker :value="clothingIndex" :range="clothingOptions" @change="handleClothingChange">
              <view class="picker-value">
                <text>{{ clothingOptions[clothingIndex] || '请选择' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">表情</text>
            <picker :value="expressionIndex" :range="expressionOptions" @change="handleExpressionChange">
              <view class="picker-value">
                <text>{{ expressionOptions[expressionIndex] || '请选择' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-secondary btn-block" @click="closeModal">
            <text>取消</text>
          </button>
          <button class="btn btn-primary btn-block" @click="saveAvatar">
            <text>保存</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { AvatarConfig } from '@/types'
import { mockAvatars } from '@/data/mock'

const avatarList = ref<AvatarConfig[]>([...mockAvatars])
const activeAvatarId = ref(mockAvatars[0]?.id || '')
const showAddModal = ref(false)
const isEditing = ref(false)
const editingId = ref('')

const voiceTypes = ['温柔女声', '活力女声', '亲切男声', '沉稳男声']
const clothingOptions = ['传统服饰', '现代服装', '休闲风格', '正式着装']
const expressionOptions = ['微笑', '开心', '友好', '自然']

const voiceTypeMap: Record<string, string> = {
  'female-gentle': '温柔女声',
  'female-energetic': '活力女声',
  'male-friendly': '亲切男声',
  'male-calm': '沉稳男声'
}

const clothingMap: Record<string, string> = {
  'traditional': '传统服饰',
  'modern': '现代服装',
  'casual': '休闲风格',
  'formal': '正式着装'
}

const expressionMap: Record<string, string> = {
  'smile': '微笑',
  'happy': '开心',
  'friendly': '友好',
  'natural': '自然'
}

const reverseVoiceMap: Record<string, string> = {
  '温柔女声': 'female-gentle',
  '活力女声': 'female-energetic',
  '亲切男声': 'male-friendly',
  '沉稳男声': 'male-calm'
}

const reverseClothingMap: Record<string, string> = {
  '传统服饰': 'traditional',
  '现代服装': 'modern',
  '休闲风格': 'casual',
  '正式着装': 'formal'
}

const reverseExpressionMap: Record<string, string> = {
  '微笑': 'smile',
  '开心': 'happy',
  '友好': 'friendly',
  '自然': 'natural'
}

const voiceIndex = ref(0)
const clothingIndex = ref(0)
const expressionIndex = ref(0)

const formData = ref({
  name: '',
  voiceType: '',
  clothing: '',
  expression: ''
})

const goBack = () => {
  uni.navigateBack()
}

const getVoiceText = (type: string) => voiceTypeMap[type] || type
const getClothingText = (type: string) => clothingMap[type] || type
const getExpressionText = (type: string) => expressionMap[type] || type

const setActive = (id: string) => {
  if (id === activeAvatarId.value) {
    uni.showToast({ title: '已为当前使用的数字人', icon: 'none' })
    return
  }
  activeAvatarId.value = id
  uni.showToast({ title: '已切换数字人', icon: 'success' })
}

const editAvatar = (avatar: AvatarConfig) => {
  isEditing.value = true
  editingId.value = avatar.id
  formData.value = {
    name: avatar.name,
    voiceType: avatar.voiceType,
    clothing: avatar.clothing,
    expression: avatar.expression
  }
  voiceIndex.value = voiceTypes.indexOf(voiceTypeMap[avatar.voiceType])
  clothingIndex.value = clothingOptions.indexOf(clothingMap[avatar.clothing])
  expressionIndex.value = expressionOptions.indexOf(expressionMap[avatar.expression])
  showAddModal.value = true
}

const deleteAvatar = (id: string) => {
  if (id === activeAvatarId.value) {
    uni.showToast({ title: '不能删除当前使用的数字人', icon: 'none' })
    return
  }
  
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个数字人吗？',
    success: (res) => {
      if (res.confirm) {
        avatarList.value = avatarList.value.filter(item => item.id !== id)
        uni.showToast({ title: '删除成功', icon: 'success' })
      }
    }
  })
}

const closeModal = () => {
  showAddModal.value = false
  isEditing.value = false
  editingId.value = ''
  formData.value = {
    name: '',
    voiceType: '',
    clothing: '',
    expression: ''
  }
  voiceIndex.value = 0
  clothingIndex.value = 0
  expressionIndex.value = 0
}

const handleVoiceChange = (e: any) => {
  voiceIndex.value = e.detail.value
  formData.value.voiceType = reverseVoiceMap[voiceTypes[e.detail.value]]
}

const handleClothingChange = (e: any) => {
  clothingIndex.value = e.detail.value
  formData.value.clothing = reverseClothingMap[clothingOptions[e.detail.value]]
}

const handleExpressionChange = (e: any) => {
  expressionIndex.value = e.detail.value
  formData.value.expression = reverseExpressionMap[expressionOptions[e.detail.value]]
}

const saveAvatar = () => {
  if (!formData.value.name) {
    uni.showToast({ title: '请输入数字人名称', icon: 'none' })
    return
  }

  const avatarData: Partial<AvatarConfig> = {
    name: formData.value.name,
    voiceType: formData.value.voiceType,
    clothing: formData.value.clothing,
    expression: formData.value.expression,
    avatarUrl: `/static/avatars/avatar${Date.now()}.png`
  }

  if (isEditing.value) {
    const index = avatarList.value.findIndex(item => item.id === editingId.value)
    if (index > -1) {
      avatarList.value[index] = {
        ...avatarList.value[index],
        ...avatarData,
        updatedAt: new Date().toISOString()
      }
    }
    uni.showToast({ title: '修改成功', icon: 'success' })
  } else {
    const newAvatar: AvatarConfig = {
      id: Date.now().toString(),
      ...(avatarData as AvatarConfig),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    avatarList.value.push(newAvatar)
    uni.showToast({ title: '添加成功', icon: 'success' })
  }
  
  closeModal()
}
</script>

<style lang="scss" scoped>
.avatar-container {
  min-height: 100vh;
  background: $bg-color;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-base $spacing-lg;
  background: #fffdf5;
  box-shadow: $shadow-sm;
}

.header-left {
  padding: $spacing-sm;
  
  text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
}

.header-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.add-btn {
  padding: $spacing-sm $spacing-base;
  background: $primary-color;
  border-radius: $border-radius;
  
  text {
    font-size: $font-size-sm;
    color: #fff;
  }
}

.avatar-list {
  flex: 1;
  padding: $spacing-base;
}

.avatar-card {
  background: #fffdf5;
  border-radius: $border-radius-lg;
  padding: $spacing-base;
  margin-bottom: $spacing-base;
  box-shadow: $shadow-sm;
  border: 2rpx solid transparent;
  
  &.active {
    border-color: $primary-color;
  }
}

.avatar-preview {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  margin: 0 auto $spacing-base;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4rpx solid $border-color;
}

.active-badge {
  position: absolute;
  bottom: -10rpx;
  left: 50%;
  transform: translateX(-50%);
  background: $primary-color;
  padding: $spacing-xs $spacing-base;
  border-radius: 100rpx;
  
  text {
    font-size: $font-size-xs;
    color: #fff;
  }
}

.avatar-name {
  display: block;
  text-align: center;
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-base;
}

.avatar-info {
  background: $bg-gray;
  border-radius: $border-radius;
  padding: $spacing-base;
  margin-bottom: $spacing-base;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: $spacing-xs 0;
  
  &:not(:last-child) {
    border-bottom: 2rpx solid rgba(0, 0, 0, 0.05);
  }
}

.info-label {
  font-size: $font-size-sm;
  color: $text-light;
}

.info-value {
  font-size: $font-size-sm;
  color: $text-primary;
}

.avatar-actions {
  display: flex;
  gap: $spacing-sm;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: $spacing-sm;
  background: $primary-color;
  border-radius: $border-radius;
  
  text {
    font-size: $font-size-sm;
    color: #fff;
  }
  
  &.edit {
    background: $bg-gray;
    
    text {
      color: $text-secondary;
    }
  }
  
  &.delete {
    background: rgba(255, 77, 79, 0.1);
    
    text {
      color: $error-color;
    }
    
    &.disabled {
      opacity: 0.5;
    }
  }
  
  &.active {
    background: $success-color;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xl;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: $spacing-base;
}

.empty-text {
  font-size: $font-size-base;
  color: $text-light;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(80, 65, 40, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 90%;
  background: #fffdf5;
  border-radius: $border-radius-xl;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-lg;
  border-bottom: 2rpx solid $bg-gray;
}

.modal-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.modal-close {
  width: 48rpx;
  height: 48rpx;
  background: $bg-gray;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
}

.modal-body {
  padding: $spacing-lg;
}

.form-item {
  margin-bottom: $spacing-lg;
}

.form-label {
  display: block;
  font-size: $font-size-sm;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: $spacing-sm;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  padding: 0 $spacing-base;
  font-size: $font-size-base;
}

.picker-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  padding: 0 $spacing-base;
  
  text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
  
  .picker-arrow {
    font-size: $font-size-xs;
    color: $text-light;
  }
}

.modal-footer {
  display: flex;
  gap: $spacing-base;
  padding: $spacing-lg;
  border-top: 2rpx solid $bg-gray;
}
</style>
