/**
 * 景点评价接口 —— 列表(公开) / 发表(需登录)
 * 与 api/user.ts 同一套 request 约定，复用游客 Bearer token 鉴权。
 */
const TOKEN_KEY = 'lingshan_user_token'

// 开发环境直连本地 8080 后端（跨域，server.py 已开 CORS）；
// 生产构建后同源（空串），走相对 /api，适配隧道暴露。
const API_BASE = import.meta.env.DEV ? 'http://localhost:8080' : ''

export interface Review {
  id: number
  spotId: string
  userId: number
  nickname: string
  rating: number
  content: string
  createdAt: string
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

export const reviewApi = {
  /** 获取某景点的全部评价（公开，无需登录） */
  list: (spotId: string) =>
    request<{ reviews: Review[] }>('/api/reviews/list', { data: { spot_id: spotId } }),

  /** 发表评价（需登录，携带游客 token） */
  create: (data: { spot_id: string; rating: number; content: string }) => {
    const token = uni.getStorageSync(TOKEN_KEY)
    return request<{ review: Review }>('/api/reviews/create', { data, token })
  },

  /** 删除自己的评价（需登录） */
  delete: (reviewId: number) => {
    const token = uni.getStorageSync(TOKEN_KEY)
    return request<{ ok: boolean }>('/api/reviews/delete', {
      data: { review_id: reviewId },
      token
    })
  }
}
