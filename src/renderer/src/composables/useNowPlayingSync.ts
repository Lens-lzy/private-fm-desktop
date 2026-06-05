import { watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { resolveCover } from '@/services/covers'
import { songSinger, songAlbum } from '@/utils/format'

/**
 * 系统 Now Playing 集成（macOS 媒体信息中心 + 硬件媒体键），零原生模块：
 * 用 Chromium 内置 navigator.mediaSession。设置 metadata / playbackState / action handlers。
 * 媒体键由 MediaSession 处理；不另注册 globalShortcut，避免双触发。
 */
export function useNowPlayingSync(): void {
  const player = usePlayerStore()

  if (!('mediaSession' in navigator)) return

  navigator.mediaSession.setActionHandler('play', () => {
    if (!player.isPlaying) player.togglePlay()
  })
  navigator.mediaSession.setActionHandler('pause', () => {
    if (player.isPlaying) player.togglePlay()
  })
  navigator.mediaSession.setActionHandler('previoustrack', () => player.prev())
  navigator.mediaSession.setActionHandler('nexttrack', () => player.next())
  try {
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (typeof d.seekTime === 'number') player.seek(d.seekTime)
    })
  } catch {
    /* 个别平台不支持 seekto */
  }

  // 元数据：随当前曲变化
  watch(
    () => player.current,
    async (s) => {
      if (!s) {
        navigator.mediaSession.metadata = null
        return
      }
      const cover = await resolveCover(s)
      if (player.current !== s) return
      navigator.mediaSession.metadata = new MediaMetadata({
        title: String(s.name || ''),
        artist: songSinger(s),
        album: songAlbum(s),
        artwork: cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : []
      })
    },
    { immediate: true }
  )

  // 播放态
  watch(
    () => player.isPlaying,
    (p) => {
      navigator.mediaSession.playbackState = p ? 'playing' : 'paused'
    },
    { immediate: true }
  )

  // 进度（让系统进度条准确）
  watch(
    () => [player.currentTime, player.duration],
    () => {
      if (player.duration > 0 && isFinite(player.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: player.duration,
            position: Math.min(player.currentTime, player.duration),
            playbackRate: 1
          })
        } catch {
          /* 忽略无效进度 */
        }
      }
    }
  )
}
