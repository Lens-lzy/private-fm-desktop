import { usePlayerStore } from '@/stores/player'

/**
 * 接收来自主进程的媒体指令（托盘菜单、桌面歌词窗口控制按钮转发而来），
 * 分发到 player。硬件媒体键已由 useNowPlayingSync 的 MediaSession 处理。
 */
export function useMediaKeys(): void {
  const player = usePlayerStore()
  window.pf.media.onMediaKey((cmd) => {
    switch (cmd) {
      case 'playpause':
        player.togglePlay()
        break
      case 'play':
        if (!player.isPlaying) player.togglePlay()
        break
      case 'pause':
        if (player.isPlaying) player.togglePlay()
        break
      case 'prev':
        player.prev()
        break
      case 'next':
        player.next()
        break
    }
  })
}
