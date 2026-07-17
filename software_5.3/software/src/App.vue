<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const TAB_TITLES_ZH = ['首页', '景点', '导览', '地图', '我的']
const TAB_TITLES_EN = ['Home', 'Spots', 'Chat', 'Map', 'Mine']

const updateTabBarLanguage = () => {
  const doUpdate = () => {
    const labels = document.querySelectorAll('.uni-tabbar__label')
    if (labels.length === 0) {
      setTimeout(doUpdate, 300)
      return
    }
    const isEn = localStorage.getItem('lingshan_lang') === 'en'
    const titles = isEn ? TAB_TITLES_EN : TAB_TITLES_ZH
    labels.forEach((el, idx) => {
      ;(el as HTMLElement).textContent = titles[idx] || ''
    })
  }
  setTimeout(doUpdate, 100)
}

onLaunch(() => {
  userStore.checkLogin()

  const TAB_ROUTES = [
    'pages/visitor/index',
    'pages/visitor/spots',
    'pages/visitor/chat',
    'pages/visitor/location',
    'pages/visitor/profile'
  ]
  const SUB_PAGE_TO_TAB: Record<string, number> = {
    'pages/visitor/spot-detail': 1,
    'pages/visitor/foods': 0,
    'pages/visitor/food-detail': 0,
    'pages/visitor/hotels': 0,
    'pages/visitor/hotel-detail': 0
  }
  const getCurrentTabIndex = (): number => {
    const hash = window.location.hash || ''
    const route = hash.replace(/^#\/?/, '').split('?')[0]
    if (route === '' || route === 'pages/visitor/index') return 0
    for (let i = 1; i < TAB_ROUTES.length; i++) {
      if (route === TAB_ROUTES[i]) return i
    }
    if (SUB_PAGE_TO_TAB[route] !== undefined) return SUB_PAGE_TO_TAB[route]
    return -1
  }
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const markActiveTab = () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const activeIndex = getCurrentTabIndex()
      document.querySelectorAll('.uni-tabbar__item').forEach((item, idx) => {
        item.classList.toggle('tab-active', idx === activeIndex)
      })
      const enableLargeFont = localStorage.getItem('lingshan_large_font') === '1'
      applyTabBarLargeFont(enableLargeFont)
      updateTabBarLanguage()
    }, 50)
  }
  const pollForTabBar = setInterval(() => {
    if (!document.querySelector('.uni-tabbar')) return
    clearInterval(pollForTabBar)
    markActiveTab()
    window.addEventListener('hashchange', markActiveTab)
    new MutationObserver(markActiveTab).observe(document.body, {
      childList: true,
      subtree: true
    })
  }, 200)

  // ── 全局页面切换动画 ──
  // 注意：UniApp H5 的页面根容器是 <uni-page> 自定义元素（无 class），
  //       必须用元素选择器 'uni-page'，不能用 '.uni-page'
  // 下钻/返回页（navigateTo/redirectTo/reLaunch/navigateBack）保留离开动画，有方向感
  const NAV_METHODS_WITH_LEAVE = ['navigateTo', 'redirectTo', 'reLaunch', 'navigateBack'] as const
  NAV_METHODS_WITH_LEAVE.forEach(method => {
    const original = (uni as any)[method]
    if (!original || (original as any).__pageAnimWrapped) return
    const wrapped = function(options: any) {
      const currentPage = document.querySelector('uni-page') as HTMLElement | undefined
      if (currentPage && !currentPage.classList.contains('page-leave')) {
        currentPage.classList.add('page-leave')
        setTimeout(() => {
          currentPage.classList.remove('page-leave')
          original.call(uni, options)
        }, 380)
      } else {
        original.call(uni, options)
      }
    }
    ;(wrapped as any).__pageAnimWrapped = true
    ;(uni as any)[method] = wrapped
  })
})

onShow(() => {
  const enableLargeFont = localStorage.getItem('lingshan_large_font') === '1'
  const isEnMode = localStorage.getItem('lingshan_lang') === 'en'
  if (typeof document !== 'undefined' && document.body) {
    if (enableLargeFont) {
      document.body.classList.add('large-font-mode')
    } else {
      document.body.classList.remove('large-font-mode')
    }
    if (isEnMode) {
      document.body.classList.add('en-mode')
    } else {
      document.body.classList.remove('en-mode')
    }
  }
  applyTabBarLargeFont(enableLargeFont)
  updateTabBarLanguage()
})

const applyTabBarLargeFont = (enable: boolean) => {
  const doApply = () => {
    const icons = document.querySelectorAll('.uni-tabbar__icon')
    const labels = document.querySelectorAll('.uni-tabbar__label')
    if (icons.length === 0) {
      setTimeout(doApply, 300)
      return
    }
    icons.forEach((el) => {
      ;(el as HTMLElement).style.cssText = enable
        ? 'display:none !important;'
        : ''
    })
    labels.forEach((el) => {
      if (enable) {
        // 使用固定字号 18px，不再读取当前 computed fontSize + 8（会导致递增放大）
        // 与 global.scss 中 .large-font-mode .uni-tabbar__label 的 font-size: 18px 保持一致
        ;(el as HTMLElement).style.cssText =
          `font-size:18px !important;` +
          `font-weight:bold !important;` +
          `width:100% !important;` +
          `height:100% !important;` +
          `display:flex !important;` +
          `align-items:center !important;` +
          `justify-content:center !important;` +
          `text-align:center !important;` +
          `line-height:1 !important;`
      } else {
        ;(el as HTMLElement).style.cssText = ''
      }
    })
    const styleId = 'large-font-tabbar-divider'
    const existing = document.getElementById(styleId)
    if (enable) {
      if (!existing) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent =
          '.uni-tabbar__bd::before,.uni-tabbar__bd::after{' +
          'width:6px !important;' +
          '}' +
          '.uni-tabbar__item.tab-active .uni-tabbar__bd::before,' +
          '.uni-tabbar__item.tab-active .uni-tabbar__bd::after{' +
          'width:6px !important;' +
          '}'
        document.head.appendChild(style)
      }
    } else {
      if (existing) existing.remove()
    }
  }
  setTimeout(doApply, 100)
}

onHide(() => {
})
</script>

<style lang="scss">
@import './styles/global.scss';
</style>
