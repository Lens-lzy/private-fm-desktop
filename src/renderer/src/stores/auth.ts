import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { clearToken, setToken, setUnauthorizedHandler } from '@/services/session'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const allowRegister = ref(true)
  /** 管理员重置密码后强制改密：登录后置 true，触发改密弹窗。 */
  const forceChangePassword = ref(false)

  async function loadConfig(): Promise<void> {
    try {
      const c = await api.config()
      allowRegister.value = c.allowRegister !== false
    } catch {
      /* 配置失败不阻塞 */
    }
  }

  /** 启动时若已有 token，尝试用 /api/me 恢复登录态。 */
  async function tryRestore(): Promise<boolean> {
    try {
      const r = await api.me()
      user.value = r.user
      maybeForceChange()
      return true
    } catch {
      user.value = null
      return false
    }
  }

  function maybeForceChange(): void {
    forceChangePassword.value = !!user.value?.mustChangePassword
  }

  async function login(username: string, password: string): Promise<void> {
    const r = await api.login(username, password)
    await setToken(r.token)
    user.value = r.user
    maybeForceChange()
  }

  async function register(username: string, password: string, inviteCode: string): Promise<void> {
    const r = await api.register(username, password, inviteCode)
    await setToken(r.token)
    user.value = r.user
    forceChangePassword.value = false
  }

  async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.changePassword(oldPassword, newPassword)
    if (user.value) user.value.mustChangePassword = false
    forceChangePassword.value = false
  }

  /** 改自己的用户名（任何账号都能改）。 */
  async function updateUsername(username: string): Promise<void> {
    const r = await api.updateUsername(username)
    user.value = r.user
  }

  async function logout(): Promise<void> {
    await clearToken()
    user.value = null
    forceChangePassword.value = false
  }

  // 任何请求 401 → 全局登出
  setUnauthorizedHandler(() => {
    void logout()
  })

  return {
    user,
    allowRegister,
    forceChangePassword,
    loadConfig,
    tryRestore,
    login,
    register,
    changePassword,
    updateUsername,
    logout
  }
})
