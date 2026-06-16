<template>
  <image 
    :src="currentSrc" 
    :mode="mode"
    :lazy-load="lazyLoad"
    :class="imageClass"
    @error="handleError"
    @load="handleLoad"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { imageLoader } from '@/utils/imageLoader'

interface Props {
  src: string
  mode?: string
  lazyLoad?: boolean
  fallback?: string
  timeout?: number
  imageClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'aspectFill',
  lazyLoad: false,
  fallback: '/static/icons/default-spot.png',
  timeout: 5000,
  imageClass: ''
})

const emit = defineEmits<{
  (e: 'load', src: string): void
  (e: 'error', error: any): void
  (e: 'fallback', src: string): void
}>()

const currentSrc = ref(props.src)
const isLoading = ref(true)
const hasError = ref(false)

onMounted(() => {
  loadImage()
})

watch(() => props.src, (newSrc) => {
  if (newSrc !== currentSrc.value) {
    currentSrc.value = newSrc
    loadImage()
  }
})

const loadImage = async () => {
  if (!props.src || !props.src.includes('text_to_image')) {
    currentSrc.value = props.src
    isLoading.value = false
    return
  }

  isLoading.value = true
  hasError.value = false

  try {
    const result = await imageLoader.loadImage(props.src, {
      timeout: props.timeout,
      fallbackUrl: props.fallback,
      retryCount: 1,
      retryDelay: 1000
    })

    if (result.success) {
      currentSrc.value = result.url
      hasError.value = false
    } else {
      currentSrc.value = result.url
      hasError.value = true
      emit('fallback', result.url)
    }

    isLoading.value = false
    emit('load', result.url)
  } catch (error) {
    currentSrc.value = props.fallback
    hasError.value = true
    isLoading.value = false
    emit('error', error)
    emit('fallback', props.fallback)
  }
}

const handleError = (e: any) => {
  console.warn('图片加载失败，使用后备图片:', currentSrc.value)
  currentSrc.value = props.fallback
  hasError.value = true
  emit('error', e)
  emit('fallback', props.fallback)
}

const handleLoad = (e: any) => {
  hasError.value = false
  emit('load', currentSrc.value)
}

const retry = () => {
  loadImage()
}

defineExpose({
  retry,
  currentSrc,
  isLoading,
  hasError
})
</script>

<style lang="scss" scoped>
image {
  width: 100%;
  height: 100%;
}
</style>
