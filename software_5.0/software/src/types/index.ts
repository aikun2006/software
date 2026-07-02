export interface KnowledgeItem {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface AvatarConfig {
  id: string
  name: string
  avatarUrl: string
  voiceType: string
  clothing: string
  expression: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  userId: string
  content: string
  type: 'text' | 'voice' | 'image'
  isUser: boolean
  timestamp: string
  emotion?: 'positive' | 'neutral' | 'negative'
  imageUrl?: string
}

export interface TourRoute {
  id: string
  name: string
  description: string
  duration: number
  distance: number
  difficulty: 'easy' | 'medium' | 'hard'
  spots: Spot[]
  suitableFor: string[]
}

export interface Spot {
  id: string
  name: string
  description: string
  imageUrl: string
  duration: number
  order: number
}

export interface VisitorReport {
  date: string
  serviceCount: number
  satisfaction: number
  hotQuestions: string[]
  emotionTrend: {
    positive: number
    neutral: number
    negative: number
  }
}

export interface DashboardData {
  todayServiceCount: number
  weeklyServiceCount: number
  avgResponseTime: number
  satisfactionRate: number
  hotQuestions: { question: string; count: number }[]
  emotionDistribution: {
    positive: number
    neutral: number
    negative: number
  }
  topRoutes: { name: string; count: number }[]
}

export interface UserInfo {
  id: number
  phone: string
  age: number | null
  nickname: string
  gender: string | null
}
