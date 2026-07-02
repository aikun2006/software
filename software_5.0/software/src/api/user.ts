import type { UserInfo } from '@/types'

// 开发环境直连本地 8080 后端（跨域，server.py 已开 CORS）；
// 生产构建后同源（空串），走相对 /api，适配隧道暴露。
const API_BASE = import.meta.env.DEV ? 'http://localhost:8080' : ''

export interface AuthResult {
  token: string
  user: UserInfo
}

function request<T>(
  url: string,
  options: { method?: string; data?: any; token?: string } = {}
): Promise<T> {
  const { method = 'POST', data, token } = options
  const header: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) header['Authorization'] = `Bearer ${token}`
  return new Promise((resolve, reject) => {
    uni.request({
      url: API_BASE + url,
      method: method as any,
      data,
      header,
      success: (res) => {
        const d = res.data as any
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(d as T)
        } else {
          reject(new Error(d?.error || '请求失败'))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误'))
    })
  })
}

export const userApi = {
  register: (data: {
    phone: string
    password: string
    age?: number | null
    nickname?: string
    gender?: string
  }) => request<AuthResult>('/api/user/register', { data }),

  login: (data: { phone: string; password: string }) =>
    request<AuthResult>('/api/user/login', { data }),

  info: (token: string) =>
    request<{ user: UserInfo }>('/api/user/info', { token }),

  logout: (token: string) =>
    request<{ ok: boolean }>('/api/user/logout', { token })
}
