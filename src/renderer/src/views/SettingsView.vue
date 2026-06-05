<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { usePlayerStore } from '@/stores/player'
import { useRecentsStore } from '@/stores/recents'
import { useUiStore } from '@/stores/ui'
import { useUpdatesStore } from '@/stores/updates'
import { SHORTCUT_ROWS, formatAccel, eventToAccel } from '@/services/shortcuts'
import type { Quality, ThemeName, PlaybackPrefs } from '@/types'

const auth = useAuthStore()
const settings = useSettingsStore()
const player = usePlayerStore()
const recents = useRecentsStore()
const ui = useUiStore()
const updates = useUpdatesStore()
const router = useRouter()

// ---- 分类 tab + 滚动联动 ----
const tabs = [
  { id: 'account', label: '账号' },
  { id: 'general', label: '常规' },
  { id: 'playback', label: '播放' },
  { id: 'skin', label: '皮肤' },
  { id: 'lyrics', label: '桌面歌词' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'about', label: '关于' }
]
const bodyRef = ref<HTMLElement | null>(null)
const activeTab = ref('account')
let lockUntil = 0 // 程序化滚动期间不让 scrollspy 抢改 activeTab

function jump(id: string): void {
  const body = bodyRef.value
  if (!body) return
  const el = body.querySelector<HTMLElement>(`[data-sec="${id}"]`)
  if (!el) return
  activeTab.value = id
  lockUntil = performance.now() + 700
  body.scrollTo({ top: Math.max(0, el.offsetTop - 6), behavior: 'smooth' })
}

let rafId = 0
function onScroll(): void {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    const body = bodyRef.value
    if (!body || performance.now() < lockUntil) return
    const secs = Array.from(body.querySelectorAll<HTMLElement>('[data-sec]'))
    if (!secs.length) return
    const y = body.scrollTop + 20
    let cur = secs[0].dataset.sec as string
    for (const el of secs) {
      if (el.offsetTop <= y) cur = el.dataset.sec as string
      else break
    }
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) {
      cur = secs[secs.length - 1].dataset.sec as string
    }
    if (cur && cur !== activeTab.value) activeTab.value = cur
  })
}

// ---- 播放设置 ----
function chk(e: Event): boolean {
  return (e.target as HTMLInputElement).checked
}
function setPlay(p: Partial<PlaybackPrefs>): void {
  void settings.updatePlayback(p)
}

// ---- 睡眠 / 数据 ----
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
const roleLabel = computed(() =>
  auth.user?.isSuper ? '超级管理员' : auth.user?.isAdmin ? '管理员' : '成员'
)

// ---- 修改用户名 ----
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

// ---- 快捷键：改键录制 ----
const rec = ref('') // 正在录制的 `${action}:${kind}`
function recKey(action: string, kind: string): string {
  return action + ':' + kind
}
function onRecKeydown(e: KeyboardEvent): void {
  if (!rec.value) return
  e.preventDefault()
  e.stopImmediatePropagation()
  const [action, kind] = rec.value.split(':') as [string, 'local' | 'global']
  if (e.key === 'Escape') {
    stopRec()
    return
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    void settings.setBinding(action, kind, '')
    stopRec()
    return
  }
  const accel = eventToAccel(e)
  if (!accel) return
  void settings.setBinding(action, kind, accel)
  stopRec()
}
function startRec(action: string, kind: 'local' | 'global'): void {
  const key = recKey(action, kind)
  if (rec.value === key) {
    stopRec()
    return
  }
  window.removeEventListener('keydown', onRecKeydown, true)
  rec.value = key
  settings.recordingShortcut = true
  window.addEventListener('keydown', onRecKeydown, true)
}
function stopRec(): void {
  rec.value = ''
  settings.recordingShortcut = false
  window.removeEventListener('keydown', onRecKeydown, true)
}

function display(action: string, kind: 'local' | 'global'): string {
  const b = settings.shortcuts.keys[action]
  return formatAccel(b ? b[kind] : '')
}
function dupSet(kind: 'local' | 'global'): Set<string> {
  const counts: Record<string, number> = {}
  for (const r of SHORTCUT_ROWS) {
    const a = settings.shortcuts.keys[r.action]?.[kind]
    if (a) counts[a] = (counts[a] || 0) + 1
  }
  return new Set(Object.keys(counts).filter((k) => counts[k] > 1))
}
const localDups = computed(() => dupSet('local'))
const globalDups = computed(() => dupSet('global'))
function isInvalid(action: string, kind: 'local' | 'global'): boolean {
  const a = settings.shortcuts.keys[action]?.[kind]
  if (!a) return false
  if (kind === 'global') return settings.invalidGlobals.includes(action) || globalDups.value.has(a)
  return localDups.value.has(a)
}
function onToggleGlobal(e: Event): void {
  void settings.setEnableGlobal((e.target as HTMLInputElement).checked)
}
function onToggleMedia(e: Event): void {
  void settings.setUseMediaKeys((e.target as HTMLInputElement).checked)
}
function resetShortcuts(): void {
  void settings.resetShortcuts()
  ui.toast('已恢复默认快捷键')
}

// ---- 关于 / 检查更新 ----
const appVersion = ref('')
const checking = ref(false)
const updateMsg = ref('')
onMounted(async () => {
  void settings.applyGlobalShortcuts()
  try {
    appVersion.value = await window.pf.app.getVersion()
  } catch {
    appVersion.value = ''
  }
})
onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  stopRec()
})

function openUpdate(): void {
  if (updates.info) updates.prompt(updates.info)
}

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
    updates.prompt(info)
  } else {
    updateMsg.value = `已是最新版本（${info.current}）`
  }
}
</script>

<template>
  <div class="settings-view">
    <!-- 固定头：标题 + tab 页签（满行分割线） -->
    <div class="settings-head">
      <h1 class="settings-title">设置</h1>
      <nav class="settings-tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="st-tab"
          :class="{ active: activeTab === t.id }"
          @click="jump(t.id)"
        >
          {{ t.label }}
          <span v-if="t.id === 'about' && updates.available" class="tab-dot"></span>
        </button>
      </nav>
    </div>

    <!-- 滚动区：每类「左标题 + 右内容」，类间满行分割线 -->
    <div ref="bodyRef" class="settings-body" @scroll="onScroll">
      <!-- 账号 -->
      <section class="settings-cat" data-sec="account">
        <div class="cat-side">账号</div>
        <div class="cat-main">
          <div class="block">
            <div class="row"><span class="muted">角色</span><span>{{ roleLabel }}</span></div>
            <div class="row"><span class="muted">用户名</span></div>
            <div class="server-row">
              <input v-model="nameInput" placeholder="用户名" @keyup.enter="saveUsername" />
              <button class="primary" :disabled="savingName" @click="saveUsername">
                {{ savingName ? '保存中…' : '保存' }}
              </button>
            </div>
            <div v-if="nameMsg" class="invite-ok">{{ nameMsg }}</div>
          </div>
          <div v-if="auth.user?.isAdmin" class="block">
            <h4>服务器地址<span class="muted tag">仅管理员可见</span></h4>
            <div class="server-row">
              <input v-model="serverInput" placeholder="http://localhost:9277" @keyup.enter="applyServer" />
              <button class="primary" @click="applyServer">保存</button>
            </div>
            <div v-if="serverMsg" class="invite-ok">{{ serverMsg }}</div>
          </div>
          <div class="block">
            <button class="logout-btn" @click="logout">退出登录</button>
          </div>
        </div>
      </section>

      <!-- 常规 -->
      <section class="settings-cat" data-sec="general">
        <div class="cat-side">常规</div>
        <div class="cat-main">
          <div class="block">
            <h4>数据</h4>
            <div class="row">
              <span class="muted">清空本机「最近播放」记录</span>
              <button class="q-btn" @click="clearRecents">清空</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 播放 -->
      <section class="settings-cat" data-sec="playback">
        <div class="cat-side">播放</div>
        <div class="cat-main">
          <div class="block">
            <label class="chk">
              <input type="checkbox" :checked="settings.playback.autoplay" @change="setPlay({ autoplay: chk($event) })" />
              <span>程序启动时自动播放</span>
            </label>
            <label class="chk">
              <input type="checkbox" :checked="settings.playback.resume" @change="setPlay({ resume: chk($event) })" />
              <span>程序启动时记住上一次播放进度</span>
            </label>
            <label class="chk">
              <input type="checkbox" :checked="settings.playback.notify" @change="setPlay({ notify: chk($event) })" />
              <span>桌面通知</span><span class="muted">（在后台时歌曲切换发送通知）</span>
            </label>
          </div>

          <div class="block">
            <h4>播放列表</h4>
            <label class="rdo">
              <input
                type="radio"
                name="dc"
                :checked="settings.playback.doubleClick === 'replace'"
                @change="setPlay({ doubleClick: 'replace' })"
              />
              <span>双击播放单曲时，用当前单曲所在的歌曲列表替换播放列表</span>
            </label>
            <label class="rdo">
              <input
                type="radio"
                name="dc"
                :checked="settings.playback.doubleClick === 'add'"
                @change="setPlay({ doubleClick: 'add' })"
              />
              <span>双击播放单曲时，仅把当前单曲添加到播放列表</span>
            </label>
            <p class="sc-hint">将鼠标移到歌曲封面上、点出现的播放按钮，则插入当前列表第一首并立即播放。</p>
          </div>

          <div class="block">
            <h4>最近播放记录</h4>
            <label class="chk">
              <input type="checkbox" :checked="settings.playback.syncRecents" @change="setPlay({ syncRecents: chk($event) })" />
              <span>开启后，同步当前账号在各设备的最近播放记录</span>
            </label>
          </div>

          <div class="block">
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
          </div>

          <div class="block">
            <h4>睡眠定时</h4>
            <div class="quality-row">
              <button class="q-btn" @click="setSleep(15)">15 分钟</button>
              <button class="q-btn" @click="setSleep(30)">30 分钟</button>
              <button class="q-btn" @click="setSleep(60)">60 分钟</button>
              <button class="q-btn" @click="sleepAfterTrack">本曲播完</button>
              <button class="q-btn" @click="cancelSleep">取消</button>
            </div>
            <div
              v-if="player.sleepUntil || player.sleepAfterCurrent"
              class="invite-ok"
              style="margin-top: 10px"
            >
              {{ player.sleepAfterCurrent ? '将在当前歌曲播完后暂停' : '睡眠定时已设置' }}
            </div>
          </div>
        </div>
      </section>

      <!-- 皮肤 -->
      <section class="settings-cat" data-sec="skin">
        <div class="cat-side">皮肤</div>
        <div class="cat-main">
          <div class="block">
            <h4>主题（开发中）</h4>
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
          </div>
        </div>
      </section>

      <!-- 桌面歌词 -->
      <section class="settings-cat" data-sec="lyrics">
        <div class="cat-side">桌面歌词</div>
        <div class="cat-main">
          <div class="block">
            <div class="row">
              <span class="muted">在桌面显示浮动歌词（逐字扫光、双行对句、可拖动缩放、悬停控制）</span>
              <button
                class="q-btn"
                :class="{ active: settings.desktopLyrics.enabled }"
                @click="toggleDesktopLyrics"
              >
                {{ settings.desktopLyrics.enabled ? '已开启' : '开启' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 快捷键 -->
      <section class="settings-cat" data-sec="shortcuts">
        <div class="cat-side">快捷键</div>
        <div class="cat-main">
          <div class="block">
            <div class="sc-table">
              <div class="sc-row sc-head">
                <span class="sc-label">功能说明</span>
                <span class="sc-key-h">快捷键</span>
                <span class="sc-key-h">全局快捷键</span>
              </div>
              <div v-for="row in SHORTCUT_ROWS" :key="row.action" class="sc-row">
                <span class="sc-label">{{ row.label }}</span>
                <button
                  class="sc-key"
                  :class="{ rec: rec === row.action + ':local', invalid: isInvalid(row.action, 'local') }"
                  @click.stop="startRec(row.action, 'local')"
                >
                  {{ rec === row.action + ':local' ? '请按键…' : display(row.action, 'local') }}
                </button>
                <button
                  class="sc-key"
                  :class="{ rec: rec === row.action + ':global', invalid: isInvalid(row.action, 'global') }"
                  @click.stop="startRec(row.action, 'global')"
                >
                  {{ rec === row.action + ':global' ? '请按键…' : display(row.action, 'global') }}
                </button>
              </div>
            </div>
            <p class="sc-hint">
              点击键位后按下新组合即可修改；Esc 取消，Delete 清除。红色表示被系统占用或与其它项冲突。
            </p>
            <label class="chk">
              <input type="checkbox" :checked="settings.shortcuts.enableGlobal" @change="onToggleGlobal" />
              <span>启用全局快捷键</span><span class="muted">（应用在后台时也能响应）</span>
            </label>
            <label class="chk">
              <input type="checkbox" :checked="settings.shortcuts.useMediaKeys" @change="onToggleMedia" />
              <span>使用系统媒体快捷键</span><span class="muted">（键盘上的 播放/暂停、上一首、下一首）</span>
            </label>
            <button class="q-btn sc-reset" @click="resetShortcuts">恢复默认</button>
          </div>
        </div>
      </section>

      <!-- 关于 -->
      <section class="settings-cat" data-sec="about">
        <div class="cat-side">关于</div>
        <div class="cat-main">
          <div class="block">
            <div class="row">
              <span class="muted">当前版本</span>
              <span class="ver-cell">
                {{ appVersion || '—' }}
                <span v-if="updates.available" class="ver-dot" title="有新版本"></span>
              </span>
            </div>
            <div v-if="updates.available" class="row">
              <span class="muted">发现新版本 {{ updates.info?.latest }}</span>
              <button class="primary" @click="openUpdate">立即更新</button>
            </div>
            <div class="row">
              <span class="muted">检查软件更新</span>
              <button class="q-btn" :disabled="checking" @click="checkUpdate">
                {{ checking ? '检查中…' : '检查更新' }}
              </button>
            </div>
            <div v-if="updateMsg" class="invite-ok" style="margin-top: 10px">{{ updateMsg }}</div>
          </div>
        </div>
      </section>

      <div class="settings-foot"></div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 固定头 */
.settings-head {
  flex: 0 0 auto;
}
.settings-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 14px;
}
.settings-tabs {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
}
.st-tab {
  position: relative;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 15px;
  font-weight: 600;
  padding: 8px 12px 12px;
  cursor: pointer;
  white-space: nowrap;
}
.st-tab:hover {
  color: var(--text);
}
.st-tab.active {
  color: var(--text);
  font-weight: 800;
}
.st-tab.active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  height: 3px;
  border-radius: 3px;
  background: var(--green-bright);
}
.tab-dot {
  position: absolute;
  top: 6px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f15e6c;
}
.ver-cell {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.ver-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f15e6c;
}

/* 滚动区 */
.settings-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.settings-foot {
  height: 38vh;
}

/* 每类：左标题 + 右内容，类间满行分割线 */
.settings-cat {
  display: flex;
  align-items: flex-start;
  gap: 40px;
  padding: 28px 0;
  border-bottom: 1px solid var(--border);
}
.settings-cat:last-of-type {
  border-bottom: none;
}
.cat-side {
  flex: 0 0 96px;
  font-size: 17px;
  font-weight: 800;
  padding-top: 2px;
}
.cat-main {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 920px;
}

/* 内容块 */
.block {
  margin-bottom: 22px;
}
.block:last-child {
  margin-bottom: 0;
}
.block h4 {
  font-size: 14px;
  margin-bottom: 12px;
}
.block h4 .tag {
  font-size: 12px;
  font-weight: 400;
  margin-left: 8px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 6px 0;
}
.server-row {
  display: flex;
  gap: 10px;
  max-width: 560px;
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
  flex-wrap: wrap;
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

/* 勾选 / 单选 */
.chk,
.rdo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  padding: 7px 0;
  cursor: pointer;
}
.chk input,
.rdo input {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  accent-color: var(--green);
  cursor: pointer;
}
.chk .muted,
.rdo .muted {
  font-size: 12px;
}

/* 快捷键表 */
.sc-table {
  max-width: 620px;
}
.sc-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}
.sc-head {
  padding-bottom: 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.sc-label {
  font-size: 14px;
  color: var(--text);
}
.sc-head .sc-label,
.sc-key-h {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}
.sc-key {
  height: 34px;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  background: #1f1f1f;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.sc-key:hover {
  border-color: #6a6a6a;
}
.sc-key.rec {
  border-color: var(--green-bright);
  color: var(--green-bright);
  background: rgba(30, 215, 96, 0.08);
}
.sc-key.invalid {
  border-color: #f15e6c;
  color: #f15e6c;
  background: rgba(241, 94, 108, 0.08);
}
.sc-hint {
  max-width: 620px;
  color: var(--muted);
  font-size: 12px;
  margin: 12px 0 6px;
  line-height: 1.6;
}
.sc-reset {
  margin-top: 16px;
}
</style>
