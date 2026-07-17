<template>
  <view class="ai-models-container">
    <!-- 顶部标题栏 -->
    <view class="admin-header">
      <view class="header-top">
        <view class="back-btn" @click="handleBack">
          <image class="back-icon" src="/static/icons/back.png" mode="aspectFit" />
        </view>
        <text class="header-title">AI模型配置</text>
        <view v-if="isLoggedIn" class="logout-btn" @click="handleLogout">
          <text>退出</text>
        </view>
        <view v-else class="header-placeholder"></view>
      </view>
    </view>

    <!-- 未登录：登录表单 -->
    <view v-if="!isLoggedIn" class="login-section">
      <view class="login-card">
        <view class="login-icon">
          <text>🤖</text>
        </view>
        <text class="login-title">管理员登录</text>

        <view class="form-item">
          <text class="form-label">用户名</text>
          <input
            class="form-input aim-username-input"
            v-model="loginForm.username"
            placeholder="请输入用户名"
            type="text"
            @confirm="onUsernameConfirm"
          />
        </view>

        <view class="form-item">
          <text class="form-label">密码</text>
          <input
            class="form-input aim-password-input"
            v-model="loginForm.password"
            placeholder="请输入密码"
            type="password"
            @confirm="onPasswordConfirm"
          />
        </view>

        <button class="btn-login" :disabled="loginLoading" @click="handleLogin">
          {{ loginLoading ? '登录中...' : '登 录' }}
        </button>

        <view class="login-tips">
          <text>默认账号：admin / admin123</text>
        </view>
      </view>
    </view>

    <!-- 已登录：主内容区 -->
    <view v-else class="main-content">
      <!-- Tab 切换栏 -->
      <view class="tab-bar">
        <view
          class="tab-item"
          :class="{ active: activeTab === 'models' }"
          @click="activeTab = 'models'"
        >
          <text>模型列表</text>
        </view>
        <view
          class="tab-item"
          :class="{ active: activeTab === 'config' }"
          @click="activeTab = 'config'"
        >
          <text>全局配置</text>
        </view>
      </view>

      <!-- Tab1: 模型列表 -->
      <view v-if="activeTab === 'models'" class="tab-content">
        <view class="action-bar">
          <button class="btn-add" @click="handleCreate">+ 新增模型</button>
        </view>

        <view v-if="modelsLoading" class="loading-tip">
          <text>加载中...</text>
        </view>

        <view v-else-if="models.length === 0" class="empty-tip">
          <text>暂无模型配置，请点击"新增模型"添加</text>
        </view>

        <view v-else class="model-list">
          <view class="model-card" v-for="model in models" :key="model.id">
            <view class="model-card-header">
              <text class="model-name">{{ model.name }}</text>
              <view class="status-tag" :class="model.status">
                <text>{{ model.status === 'enabled' ? '启用' : '禁用' }}</text>
              </view>
            </view>

            <view class="model-info">
              <view class="info-row">
                <text class="info-label">类型</text>
                <text class="info-value">{{ getProviderLabel(model.provider_type) }}</text>
              </view>
              <view class="info-row">
                <text class="info-label">角色</text>
                <text class="info-value">{{ getRoleLabel(model.role) }}</text>
              </view>
              <view class="info-row">
                <text class="info-label">模型</text>
                <text class="info-value">{{ model.model_name }}</text>
              </view>
              <view class="info-row">
                <text class="info-label">地址</text>
                <text class="info-value ellipsis">{{ model.api_url }}</text>
              </view>
              <view class="info-row">
                <text class="info-label">创建</text>
                <text class="info-value">{{ formatDateTime(model.created_at) }}</text>
              </view>
            </view>

            <view class="model-actions">
              <view class="action-btn edit" @click="handleEdit(model)">
                <text>编辑</text>
              </view>
              <view class="action-btn toggle" @click="handleToggle(model.id)">
                <text>{{ model.status === 'enabled' ? '禁用' : '启用' }}</text>
              </view>
              <view class="action-btn delete" @click="handleDelete(model.id)">
                <text>删除</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- Tab2: 全局配置 -->
      <view v-if="activeTab === 'config'" class="tab-content">
        <view class="config-card">
          <view class="config-item">
            <text class="config-label">默认识别模型</text>
            <picker
              mode="selector"
              :range="recognitionModelOptions"
              range-key="name"
              :value="recognitionPickerIndex"
              :disabled="recognitionModelOptions.length === 0"
              @change="onRecognitionModelChange"
            >
              <view class="picker-display" :class="{ disabled: recognitionModelOptions.length === 0 }">
                <text>{{ recognitionModelOptions.length > 0 ? recognitionModelOptions[recognitionPickerIndex].name : '暂无可用模型' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>

          <view class="config-item">
            <text class="config-label">默认问答模型</text>
            <picker
              mode="selector"
              :range="qaModelOptions"
              range-key="name"
              :value="qaPickerIndex"
              :disabled="qaModelOptions.length === 0"
              @change="onQaModelChange"
            >
              <view class="picker-display" :class="{ disabled: qaModelOptions.length === 0 }">
                <text>{{ qaModelOptions.length > 0 ? qaModelOptions[qaPickerIndex].name : '暂无可用模型' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>

          <view class="config-item">
            <text class="config-label">默认TTS模型</text>
            <picker
              mode="selector"
              :range="ttsModelOptions"
              range-key="name"
              :value="ttsPickerIndex"
              :disabled="ttsModelOptions.length === 0"
              @change="onTtsModelChange"
            >
              <view class="picker-display" :class="{ disabled: ttsModelOptions.length === 0 }">
                <text>{{ ttsModelOptions.length > 0 ? ttsModelOptions[ttsPickerIndex].name : '暂无可用模型' }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>

          <view class="config-item">
            <text class="config-label">AI调用超时时间（秒）</text>
            <input
              class="config-input"
              type="number"
              v-model="configTimeoutStr"
              placeholder="请输入超时时间"
            />
          </view>

          <button class="btn-save-config" @click="handleSaveConfig">保存配置</button>
        </view>
      </view>
    </view>

    <!-- 新增/编辑模型弹窗 -->
    <view v-if="showFormModal" class="modal-overlay" @click="closeFormModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editingModel ? '编辑模型' : '新增模型' }}</text>
          <view class="modal-close" @click="closeFormModal">
            <text>✕</text>
          </view>
        </view>

        <scroll-view scroll-y class="modal-body">
          <view class="form-item">
            <text class="form-label">模型显示名称</text>
            <input
              class="form-input"
              v-model="formData.name"
              placeholder="如：智谱GLM-4V"
              type="text"
            />
          </view>

          <view class="form-item">
            <text class="form-label">提供商类型</text>
            <picker
              mode="selector"
              :range="providerOptions"
              range-key="label"
              :value="formProviderIndex"
              @change="onProviderChange"
            >
              <view class="picker-display">
                <text>{{ providerOptions[formProviderIndex].label }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>

          <view class="form-item">
            <text class="form-label">角色</text>
            <picker
              mode="selector"
              :range="roleOptions"
              range-key="label"
              :value="formRoleIndex"
              @change="onRoleChange"
            >
              <view class="picker-display">
                <text>{{ roleOptions[formRoleIndex].label }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
          </view>

          <view class="form-item">
            <text class="form-label">API地址</text>
            <input
              class="form-input"
              v-model="formData.api_url"
              placeholder="如：https://open.bigmodel.cn/api/paas/v4"
              type="text"
            />
          </view>

          <view class="form-item">
            <text class="form-label">API密钥</text>
            <input
              class="form-input"
              v-model="formData.api_key"
              :placeholder="editingModel ? '留空则不修改' : '请输入API密钥'"
              type="password"
            />
          </view>

          <view class="form-item">
            <text class="form-label">模型名称</text>
            <input
              class="form-input"
              v-model="formData.model_name"
              placeholder="如：glm-4v-flash"
              type="text"
            />
          </view>

          <view class="form-item">
            <text class="form-label">上下文长度</text>
            <input
              class="form-input"
              v-model="formContextLimitStr"
              type="number"
              placeholder="默认4096"
            />
          </view>

          <view class="form-item form-item-switch">
            <text class="form-label">启用状态</text>
            <switch
              :checked="formData.status === 'enabled'"
              @change="onStatusChange"
              color="#8B7355"
            />
          </view>
        </scroll-view>

        <view class="modal-footer">
          <button class="btn-cancel" @click="closeFormModal">取消</button>
          <button class="btn-confirm" :disabled="saveLoading" @click="handleSave">
            {{ saveLoading ? '保存中...' : '保存' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { adminLogin, getAdminToken, clearAdminToken, aiModelApi, aiConfigApi } from '@/api/ai'
import type { AIModelConfig, AIGlobalConfig, AIRole, ProviderType } from '@/ai/types'

// ===== 状态 =====
const isLoggedIn = ref(false)
const loginForm = ref({ username: '', password: '' })
const loginLoading = ref(false)

const activeTab = ref<'models' | 'config'>('models')

const models = ref<AIModelConfig[]>([])
const modelsLoading = ref(false)

const configForm = ref<AIGlobalConfig>({
  default_recognition_model_id: null,
  default_qa_model_id: null,
  default_tts_model_id: null,
  timeout_seconds: 30
})

const showFormModal = ref(false)
const editingModel = ref<AIModelConfig | null>(null)
const saveLoading = ref(false)

const formData = ref({
  name: '',
  provider_type: 'glm' as ProviderType,
  role: 'recognition' as AIRole,
  api_url: '',
  api_key: '',
  model_name: '',
  context_limit: 4096,
  status: 'enabled' as 'enabled' | 'disabled'
})

// 数字输入用字符串桥接，避免 UniApp number 类型 v-model 的空值问题
const formContextLimitStr = ref('4096')
const configTimeoutStr = ref('30')

// ===== 常量映射 =====
const providerOptions = [
  { label: '智谱GLM', value: 'glm' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '通义千问', value: 'qwen' },
  { label: 'MiniMax', value: 'minimax' },
  { label: 'Edge TTS', value: 'edge_tts' },
  { label: '自定义', value: 'custom' }
]

const roleOptions = [
  { label: '场景识别', value: 'recognition' },
  { label: '景区问答', value: 'qa' },
  { label: '语音合成', value: 'tts' }
]

// ===== 计算属性 =====
const formProviderIndex = computed(() =>
  Math.max(0, providerOptions.findIndex(o => o.value === formData.value.provider_type))
)

const formRoleIndex = computed(() =>
  Math.max(0, roleOptions.findIndex(o => o.value === formData.value.role))
)

const recognitionModelOptions = computed(() =>
  models.value.filter(m => m.role === 'recognition' && m.status === 'enabled')
)

const qaModelOptions = computed(() =>
  models.value.filter(m => m.role === 'qa' && m.status === 'enabled')
)

const ttsModelOptions = computed(() =>
  models.value.filter(m => m.role === 'tts' && m.status === 'enabled')
)

const recognitionPickerIndex = computed(() => {
  const idx = recognitionModelOptions.value.findIndex(
    m => m.id === configForm.value.default_recognition_model_id
  )
  return idx >= 0 ? idx : 0
})

const qaPickerIndex = computed(() => {
  const idx = qaModelOptions.value.findIndex(
    m => m.id === configForm.value.default_qa_model_id
  )
  return idx >= 0 ? idx : 0
})

const ttsPickerIndex = computed(() => {
  const idx = ttsModelOptions.value.findIndex(
    m => m.id === configForm.value.default_tts_model_id
  )
  return idx >= 0 ? idx : 0
})

// ===== 工具方法 =====
const getProviderLabel = (type: ProviderType): string => {
  const found = providerOptions.find(o => o.value === type)
  return found ? found.label : type
}

const getRoleLabel = (role: AIRole): string => {
  const found = roleOptions.find(o => o.value === role)
  return found ? found.label : role
}

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

// ===== 导航与登录 =====
const handleBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.redirectTo({ url: '/pages/admin/index' })
  }
}

const handleLogin = async () => {
  if (!loginForm.value.username.trim() || !loginForm.value.password.trim()) {
    uni.showToast({ title: '请输入用户名和密码', icon: 'none' })
    return
  }
  loginLoading.value = true
  try {
    await adminLogin(loginForm.value.username, loginForm.value.password)
    isLoggedIn.value = true
    uni.showToast({ title: '登录成功', icon: 'success' })
    await Promise.all([loadModels(), loadConfig()])
  } catch (e: any) {
    uni.showToast({ title: e.message || '登录失败', icon: 'none' })
  } finally {
    loginLoading.value = false
  }
}

// ====== 回车键顺序聚焦 + 提交 ======
const focusField = (className: string) => {
  nextTick(() => {
    setTimeout(() => {
      const el = (document.querySelector(`.${className} input`) as HTMLInputElement)
        || (document.querySelector(`.${className}`) as HTMLInputElement)
      if (el) { el.focus(); el.click() }
    }, 50)
  })
}
// 用户名回车 → 聚焦密码框
const onUsernameConfirm = () => focusField('aim-password-input')
// 密码回车 → 触发登录
const onPasswordConfirm = () => handleLogin()

const handleLogout = () => {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        clearAdminToken()
        isLoggedIn.value = false
        loginForm.value = { username: '', password: '' }
        models.value = []
        activeTab.value = 'models'
      }
    }
  })
}

// ===== 数据加载 =====
const loadModels = async () => {
  modelsLoading.value = true
  try {
    const res = await aiModelApi.list()
    models.value = res.models || []
  } catch (e: any) {
    uni.showToast({ title: e.message || '加载模型列表失败', icon: 'none' })
    if (e.message && e.message.includes('过期')) {
      isLoggedIn.value = false
    }
  } finally {
    modelsLoading.value = false
  }
}

const loadConfig = async () => {
  try {
    const res = await aiConfigApi.get()
    configForm.value = { ...res.config }
    configTimeoutStr.value = String(res.config.timeout_seconds)
  } catch (e: any) {
    uni.showToast({ title: e.message || '加载配置失败', icon: 'none' })
  }
}

// ===== 模型 CRUD =====
const resetForm = () => {
  formData.value = {
    name: '',
    provider_type: 'glm',
    role: 'recognition',
    api_url: '',
    api_key: '',
    model_name: '',
    context_limit: 4096,
    status: 'enabled'
  }
  formContextLimitStr.value = '4096'
}

const handleCreate = () => {
  editingModel.value = null
  resetForm()
  showFormModal.value = true
}

const handleEdit = (model: AIModelConfig) => {
  editingModel.value = model
  formData.value = {
    name: model.name,
    provider_type: model.provider_type,
    role: model.role,
    api_url: model.api_url,
    api_key: '',
    model_name: model.model_name,
    context_limit: model.context_limit,
    status: model.status
  }
  formContextLimitStr.value = String(model.context_limit)
  showFormModal.value = true
}

const closeFormModal = () => {
  showFormModal.value = false
  editingModel.value = null
}

const onProviderChange = (e: any) => {
  const idx = Number(e.detail.value)
  formData.value.provider_type = providerOptions[idx].value as ProviderType
}

const onRoleChange = (e: any) => {
  const idx = Number(e.detail.value)
  formData.value.role = roleOptions[idx].value as AIRole
}

const onStatusChange = (e: any) => {
  formData.value.status = e.detail.value ? 'enabled' : 'disabled'
}

const handleSave = async () => {
  if (!formData.value.name.trim()) {
    uni.showToast({ title: '请输入模型显示名称', icon: 'none' })
    return
  }
  if (!formData.value.api_url.trim()) {
    uni.showToast({ title: '请输入API地址', icon: 'none' })
    return
  }
  if (!formData.value.model_name.trim()) {
    uni.showToast({ title: '请输入模型名称', icon: 'none' })
    return
  }
  if (!editingModel.value && !formData.value.api_key.trim()) {
    uni.showToast({ title: '请输入API密钥', icon: 'none' })
    return
  }

  const contextLimit = parseInt(formContextLimitStr.value, 10)
  if (isNaN(contextLimit) || contextLimit < 1) {
    uni.showToast({ title: '请输入有效的上下文长度', icon: 'none' })
    return
  }

  saveLoading.value = true
  try {
    const payload: any = {
      name: formData.value.name,
      provider_type: formData.value.provider_type,
      role: formData.value.role,
      api_url: formData.value.api_url,
      model_name: formData.value.model_name,
      context_limit: contextLimit,
      status: formData.value.status
    }
    // 编辑时若 api_key 留空则不传（保持原密钥）
    if (formData.value.api_key.trim()) {
      payload.api_key = formData.value.api_key
    }

    if (editingModel.value) {
      await aiModelApi.update(editingModel.value.id, payload)
      uni.showToast({ title: '更新成功', icon: 'success' })
    } else {
      await aiModelApi.create(payload)
      uni.showToast({ title: '创建成功', icon: 'success' })
    }
    closeFormModal()
    await loadModels()
  } catch (e: any) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' })
  } finally {
    saveLoading.value = false
  }
}

const handleDelete = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该模型配置吗？此操作不可恢复。',
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (res.confirm) {
        try {
          await aiModelApi.remove(id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          await loadModels()
        } catch (e: any) {
          uni.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      }
    }
  })
}

const handleToggle = async (id: number) => {
  try {
    await aiModelApi.toggle(id)
    uni.showToast({ title: '切换成功', icon: 'success' })
    await loadModels()
  } catch (e: any) {
    uni.showToast({ title: e.message || '切换失败', icon: 'none' })
  }
}

// ===== 全局配置 =====
const onRecognitionModelChange = (e: any) => {
  const idx = Number(e.detail.value)
  const model = recognitionModelOptions.value[idx]
  configForm.value.default_recognition_model_id = model ? model.id : null
}

const onQaModelChange = (e: any) => {
  const idx = Number(e.detail.value)
  const model = qaModelOptions.value[idx]
  configForm.value.default_qa_model_id = model ? model.id : null
}

const onTtsModelChange = (e: any) => {
  const idx = Number(e.detail.value)
  const model = ttsModelOptions.value[idx]
  configForm.value.default_tts_model_id = model ? model.id : null
}

const handleSaveConfig = async () => {
  const timeout = parseInt(configTimeoutStr.value, 10)
  if (isNaN(timeout) || timeout < 1) {
    uni.showToast({ title: '请输入有效的超时时间', icon: 'none' })
    return
  }

  try {
    const payload: AIGlobalConfig = {
      default_recognition_model_id: configForm.value.default_recognition_model_id,
      default_qa_model_id: configForm.value.default_qa_model_id,
      default_tts_model_id: configForm.value.default_tts_model_id,
      timeout_seconds: timeout
    }
    await aiConfigApi.update(payload)
    uni.showToast({ title: '配置保存成功', icon: 'success' })
    await loadConfig()
  } catch (e: any) {
    uni.showToast({ title: e.message || '保存配置失败', icon: 'none' })
  }
}

// ===== 生命周期 =====
onMounted(() => {
  isLoggedIn.value = !!getAdminToken()
  if (isLoggedIn.value) {
    Promise.all([loadModels(), loadConfig()])
  }
})
</script>

<style lang="scss" scoped>
.ai-models-container {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: $spacing-xl;
}

// ===== 顶部标题栏 =====
.admin-header {
  background: linear-gradient(135deg, $primary-color 0%, $primary-dark 100%);
  padding: $spacing-lg;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  .back-icon {
    width: 40rpx;
    height: 40rpx;
  }
}

.header-title {
  font-size: $font-size-xl;
  font-weight: 700;
  color: #fff;
}

.logout-btn {
  padding: $spacing-xs $spacing-base;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $border-radius;

  text {
    font-size: $font-size-sm;
    color: #fff;
  }
}

.header-placeholder {
  width: 60rpx;
}

// ===== 登录表单 =====
.login-section {
  padding: $spacing-xl;
  display: flex;
  justify-content: center;
}

.login-card {
  width: 100%;
  background: $bg-white;
  border-radius: $border-radius-xl;
  padding: $spacing-xl;
  box-shadow: $shadow-lg;
  text-align: center;
}

.login-icon {
  font-size: 80rpx;
  margin-bottom: $spacing-base;
}

.login-title {
  display: block;
  font-size: $font-size-xl;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: $spacing-lg;
}

.login-tips {
  margin-top: $spacing-lg;

  text {
    font-size: $font-size-xs;
    color: $text-light;
  }
}

// ===== 表单通用 =====
.form-item {
  margin-bottom: $spacing-lg;
  text-align: left;
}

.form-label {
  display: block;
  font-size: $font-size-base;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: $spacing-sm;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  padding: 0 $spacing-base;
  font-size: $font-size-base;
  color: $text-primary;
}

.form-item-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .form-label {
    margin-bottom: 0;
  }
}

// ===== 按钮样式 =====
.btn-login {
  width: 100%;
  height: 88rpx;
  background: $primary-color;
  color: #fff;
  border: none;
  border-radius: $border-radius;
  font-size: $font-size-lg;
  font-weight: 600;
  margin-top: $spacing-base;
  line-height: 88rpx;

  &:active {
    background: $primary-dark;
  }

  &[disabled] {
    opacity: 0.6;
  }
}

.btn-add {
  width: 100%;
  height: 80rpx;
  background: $primary-color;
  color: #fff;
  border: none;
  border-radius: $border-radius;
  font-size: $font-size-base;
  font-weight: 600;
  line-height: 80rpx;

  &:active {
    background: $primary-dark;
  }
}

.btn-save-config {
  width: 100%;
  height: 88rpx;
  background: $primary-color;
  color: #fff;
  border: none;
  border-radius: $border-radius;
  font-size: $font-size-lg;
  font-weight: 600;
  margin-top: $spacing-lg;
  line-height: 88rpx;

  &:active {
    background: $primary-dark;
  }
}

.btn-cancel {
  flex: 1;
  height: 80rpx;
  background: $bg-gray;
  color: $text-primary;
  border: none;
  border-radius: $border-radius;
  font-size: $font-size-base;
  font-weight: 500;
  line-height: 80rpx;

  &:active {
    background: $border-color;
  }
}

.btn-confirm {
  flex: 1;
  height: 80rpx;
  background: $primary-color;
  color: #fff;
  border: none;
  border-radius: $border-radius;
  font-size: $font-size-base;
  font-weight: 600;
  line-height: 80rpx;

  &:active {
    background: $primary-dark;
  }

  &[disabled] {
    opacity: 0.6;
  }
}

// ===== 主内容区 =====
.main-content {
  padding: $spacing-base;
}

// ===== Tab 栏 =====
.tab-bar {
  display: flex;
  background: $bg-white;
  border-radius: $border-radius-lg;
  box-shadow: $shadow-sm;
  margin-bottom: $spacing-base;
  overflow: hidden;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: $spacing-base 0;
  border-bottom: 4rpx solid transparent;

  text {
    font-size: $font-size-base;
    color: $text-secondary;
    font-weight: 500;
  }

  &.active {
    border-bottom-color: $primary-color;

    text {
      color: $primary-color;
      font-weight: 600;
    }
  }
}

.tab-content {
  // 内容区容器
}

.action-bar {
  margin-bottom: $spacing-base;
}

.loading-tip,
.empty-tip {
  text-align: center;
  padding: $spacing-xl 0;

  text {
    font-size: $font-size-base;
    color: $text-light;
  }
}

// ===== 模型卡片列表 =====
.model-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.model-card {
  background: $bg-white;
  border-radius: $border-radius-lg;
  padding: $spacing-base;
  box-shadow: $shadow-sm;
}

.model-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-base;
}

.model-name {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  flex: 1;
}

.status-tag {
  padding: $spacing-xs $spacing-base;
  border-radius: $border-radius;
  flex-shrink: 0;

  text {
    font-size: $font-size-xs;
    font-weight: 500;
  }

  &.enabled {
    background: rgba(82, 196, 26, 0.12);

    text {
      color: $success-color;
    }
  }

  &.disabled {
    background: $bg-gray;

    text {
      color: $text-light;
    }
  }
}

.model-info {
  margin-bottom: $spacing-base;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-sm;

  &:last-child {
    margin-bottom: 0;
  }
}

.info-label {
  font-size: $font-size-sm;
  color: $text-light;
  width: 80rpx;
  flex-shrink: 0;
}

.info-value {
  font-size: $font-size-sm;
  color: $text-secondary;
  flex: 1;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-actions {
  display: flex;
  gap: $spacing-sm;
  border-top: 2rpx solid $border-color;
  padding-top: $spacing-base;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: $spacing-sm 0;
  border-radius: $border-radius;

  text {
    font-size: $font-size-sm;
    font-weight: 500;
  }

  &.edit {
    background: rgba(139, 115, 85, 0.1);

    text {
      color: $primary-color;
    }
  }

  &.toggle {
    background: rgba(24, 144, 255, 0.1);

    text {
      color: $info-color;
    }
  }

  &.delete {
    background: rgba(255, 77, 79, 0.1);

    text {
      color: $error-color;
    }
  }
}

// ===== 全局配置 =====
.config-card {
  background: $bg-white;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  box-shadow: $shadow-sm;
}

.config-item {
  margin-bottom: $spacing-lg;
}

.config-label {
  display: block;
  font-size: $font-size-base;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: $spacing-sm;
}

.config-input {
  width: 100%;
  height: 88rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  padding: 0 $spacing-base;
  font-size: $font-size-base;
  color: $text-primary;
}

// ===== Picker 选择器 =====
.picker-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 88rpx;
  background: $bg-gray;
  border-radius: $border-radius;
  padding: 0 $spacing-base;

  text {
    font-size: $font-size-base;
    color: $text-primary;
  }

  .picker-arrow {
    font-size: $font-size-xs;
    color: $text-light;
  }

  &.disabled {
    opacity: 0.5;
  }
}

// ===== 弹窗 =====
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
}

.modal-content {
  width: 90%;
  max-height: 85vh;
  background: $bg-white;
  border-radius: $border-radius-xl;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-lg;
  border-bottom: 2rpx solid $border-color;
}

.modal-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.modal-close {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: $font-size-lg;
    color: $text-light;
  }
}

.modal-body {
  padding: $spacing-lg;
  max-height: 60vh;
}

.modal-footer {
  display: flex;
  gap: $spacing-base;
  padding: $spacing-lg;
  border-top: 2rpx solid $border-color;

  button {
    flex: 1;
  }
}
</style>
