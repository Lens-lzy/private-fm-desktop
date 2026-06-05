import { defineStore } from 'pinia'
import { ref } from 'vue'
import { serverURL, quality, setServerURL, setQualityLocal } from '@/services/session'
import { cloneDefaultShortcuts } from '@/services/shortcuts'
import type {
  Quality,
  DesktopLyricsPrefs,
  ThemeName,
  ShortcutsPrefs,
  PlaybackPrefs
} from '@/types'

const DEFAULT_PLAYBACK: PlaybackPrefs = {
  autoplay: false,
  resume: true,
  notify: true,
  doubleClick: 'replace',
  syncRecents: true
}

function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
}

export const useSettingsStore = defineStore('settings', () => {
  const server = ref(serverURL())
  const audioQuality = ref<Quality>((quality() as Quality) || '128k')
  const theme = ref<ThemeName>('dark')
  const desktopLyrics = ref<DesktopLyricsPrefs>({
    enabled: false,
    twoLines: false,
    colorMode: 'solid',
    colorSolid: '#1ed760',
    colorFrom: '#1ed760',
    colorTo: '#36c5ff',
    menuBar: false,
    touchBar: false
  })
  const shortcuts = ref<ShortcutsPrefs>(cloneDefaultShortcuts())
  const invalidGlobals = ref<string[]>([]) // 全局注册失败的 action（被占用/非法），供 UI 标红
  const recordingShortcut = ref(false) // 设置页正在录制改键时为 true，应用内快捷键暂时让路
  const playback = ref<PlaybackPrefs>({ ...DEFAULT_PLAYBACK })

  function hydrate(cfg: {
    serverURL?: string
    quality?: string
    theme?: ThemeName
    desktopLyrics?: DesktopLyricsPrefs
    shortcuts?: ShortcutsPrefs
    playback?: PlaybackPrefs
  }): void {
    if (cfg.serverURL) server.value = cfg.serverURL
    if (cfg.quality) audioQuality.value = cfg.quality as Quality
    // 1.0 暂锁深色：浅色主题仍有组件写死深色配色，避免进入半成品状态。完成后改回 `cfg.theme`。
    theme.value = 'dark'
    if (cfg.desktopLyrics) desktopLyrics.value = cfg.desktopLyrics
    if (cfg.shortcuts) shortcuts.value = cfg.shortcuts
    if (cfg.playback) playback.value = { ...DEFAULT_PLAYBACK, ...cfg.playback }
    applyTheme(theme.value)
  }

  /** 更新播放偏好（部分字段）并持久化。 */
  async function updatePlayback(patch: Partial<PlaybackPrefs>): Promise<void> {
    playback.value = { ...playback.value, ...patch }
    await window.pf.config.set({ playback: playback.value })
  }

  async function updateTheme(t: ThemeName): Promise<void> {
    theme.value = t
    applyTheme(t)
    await window.pf.config.set({ theme: t })
  }

  async function updateServer(url: string): Promise<void> {
    await setServerURL(url)
    server.value = serverURL()
  }

  async function updateQuality(q: Quality): Promise<void> {
    audioQuality.value = q
    setQualityLocal(q)
    await window.pf.config.set({ quality: q })
  }

  async function updateDesktopLyrics(patch: Partial<DesktopLyricsPrefs>): Promise<void> {
    desktopLyrics.value = { ...desktopLyrics.value, ...patch }
    await window.pf.config.set({ desktopLyrics: desktopLyrics.value })
    // 通知主进程立即应用：重推浮窗配色 + 挂/卸菜单栏与 Touch Bar 歌词
    window.pf.desktopLyrics.applyConfig()
  }

  /** 开/关桌面歌词浮窗（主进程已持久化 enabled，这里同步本地状态）。 */
  async function toggleDesktopLyrics(): Promise<boolean> {
    const on = await window.pf.desktopLyrics.toggle()
    desktopLyrics.value = { ...desktopLyrics.value, enabled: on }
    return on
  }

  /** 启动时若已启用，确保浮窗显示（与主进程 restore 互补，幂等）。 */
  async function syncDesktopLyrics(): Promise<void> {
    desktopLyrics.value = {
      ...desktopLyrics.value,
      enabled: await window.pf.desktopLyrics.isShowing()
    }
  }

  /** 监听主进程回推的浮窗开/关状态（如浮窗自身的 ✕ 关闭），保持「词」按钮同步。 */
  function watchDesktopLyricsState(): void {
    window.pf.desktopLyrics.onStateChanged?.((on) => {
      desktopLyrics.value = { ...desktopLyrics.value, enabled: on }
    })
  }

  // ---- 快捷键 ----
  async function persistShortcuts(): Promise<void> {
    await window.pf.config.set({ shortcuts: shortcuts.value })
  }
  /** 重新注册全局快捷键并记录失败项（标红）。 */
  async function applyGlobalShortcuts(): Promise<void> {
    invalidGlobals.value = (await window.pf.shortcuts.apply()) || []
  }
  /** 设置某 action 的本地/全局键位（accel 空串=清除）。 */
  async function setBinding(
    action: string,
    kind: 'local' | 'global',
    accel: string
  ): Promise<void> {
    const prev = shortcuts.value.keys[action] || { local: '', global: '' }
    shortcuts.value = {
      ...shortcuts.value,
      keys: { ...shortcuts.value.keys, [action]: { ...prev, [kind]: accel } }
    }
    await persistShortcuts()
    if (kind === 'global') await applyGlobalShortcuts()
  }
  async function setEnableGlobal(on: boolean): Promise<void> {
    shortcuts.value = { ...shortcuts.value, enableGlobal: on }
    await persistShortcuts()
    await applyGlobalShortcuts()
  }
  async function setUseMediaKeys(on: boolean): Promise<void> {
    shortcuts.value = { ...shortcuts.value, useMediaKeys: on }
    await persistShortcuts()
  }
  async function resetShortcuts(): Promise<void> {
    shortcuts.value = cloneDefaultShortcuts()
    await persistShortcuts()
    await applyGlobalShortcuts()
  }

  return {
    server,
    audioQuality,
    theme,
    desktopLyrics,
    shortcuts,
    invalidGlobals,
    recordingShortcut,
    playback,
    hydrate,
    updatePlayback,
    updateServer,
    updateQuality,
    updateTheme,
    updateDesktopLyrics,
    toggleDesktopLyrics,
    syncDesktopLyrics,
    watchDesktopLyricsState,
    applyGlobalShortcuts,
    setBinding,
    setEnableGlobal,
    setUseMediaKeys,
    resetShortcuts
  }
})
