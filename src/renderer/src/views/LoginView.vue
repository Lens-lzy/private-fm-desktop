<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { ApiError } from '@/services/http'

const auth = useAuthStore()
const settings = useSettingsStore()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const busy = ref(false)

const login = ref({ username: '', password: '', error: '' })
const reg = ref({ username: '', password: '', password2: '', inviteCode: '', error: '' })

const showServer = ref(false)
const serverInput = ref(settings.server)

function msgOf(e: unknown): string {
  if (e instanceof ApiError) return e.message
  return '网络错误：' + (e instanceof Error ? e.message : String(e))
}

async function applyServer(): Promise<void> {
  const v = serverInput.value.trim()
  if (v) await settings.updateServer(v)
  showServer.value = false
}

async function doLogin(): Promise<void> {
  login.value.error = ''
  if (!login.value.username || !login.value.password) {
    login.value.error = '请输入用户名和密码'
    return
  }
  busy.value = true
  try {
    await auth.login(login.value.username, login.value.password)
    login.value.password = ''
    router.replace({ name: 'home' })
  } catch (e) {
    login.value.error = msgOf(e)
  } finally {
    busy.value = false
  }
}

async function doRegister(): Promise<void> {
  reg.value.error = ''
  const { username, password, password2, inviteCode } = reg.value
  if (!username || !password) {
    reg.value.error = '请输入用户名和密码'
    return
  }
  if (!inviteCode.trim()) {
    reg.value.error = '请输入邀请码'
    return
  }
  if (password.length < 4) {
    reg.value.error = '密码至少 4 位'
    return
  }
  if (password !== password2) {
    reg.value.error = '两次输入的密码不一致'
    return
  }
  busy.value = true
  try {
    await auth.register(username, password, inviteCode.trim())
    router.replace({ name: 'home' })
  } catch (e) {
    reg.value.error = msgOf(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login-screen">
    <div class="login-box">
      <div class="login-logo">Private FM</div>
      <div class="login-sub">你的私域音乐空间</div>

      <template v-if="mode === 'login'">
        <input v-model="login.username" placeholder="用户名" autofocus @keyup.enter="doLogin" />
        <input
          v-model="login.password"
          type="password"
          placeholder="密码"
          @keyup.enter="doLogin"
        />
        <div v-if="login.error" class="login-err">{{ login.error }}</div>
        <button class="login-btn" :disabled="busy" @click="doLogin">
          {{ busy ? '登录中…' : '登 录' }}
        </button>
        <div class="login-switch">
          <a v-if="auth.allowRegister" @click="mode = 'register'">没有账号？用邀请码注册</a>
        </div>
      </template>

      <template v-else>
        <input v-model="reg.username" placeholder="用户名" @keyup.enter="doRegister" />
        <input v-model="reg.password" type="password" placeholder="密码（至少 4 位）" />
        <input v-model="reg.password2" type="password" placeholder="确认密码" />
        <input v-model="reg.inviteCode" placeholder="邀请码" @keyup.enter="doRegister" />
        <div v-if="reg.error" class="login-err">{{ reg.error }}</div>
        <button class="login-btn" :disabled="busy" @click="doRegister">
          {{ busy ? '注册中…' : '注 册' }}
        </button>
        <div class="login-switch">
          <a @click="mode = 'login'">已有账号？去登录</a>
        </div>
      </template>

      <div class="login-switch">
        <a @click="showServer = !showServer">{{ showServer ? '收起' : '服务器设置' }}</a>
      </div>
      <div v-if="showServer" class="server-edit">
        <input v-model="serverInput" placeholder="http://localhost:9277" @keyup.enter="applyServer" />
        <button @click="applyServer">应用</button>
      </div>
      <div class="login-hint">当前服务器：{{ settings.server }}</div>
    </div>
  </div>
</template>

<style scoped>
.server-edit {
  display: flex;
  gap: 8px;
}
.server-edit input {
  flex: 1;
  height: 40px;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 0 14px;
  background: #2a2a2a;
  color: #fff;
  outline: none;
}
.server-edit input:focus {
  border-color: #fff;
}
.server-edit button {
  border: none;
  background: var(--green);
  color: #000;
  border-radius: 6px;
  padding: 0 16px;
  font-weight: 700;
  cursor: pointer;
}
</style>
