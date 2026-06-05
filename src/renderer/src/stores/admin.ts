import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import type { User } from '@/types'

interface Invite {
  code: string
  used: boolean
  usedBy?: string
  createdAt?: string
}

/** 管理后台：用户与邀请码管理。移植 app.js admin 逻辑。 */
export const useAdminStore = defineStore('admin', () => {
  const users = ref<User[]>([])
  const invites = ref<Invite[]>([])
  const msg = ref('')
  const lastReset = ref<{ username: string; password: string } | null>(null)

  async function loadAll(): Promise<void> {
    msg.value = ''
    try {
      users.value = (await api.adminUsers()).users
      await loadInvites()
    } catch (e) {
      msg.value = e instanceof Error ? e.message : '加载失败'
    }
  }

  async function loadInvites(): Promise<void> {
    try {
      invites.value = (await api.adminInvites()).invites || []
    } catch {
      /* 静默 */
    }
  }

  async function addUser(username: string, password: string, isAdmin: boolean): Promise<boolean> {
    msg.value = ''
    try {
      await api.adminCreateUser(username, password, isAdmin)
      users.value = (await api.adminUsers()).users
      msg.value = '已添加成员'
      return true
    } catch (e) {
      msg.value = e instanceof Error ? e.message : '添加失败'
      return false
    }
  }

  async function removeUser(u: User): Promise<void> {
    try {
      await api.adminDeleteUser(u.id)
      users.value = (await api.adminUsers()).users
    } catch (e) {
      msg.value = e instanceof Error ? e.message : '删除失败'
    }
  }

  async function resetPwd(u: User): Promise<void> {
    msg.value = ''
    lastReset.value = null
    try {
      const r = await api.adminResetPassword(u.id)
      lastReset.value = { username: u.username, password: r.password || '' }
      users.value = (await api.adminUsers()).users
    } catch (e) {
      msg.value = e instanceof Error ? e.message : '重置失败'
    }
  }

  async function toggleAdmin(u: User, val: boolean): Promise<void> {
    try {
      await api.adminSetAdmin(u.id, val)
      users.value = (await api.adminUsers()).users
    } catch (e) {
      msg.value = e instanceof Error ? e.message : '操作失败'
    }
  }

  async function genInvite(): Promise<void> {
    msg.value = ''
    try {
      await api.adminCreateInvite()
      await loadInvites()
    } catch (e) {
      msg.value = e instanceof Error ? e.message : '生成失败'
    }
  }

  async function delInvite(code: string): Promise<void> {
    try {
      await api.adminDeleteInvite(code)
      await loadInvites()
    } catch (e) {
      msg.value = e instanceof Error ? e.message : '删除失败'
    }
  }

  return {
    users,
    invites,
    msg,
    lastReset,
    loadAll,
    loadInvites,
    addUser,
    removeUser,
    resetPwd,
    toggleAdmin,
    genInvite,
    delInvite
  }
})
