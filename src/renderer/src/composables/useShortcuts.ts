import { onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { matchEvent } from '@/services/shortcuts'

/**
 * 应用内 + 全局快捷键的统一分发。
 * - 本地：监听 window keydown，命中 settings.shortcuts.keys[*].local → runAction
 *   （输入框内 / 设置页正在改键时让路）。
 * - 全局：主进程 globalShortcut 触发 → pf:shortcut:action → 同一 runAction。
 * 硬件媒体键仍由 useNowPlayingSync 的 MediaSession 处理（受「使用系统媒体键」开关控制）。
 */
export function useShortcuts(): void {
  const player = usePlayerStore()
  const library = useLibraryStore()
  const settings = useSettingsStore()
  const ui = useUiStore()

  const step = (v: number): number => Math.round(v * 100) / 100

  function runAction(a: string): void {
    switch (a) {
      case 'playpause':
        player.togglePlay()
        break
      case 'prev':
        player.prev()
        break
      case 'next':
        player.next()
        break
      case 'volup':
        player.setVolume(Math.min(1, step(player.volume + 0.05)))
        break
      case 'voldown':
        player.setVolume(Math.max(0, step(player.volume - 0.05)))
        break
      case 'like':
        if (player.current) void library.toggleLike(player.current)
        break
      case 'lyrics':
        void settings.toggleDesktopLyrics()
        break
      case 'nowplaying':
        ui.toggleNowPlaying()
        break
    }
  }

  function isTyping(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null
    if (!el || !el.tagName) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
  }

  function onKeydown(e: KeyboardEvent): void {
    if (settings.recordingShortcut) return // 设置页正在改键 → 让路
    if (e.repeat) return
    if (isTyping(e.target)) return
    const keys = settings.shortcuts.keys
    for (const action in keys) {
      if (matchEvent(e, keys[action].local)) {
        e.preventDefault()
        runAction(action)
        return
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    window.pf.shortcuts.onAction((a) => runAction(a))
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
  })
}
