import { ipcMain } from 'electron'
import Store from 'electron-store'

export interface DesktopLyricsPrefs {
  enabled: boolean
  twoLines: boolean
}

export type ThemeName = 'dark' | 'light'

export interface AppConfig {
  serverURL: string
  quality: string
  theme: ThemeName
  desktopLyrics: DesktopLyricsPrefs
  skippedVersion: string
}

const DEFAULT_CONFIG: AppConfig = {
  // 默认线上后端（Cloudflare Tunnel + 自有域名），可在登录页/设置页修改（对齐 Swift AppConfig.defaultServerURL）
  serverURL: 'https://fm.bonjor.fun',
  quality: '128k',
  theme: 'dark',
  desktopLyrics: { enabled: false, twoLines: false },
  skippedVersion: ''
}

const store = new Store<AppConfig>({ name: 'config', defaults: DEFAULT_CONFIG })

export function getConfig(): AppConfig {
  return {
    serverURL: store.get('serverURL', DEFAULT_CONFIG.serverURL),
    quality: store.get('quality', DEFAULT_CONFIG.quality),
    theme: store.get('theme', DEFAULT_CONFIG.theme),
    desktopLyrics: { ...DEFAULT_CONFIG.desktopLyrics, ...store.get('desktopLyrics') },
    skippedVersion: store.get('skippedVersion', DEFAULT_CONFIG.skippedVersion)
  }
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  if (patch.serverURL !== undefined) store.set('serverURL', String(patch.serverURL).replace(/\/+$/, ''))
  if (patch.quality !== undefined) store.set('quality', String(patch.quality))
  if (patch.theme !== undefined) store.set('theme', patch.theme)
  if (patch.desktopLyrics !== undefined) {
    store.set('desktopLyrics', { ...getConfig().desktopLyrics, ...patch.desktopLyrics })
  }
  if (patch.skippedVersion !== undefined) store.set('skippedVersion', String(patch.skippedVersion))
  return getConfig()
}

export function registerConfigIpc(): void {
  ipcMain.handle('pf:config:get-all', () => getConfig())
  ipcMain.handle('pf:config:set', (_e, patch: Partial<AppConfig>) => setConfig(patch || {}))
}
