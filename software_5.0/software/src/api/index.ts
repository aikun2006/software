import { get, post, put, del } from '@/utils/request'
import type { KnowledgeItem, AvatarConfig, ChatMessage, TourRoute, VisitorReport, DashboardData } from '@/types'

export const authApi = {
  login: (data: { username: string; password: string }) => post('/auth/login', data),
  logout: () => post('/auth/logout')
}

export const knowledgeApi = {
  list: (params?: { page?: number; pageSize?: number; keyword?: string }) => 
    get<{ data: KnowledgeItem[]; total: number }>('/knowledge', params),
  get: (id: string) => get<KnowledgeItem>(`/knowledge/${id}`),
  create: (data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => post('/knowledge', data),
  update: (id: string, data: Partial<KnowledgeItem>) => put(`/knowledge/${id}`, data),
  delete: (id: string) => del(`/knowledge/${id}`)
}

export const avatarApi = {
  list: () => get<AvatarConfig[]>('/avatar'),
  get: (id: string) => get<AvatarConfig>(`/avatar/${id}`),
  create: (data: Omit<AvatarConfig, 'id' | 'createdAt' | 'updatedAt'>) => post('/avatar', data),
  update: (id: string, data: Partial<AvatarConfig>) => put(`/avatar/${id}`, data),
  delete: (id: string) => del(`/avatar/${id}`),
  setActive: (id: string) => post(`/avatar/${id}/active`)
}

export const chatApi = {
  send: (data: { content: string; type: 'text' | 'voice' }) => 
    post<{ response: string; emotion?: string }>('/chat', data),
  history: () => get<ChatMessage[]>('/chat/history')
}

export const routeApi = {
  list: (params?: { interest?: string }) => get<TourRoute[]>('/routes', params),
  get: (id: string) => get<TourRoute>(`/routes/${id}`),
  recommend: (interests: string[]) => post<TourRoute[]>('/routes/recommend', { interests })
}

export const reportApi = {
  getDaily: (date: string) => get<VisitorReport>(`/report/daily/${date}`),
  getWeekly: () => get<VisitorReport[]>('/report/weekly'),
  getDashboard: () => get<DashboardData>('/report/dashboard')
}
