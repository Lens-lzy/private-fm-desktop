import type { ShortcutsPrefs } from '@/types'

/**
 * 快捷键的单一事实源（UI 行、默认绑定、accelerator 编解码）。
 *
 * accelerator 字符串格式（与 Electron globalShortcut 直接兼容）：
 *   修饰键按 Ctrl→Alt→Shift→Cmd 顺序 + 主键，用 '+' 连接，如 'Ctrl+Cmd+P' / 'Cmd+Left' / 'Space'。
 *   空串表示未设置。本地匹配与全局注册共用同一字符串。
 */
export type ShortcutAction =
  | 'playpause'
  | 'prev'
  | 'next'
  | 'volup'
  | 'voldown'
  | 'like'
  | 'lyrics'
  | 'nowplaying'

export const SHORTCUT_ROWS: { action: ShortcutAction; label: string }[] = [
  { action: 'playpause', label: '播放/暂停' },
  { action: 'prev', label: '上一首' },
  { action: 'next', label: '下一首' },
  { action: 'volup', label: '音量加' },
  { action: 'voldown', label: '音量减' },
  { action: 'like', label: '喜欢歌曲' },
  { action: 'lyrics', label: '打开/关闭桌面歌词' },
  { action: 'nowplaying', label: '展开/收起播放页' }
]

/** 默认快捷键（main 的 config 默认值需与此保持一致；getConfig 会按 key 兜底合并）。 */
export const DEFAULT_SHORTCUTS: ShortcutsPrefs = {
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

/** 深拷贝一份默认值（恢复默认用，避免改到常量）。 */
export function cloneDefaultShortcuts(): ShortcutsPrefs {
  return {
    enableGlobal: DEFAULT_SHORTCUTS.enableGlobal,
    useMediaKeys: DEFAULT_SHORTCUTS.useMediaKeys,
    keys: Object.fromEntries(
      Object.entries(DEFAULT_SHORTCUTS.keys).map(([k, v]) => [k, { ...v }])
    )
  }
}

const MOD_ORDER = ['Ctrl', 'Alt', 'Shift', 'Cmd'] as const

/** KeyboardEvent → accelerator 主键 token；按下的是纯修饰键则返回空串（等待真正的键）。 */
function eventMainKey(e: KeyboardEvent): string {
  const c = e.code
  if (c === 'Space') return 'Space'
  if (c === 'ArrowLeft') return 'Left'
  if (c === 'ArrowRight') return 'Right'
  if (c === 'ArrowUp') return 'Up'
  if (c === 'ArrowDown') return 'Down'
  if (/^Key[A-Z]$/.test(c)) return c.slice(3)
  if (/^Digit[0-9]$/.test(c)) return c.slice(5)
  if (/^F[0-9]{1,2}$/.test(c)) return c // F1..F12
  if (c === 'Enter' || c === 'NumpadEnter') return 'Enter'
  if (c === 'Escape' || c === 'Backspace' || c === 'Delete' || c === 'Tab') return '' // 这些另作控制用
  // 纯修饰键
  if (/^(Meta|Control|Alt|Shift)(Left|Right)$/.test(c)) return ''
  // 兜底：可打印单字符
  if (e.key && e.key.length === 1) return e.key.toUpperCase()
  return ''
}

/** 把 KeyboardEvent 编码成 accelerator；无有效主键时返回空串。 */
export function eventToAccel(e: KeyboardEvent): string {
  const key = eventMainKey(e)
  if (!key) return ''
  const mods: string[] = []
  if (e.ctrlKey) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey) mods.push('Cmd')
  mods.sort((a, b) => MOD_ORDER.indexOf(a as never) - MOD_ORDER.indexOf(b as never))
  return [...mods, key].join('+')
}

/** 该事件是否匹配某 accelerator（与 eventToAccel 同一套规范化）。 */
export function matchEvent(e: KeyboardEvent, accel: string): boolean {
  if (!accel) return false
  return eventToAccel(e) === accel
}

const SYMBOL: Record<string, string> = {
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Cmd: '⌘',
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
  Space: '空格',
  Enter: '⏎'
}

/** accelerator → 给人看的 mac 符号串（空串显示为「空」）。 */
export function formatAccel(accel: string): string {
  if (!accel) return '空'
  return accel
    .split('+')
    .map((t) => SYMBOL[t] || t)
    .join('')
}
