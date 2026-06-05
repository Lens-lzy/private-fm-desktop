import { watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useLyricsStore } from '@/stores/lyrics'

/**
 * 把「对句两行 + 当前句时间轴 + 播放态」推给主进程 → 桌面歌词窗口。
 *
 * 双行采用「对句分页」：上行=偶数句、下行=奇数句，整页每两句才翻一次；
 * activeRow 标明此刻在唱上行还是下行——唱第二句（下行）时上行保持不变，
 * 唱完整页两句后才翻到下一对，符合「第二句唱完再刷新」的预期。
 *
 * 同时下发当前句的 start/end/pos，窗口侧据此用 rAF 平滑推进卡拉OK扫光
 * （每帧外推播放位置，绿色从左到右覆盖正在唱的那一行）。
 * 无歌词时用歌名占位，保证浮窗始终有内容。
 */
export function useDesktopLyricsSync(): void {
  const player = usePlayerStore()
  const lyrics = useLyricsStore()

  function push(): void {
    const idx = lyrics.currentIndex
    const lines = lyrics.lines
    let top = ''
    let bottom = ''
    let activeRow = 0
    let start = 0
    let end = 0

    if (lines.length && idx >= 0) {
      const pairStart = idx - (idx % 2) // 偶数句为对句上行
      top = lines[pairStart]?.text || ''
      bottom = lines[pairStart + 1]?.text || ''
      activeRow = idx - pairStart // 0=上行在唱，1=下行在唱
      start = lines[idx]?.time ?? 0
      const nextTime = lines[idx + 1]?.time
      // 末句无下一句时间轴 → 退回整曲时长，让最后一句也能完整扫光
      end = nextTime != null ? nextTime : player.duration > start ? player.duration : 0
    } else {
      top = player.current?.name ? String(player.current.name) : ''
    }

    window.pf.desktopLyrics.push({
      top,
      bottom,
      activeRow,
      start,
      end,
      pos: player.currentTime,
      playing: player.isPlaying
    })
  }

  // 额外纳入 currentTime：每次时间更新都重新锚定，seek/缓冲后扫光仍精准对齐
  watch(
    () => [
      lyrics.currentIndex,
      lyrics.epoch,
      player.isPlaying,
      player.current,
      player.currentTime
    ],
    push,
    { immediate: true }
  )
}
