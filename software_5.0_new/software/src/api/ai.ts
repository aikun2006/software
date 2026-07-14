/**
 * AI 模型管理 API —— 管理员后台用
 *
 * 所有接口需要管理员 Token（Authorization: Bearer <token>）
 * Token 通过 POST /api/admin/ai/login 获取
 */
import type { AIModelConfig, AIGlobalConfig, AIRole } from '@/ai/types'

const ADMIN_TOKEN_KEY = 'lingshan_admin_ai_token'

/** 获取管理员Token */
export function getAdminToken(): string {
  return uni.getStorageSync(ADMIN_TOKEN_KEY) || ''
}

/** 设置管理员Token */
export function setAdminToken(token: string) {
  uni.setStorageSync(ADMIN_TOKEN_KEY, token)
}

/** 清除管理员Token */
export function clearAdminToken() {
  uni.removeStorageSync(ADMIN_TOKEN_KEY)
}

/** 通用请求封装（管理员接口） */
async function adminRequest<T = any>(
  url: string,
  options: { method?: string; data?: any } = {}
): Promise<T> {
  const { method = 'GET', data } = options
  const token = getAdminToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const response = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  })
  if (response.status === 401) {
    clearAdminToken()
    throw new Error('管理员登录已过期，请重新登录')
  }
  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.error || `请求失败: HTTP ${response.status}`)
  }
  return json as T
}

/** 管理员登录 */
export async function adminLogin(username: string, password: string): Promise<{ token: string; expires_at: number }> {
  const res = await fetch('/api/admin/ai/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || '登录失败')
  }
  setAdminToken(json.token)
  return json
}

/** 模型管理 CRUD */
export const aiModelApi = {
  /** 获取全部模型列表（含api_key，仅管理员） */
  list: () => adminRequest<{ models: AIModelConfig[] }>('/api/admin/ai/models'),

  /** 新增模型 */
  create: (data: {
    name: string
    provider_type: string
    role: AIRole
    api_url: string
    api_key: string
    model_name: string
    context_limit?: number
    status?: string
  }) => adminRequest<{ model: AIModelConfig }>('/api/admin/ai/models', { method: 'POST', data }),

  /** 编辑模型 */
  update: (id: number, data: Partial<{
    name: string
    provider_type: string
    role: AIRole
    api_url: string
    api_key: string
    model_name: string
    context_limit: number
    status: string
  }>) => adminRequest<{ model: AIModelConfig }>('/api/admin/ai/models', { method: 'PUT', data: { id, ...data } }),

  /** 删除模型 */
  remove: (id: number) => adminRequest<{ ok: boolean }>('/api/admin/ai/models', { method: 'DELETE', data: { id } }),

  /** 启用/禁用切换 */
  toggle: (id: number) => adminRequest<{ model: AIModelConfig }>('/api/admin/ai/models/toggle', { method: 'POST', data: { id } })
}

/** 全局配置 */
export const aiConfigApi = {
  /** 获取全局配置 */
  get: () => adminRequest<{ config: AIGlobalConfig }>('/api/admin/ai/config'),

  /** 更新全局配置 */
  update: (data: Partial<AIGlobalConfig>) =>
    adminRequest<{ config: AIGlobalConfig }>('/api/admin/ai/config', { method: 'PUT', data })
}

/** 公开接口（游客端，需访问口令Cookie但不需要管理员Token） */
export const aiPublicApi = {
  /** 获取已启用的模型列表（不含api_key，按role分组） */
  async getEnabledModels(): Promise<{ models: AIModelConfig[] }> {
    const res = await fetch('/api/ai/models')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }
}
