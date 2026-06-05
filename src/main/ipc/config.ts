import { ipcMain } from 'electron'
import Store from 'electron-store'

export interface DesktopLyricsPrefs {
  enabled: boolean
  twoLines: boolean
}

export type ThemeName = 'dark' | 'light'

export interface ShortcutBinding {
  local: string
  global: string
}
export interface ShortcutsPrefs {
  enableGlobal: boolean
  useMediaKeys: boolean
  keys: Record<string, ShortcutBinding>
}

export interface AppConfig {
  serverURL: string
  quality: string
  theme: ThemeName
  desktopLyrics: DesktopLyricsPrefs
  shortcuts: ShortcutsPrefs
  skippedVersion: string
  serverMigrated: boolean
}

// 默认快捷键：须与渲染层 services/shortcuts.ts 的 DEFAULT_SHORTCUTS 保持一致
const DEFAULT_SHORTCUTS: ShortcutsPrefs = {
  enableGlobal: true,
  useMediaKeys: true,
  keys: {
    playpause: { local: 'Space', global: 'Ctrl+Cmd+P' },
    prev: { local: 'Cmd+Left', global: 'Ctrl+Cmd+Left' },
    next: { local: 'Cmd+Right', global: 'Ctrl+Cmd+Right' },
    volup: { local: 'Cmd+Up', global: 'Ctrl+Cmd+Up' },
    voldown: { local: 'Cmd+Down', global: 'Ctrl+Cmd+Down' },
    like: { local: 'Cmd+L', global: 'Ctrl+Cmd+L' },
    lyrics: { local: 'Cmd+R', global: 'Ctrl+Cmd+R' },
    nowplaying: { local: 'Ctrl+Cmd+M', global: '' }
  }
}

const DEFAULT_CONFIG: AppConfig = {
  // 默认线上后端（Cloudflare Tunnel + 自有域名），可在登录页/设置页修改（对齐 Swift AppConfig.defaultServerURL）
  serverURL: 'https://fm.bonjor.fun',
  quality: '128k',
  theme: 'dark',
  desktopLyrics: { enabled: false, twoLines: false },
  shortcuts: DEFAULT_SHORTCUTS,
  skippedVersion: '',
  serverMigrated: false
}

/** 合并存储的 shortcuts 与默认值，保证缺失的 action/字段都有兜底。 */
function mergeShortcuts(stored?: Partial<ShortcutsPrefs>): ShortcutsPrefs {
  return {
    enableGlobal: stored?.enableGlobal ?? DEFAULT_SHORTCUTS.enableGlobal,
    useMediaKeys: stored?.useMediaKeys ?? DEFAULT_SHORTCUTS.useMediaKeys,
    keys: { ...DEFAULT_SHORTCUTS.keys, ...(stored?.keys || {}) }
  }
}

const store = new Store<AppConfig>({ name: 'config', defaults: DEFAULT_CONFIG })

export function getConfig(): AppConfig {
  return {
    serverURL: store.get('serverURL', DEFAULT_CONFIG.serverURL),
    quality: store.get('quality', DEFAULT_CONFIG.quality),
    theme: store.get('theme', DEFAULT_CONFIG.theme),
    desktopLyrics: { ...DEFAULT_CONFIG.desktopLyrics, ...store.get('desktopLyrics') },
    shortcuts: mergeShortcuts(store.get('shortcuts')),
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
  if (patch.shortcuts !== undefined) {
    const cur = getConfig().shortcuts
    store.set('shortcuts', {
      enableGlobal: patch.shortcuts.enableGlobal ?? cur.enableGlobal,
      useMediaKeys: patch.shortcuts.useMediaKeys ?? cur.useMediaKeys,
      keys: { ...cur.keys, ...(patch.shortcuts.keys || {}) }
    })
  }
  if (patch.skippedVersion !== undefined) store.set('skippedVersion', String(patch.skippedVersion))
  if (patch.serverMigrated !== undefined) store.set('serverMigrated', Boolean(patch.serverMigrated))
  return getConfig()
}

export function registerConfigIpc(): void {
  ipcMain.handle('pf:config:get-all', () => getConfig())
  ipcMain.handle('pf:config:set', (_e, patch: Partial<AppConfig>) => setConfig(patch || {}))
}
