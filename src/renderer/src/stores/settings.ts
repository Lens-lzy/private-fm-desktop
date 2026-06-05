import { defineStore } from 'pinia'
import { ref } from 'vue'
import { serverURL, quality, setServerURL, setQualityLocal } from '@/services/session'
import type { Quality, DesktopLyricsPrefs, ThemeName } from '@/types'

function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
}

export const useSettingsStore = defineStore('settings', () => {
  const server = ref(serverURL())
  const audioQuality = ref<Quality>((quality() as Quality) || '128k')
  const theme = ref<ThemeName>('dark')
  const desktopLyrics = ref<DesktopLyricsPrefs>({ enabled: false, twoLines: false })

  function hydrate(cfg: {
    serverURL?: string
    quality?: string
    theme?: ThemeName
    desktopLyrics?: DesktopLyricsPrefs
  }): void {
    if (cfg.serverURL) server.value = cfg.serverURL
    if (cfg.quality) audioQuality.value = cfg.quality as Quality
    if (cfg.theme) theme.value = cfg.theme
    if (cfg.desktopLyrics) desktopLyrics.value = cfg.desktopLyrics
    applyTheme(theme.value)
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

  return {
    server,
    audioQuality,
    theme,
    desktopLyrics,
    hydrate,
    updateServer,
    updateQuality,
    updateTheme,
    updateDesktopLyrics,
    toggleDesktopLyrics,
    syncDesktopLyrics,
    watchDesktopLyricsState
  }
})
