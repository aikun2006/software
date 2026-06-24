import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@/types'
import { authApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const user = ref<UserInfo | null>(null)
  const isLoggedIn = ref(false)

  const login = async (username: string, password: string) => {
    try {
      const response = await authApi.login({ username, password })
      user.value = response.user
      isLoggedIn.value = true
      uni.setStorageSync('token', response.token)
      return true
    } catch (error) {
      return false
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      user.value = null
      isLoggedIn.value = false
      uni.removeStorageSync('token')
    }
  }

  const checkLogin = () => {
    const token = uni.getStorageSync('token')
    if (token) {
      isLoggedIn.value = true
      user.value = {
        id: 'admin',
        name: '管理员',
        role: 'admin',
        preferences: []
      }
    }
  }

  return {
    user,
    isLoggedIn,
    login,
    logout,
    checkLogin
  }
})
