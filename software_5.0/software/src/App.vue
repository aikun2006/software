<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onLaunch(() => {
  // 恢复游客登录态：本地 token 调后端 /api/user/info 验证有效性
  userStore.checkLogin()
})

onShow(() => {
})

onHide(() => {
})
</script>

<style lang="scss">
@import './styles/global.scss';
</style>
