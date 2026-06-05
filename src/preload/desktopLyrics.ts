import { contextBridge, ipcRenderer } from 'electron'

/**
 * 桌面歌词窗口的独立 preload。
 * 因窗口 focusable:false（不夺焦，macOS 下隐含 movable:false），
 * 拖动/缩放改由渲染层捕获鼠标 → IPC → 主进程 setPosition/setBounds 实现。
 */
type LyricPayload = {
  top: string
  bottom: string
  activeRow: number
  start: number
  end: number
  pos: number
  playing: boolean
  twoLines: boolean
  colorMode: 'solid' | 'gradient'
  colorSolid: string
  colorFrom: string
  colorTo: string
}

const lyricsApi = {
  onLyric: (cb: (payload: LyricPayload) => void): void => {
    ipcRenderer.on('lyric:update', (_e, payload: LyricPayload) => cb(payload))
  },
  sendControl: (cmd: string): void => {
    ipcRenderer.send('lyric:control', cmd)
  },
  // 拖动：记录起点后按屏幕坐标增量移动窗口
  dragStart: (): void => ipcRenderer.send('lyric:drag-start'),
  dragMove: (dx: number, dy: number): void => ipcRenderer.send('lyric:drag-move', { dx, dy }),
  // 缩放：右下角手柄拖动，按增量调整窗口尺寸
  resizeStart: (): void => ipcRenderer.send('lyric:resize-start'),
  resizeMove: (dx: number, dy: number): void => ipcRenderer.send('lyric:resize-move', { dx, dy }),
  // 锁定：忽略鼠标事件（点击穿透到下层窗口），forward 仍转发 move 用于检测悬停
  setIgnore: (ignore: boolean): void => ipcRenderer.send('lyric:set-ignore', ignore)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('pfLyrics', lyricsApi)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(globalThis as unknown as { pfLyrics: typeof lyricsApi }).pfLyrics = lyricsApi
}
