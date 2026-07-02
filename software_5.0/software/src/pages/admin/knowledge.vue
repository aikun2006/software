<template>
  <view class="knowledge-container">
    <view class="page-header">
      <view class="header-left" @click="goBack">
        <text>← 返回</text>
      </view>
      <text class="header-title">知识库管理</text>
      <view class="header-right">
        <view class="add-btn" @click="showAddModal = true">
          <text>+ 添加</text>
        </view>
      </view>
    </view>

    <view class="search-bar">
      <input 
        class="search-input" 
        v-model="searchKeyword"
        placeholder="搜索知识库..."
        @confirm="handleSearch"
      />
      <view class="search-btn" @click="handleSearch">
        <text>🔍</text>
      </view>
    </view>

    <view class="filter-tabs">
      <view 
        class="filter-tab" 
        v-for="tab in filterTabs" 
        :key="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        <text>{{ tab }}</text>
      </view>
    </view>

    <scroll-view class="knowledge-list" scroll-y>
      <view 
        class="knowledge-card" 
        v-for="item in filteredKnowledge" 
        :key="item.id"
        @click="showDetail(item)"
      >
        <view class="card-header">
          <text class="card-title">{{ item.title }}</text>
          <view class="card-category">{{ item.category }}</view>
        </view>
        <text class="card-content">{{ item.content }}</text>
        <view class="card-footer">
          <view class="card-tags">
            <text class="tag" v-for="tag in item.tags" :key="tag">{{ tag }}</text>
          </view>
          <view class="card-time">{{ formatTime(item.updatedAt) }}</view>
        </view>
        <view class="card-actions">
          <view class="action-btn edit" @click.stop="editItem(item)">
            <text>编辑</text>
          </view>
          <view class="action-btn delete" @click.stop="deleteItem(item.id)">
            <text>删除</text>
          </view>
        </view>
      </view>

      <view v-if="filteredKnowledge.length === 0" class="empty-state">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无知识文档</text>
      </view>
    </scroll-view>

    <view v-if="showAddModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ isEditing ? '编辑知识' : '添加知识' }}</text>
          <view class="modal-close" @click="closeModal">
            <text>✕</text>
          </view>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">标题</text>
            <input class="form-input" v-model="formData.title" placeholder="请输入标题" />
          </view>
          <view class="form-item">
            <text class="form-label">分类</text>
            <picker :value="categoryIndex" :range="categories" @change="handleCategoryChange">
              <view class="picker-value">
                <text>{{ categories[categoryIndex] || '请选择分类' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">内容</text>
            <textarea 
              class="form-textarea" 
              v-model="formData.content"
              placeholder="请输入知识内容"
            ></textarea>
          </view>
          <view class="form-item">
            <text class="form-label">标签</text>
            <input class="form-input" v-model="formData.tagsInput" placeholder="多个标签用逗号分隔" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-secondary btn-block" @click="closeModal">
            <text>取消</text>
          </button>
          <button class="btn btn-primary btn-block" @click="saveItem">
            <text>保存</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { KnowledgeItem } from '@/types'
import { mockKnowledge } from '@/data/mock'

const searchKeyword = ref('')
const activeTab = ref('全部')
const filterTabs = ['全部', '景区概况', '景点介绍', '服务信息', '文化历史']
const categories = ['景区概况', '景点介绍', '服务信息', '文化历史']

const knowledgeList = ref<KnowledgeItem[]>([...mockKnowledge])
const showAddModal = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const categoryIndex = ref(0)

const formData = ref({
  title: '',
  category: '',
  content: '',
  tagsInput: ''
})

const filteredKnowledge = computed(() => {
  let result = knowledgeList.value
  
  if (activeTab.value !== '全部') {
    result = result.filter(item => item.category === activeTab.value)
  }
  
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(item => 
      item.title.toLowerCase().includes(keyword) ||
      item.content.toLowerCase().includes(keyword)
    )
  }
  
  return result
})

const goBack = () => {
  uni.navigateBack()
}

const handleSearch = () => {
  console.log('Search:', searchKeyword.value)
}

const handleCategoryChange = (e: any) => {
  categoryIndex.value = e.detail.value
  formData.value.category = categories[e.detail.value]
}

const showDetail = (item: KnowledgeItem) => {
  uni.showModal({
    title: item.title,
    content: item.content,
    showCancel: false
  })
}

const editItem = (item: KnowledgeItem) => {
  isEditing.value = true
  editingId.value = item.id
  formData.value = {
    title: item.title,
    category: item.category,
    content: item.content,
    tagsInput: item.tags.join(',')
  }
  categoryIndex.value = categories.indexOf(item.category)
  showAddModal.value = true
}

const deleteItem = (id: string) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这条知识吗？',
    success: (res) => {
      if (res.confirm) {
        knowledgeList.value = knowledgeList.value.filter(item => item.id !== id)
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
    title: '',
    category: '',
    content: '',
    tagsInput: ''
  }
  categoryIndex.value = 0
}

const saveItem = () => {
  if (!formData.value.title || !formData.value.content) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }

  const tags = formData.value.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
  
  if (isEditing.value) {
    const index = knowledgeList.value.findIndex(item => item.id === editingId.value)
    if (index > -1) {
      knowledgeList.value[index] = {
        ...knowledgeList.value[index],
        title: formData.value.title,
        category: formData.value.category || categories[0],
        content: formData.value.content,
        tags,
        updatedAt: new Date().toISOString()
      }
    }
    uni.showToast({ title: '修改成功', icon: 'success' })
  } else {
    const newItem: KnowledgeItem = {
      id: Date.now().toString(),
      title: formData.value.title,
      category: formData.value.category || categories[0],
      content: formData.value.content,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    knowledgeList.value.unshift(newItem)
    uni.showToast({ title: '添加成功', icon: 'success' })
  }
  
  closeModal()
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}
</script>

<style lang="scss" scoped>
.knowledge-container {
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

.search-bar {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-base;
  background: #fffdf5;
}

.search-input {
  flex: 1;
  height: 72rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  padding: 0 $spacing-base;
  font-size: $font-size-sm;
}

.search-btn {
  width: 72rpx;
  height: 72rpx;
  background: $primary-color;
  border-radius: $border-radius;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: 28rpx;
  }
}

.filter-tabs {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-base;
  background: #fffdf5;
  border-top: 2rpx solid $bg-gray;
  overflow-x: auto;
}

.filter-tab {
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: 100rpx;
  flex-shrink: 0;
  
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

.knowledge-list {
  flex: 1;
  padding: $spacing-base;
}

.knowledge-card {
  background: #fffdf5;
  border-radius: $border-radius-lg;
  padding: $spacing-base;
  margin-bottom: $spacing-base;
  box-shadow: $shadow-sm;
}

.card-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.card-title {
  flex: 1;
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.card-category {
  padding: $spacing-xs $spacing-sm;
  background: $primary-light;
  border-radius: $border-radius;
  
  text {
    font-size: $font-size-xs;
    color: $primary-color;
  }
}

.card-content {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: $spacing-sm;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-sm;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.tag {
  padding: $spacing-xs $spacing-sm;
  background: $bg-gray;
  border-radius: $border-radius;
  font-size: $font-size-xs;
  color: $text-light;
}

.card-time {
  font-size: $font-size-xs;
  color: $text-light;
}

.card-actions {
  display: flex;
  gap: $spacing-base;
  padding-top: $spacing-sm;
  border-top: 2rpx solid $bg-gray;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: $spacing-sm;
  border-radius: $border-radius;
  
  text {
    font-size: $font-size-sm;
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
  max-height: 85vh;
  background: #fffdf5;
  border-radius: $border-radius-xl;
  display: flex;
  flex-direction: column;
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
  flex: 1;
  padding: $spacing-lg;
  overflow-y: auto;
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

.form-textarea {
  width: 100%;
  height: 200rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  padding: $spacing-base;
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
