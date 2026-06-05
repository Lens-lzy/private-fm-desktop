<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { User } from '@/types'

const admin = useAdminStore()
const auth = useAuthStore()
const ui = useUiStore()

const nu = ref({ username: '', password: '', isAdmin: false })
const inviteMax = ref(1)

onMounted(() => void admin.loadAll())

async function addUser(): Promise<void> {
  if (!nu.value.username || !nu.value.password) {
    admin.msg = '请填写用户名和密码'
    return
  }
  const ok = await admin.addUser(nu.value.username, nu.value.password, nu.value.isAdmin)
  if (ok) nu.value = { username: '', password: '', isAdmin: false }
}
function removeUser(u: User): void {
  if (confirm(`确定删除成员 ${u.username}？`)) void admin.removeUser(u)
}
function resetPwd(u: User): void {
  if (confirm(`为「${u.username}」生成随机临时密码？该用户下次登录需改密。`)) void admin.resetPwd(u)
}
function copy(text: string): void {
  void navigator.clipboard.writeText(text)
  ui.toast('已复制：' + text)
}
</script>

<template>
  <div class="admin-view">
    <h1 class="list-title">成员管理</h1>

    <div v-if="admin.lastReset" class="reset-result">
      已为 <b>{{ admin.lastReset.username }}</b> 生成临时密码：
      <span class="temp-pwd" @click="copy(admin.lastReset.password)">{{ admin.lastReset.password }}</span>
      （点击复制，转告该用户，其首次登录需改密）
      <span class="modal-close" @click="admin.lastReset = null">×</span>
    </div>

    <table class="user-table">
      <thead>
        <tr><th>用户名</th><th>角色</th><th>状态</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="u in admin.users" :key="u.id">
          <td>{{ u.username }}</td>
          <td>
            <span v-if="u.isSuper" class="badge-admin">超级管理员</span>
            <template v-else>{{ u.isAdmin ? '管理员' : '成员' }}</template>
          </td>
          <td class="muted">{{ u.mustChangePassword ? '待改密' : '正常' }}</td>
          <td>
            <div class="user-ops">
              <span v-if="u.isSuper" class="muted">站主 · 不可变更</span>
              <template v-else>
                <button @click="resetPwd(u)">重置密码</button>
                <button v-if="!u.isAdmin" @click="admin.toggleAdmin(u, true)">设为管理员</button>
                <button v-else :disabled="u.id === auth.user?.id" @click="admin.toggleAdmin(u, false)">
                  取消管理员
                </button>
                <button class="danger" :disabled="u.id === auth.user?.id" @click="removeUser(u)">删除</button>
              </template>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="add-user">
      <h4>新增成员</h4>
      <input v-model="nu.username" placeholder="用户名" />
      <input v-model="nu.password" type="password" placeholder="初始密码" />
      <label class="chk"><input v-model="nu.isAdmin" type="checkbox" /> 管理员</label>
      <button class="primary" @click="addUser">添加</button>
    </div>

    <div class="invite-box">
      <h4>邀请码</h4>
      <div class="invite-gen">
        <label class="inv-uses">
          可用次数
          <input v-model.number="inviteMax" type="number" min="1" max="999" />
        </label>
        <button class="primary" @click="admin.genInvite(inviteMax || 1)">生成邀请码</button>
      </div>
      <table class="user-table invite-table">
        <thead>
          <tr><th>邀请码</th><th>生成人</th><th>使用情况</th><th>使用者</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="iv in admin.invites" :key="iv.code">
            <td><span class="invite-code" @click="copy(iv.code)">{{ iv.code }}</span></td>
            <td class="muted">{{ iv.createdBy || '-' }}</td>
            <td :class="{ 'invite-ok': !iv.used }">
              {{ iv.useCount ?? 0 }}/{{ iv.maxUses ?? 1 }}<span v-if="iv.used"> · 已用完</span>
            </td>
            <td class="muted">
              {{ iv.uses && iv.uses.length ? iv.uses.map((x) => x.username).join('、') : '-' }}
            </td>
            <td><button class="danger" @click="admin.delInvite(iv.code)">删除</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="admin.msg" class="admin-msg">{{ admin.msg }}</div>
  </div>
</template>

<style scoped>
.invite-gen {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.inv-uses {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}
.inv-uses input {
  width: 72px;
  height: 34px;
  border: 1px solid var(--border-2, #4a4a4a);
  border-radius: 6px;
  padding: 0 10px;
  background: var(--input-bg, #1f1f1f);
  color: var(--text, #fff);
  outline: none;
}
.inv-uses input:focus {
  border-color: var(--green);
}
</style>
