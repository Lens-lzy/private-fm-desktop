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
  serverMigrated: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  // 默认线上后端（Cloudflare Tunnel + 自有域名），可在登录页/设置页修改（对齐 Swift AppConfig.defaultServerURL）
  serverURL: 'https://fm.bonjor.fun',
  quality: '128k',
  theme: 'dark',
  desktopLyrics: { enabled: false, twoLines: false },
  skippedVersion: '',
  serverMigrated: false
}

const store = new Store<AppConfig>({ name: 'config', defaults: DEFAULT_CONFIG })

export function getConfig(): AppConfig {
  return {
    serverURL: store.get('serverURL', DEFAULT_CONFIG.serverURL),
    quality: store.get('quality', DEFAULT_CONFIG.quality),
    theme: store.get('theme', DEFAULT_CONFIG.theme),
    desktopLyrics: { ...DEFAULT_CONFIG.desktopLyrics, ...store.get('desktopLyrics') },
    skippedVersion: store.get('skippedVersion', DEFAULT_CONFIG.skippedVersion),
    serverMigrated: store.get('serverMigrated', DEFAULT_CONFIG.serverMigrated)
  }
}

/**
 * 一次性迁移：beta 早期测试机上可能残留了指向本地后端（localhost/127.0.0.1）的 serverURL，
 * 导致看不到线上注册的成员。仅当残留值是回环地址时纠正到当前线上默认；执行一次后置标记，
 * 之后用户可自由改回任意地址并保留。不会动用户主动设置的远程地址。
 */
export function migrateConfig(): void {
  if (store.get('serverMigrated', false)) return
  const cur = String(store.get('serverURL', DEFAULT_CONFIG.serverURL))
  if (/\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/i.test(cur)) {
    store.set('serverURL', DEFAULT_CONFIG.serverURL)
  }
  store.set('serverMigrated', true)
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  if (patch.serverURL !== undefined) store.set('serverURL', String(patch.serverURL).replace(/\/+$/, ''))
  if (patch.quality !== undefined) store.set('quality', String(patch.quality))
  if (patch.theme !== undefined) store.set('theme', patch.theme)
  if (patch.desktopLyrics !== undefined) {
    store.set('desktopLyrics', { ...getConfig().desktopLyrics, ...patch.desktopLyrics })
  }
  if (patch.skippedVersion !== undefined) store.set('skippedVersion', String(patch.skippedVersion))
  if (patch.serverMigrated !== undefined) store.set('serverMigrated', Boolean(patch.serverMigrated))
  return getConfig()
}

export function registerConfigIpc(): void {
  ipcMain.handle('pf:config:get-all', () => getConfig())
  ipcMain.handle('pf:config:set', (_e, patch: Partial<AppConfig>) => setConfig(patch || {}))
}
