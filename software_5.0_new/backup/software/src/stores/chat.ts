import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@/types'
import { chatApi } from '@/api'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)

  const addMessage = (message: Omit<ChatMessage, 'id'>) => {
    messages.value.push({
      ...message,
      id: Date.now().toString()
    })
  }

  const sendMessage = async (content: string, type: 'text' | 'voice') => {
    isLoading.value = true
    
    addMessage({
      content,
      type,
      isUser: true,
      userId: 'visitor',
      timestamp: new Date().toISOString()
    })

    try {
      const response = await chatApi.send({ content, type })
      
      addMessage({
        content: response.response,
        type: 'text',
        isUser: false,
        userId: 'ai',
        timestamp: new Date().toISOString(),
        emotion: response.emotion as 'positive' | 'neutral' | 'negative'
      })
    } catch (error) {
      addMessage({
        content: '抱歉，我暂时无法回答您的问题，请稍后再试。',
        type: 'text',
        isUser: false,
        userId: 'ai',
        timestamp: new Date().toISOString()
      })
    } finally {
      isLoading.value = false
    }
  }

  const clearMessages = () => {
    messages.value = []
  }

  return {
    messages,
    isLoading,
    addMessage,
    sendMessage,
    clearMessages
  }
})
