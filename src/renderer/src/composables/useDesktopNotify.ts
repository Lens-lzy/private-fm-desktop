import { watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useSettingsStore } from '@/stores/settings'
import { resolveCover } from '@/services/covers'
import { songSinger } from '@/utils/format'
import { keyOf } from '@/services/songKey'
import type { Song } from '@/types'

/**
 * 后台歌曲切换通知：当窗口不在前台、且开启「桌面通知」时，切歌弹一条系统通知。
 * 用浏览器 Notification API（Electron 默认已授权）；前台时不打扰。
 */
export function useDesktopNotify(): void {
  const player = usePlayerStore()
  const settings = useSettingsStore()
  let lastKey = ''

  watch(
    () => player.current,
    async (s) => {
      if (!s) {
        lastKey = ''
        return
      }
      const k = keyOf(s)
      if (k === lastKey) return // 同一首（仅状态变化）不重复通知
      lastKey = k
      if (!settings.playback.notify) return
      if (typeof document !== 'undefined' && document.hasFocus()) return // 前台不打扰
      if (typeof Notification === 'undefined') return
      const cover = await resolveCover(s).catch(() => '')
      if (keyOf(player.current as Song) !== k) return // 期间已切歌
      try {
        const n = new Notification(String(s.name || '正在播放'), {
          body: songSinger(s),
          icon: cover || undefined,
          silent: true
        })
        n.onclick = (): void => window.focus()
      } catch {
        /* 通知失败忽略 */
      }
    }
  )
}
