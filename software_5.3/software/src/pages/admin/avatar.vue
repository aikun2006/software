<template>
  <view class="avatar-container">
    <view class="page-header">
      <view class="header-left" @click="goBack">
        <image class="back-icon" src="/static/icons/back.png" mode="aspectFit" />
        <text>返回</text>
      </view>
      <text class="header-title">数字人管理</text>
      <view class="header-right">
        <view class="voice-btn" @click="openVoiceModal">
          <text>🎵 音色管理</text>
        </view>
        <view class="reset-btn" :class="{ disabled: resetting }" @click="resetAvatars">
          <text>{{ resetting ? '重置中...' : '↻ 重置' }}</text>
        </view>
        <view class="add-btn" @click="openAddModal">
          <text>+ 上传新形象</text>
        </view>
      </view>
    </view>

    <scroll-view class="avatar-scroll" scroll-y>
      <!-- 加载状态 -->
      <view v-if="loading" class="state-block">
        <view class="state-spinner"></view>
        <text class="state-text">正在加载数字人列表...</text>
      </view>
      <!-- 错误状态 + 重试 -->
      <view v-else-if="loadError" class="state-block error">
        <text class="state-icon">⚠️</text>
        <text class="state-text">{{ loadError }}</text>
        <view class="state-retry" @click="fetchAvatars">
          <text>重试</text>
        </view>
      </view>
      <template v-else>
      <!-- 内置数字人区域 -->
      <view class="section-header">
        <text class="section-title">内置数字人</text>
        <text class="section-count">{{ builtinAvatars.length }} 个</text>
      </view>
      <view class="avatar-grid">
        <view
          class="avatar-card"
          v-for="avatar in builtinAvatars"
          :key="avatar.id"
          :class="{ active: avatar.is_active }"
          @click="activateAvatar(avatar.id)"
        >
          <view class="card-preview" @click.stop="previewAvatar(avatar)">
            <view class="preview-placeholder">
              <text class="preview-icon">🎭</text>
            </view>
            <view v-if="avatar.is_active" class="active-overlay">
              <text class="active-text">✓ 当前使用</text>
            </view>
            <view class="preview-btn-hint">
              <text>点击预览</text>
            </view>
          </view>
          <view class="card-info">
            <view class="card-name-row">
              <text class="card-name">{{ avatar.name }}</text>
              <view v-if="avatar.is_active" class="active-dot"></view>
            </view>
            <text class="card-voice">{{ getVoiceLabel(avatar.voice_type) }}</text>
            <view class="card-meta">
              <text class="meta-size">{{ formatFileSize(avatar.file_size) }}</text>
              <text class="meta-scale">缩放 {{ avatar.model_scale.toFixed(1) }}</text>
            </view>
          </view>
          <view class="card-actions">
            <view
              class="card-btn primary"
              :class="{ active: avatar.is_active }"
              @click.stop="activateAvatar(avatar.id)"
            >
              <text>{{ avatar.is_active ? '✓ 已启用' : '点击切换' }}</text>
            </view>
            <view class="card-btn secondary" @click.stop="editAvatar(avatar)">
              <text>编辑</text>
            </view>
            <view class="card-btn secondary" @click.stop="previewAvatar(avatar)">
              <text>预览</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 上传数字人区域 -->
      <view class="section-header upload-section">
        <text class="section-title">上传数字人</text>
        <text class="section-count">{{ uploadedAvatars.length }} 个</text>
        <view class="upload-link" @click="openAddModal">
          <text>+ 添加新形象</text>
        </view>
      </view>
      <view class="avatar-grid">
        <view
          class="avatar-card"
          v-for="avatar in uploadedAvatars"
          :key="avatar.id"
          :class="{ active: avatar.is_active }"
          @click="activateAvatar(avatar.id)"
        >
          <view class="card-preview" @click.stop="previewAvatar(avatar)">
            <view class="preview-placeholder uploaded">
              <text class="preview-icon">📦</text>
            </view>
            <view v-if="avatar.is_active" class="active-overlay">
              <text class="active-text">✓ 当前使用</text>
            </view>
            <view class="preview-btn-hint">
              <text>点击预览</text>
            </view>
          </view>
          <view class="card-info">
            <view class="card-name-row">
              <text class="card-name">{{ avatar.name }}</text>
              <view v-if="avatar.is_active" class="active-dot"></view>
            </view>
            <text class="card-voice">{{ getVoiceLabel(avatar.voice_type) }}</text>
            <view class="card-meta">
              <text class="meta-size">{{ formatFileSize(avatar.file_size) }}</text>
              <text class="meta-scale">缩放 {{ avatar.model_scale.toFixed(1) }}</text>
            </view>
          </view>
          <view class="card-actions">
            <view
              class="card-btn primary"
              :class="{ active: avatar.is_active }"
              @click.stop="activateAvatar(avatar.id)"
            >
              <text>{{ avatar.is_active ? '✓ 已启用' : '点击切换' }}</text>
            </view>
            <view class="card-btn secondary" @click.stop="editAvatar(avatar)">
              <text>编辑</text>
            </view>
            <view
              class="card-btn danger"
              :class="{ disabled: avatar.is_active }"
              @click.stop="deleteAvatar(avatar.id)"
            >
              <text>删除</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 上传区域空状态 -->
      <view v-if="uploadedAvatars.length === 0" class="empty-upload" @click="openAddModal">
        <text class="empty-icon">📤</text>
        <text class="empty-text">暂无上传数字人</text>
        <text class="empty-hint">点击上传 .vrm 文件添加新形象</text>
      </view>

      <view class="bottom-spacer"></view>
      </template>
    </scroll-view>

    <!-- 添加/编辑弹窗 -->
    <view v-if="showModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ isEditing ? '编辑数字人' : '添加数字人' }}</text>
          <view class="modal-close" @click="closeModal">
            <text>✕</text>
          </view>
        </view>
        <scroll-view class="modal-body" scroll-y>
          <!-- 名称 -->
          <view class="form-item">
            <text class="form-label">名称</text>
            <input class="form-input" v-model="formData.name" placeholder="请输入数字人名称" />
          </view>

          <!-- VRM 文件上传 -->
          <view class="form-item">
            <text class="form-label">VRM 模型文件</text>
            <view class="upload-area" @click="pickVrmFile">
              <view v-if="!formData.vrm_path" class="upload-placeholder">
                <text class="upload-icon">📁</text>
                <text class="upload-text">点击上传 .vrm 文件</text>
                <text class="upload-hint">支持 VRM 0.x / 1.0 格式，上限 100MB</text>
              </view>
              <view v-else class="upload-done">
                <text class="upload-filename">{{ formData.vrm_path.split('/').pop() }}</text>
                <text class="upload-size">{{ formatFileSize(formData.file_size) }}</text>
                <view class="upload-replace" @click.stop="pickVrmFile">
                  <text>更换</text>
                </view>
              </view>
            </view>
            <view v-if="uploading" class="upload-progress">
              <text>上传中... {{ uploadProgress }}%</text>
            </view>
          </view>

          <!-- 音色选择 + 试听 -->
          <view class="form-item">
            <text class="form-label">音色配置</text>
            <view class="voice-row">
              <picker class="voice-picker" :value="voiceIndex" :range="voiceLabels" @change="handleVoiceChange">
                <view class="picker-value">
                  <text>{{ voiceLabels[voiceIndex] || '请选择' }}</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
              <view class="voice-preview-btn" :class="{ playing: ttsPlaying }" @click="previewVoice">
                <text>{{ ttsPlaying ? '⏸ 停止' : '▶ 试听' }}</text>
              </view>
            </view>
          </view>

          <!-- 模型缩放 -->
          <view class="form-item">
            <text class="form-label">模型缩放: {{ formData.model_scale.toFixed(1) }}</text>
            <slider
              :value="formData.model_scale"
              :min="1"
              :max="5"
              :step="0.1"
              @change="onScaleChange"
              activeColor="#C8973F"
              backgroundColor="#E8DCC8"
              block-color="#C8973F"
            />
          </view>

          <!-- 朝向旋转 -->
          <view class="form-item">
            <text class="form-label">朝向旋转: {{ (formData.rotation_y * 180 / Math.PI).toFixed(1) }}°</text>
            <slider
              :value="formData.rotation_y"
              :min="-3.14"
              :max="3.14"
              :step="0.05"
              @change="onRotationChange"
              activeColor="#C8973F"
              backgroundColor="#E8DCC8"
              block-color="#C8973F"
            />
          </view>

          <!-- 水平偏移 -->
          <view class="form-item">
            <text class="form-label">水平偏移: {{ formData.position_x.toFixed(2) }}</text>
            <slider
              :value="formData.position_x"
              :min="-1"
              :max="1"
              :step="0.05"
              @change="onPosXChange"
              activeColor="#C8973F"
              backgroundColor="#E8DCC8"
              block-color="#C8973F"
            />
          </view>

          <!-- 垂直偏移 -->
          <view class="form-item">
            <text class="form-label">垂直偏移: {{ formData.position_y.toFixed(2) }}</text>
            <slider
              :value="formData.position_y"
              :min="-1"
              :max="1"
              :step="0.05"
              @change="onPosYChange"
              activeColor="#C8973F"
              backgroundColor="#E8DCC8"
              block-color="#C8973F"
            />
          </view>

          <!-- 3D 实时预览 -->
          <view class="form-item" v-if="formData.vrm_path">
            <text class="form-label">3D 实时预览</text>
            <view class="preview-3d-area">
              <Avatar3D
                :model-path="formData.vrm_path"
                :model-scale="formData.model_scale"
                :model-rotation-y="formData.rotation_y"
                :vertical-offset-ratio="0"
                :full-body-fit="true"
                :disable-zoom="false"
                width="100%"
                height="400rpx"
              />
            </view>
          </view>
        </scroll-view>
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

    <!-- 3D 预览弹窗（列表中的"预览"按钮） -->
    <view v-if="showPreviewModal" class="modal-overlay" @click="showPreviewModal = false">
      <view class="modal-content preview-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ previewAvatarData?.name }} - 3D 预览</text>
          <view class="modal-close" @click="showPreviewModal = false">
            <text>✕</text>
          </view>
        </view>
        <view class="preview-full-area">
          <Avatar3D
            v-if="previewAvatarData"
            :model-path="previewAvatarData.vrm_path"
            :model-scale="previewAvatarData.model_scale"
            :model-rotation-y="previewAvatarData.rotation_y"
            :vertical-offset-ratio="0"
            :full-body-fit="true"
            :disable-zoom="false"
            width="100%"
            height="100%"
          />
        </view>
        <view class="preview-modal-footer" v-if="previewAvatarData && !previewAvatarData.is_active">
          <button class="btn btn-primary btn-block" @click="activateFromPreview">
            <text>启用此数字人</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 音色管理弹窗 -->
    <view v-if="showVoiceModal" class="modal-overlay" @click="closeVoiceModal">
      <view class="modal-content voice-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">🎵 音色管理</text>
          <view class="modal-close" @click="closeVoiceModal">
            <text>✕</text>
          </view>
        </view>
        <view class="voice-tabs">
          <view class="voice-tab" :class="{ active: voiceModalTab === 'list' }" @click="voiceModalTab = 'list'">
            <text>音色列表</text>
          </view>
          <view class="voice-tab" :class="{ active: voiceModalTab === 'add' }" @click="voiceModalTab = 'add'">
            <text>+ 添加音色</text>
          </view>
        </view>
        <scroll-view class="modal-body voice-body" scroll-y>
          <!-- 音色列表 -->
          <view v-if="voiceModalTab === 'list'">
            <!-- 自定义音色 -->
            <view class="voice-section" v-if="customVoices.length > 0">
              <text class="voice-section-title">自定义音色（{{ customVoices.length }}）</text>
              <view class="voice-item custom" v-for="v in customVoices" :key="v.id">
                <view class="voice-item-info">
                  <text class="voice-item-name">{{ v.name }}</text>
                  <text class="voice-item-desc" v-if="v.description">{{ v.description }}</text>
                  <text class="voice-item-edge">引擎: {{ v.edge_voice }}</text>
                </view>
                <view class="voice-item-actions">
                  <view
                    class="voice-play-btn"
                    :class="{ playing: playingVoiceId === v.id }"
                    @click="previewVoiceSample(v)"
                  >
                    <text>{{ playingVoiceId === v.id ? '⏸' : '▶' }}</text>
                  </view>
                  <view class="voice-del-btn" @click="deleteVoice(v.id)">
                    <text>🗑</text>
                  </view>
                </view>
              </view>
            </view>
            <!-- 内置音色 -->
            <view class="voice-section">
              <text class="voice-section-title">内置音色（{{ builtinVoices.length }}）</text>
              <view class="voice-item" v-for="v in builtinVoices" :key="v.id">
                <view class="voice-item-info">
                  <text class="voice-item-name">{{ v.name }}</text>
                  <text class="voice-item-edge">引擎: {{ v.edge_voice }}</text>
                </view>
                <view class="voice-item-actions">
                  <view
                    class="voice-play-btn"
                    :class="{ playing: playingVoiceId === v.id }"
                    @click="previewVoiceSample(v)"
                  >
                    <text>{{ playingVoiceId === v.id ? '⏸' : '▶' }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <!-- 添加音色表单 -->
          <view v-if="voiceModalTab === 'add'" class="voice-form">
            <view class="form-item">
              <text class="form-label">音色名称 *</text>
              <input class="form-input" v-model="voiceFormData.name" placeholder="如：温柔女声、沉稳男声" />
            </view>
            <view class="form-item">
              <text class="form-label">对应 Edge-TTS 引擎音色 *</text>
              <picker :value="EDGE_TTS_OPTIONS.indexOf(voiceFormData.edge_voice)" :range="EDGE_TTS_OPTIONS" @change="(e: any) => voiceFormData.edge_voice = EDGE_TTS_OPTIONS[e.detail.value]">
                <view class="picker-value">
                  <text>{{ voiceFormData.edge_voice || '请选择' }}</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
            <view class="form-item">
              <text class="form-label">描述（选填）</text>
              <input class="form-input" v-model="voiceFormData.description" placeholder="音色特点描述" />
            </view>
            <view class="form-item">
              <text class="form-label">音频样本 *</text>
              <view class="upload-area" @click="pickVoiceAudio">
                <view v-if="!voiceAudioFile" class="upload-placeholder">
                  <text class="upload-icon">🎵</text>
                  <text class="upload-text">点击上传音频样本</text>
                  <text class="upload-hint">支持 mp3/wav/m4a/ogg，上限 20MB</text>
                </view>
                <view v-else class="upload-done">
                  <text class="upload-filename">📄 {{ voiceAudioFile.name }}</text>
                  <text class="upload-size">{{ formatFileSize(voiceAudioFile.size) }}</text>
                  <view class="upload-replace" @click.stop="pickVoiceAudio">
                    <text>更换</text>
                  </view>
                </view>
              </view>
              <view v-if="voiceUploading && voiceUploadProgress > 0" class="upload-progress">
                <text>上传中... {{ voiceUploadProgress }}%</text>
              </view>
            </view>
            <view class="voice-tip">
              <text class="tip-icon">💡</text>
              <text class="tip-text">音频样本用于管理员快速试听音色效果。实际 TTS 合成使用所选 Edge-TTS 引擎音色。</text>
            </view>
          </view>
        </scroll-view>
        <view class="modal-footer" v-if="voiceModalTab === 'add'">
          <button class="btn btn-secondary btn-block" @click="voiceModalTab = 'list'">
            <text>取消</text>
          </button>
          <button class="btn btn-primary btn-block" @click="submitVoice" :disabled="voiceUploading">
            <text>{{ voiceUploading ? '上传中...' : '添加音色' }}</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAdminToken } from '@/api/ai'
import Avatar3D from '@/components/Avatar3D.vue'

interface AvatarItem {
  id: number
  name: string
  vrm_path: string
  voice_type: string
  model_scale: number
  position_x: number
  position_y: number
  rotation_y: number
  is_active: boolean
  is_builtin: boolean
  file_size: number
  created_at: string
  updated_at: string
}

const avatarList = ref<AvatarItem[]>([])
const loading = ref(false)
const loadError = ref('')
const resetting = ref(false)
const activatingId = ref<number | null>(null)
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref(0)
const uploading = ref(false)
const uploadProgress = ref(0)

// 音色列表
interface VoiceItem {
  id: number
  name: string
  edge_voice: string
  audio_path: string
  description: string
  is_builtin: boolean
  created_at: string
  updated_at: string
}
const voiceList = ref<VoiceItem[]>([])
const voiceLabels = computed(() => voiceList.value.map(v => v.name))
const voiceIndex = ref(0)

// 音色管理弹窗
const showVoiceModal = ref(false)
const voiceModalTab = ref<'list' | 'add'>('list')
const builtinVoices = computed(() => voiceList.value.filter(v => v.is_builtin))
const customVoices = computed(() => voiceList.value.filter(v => !v.is_builtin))
const voiceFormData = ref({
  name: '',
  edge_voice: 'zh-CN-XiaoxiaoNeural',
  description: '',
})
const voiceAudioFile = ref<File | null>(null)
const voiceUploading = ref(false)
const voiceUploadProgress = ref(0)
const playingVoiceId = ref<number | null>(null)
let voiceAudioEl: HTMLAudioElement | null = null

// edge-tts 可选音色（供添加自定义音色时选择）
const EDGE_TTS_OPTIONS = [
  'zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural', 'zh-CN-YunxiNeural',
  'zh-CN-YunyangNeural', 'zh-CN-XiaochenNeural', 'zh-CN-XiaohanNeural',
  'zh-CN-XiaomengNeural', 'zh-CN-XiaomoNeural', 'zh-CN-XiaoqiuNeural',
  'zh-CN-XiaoruiNeural', 'zh-CN-XiaoshuangNeural', 'zh-CN-XiaoxuanNeural',
  'zh-CN-XiaoyanNeural', 'zh-CN-XiaozhenNeural', 'zh-CN-YunjianNeural',
  'zh-CN-YunfengNeural', 'zh-CN-YunhaoNeural', 'zh-CN-YunxiaNeural',
  'zh-CN-YunyeNeural',
]

// TTS 试听
const ttsPlaying = ref(false)
let ttsAudio: HTMLAudioElement | null = null

// 3D 预览弹窗
const showPreviewModal = ref(false)
const previewAvatarData = ref<AvatarItem | null>(null)

const formData = ref({
  name: '',
  vrm_path: '',
  voice_type: 'zh-CN-XiaoxiaoNeural',
  model_scale: 3.25,
  position_x: 0,
  position_y: 0,
  rotation_y: 0,
  file_size: 0,
})

// 内置/上传分区
const builtinAvatars = computed(() => avatarList.value.filter(a => a.is_builtin))
const uploadedAvatars = computed(() => avatarList.value.filter(a => !a.is_builtin))

const goBack = () => {
  uni.navigateBack()
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const getVoiceLabel = (value: string) => {
  const v = voiceList.value.find(item => item.edge_voice === value)
  return v ? v.name : value
}

// ===== API 调用 =====

const fetchAvatars = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const token = getAdminToken()
    const res = await fetch('/api/admin/avatars', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `请求失败 (${res.status})`)
    }
    const data = await res.json()
    avatarList.value = data.avatars || []
  } catch (e: any) {
    loadError.value = e.message || '获取数字人列表失败'
    console.error('获取数字人列表失败:', e)
  } finally {
    loading.value = false
  }
}

const resetAvatars = () => {
  uni.showModal({
    title: '重置数字人',
    content: '将清空全部上传数字人并重新初始化 3 个内置数字人，是否继续？',
    success: async (res) => {
      if (!res.confirm) return
      resetting.value = true
      try {
        const token = getAdminToken()
        const r = await fetch('/api/admin/avatars/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.error || '重置失败')
        }
        const data = await r.json()
        avatarList.value = data.avatars || []
        uni.showToast({ title: '已重置数字人', icon: 'success' })
      } catch (e: any) {
        uni.showToast({ title: e.message || '重置失败', icon: 'none' })
      } finally {
        resetting.value = false
      }
    }
  })
}

const fetchVoices = async () => {
  try {
    const token = getAdminToken()
    const res = await fetch('/api/admin/avatars/voices', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) return
    const data = await res.json()
    voiceList.value = data.voices || []
  } catch (e) {
    console.error('获取音色列表失败:', e)
  }
}

const uploadVrm = async (file: File) => {
  uploading.value = true
  uploadProgress.value = 0
  try {
    const formDataObj = new FormData()
    formDataObj.append('file', file)
    const token = getAdminToken()
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/avatars/upload')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    }
    const result = await new Promise<any>((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(JSON.parse(xhr.responseText))
        } else {
          reject(new Error(`上传失败: HTTP ${xhr.status}`))
        }
      }
      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.send(formDataObj)
    })
    formData.value.vrm_path = result.vrm_path
    formData.value.file_size = result.file_size
    uni.showToast({ title: 'VRM 上传成功', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e.message || '上传失败', icon: 'none' })
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

const pickVrmFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.vrm'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.vrm')) {
        uni.showToast({ title: '请选择 .vrm 文件', icon: 'none' })
        return
      }
      if (file.size > 100 * 1024 * 1024) {
        uni.showToast({ title: '文件超过 100MB 限制', icon: 'none' })
        return
      }
      uploadVrm(file)
    }
  }
  input.click()
}

const previewVoice = async () => {
  if (ttsPlaying.value) {
    if (ttsAudio) {
      ttsAudio.pause()
      ttsAudio = null
    }
    ttsPlaying.value = false
    return
  }
  try {
    ttsPlaying.value = true
    const token = getAdminToken()
    const res = await fetch('/api/admin/tts/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        text: '你好，欢迎来到灵山胜境，我是您的专属导游小乐。',
        voice: formData.value.voice_type
      })
    })
    if (!res.ok) {
      throw new Error('试听失败')
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    ttsAudio = new Audio(url)
    ttsAudio.onended = () => {
      ttsPlaying.value = false
      URL.revokeObjectURL(url)
    }
    ttsAudio.onerror = () => {
      ttsPlaying.value = false
      URL.revokeObjectURL(url)
    }
    await ttsAudio.play()
  } catch (e: any) {
    ttsPlaying.value = false
    uni.showToast({ title: e.message || '试听失败', icon: 'none' })
  }
}

const handleVoiceChange = (e: any) => {
  voiceIndex.value = e.detail.value
  formData.value.voice_type = voiceList.value[e.detail.value]?.edge_voice || 'zh-CN-XiaoxiaoNeural'
}

const onScaleChange = (e: any) => {
  formData.value.model_scale = parseFloat(e.detail.value)
}

const onRotationChange = (e: any) => {
  formData.value.rotation_y = parseFloat(e.detail.value)
}

const onPosXChange = (e: any) => {
  formData.value.position_x = parseFloat(e.detail.value)
}

const onPosYChange = (e: any) => {
  formData.value.position_y = parseFloat(e.detail.value)
}

const openAddModal = () => {
  isEditing.value = false
  editingId.value = 0
  formData.value = {
    name: '',
    vrm_path: '',
    voice_type: 'zh-CN-XiaoxiaoNeural',
    model_scale: 3.25,
    position_x: 0,
    position_y: 0,
    rotation_y: 0,
    file_size: 0,
  }
  voiceIndex.value = voiceList.value.findIndex(v => v.edge_voice === 'zh-CN-XiaoxiaoNeural')
  if (voiceIndex.value < 0) voiceIndex.value = 0
  showModal.value = true
}

const editAvatar = (avatar: AvatarItem) => {
  isEditing.value = true
  editingId.value = avatar.id
  formData.value = {
    name: avatar.name,
    vrm_path: avatar.vrm_path,
    voice_type: avatar.voice_type,
    model_scale: avatar.model_scale,
    position_x: avatar.position_x,
    position_y: avatar.position_y,
    rotation_y: avatar.rotation_y,
    file_size: avatar.file_size,
  }
  voiceIndex.value = voiceList.value.findIndex(v => v.edge_voice === avatar.voice_type)
  if (voiceIndex.value < 0) voiceIndex.value = 0
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  isEditing.value = false
  editingId.value = 0
  if (ttsAudio) {
    ttsAudio.pause()
    ttsAudio = null
    ttsPlaying.value = false
  }
}

const saveAvatar = async () => {
  if (!formData.value.name) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }
  if (!formData.value.vrm_path) {
    uni.showToast({ title: '请上传 VRM 模型文件', icon: 'none' })
    return
  }
  try {
    const token = getAdminToken()
    const url = isEditing.value ? '/api/admin/avatars/update' : '/api/admin/avatars/create'
    const body: any = { ...formData.value }
    if (isEditing.value) body.id = editingId.value
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '保存失败')
    }
    uni.showToast({ title: isEditing.value ? '修改成功' : '添加成功', icon: 'success' })
    closeModal()
    await fetchAvatars()
  } catch (e: any) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' })
  }
}

const activateAvatar = async (id: number) => {
  // 如果已经启用或在激活中，不重复操作
  const avatar = avatarList.value.find(a => a.id === id)
  if (avatar?.is_active || activatingId.value !== null) return
  activatingId.value = id
  // 乐观更新：先在本地切换 is_active 状态，避免界面卡顿
  avatarList.value = avatarList.value.map(a => ({
    ...a,
    is_active: a.id === id
  }))
  try {
    const token = getAdminToken()
    const res = await fetch('/api/admin/avatars/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '启用失败')
    }
    uni.showToast({ title: '已切换数字人', icon: 'success' })
    // 拉取最新数据确保与后端一致
    await fetchAvatars()
  } catch (e: any) {
    // 回滚乐观更新
    await fetchAvatars()
    uni.showToast({ title: e.message || '启用失败', icon: 'none' })
  } finally {
    activatingId.value = null
  }
}

const activateFromPreview = async () => {
  if (previewAvatarData.value) {
    const id = previewAvatarData.value.id
    showPreviewModal.value = false
    await activateAvatar(id)
  }
}

const deleteAvatar = (id: number) => {
  const avatar = avatarList.value.find(a => a.id === id)
  if (avatar?.is_active) {
    uni.showToast({ title: '不能删除当前启用的数字人', icon: 'none' })
    return
  }
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个数字人形象吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const token = getAdminToken()
          const r = await fetch('/api/admin/avatars/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
          })
          if (!r.ok) {
            const d = await r.json()
            throw new Error(d.error || '删除失败')
          }
          uni.showToast({ title: '删除成功', icon: 'success' })
          await fetchAvatars()
        } catch (e: any) {
          uni.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      }
    }
  })
}

const previewAvatar = (avatar: AvatarItem) => {
  previewAvatarData.value = avatar
  showPreviewModal.value = true
}

// ===== 音色管理 =====

const openVoiceModal = () => {
  voiceModalTab.value = 'list'
  showVoiceModal.value = true
}

const closeVoiceModal = () => {
  showVoiceModal.value = false
  voiceFormData.value = { name: '', edge_voice: 'zh-CN-XiaoxiaoNeural', description: '' }
  voiceAudioFile.value = null
  voiceUploadProgress.value = 0
  if (voiceAudioEl) {
    voiceAudioEl.pause()
    voiceAudioEl = null
    playingVoiceId.value = null
  }
}

const pickVoiceAudio = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.mp3,.wav,.m4a,.ogg'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        uni.showToast({ title: '音频不能超过20MB', icon: 'none' })
        return
      }
      voiceAudioFile.value = file
    }
  }
  input.click()
}

const submitVoice = async () => {
  if (!voiceFormData.value.name) {
    uni.showToast({ title: '请输入音色名称', icon: 'none' })
    return
  }
  if (!voiceFormData.value.edge_voice) {
    uni.showToast({ title: '请选择对应的 edge-tts 音色', icon: 'none' })
    return
  }
  if (!voiceAudioFile.value) {
    uni.showToast({ title: '请上传音频样本', icon: 'none' })
    return
  }
  voiceUploading.value = true
  voiceUploadProgress.value = 0
  try {
    const fd = new FormData()
    fd.append('name', voiceFormData.value.name)
    fd.append('edge_voice', voiceFormData.value.edge_voice)
    fd.append('description', voiceFormData.value.description)
    fd.append('audio', voiceAudioFile.value)
    const token = getAdminToken()
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/voices/create')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        voiceUploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    }
    await new Promise<void>((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) resolve()
        else reject(new Error(JSON.parse(xhr.responseText || '{}').error || '添加失败'))
      }
      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.send(fd)
    })
    uni.showToast({ title: '音色添加成功', icon: 'success' })
    voiceFormData.value = { name: '', edge_voice: 'zh-CN-XiaoxiaoNeural', description: '' }
    voiceAudioFile.value = null
    voiceUploadProgress.value = 0
    voiceModalTab.value = 'list'
    await fetchVoices()
  } catch (e: any) {
    uni.showToast({ title: e.message || '添加失败', icon: 'none' })
  } finally {
    voiceUploading.value = false
  }
}

const deleteVoice = (id: number) => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个自定义音色吗？音频样本也将被删除。',
    success: async (res) => {
      if (res.confirm) {
        try {
          const token = getAdminToken()
          const r = await fetch('/api/admin/voices/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id })
          })
          if (!r.ok) {
            const d = await r.json()
            throw new Error(d.error || '删除失败')
          }
          uni.showToast({ title: '删除成功', icon: 'success' })
          await fetchVoices()
        } catch (e: any) {
          uni.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      }
    }
  })
}

const previewVoiceSample = async (voice: VoiceItem) => {
  // 如果正在播放，停止
  if (playingVoiceId.value === voice.id && voiceAudioEl) {
    voiceAudioEl.pause()
    voiceAudioEl = null
    playingVoiceId.value = null
    return
  }
  // 停止之前的播放
  if (voiceAudioEl) {
    voiceAudioEl.pause()
    voiceAudioEl = null
  }
  try {
    if (voice.audio_path) {
      // 播放上传的音频样本
      const token = getAdminToken()
      const res = await fetch(`/api/admin/voices/audio?id=${voice.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('获取音频失败')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      voiceAudioEl = new Audio(url)
      playingVoiceId.value = voice.id
      voiceAudioEl.onended = () => {
        playingVoiceId.value = null
        URL.revokeObjectURL(url)
      }
      voiceAudioEl.onerror = () => {
        playingVoiceId.value = null
        URL.revokeObjectURL(url)
      }
      await voiceAudioEl.play()
    } else {
      // 内置音色，用 TTS 合成试听
      const token = getAdminToken()
      const res = await fetch('/api/admin/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          text: '你好，欢迎来到灵山胜境，我是您的专属导游。',
          voice: voice.edge_voice
        })
      })
      if (!res.ok) throw new Error('试听失败')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      voiceAudioEl = new Audio(url)
      playingVoiceId.value = voice.id
      voiceAudioEl.onended = () => {
        playingVoiceId.value = null
        URL.revokeObjectURL(url)
      }
      voiceAudioEl.onerror = () => {
        playingVoiceId.value = null
        URL.revokeObjectURL(url)
      }
      await voiceAudioEl.play()
    }
  } catch (e: any) {
    playingVoiceId.value = null
    uni.showToast({ title: e.message || '试听失败', icon: 'none' })
  }
}

onMounted(() => {
  fetchAvatars()
  fetchVoices()
})

onUnmounted(() => {
  if (ttsAudio) {
    ttsAudio.pause()
    ttsAudio = null
  }
  if (voiceAudioEl) {
    voiceAudioEl.pause()
    voiceAudioEl = null
  }
})
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
  display: flex;
  align-items: center;
  gap: 8rpx;
  text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
  .back-icon {
    width: 32rpx;
    height: 32rpx;
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

.header-right {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.voice-btn {
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
  border: 2rpx solid rgba(139, 115, 85, 0.2);
  text {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

.reset-btn {
  padding: $spacing-sm $spacing-base;
  background: #fff3cd;
  border-radius: $border-radius;
  border: 2rpx solid #ffc107;
  text {
    font-size: $font-size-sm;
    color: #856404;
  }
  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

// ===== 加载/错误状态 =====
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
  gap: 20rpx;
  &.error {
    .state-text {
      color: #dc3545;
    }
  }
}
.state-spinner {
  width: 56rpx;
  height: 56rpx;
  border: 4rpx solid rgba(200, 151, 63, 0.2);
  border-top-color: $primary-color;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.state-icon {
  font-size: 64rpx;
}
.state-text {
  font-size: $font-size-base;
  color: $text-secondary;
}
.state-retry {
  margin-top: 12rpx;
  padding: 16rpx 48rpx;
  background: $primary-color;
  border-radius: $border-radius;
  text {
    font-size: $font-size-sm;
    color: #fff;
  }
}

.avatar-scroll {
  flex: 1;
  padding: $spacing-base;
}

// ===== 分区标题 =====
.section-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-base $spacing-sm;
  margin-bottom: $spacing-sm;

  &.upload-section {
    margin-top: $spacing-lg;
  }
}

.section-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.section-count {
  font-size: $font-size-sm;
  color: $text-light;
}

.upload-link {
  margin-left: auto;
  padding: $spacing-xs $spacing-base;
  background: $primary-color;
  border-radius: $border-radius;
  text {
    font-size: $font-size-sm;
    color: #fff;
  }
}

// ===== 卡片网格 =====
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-base;
}

.avatar-card {
  background: #fffdf5;
  border-radius: $border-radius-lg;
  overflow: hidden;
  box-shadow: $shadow-sm;
  border: 3rpx solid transparent;
  transition: border-color 0.2s, transform 0.15s;

  &:active {
    transform: scale(0.98);
  }

  &.active {
    border-color: $primary-color;
    box-shadow: 0 0 0 2rpx rgba(200, 151, 63, 0.2);
  }
}

.card-preview {
  position: relative;
  width: 100%;
  height: 240rpx;
  background: linear-gradient(135deg, #f0e6d0 0%, #e0d4b8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;

  &.uploaded {
    .preview-icon {
      opacity: 0.7;
    }
  }
}

.preview-icon {
  font-size: 64rpx;
}

.active-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(200, 151, 63, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.active-text {
  font-size: $font-size-base;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.preview-btn-hint {
  position: absolute;
  bottom: $spacing-xs;
  right: $spacing-xs;
  background: rgba(0, 0, 0, 0.4);
  padding: $spacing-xs $spacing-sm;
  border-radius: $border-radius;
  text {
    font-size: $font-size-xs;
    color: #fff;
  }
}

.card-info {
  padding: $spacing-sm $spacing-base;
}

.card-name-row {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  margin-bottom: $spacing-xs;
}

.card-name {
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-dot {
  width: 16rpx;
  height: 16rpx;
  background: $success-color;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-voice {
  font-size: $font-size-xs;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
  display: block;
}

.card-meta {
  display: flex;
  gap: $spacing-base;
}

.meta-size,
.meta-scale {
  font-size: $font-size-xs;
  color: $text-light;
}

.card-actions {
  display: flex;
  border-top: 2rpx solid $bg-gray;
}

.card-btn {
  flex: 1;
  text-align: center;
  padding: $spacing-sm 0;
  text {
    font-size: $font-size-xs;
  }

  &.primary {
    background: $primary-color;
    text {
      color: #fff;
      font-weight: 500;
    }
    &.active {
      background: $success-color;
    }
  }

  &.secondary {
    background: $bg-gray;
    text {
      color: $text-secondary;
    }
  }

  &.danger {
    background: rgba(255, 77, 79, 0.08);
    text {
      color: $error-color;
    }
    &.disabled {
      opacity: 0.4;
    }
  }
}

// ===== 空状态 =====
.empty-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xl;
  margin: $spacing-base;
  border: 2rpx dashed $border-color;
  border-radius: $border-radius-lg;
  background: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 64rpx;
  margin-bottom: $spacing-base;
}

.empty-text {
  font-size: $font-size-base;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
}

.empty-hint {
  font-size: $font-size-sm;
  color: $text-light;
}

.bottom-spacer {
  height: 40rpx;
}

// ===== 弹窗样式 =====
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

.preview-modal {
  width: 90%;
  height: 75vh;
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
  flex: 1;
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

.upload-area {
  border: 2rpx dashed $border-color;
  border-radius: $border-radius;
  padding: $spacing-lg;
  text-align: center;
  background: $bg-gray;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
}

.upload-icon {
  font-size: 48rpx;
}

.upload-text {
  font-size: $font-size-base;
  color: $text-primary;
}

.upload-hint {
  font-size: $font-size-xs;
  color: $text-light;
}

.upload-done {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

.upload-filename {
  font-size: $font-size-sm;
  color: $success-color;
  font-weight: 600;
}

.upload-size {
  font-size: $font-size-xs;
  color: $text-light;
}

.upload-replace {
  padding: $spacing-xs $spacing-sm;
  background: $primary-color;
  border-radius: $border-radius;
  text {
    font-size: $font-size-xs;
    color: #fff;
  }
}

.upload-progress {
  margin-top: $spacing-sm;
  text-align: center;
  text {
    font-size: $font-size-sm;
    color: $primary-color;
  }
}

.voice-row {
  display: flex;
  gap: $spacing-sm;
}

.voice-picker {
  flex: 1;
}

.voice-preview-btn {
  padding: 0 $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
  display: flex;
  align-items: center;
  justify-content: center;
  text {
    font-size: $font-size-sm;
    color: $primary-color;
    white-space: nowrap;
  }
  &.playing {
    background: $primary-color;
    text {
      color: #fff;
    }
  }
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

.preview-3d-area {
  border-radius: $border-radius;
  overflow: hidden;
  background: $bg-gray;
}

.preview-full-area {
  flex: 1;
  overflow: hidden;
  border-radius: 0 0 $border-radius-xl $border-radius-xl;
}

.preview-modal-footer {
  padding: $spacing-base $spacing-lg;
  border-top: 2rpx solid $bg-gray;
}

.modal-footer {
  display: flex;
  gap: $spacing-base;
  padding: $spacing-lg;
  border-top: 2rpx solid $bg-gray;
}

.btn-block {
  flex: 1;
}

// ===== 音色管理弹窗 =====
.voice-modal {
  width: 90%;
  max-height: 85vh;
}

.voice-tabs {
  display: flex;
  border-bottom: 2rpx solid $bg-gray;
}

.voice-tab {
  flex: 1;
  text-align: center;
  padding: $spacing-base;
  text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
  &.active {
    border-bottom: 4rpx solid $primary-color;
    text {
      color: $primary-color;
      font-weight: 600;
    }
  }
}

.voice-body {
  padding: $spacing-base $spacing-lg;
}

.voice-section {
  margin-bottom: $spacing-lg;
}

.voice-section-title {
  display: block;
  font-size: $font-size-sm;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-sm;
  padding-bottom: $spacing-xs;
  border-bottom: 2rpx solid $bg-gray;
}

.voice-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm $spacing-base;
  background: $bg-gray;
  border-radius: $border-radius;
  margin-bottom: $spacing-xs;

  &.custom {
    background: rgba(24, 144, 255, 0.06);
    border-left: 4rpx solid #1890ff;
  }
}

.voice-item-info {
  flex: 1;
  min-width: 0;
}

.voice-item-name {
  display: block;
  font-size: $font-size-sm;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.voice-item-desc {
  display: block;
  font-size: $font-size-xs;
  color: $text-secondary;
  margin-bottom: 4rpx;
}

.voice-item-edge {
  font-size: $font-size-xs;
  color: $text-light;
}

.voice-item-actions {
  display: flex;
  gap: $spacing-xs;
  flex-shrink: 0;
}

.voice-play-btn {
  width: 64rpx;
  height: 64rpx;
  background: $primary-color;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text {
    font-size: 28rpx;
    color: #fff;
  }
  &.playing {
    background: $error-color;
  }
}

.voice-del-btn {
  width: 64rpx;
  height: 64rpx;
  background: rgba(255, 77, 79, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text {
    font-size: 28rpx;
  }
}

.voice-form {
  padding: $spacing-base 0;
}

.voice-tip {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-base;
  background: rgba(24, 144, 255, 0.08);
  border-radius: $border-radius;
  margin-top: $spacing-base;
}

.tip-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}

.tip-text {
  font-size: $font-size-xs;
  color: $text-secondary;
  line-height: 1.5;
}
</style>
