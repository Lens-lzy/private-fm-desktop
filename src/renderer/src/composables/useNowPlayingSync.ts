import { watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useSettingsStore } from '@/stores/settings'
import { resolveCover } from '@/services/covers'
import { songSinger, songAlbum } from '@/utils/format'

/**
 * 系统 Now Playing 集成（macOS 媒体信息中心 + 硬件媒体键），零原生模块：
 * 用 Chromium 内置 navigator.mediaSession。设置 metadata / playbackState / action handlers。
 * 硬件媒体键由 MediaSession 处理；是否响应受设置「使用系统媒体快捷键」开关控制（关闭则解绑 handler）。
 * 不另注册 globalShortcut 处理硬件键，避免双触发（自定义全局键走 useShortcuts）。
 */
export function useNowPlayingSync(): void {
  const player = usePlayerStore()
  const settings = useSettingsStore()

  if (!('mediaSession' in navigator)) return

  // 按「使用系统媒体快捷键」开关绑定/解绑硬件键 handler（元数据/进度仍始终同步）
  function applyMediaHandlers(on: boolean): void {
    const ms = navigator.mediaSession
    ms.setActionHandler('play', on ? () => { if (!player.isPlaying) player.togglePlay() } : null)
    ms.setActionHandler('pause', on ? () => { if (player.isPlaying) player.togglePlay() } : null)
    ms.setActionHandler('previoustrack', on ? () => player.prev() : null)
    ms.setActionHandler('nexttrack', on ? () => player.next() : null)
    try {
      ms.setActionHandler(
        'seekto',
        on
          ? (d) => {
              if (typeof d.seekTime === 'number') player.seek(d.seekTime)
            }
          : null
      )
    } catch {
      /* 个别平台不支持 seekto */
    }
  }
  watch(() => settings.shortcuts.useMediaKeys, (on) => applyMediaHandlers(!!on), { immediate: true })

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
