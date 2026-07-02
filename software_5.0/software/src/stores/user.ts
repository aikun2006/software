import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@/types'
import { userApi } from '@/api/user'

// 游客登录态专用 key（与 admin 体系的 'token' 隔离，互不影响）
const TOKEN_KEY = 'lingshan_user_token'

export const useUserStore = defineStore('user', () => {
  const user = ref<UserInfo | null>(null)
  const isLoggedIn = ref(false)

  const _setSession = (token: string, u: UserInfo) => {
    uni.setStorageSync(TOKEN_KEY, token)
    user.value = u
    isLoggedIn.value = true
  }

  const register = async (data: {
    phone: string
    password: string
    age?: number | null
    nickname?: string
    gender?: string
  }) => {
    const res = await userApi.register(data)
    _setSession(res.token, res.user)
    return res.user
  }

  const login = async (phone: string, password: string) => {
    const res = await userApi.login({ phone, password })
    _setSession(res.token, res.user)
    return res.user
  }

  const logout = async () => {
    const token = uni.getStorageSync(TOKEN_KEY)
    try {
      if (token) await userApi.logout(token)
    } catch {
      /* 忽略网络错误，本地仍清除 */
    } finally {
      uni.removeStorageSync(TOKEN_KEY)
      user.value = null
      isLoggedIn.value = false
    }
  }

  const checkLogin = async () => {
    const token = uni.getStorageSync(TOKEN_KEY)
    if (!token) return false
    try {
      const res = await userApi.info(token)
      user.value = res.user
      isLoggedIn.value = true
      return true
    } catch {
      uni.removeStorageSync(TOKEN_KEY)
      user.value = null
      isLoggedIn.value = false
      return false
    }
  }

  return { user, isLoggedIn, register, login, logout, checkLogin }
})
