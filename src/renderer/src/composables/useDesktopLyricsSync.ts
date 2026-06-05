import { watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useLyricsStore } from '@/stores/lyrics'

/**
 * 把「当前句 / 下一句 / 播放态」推给主进程 → 桌面歌词窗口。
 * 无歌词时用歌名占位，保证浮窗始终有内容。
 */
export function useDesktopLyricsSync(): void {
  const player = usePlayerStore()
  const lyrics = useLyricsStore()

  function push(): void {
    const idx = lyrics.currentIndex
    const lines = lyrics.lines
    let cur = ''
    let next = ''
    if (lines.length && idx >= 0) {
      cur = lines[idx]?.text || ''
      next = lines[idx + 1]?.text || ''
    } else {
      cur = player.current?.name ? String(player.current.name) : ''
    }
    window.pf.desktopLyrics.push({ cur, next, playing: player.isPlaying })
  }

  watch(
    () => [lyrics.currentIndex, lyrics.epoch, player.isPlaying, player.current],
    push,
    { immediate: true }
  )
}
