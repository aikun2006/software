<template>
  <view class="knowledge-container">
    <view class="page-header">
      <view class="header-left" @click="goBack">
        <text>← 返回</text>
      </view>
      <text class="header-title">知识库管理</text>
      <view class="header-right">
        <view class="add-btn" @click="openAddModal">
          <text>+ 添加</text>
        </view>
      </view>
    </view>

    <!-- 覆盖率指标卡片 -->
    <view class="coverage-section">
      <view class="coverage-card">
        <view class="coverage-header">
          <text class="coverage-title">📊 知识库覆盖率</text>
          <text class="coverage-rate">{{ coverage.coverageRate }}%</text>
        </view>
        <view class="coverage-bar">
          <view class="coverage-fill" :style="{ width: coverage.coverageRate + '%' }"></view>
        </view>
        <view class="coverage-stats">
          <view class="cov-stat">
            <text class="cov-value">{{ coverage.total }}</text>
            <text class="cov-label">总条目</text>
          </view>
          <view class="cov-stat">
            <text class="cov-value">{{ coverage.coveredSpotCount }}/{{ coverage.totalSpotCount }}</text>
            <text class="cov-label">景点覆盖</text>
          </view>
          <view class="cov-stat">
            <text class="cov-value">{{ coverage.sourceCounts.manual }}</text>
            <text class="cov-label">手动录入</text>
          </view>
          <view class="cov-stat">
            <text class="cov-value">{{ coverage.sourceCounts.upload }}</text>
            <text class="cov-label">文档上传</text>
          </view>
        </view>
        <view class="coverage-spots" v-if="coverage.coveredSpots.length > 0">
          <text class="spots-label">已覆盖景点：</text>
          <view class="spots-tags">
            <text class="spot-tag" v-for="spot in coverage.coveredSpots" :key="spot.name">
              {{ spot.name }} ({{ spot.count }})
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 搜索与筛选 -->
    <view class="search-bar">
      <input 
        class="search-input" 
        v-model="searchKeyword"
        placeholder="搜索标题/内容/标签..."
        @confirm="loadList"
      />
      <view class="search-btn" @click="loadList">
        <text>🔍</text>
      </view>
    </view>

    <view class="filter-tabs">
      <view 
        class="filter-tab" 
        v-for="tab in filterTabs" 
        :key="tab"
        :class="{ active: activeTab === tab }"
        @click="switchTab(tab)"
      >
        <text>{{ tab }}</text>
      </view>
    </view>

    <view class="source-tabs">
      <view 
        class="source-tab" 
        v-for="src in sourceTabs" 
        :key="src"
        :class="{ active: activeSource === src }"
        @click="switchSource(src)"
      >
        <text>{{ src }}</text>
      </view>
    </view>

    <!-- 知识列表 -->
    <scroll-view class="knowledge-list" scroll-y @scrolltolower="loadList">
      <view 
        class="knowledge-card" 
        v-for="item in knowledgeList" 
        :key="item.id"
        @click="showDetail(item)"
      >
        <view class="card-header">
          <text class="card-title">{{ item.title }}</text>
          <view class="card-badges">
            <view class="card-category">{{ item.category }}</view>
            <view class="card-source" :class="{ upload: item.source === 'upload' }">
              {{ item.source === 'upload' ? '文档' : '手动' }}
            </view>
          </view>
        </view>
        <text class="card-content">{{ item.content }}</text>
        <view class="card-footer">
          <view class="card-tags" v-if="item.tags && item.tags.length">
            <text class="tag" v-for="tag in item.tags" :key="tag">{{ tag }}</text>
          </view>
          <view class="card-time">{{ formatTime(item.updated_at) }}</view>
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

      <view v-if="knowledgeList.length === 0 && !loading" class="empty-state">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无知识文档</text>
        <text class="empty-hint">点击右上角添加或上传文档</text>
      </view>
      <view v-if="loading" class="loading-tip">
        <text>加载中...</text>
      </view>
    </scroll-view>

    <!-- 添加/编辑弹窗 -->
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
              :maxlength="-1"
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

    <!-- 文档上传弹窗 -->
    <view v-if="showUploadModal" class="modal-overlay" @click="closeUploadModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">文档上传</text>
          <view class="modal-close" @click="closeUploadModal">
            <text>✕</text>
          </view>
        </view>
        <view class="modal-body">
          <view class="upload-tip">
            <text class="tip-title">支持格式：.txt / .md</text>
            <text class="tip-desc">文档将按段落自动分条存入知识库，每个段落成为一条知识条目。文件大小限制 20MB。</text>
          </view>
          <view class="form-item">
            <text class="form-label">分类</text>
            <picker :value="uploadCategoryIndex" :range="categories" @change="handleUploadCategoryChange">
              <view class="picker-value">
                <text>{{ categories[uploadCategoryIndex] || '请选择分类' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>
          <view class="form-item">
            <text class="form-label">选择文件</text>
            <view class="file-picker" @click="chooseFile">
              <text class="file-picker-text" v-if="!uploadFile">📎 点击选择文件</text>
              <text class="file-name" v-else>📄 {{ uploadFile.name }}（{{ formatSize(uploadFile.size) }}）</text>
            </view>
          </view>
          <view v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view>
            </view>
            <text class="progress-text">{{ uploadProgress }}%</text>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-secondary btn-block" @click="closeUploadModal">
            <text>取消</text>
          </button>
          <button class="btn btn-primary btn-block" @click="uploadDocument" :disabled="uploading">
            <text>{{ uploading ? '上传中...' : '开始上传' }}</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 浮动上传按钮 -->
    <view class="float-upload-btn" @click="openUploadModal">
      <text>📤</text>
      <text class="float-text">上传文档</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAdminToken } from '@/api/ai'

interface KnowledgeItem {
  id: number
  title: string
  category: string
  content: string
  tags: string[]
  source: string
  created_at: string
  updated_at: string
}

interface CoverageData {
  total: number
  categoryCounts: { category: string; count: number }[]
  sourceCounts: { manual: number; upload: number }
  coveredSpots: { name: string; count: number }[]
  coveredSpotCount: number
  totalSpotCount: number
  coverageRate: number
  lastUpdated: string | null
}

const searchKeyword = ref('')
const activeTab = ref('全部')
const activeSource = ref('全部')
const filterTabs = ['全部', '景区概况', '景点介绍', '服务信息', '文化历史']
const sourceTabs = ['全部', '手动', '文档']
const categories = ['景区概况', '景点介绍', '服务信息', '文化历史']

const knowledgeList = ref<KnowledgeItem[]>([])
const coverage = ref<CoverageData>({
  total: 0,
  categoryCounts: [],
  sourceCounts: { manual: 0, upload: 0 },
  coveredSpots: [],
  coveredSpotCount: 0,
  totalSpotCount: 0,
  coverageRate: 0,
  lastUpdated: null,
})
const loading = ref(false)
const showAddModal = ref(false)
const showUploadModal = ref(false)
const isEditing = ref(false)
const editingId = ref(0)
const categoryIndex = ref(0)
const uploadCategoryIndex = ref(0)

const formData = ref({
  title: '',
  category: '',
  content: '',
  tagsInput: ''
})

// 上传相关
const uploadFile = ref<File | null>(null)
const uploadProgress = ref(0)
const uploading = ref(false)

// 获取管理员请求头
const adminHeaders = (): Record<string, string> => ({
  'Authorization': `Bearer ${getAdminToken()}`,
})

// 加载列表
const loadList = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (searchKeyword.value.trim()) params.set('keyword', searchKeyword.value.trim())
    if (activeTab.value !== '全部') params.set('category', activeTab.value)
    if (activeSource.value === '手动') params.set('source', 'manual')
    else if (activeSource.value === '文档') params.set('source', 'upload')
    const qs = params.toString()
    const url = `/api/admin/knowledge${qs ? '?' + qs : ''}`
    const res = await fetch(url, { headers: adminHeaders() })
    if (!res.ok) throw new Error('加载失败')
    const data = await res.json()
    knowledgeList.value = data.items || []
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 加载覆盖率
const loadCoverage = async () => {
  try {
    const res = await fetch('/api/admin/knowledge/coverage', { headers: adminHeaders() })
    if (!res.ok) return
    const data = await res.json()
    coverage.value = data
  } catch (e) {
    console.error('覆盖率加载失败:', e)
  }
}

const switchTab = (tab: string) => {
  activeTab.value = tab
  loadList()
}

const switchSource = (src: string) => {
  activeSource.value = src
  loadList()
}

const handleCategoryChange = (e: any) => {
  categoryIndex.value = e.detail.value
  formData.value.category = categories[e.detail.value]
}

const handleUploadCategoryChange = (e: any) => {
  uploadCategoryIndex.value = e.detail.value
}

const showDetail = (item: KnowledgeItem) => {
  uni.showModal({
    title: item.title,
    content: item.content,
    showCancel: false
  })
}

const openAddModal = () => {
  isEditing.value = false
  editingId.value = 0
  formData.value = { title: '', category: categories[0], content: '', tagsInput: '' }
  categoryIndex.value = 0
  showAddModal.value = true
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
  categoryIndex.value = Math.max(0, categories.indexOf(item.category))
  showAddModal.value = true
}

const deleteItem = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这条知识吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const r = await fetch('/api/admin/knowledge/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...adminHeaders() },
            body: JSON.stringify({ id })
          })
          if (!r.ok) throw new Error('删除失败')
          uni.showToast({ title: '删除成功', icon: 'success' })
          loadList()
          loadCoverage()
        } catch (e) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

const closeModal = () => {
  showAddModal.value = false
  isEditing.value = false
  editingId.value = 0
}

const saveItem = async () => {
  if (!formData.value.title || !formData.value.content) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  const payload = {
    id: editingId.value || undefined,
    title: formData.value.title,
    category: formData.value.category || categories[0],
    content: formData.value.content,
    tags: formData.value.tagsInput,
    source: 'manual'
  }
  try {
    const url = isEditing.value ? '/api/admin/knowledge/update' : '/api/admin/knowledge/create'
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify(payload)
    })
    if (!r.ok) throw new Error('保存失败')
    uni.showToast({ title: isEditing.value ? '修改成功' : '添加成功', icon: 'success' })
    closeModal()
    loadList()
    loadCoverage()
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

// 文档上传相关
const openUploadModal = () => {
  uploadFile.value = null
  uploadProgress.value = 0
  uploadCategoryIndex.value = 0
  showUploadModal.value = true
}

const closeUploadModal = () => {
  showUploadModal.value = false
  uploadFile.value = null
  uploadProgress.value = 0
}

const chooseFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.txt,.md'
  input.onchange = () => {
    const f = input.files?.[0]
    if (f) {
      if (f.size > 20 * 1024 * 1024) {
        uni.showToast({ title: '文件不能超过20MB', icon: 'none' })
        return
      }
      uploadFile.value = f
    }
  }
  input.click()
}

const uploadDocument = () => {
  if (!uploadFile.value) {
    uni.showToast({ title: '请先选择文件', icon: 'none' })
    return
  }
  uploading.value = true
  uploadProgress.value = 0
  const formDataObj = new FormData()
  formDataObj.append('file', uploadFile.value)
  formDataObj.append('category', categories[uploadCategoryIndex.value])
  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/api/admin/knowledge/upload')
  xhr.setRequestHeader('Authorization', `Bearer ${getAdminToken()}`)
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      uploadProgress.value = Math.round((e.loaded / e.total) * 100)
    }
  }
  xhr.onload = () => {
    uploading.value = false
    try {
      const data = JSON.parse(xhr.responseText)
      if (xhr.status === 200 && data.ok) {
        uni.showToast({ 
          title: `上传成功，新增${data.inserted}条`, 
          icon: 'success',
          duration: 2500
        })
        closeUploadModal()
        loadList()
        loadCoverage()
      } else {
        uni.showToast({ title: data.error || '上传失败', icon: 'none' })
      }
    } catch {
      uni.showToast({ title: '上传失败', icon: 'none' })
    }
  }
  xhr.onerror = () => {
    uploading.value = false
    uni.showToast({ title: '网络错误', icon: 'none' })
  }
  xhr.send(formDataObj)
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(2) + 'MB'
}

const goBack = () => {
  uni.navigateBack()
}

const formatTime = (timestamp: string) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

onMounted(() => {
  loadList()
  loadCoverage()
})
</script>

<style lang="scss" scoped>
.knowledge-container {
  min-height: 100vh;
  background: $bg-color;
  display: flex;
  flex-direction: column;
  padding-bottom: 140rpx;
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

// 覆盖率卡片
.coverage-section {
  padding: $spacing-base;
}

.coverage-card {
  background: linear-gradient(135deg, #fffdf5 0%, #f5edd6 100%);
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-sm;
}

.coverage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-base;
}

.coverage-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.coverage-rate {
  font-size: 48rpx;
  font-weight: 700;
  color: $primary-color;
}

.coverage-bar {
  height: 16rpx;
  background: rgba(139, 115, 85, 0.15);
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: $spacing-base;
}

.coverage-fill {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, #d4a574);
  border-radius: 8rpx;
  transition: width 0.5s ease;
}

.coverage-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-sm;
  margin-bottom: $spacing-base;
}

.cov-stat {
  text-align: center;
}

.cov-value {
  display: block;
  font-size: $font-size-xl;
  font-weight: 600;
  color: $text-primary;
}

.cov-label {
  font-size: $font-size-xs;
  color: $text-light;
}

.coverage-spots {
  padding-top: $spacing-base;
  border-top: 2rpx solid rgba(139, 115, 85, 0.1);
}

.spots-label {
  font-size: $font-size-sm;
  color: $text-secondary;
  display: block;
  margin-bottom: $spacing-xs;
}

.spots-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.spot-tag {
  padding: 4rpx 12rpx;
  background: rgba(139, 115, 85, 0.15);
  border-radius: 100rpx;
  font-size: $font-size-xs;
  color: $text-secondary;
}

.search-bar {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-base;
  background: #fffdf5;
}

.search-input {
  flex: 1;
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
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
    color: #fff;
    font-size: 28rpx;
  }
}

.filter-tabs, .source-tabs {
  display: flex;
  gap: $spacing-xs;
  padding: 0 $spacing-base $spacing-xs;
  background: #fffdf5;
}

.source-tabs {
  padding-bottom: $spacing-base;
}

.filter-tab, .source-tab {
  padding: $spacing-xs $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
  text {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
  &.active {
    background: $primary-color;
    text {
      color: #fff;
    }
  }
}

.source-tab {
  background: rgba(139, 115, 85, 0.1);
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
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: $spacing-sm;
}

.card-title {
  flex: 1;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  margin-right: $spacing-sm;
}

.card-badges {
  display: flex;
  gap: 8rpx;
  flex-shrink: 0;
}

.card-category, .card-source {
  padding: 4rpx 12rpx;
  border-radius: 100rpx;
  font-size: $font-size-xs;
}

.card-category {
  background: rgba(139, 115, 85, 0.15);
  color: $primary-color;
}

.card-source {
  background: rgba(82, 196, 26, 0.15);
  color: $success-color;
  &.upload {
    background: rgba(24, 144, 255, 0.15);
    color: #1890ff;
  }
}

.card-content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;
  margin-bottom: $spacing-sm;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  flex: 1;
}

.tag {
  padding: 2rpx 10rpx;
  background: $bg-gray;
  border-radius: 100rpx;
  font-size: $font-size-xs;
  color: $text-light;
}

.card-time {
  font-size: $font-size-xs;
  color: $text-placeholder;
}

.card-actions {
  display: flex;
  gap: $spacing-sm;
  padding-top: $spacing-sm;
  border-top: 2rpx solid $bg-gray;
}

.action-btn {
  padding: $spacing-xs $spacing-base;
  border-radius: $border-radius;
  text {
    font-size: $font-size-xs;
  }
  &.edit {
    background: rgba(24, 144, 255, 0.1);
    text { color: #1890ff; }
  }
  &.delete {
    background: rgba(255, 77, 79, 0.1);
    text { color: $error-color; }
  }
}

.empty-state {
  padding: 80rpx 40rpx;
  text-align: center;
}

.empty-icon {
  display: block;
  font-size: 80rpx;
  margin-bottom: $spacing-base;
}

.empty-text {
  display: block;
  font-size: $font-size-base;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
}

.empty-hint {
  font-size: $font-size-xs;
  color: $text-light;
}

.loading-tip {
  padding: $spacing-base;
  text-align: center;
  color: $text-light;
  font-size: $font-size-sm;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-base;
}

.modal-content {
  background: #fffdf5;
  border-radius: $border-radius-lg;
  width: 100%;
  max-width: 680rpx;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-base $spacing-lg;
  border-bottom: 2rpx solid $bg-gray;
}

.modal-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.modal-close {
  padding: $spacing-xs;
  text {
    font-size: 32rpx;
    color: $text-light;
  }
}

.modal-body {
  padding: $spacing-base $spacing-lg;
  overflow-y: auto;
  flex: 1;
}

.form-item {
  margin-bottom: $spacing-base;
}

.form-label {
  display: block;
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
}

.form-input {
  width: 100%;
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
  font-size: $font-size-sm;
}

.form-textarea {
  width: 100%;
  min-height: 240rpx;
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
  font-size: $font-size-sm;
  line-height: 1.5;
}

.picker-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
  text {
    font-size: $font-size-sm;
    color: $text-primary;
  }
}

.picker-arrow {
  font-size: $font-size-xs;
  color: $text-light;
}

.modal-footer {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-base $spacing-lg;
  border-top: 2rpx solid $bg-gray;
}

.btn-block {
  flex: 1;
}

.upload-tip {
  padding: $spacing-base;
  background: rgba(24, 144, 255, 0.08);
  border-radius: $border-radius;
  margin-bottom: $spacing-base;
}

.tip-title {
  display: block;
  font-size: $font-size-sm;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: $spacing-xs;
}

.tip-desc {
  font-size: $font-size-xs;
  color: $text-secondary;
  line-height: 1.5;
}

.file-picker {
  padding: $spacing-lg;
  background: $bg-gray;
  border: 2rpx dashed rgba(139, 115, 85, 0.3);
  border-radius: $border-radius;
  text-align: center;
}

.file-picker-text {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.file-name {
  font-size: $font-size-sm;
  color: $primary-color;
  font-weight: 500;
}

.upload-progress {
  margin-top: $spacing-base;
}

.progress-bar {
  height: 12rpx;
  background: $bg-gray;
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: $primary-color;
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.progress-text {
  display: block;
  text-align: center;
  font-size: $font-size-xs;
  color: $text-secondary;
  margin-top: 4rpx;
}

.float-upload-btn {
  position: fixed;
  right: $spacing-base;
  bottom: 60rpx;
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-lg;
  background: linear-gradient(135deg, $primary-color, #d4a574);
  border-radius: 100rpx;
  box-shadow: 0 8rpx 24rpx rgba(139, 115, 85, 0.4);
  z-index: 10;
  text {
    color: #fff;
    font-size: 28rpx;
  }
  .float-text {
    font-size: $font-size-sm;
    font-weight: 500;
  }
}
</style>
