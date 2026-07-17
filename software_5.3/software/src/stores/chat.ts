import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage } from '@/types'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)

  const addMessage = (message: Omit<ChatMessage, 'id'>) => {
    messages.value.push({
      ...message,
      id: Date.now().toString()
    })
  }

  const clearMessages = () => {
    messages.value = []
  }

  return {
    messages,
    isLoading,
    addMessage,
    clearMessages
  }
})
