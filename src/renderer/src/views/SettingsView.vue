<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { usePlayerStore } from '@/stores/player'
import { useRecentsStore } from '@/stores/recents'
import { useUiStore } from '@/stores/ui'
import { useUpdatesStore } from '@/stores/updates'
import type { Quality, ThemeName } from '@/types'

const auth = useAuthStore()
const settings = useSettingsStore()
const player = usePlayerStore()
const recents = useRecentsStore()
const ui = useUiStore()
const updates = useUpdatesStore()
const router = useRouter()

function setSleep(min: number): void {
  player.setSleepTimer(min)
  ui.toast(`将在 ${min} 分钟后暂停`)
}
function sleepAfterTrack(): void {
  player.setSleepAfterCurrentTrack()
  ui.toast('当前歌曲播完后暂停')
}
function cancelSleep(): void {
  player.cancelSleepTimer()
  ui.toast('已取消睡眠定时')
}
function clearRecents(): void {
  recents.clear()
  ui.toast('已清空最近播放')
}

const serverInput = ref(settings.server)
const serverMsg = ref('')
const qualities: Quality[] = ['128k', '320k', 'flac']

// ---- 修改用户名（任何账号都能改自己的）----
const nameInput = ref(auth.user?.username || '')
const nameMsg = ref('')
const savingName = ref(false)
async function saveUsername(): Promise<void> {
  const v = nameInput.value.trim()
  if (!v) {
    nameMsg.value = '用户名不能为空'
    return
  }
  if (v === auth.user?.username) return
  savingName.value = true
  nameMsg.value = ''
  try {
    await auth.updateUsername(v)
    nameMsg.value = '已更新用户名'
    setTimeout(() => (nameMsg.value = ''), 2000)
  } catch (e) {
    nameMsg.value = e instanceof Error ? e.message : '更新失败'
  } finally {
    savingName.value = false
  }
}

async function applyServer(): Promise<void> {
  const v = serverInput.value.trim()
  if (!v) return
  await settings.updateServer(v)
  serverInput.value = settings.server
  serverMsg.value = '已保存，下次请求生效'
  setTimeout(() => (serverMsg.value = ''), 2000)
}

async function setQuality(q: Quality): Promise<void> {
  await settings.updateQuality(q)
}

const themes: { id: ThemeName; label: string }[] = [
  { id: 'dark', label: '深色' },
  { id: 'light', label: '浅色' }
]
async function setTheme(t: ThemeName): Promise<void> {
  await settings.updateTheme(t)
}

async function toggleDesktopLyrics(): Promise<void> {
  await settings.toggleDesktopLyrics()
}

async function logout(): Promise<void> {
  await auth.logout()
  router.replace({ name: 'login' })
}

// ---- 关于 / 检查更新 ----
const appVersion = ref('')
const checking = ref(false)
const updateMsg = ref('')
onMounted(async () => {
  try {
    appVersion.value = await window.pf.app.getVersion()
  } catch {
    appVersion.value = ''
  }
})
async function checkUpdate(): Promise<void> {
  checking.value = true
  updateMsg.value = ''
  const info = await window.pf.updates.check()
  checking.value = false
  if (!info) {
    updateMsg.value = '检查失败，请检查网络后重试'
    return
  }
  if (info.hasUpdate) {
    updates.prompt(info) // 打开更新弹窗（立即更新 / 跳过 / 稍后）
  } else {
    updateMsg.value = `已是最新版本（${info.current}）`
  }
}
</script>

<template>
  <div class="settings-view">
    <h1 class="list-title">设置</h1>

    <section class="setting-block">
      <h4>账户</h4>
      <div class="row">
        <span class="muted">角色</span>
        <span>{{ auth.user?.isSuper ? '超级管理员' : auth.user?.isAdmin ? '管理员' : '成员' }}</span>
      </div>
      <div class="row"><span class="muted">用户名</span></div>
      <div class="server-row">
        <input v-model="nameInput" placeholder="用户名" @keyup.enter="saveUsername" />
        <button class="primary" :disabled="savingName" @click="saveUsername">
          {{ savingName ? '保存中…' : '保存' }}
        </button>
      </div>
      <div v-if="nameMsg" class="invite-ok">{{ nameMsg }}</div>
    </section>

    <section class="setting-block">
      <h4>服务器地址</h4>
      <div class="server-row">
        <input v-model="serverInput" placeholder="http://localhost:9277" @keyup.enter="applyServer" />
        <button class="primary" @click="applyServer">保存</button>
      </div>
      <div v-if="serverMsg" class="invite-ok">{{ serverMsg }}</div>
    </section>

    <section class="setting-block">
      <h4>皮肤（开发中）</h4>
      <div class="quality-row">
        <button
          v-for="t in themes"
          :key="t.id"
          class="q-btn"
          :class="{ active: settings.theme === t.id }"
          @click="setTheme(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
    </section>

    <section class="setting-block">
      <h4>音质</h4>
      <div class="quality-row">
        <button
          v-for="q in qualities"
          :key="q"
          class="q-btn"
          :class="{ active: settings.audioQuality === q }"
          @click="setQuality(q)"
        >
          {{ q.toUpperCase() }}
        </button>
      </div>
    </section>

    <section class="setting-block">
      <h4>桌面歌词</h4>
      <div class="row">
        <span class="muted">在桌面显示浮动歌词（可拖动、可缩放、悬停控制）</span>
        <button
          class="q-btn"
          :class="{ active: settings.desktopLyrics.enabled }"
          @click="toggleDesktopLyrics"
        >
          {{ settings.desktopLyrics.enabled ? '已开启' : '开启' }}
        </button>
      </div>
    </section>

    <section class="setting-block">
      <h4>睡眠定时</h4>
      <div class="quality-row">
        <button class="q-btn" @click="setSleep(15)">15 分钟</button>
        <button class="q-btn" @click="setSleep(30)">30 分钟</button>
        <button class="q-btn" @click="setSleep(60)">60 分钟</button>
        <button class="q-btn" @click="sleepAfterTrack">本曲播完</button>
        <button class="q-btn" @click="cancelSleep">取消</button>
      </div>
      <div v-if="player.sleepUntil || player.sleepAfterCurrent" class="invite-ok" style="margin-top: 10px">
        {{ player.sleepAfterCurrent ? '将在当前歌曲播完后暂停' : '睡眠定时已设置' }}
      </div>
    </section>

    <section class="setting-block">
      <h4>数据</h4>
      <div class="row">
        <span class="muted">清空本机「最近播放」记录</span>
        <button class="q-btn" @click="clearRecents">清空</button>
      </div>
    </section>

    <section class="setting-block">
      <h4>关于</h4>
      <div class="row">
        <span class="muted">当前版本</span>
        <span>{{ appVersion || '—' }}</span>
      </div>
      <div class="row">
        <span class="muted">检查软件更新</span>
        <button class="q-btn" :disabled="checking" @click="checkUpdate">
          {{ checking ? '检查中…' : '检查更新' }}
        </button>
      </div>
      <div v-if="updateMsg" class="invite-ok" style="margin-top: 10px">{{ updateMsg }}</div>
    </section>

    <section class="setting-block">
      <button class="logout-btn" @click="logout">退出登录</button>
    </section>
  </div>
</template>

<style scoped>
.setting-block {
  max-width: 560px;
  margin-bottom: 28px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--border);
}
.setting-block h4 {
  font-size: 15px;
  margin-bottom: 14px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}
.server-row {
  display: flex;
  gap: 10px;
}
.server-row input {
  flex: 1;
  height: 42px;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 0 14px;
  background: #1f1f1f;
  color: #fff;
  outline: none;
}
.server-row input:focus {
  border-color: #fff;
}
.quality-row {
  display: flex;
  gap: 10px;
}
.q-btn {
  border: 1px solid #4a4a4a;
  background: transparent;
  color: #fff;
  border-radius: 500px;
  padding: 8px 20px;
  cursor: pointer;
  font-weight: 600;
}
.q-btn.active {
  background: var(--green);
  color: #000;
  border-color: var(--green);
}
.logout-btn {
  border: 1px solid #5a3030;
  color: #f15e6c;
  background: transparent;
  border-radius: 500px;
  padding: 10px 28px;
  cursor: pointer;
  font-weight: 700;
}
.logout-btn:hover {
  border-color: #f15e6c;
}
</style>
