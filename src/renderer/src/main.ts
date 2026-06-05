import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { bootstrap } from './services/session'
import { useAuthStore } from './stores/auth'
import { useSettingsStore } from './stores/settings'
import './assets/style/base.css'

async function start(): Promise<void> {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)

  // 先读盘：serverURL / quality / token，再恢复登录态，最后挂载，
  // 这样路由守卫能立刻看到正确的登录状态。
  const cfg = await bootstrap()
  useSettingsStore().hydrate(cfg)

  const auth = useAuthStore()
  await auth.loadConfig()
  await auth.tryRestore()

  app.use(router)
  app.mount('#app')
}

void start()
