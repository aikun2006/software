<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onLaunch(() => {
  // 恢复游客登录态：本地 token 调后端 /api/user/info 验证有效性
  userStore.checkLogin()

  // ── 底部导航栏：精确路由匹配标记激活项 ──
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
    // 首页特殊处理：hash 为 #/ 或空时，route 为空字符串，应匹配首页
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

  // ── 全局页面切换动画：拦截导航方法，离开页加 page-leave 触发淡出 ──
  const NAV_METHODS = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab', 'navigateBack'] as const
  NAV_METHODS.forEach(method => {
    const original = (uni as any)[method]
    if (!original || (original as any).__pageAnimWrapped) return
    const wrapped = function(options: any) {
      const pages = document.querySelectorAll('.uni-page')
      const currentPage = pages[pages.length - 1] as HTMLElement | undefined
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
  if (typeof document !== 'undefined' && document.body) {
    if (enableLargeFont) {
      document.body.classList.add('large-font-mode')
    } else {
      document.body.classList.remove('large-font-mode')
    }
  }
  applyTabBarLargeFont(enableLargeFont)
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
        const cur = window.getComputedStyle(el).fontSize
        const num = parseFloat(cur) || 12
        ;(el as HTMLElement).style.cssText =
          `font-size:${num + 8}px !important;` +
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
