import { ipcMain } from 'electron'
import { getMainWindow } from '../windows/mainWindow'

export type MediaCommand = 'playpause' | 'prev' | 'next' | 'play' | 'pause'

/** 把媒体指令转发给主窗口渲染层（托盘 / 桌面歌词控制 / 未来全局快捷键共用此路径）。 */
export function sendMediaKey(cmd: MediaCommand): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send('pf:media:key', cmd)
}

export function registerMediaIpc(): void {
  // 渲染层可主动上报播放态（预留：供未来系统集成扩展），当前无副作用。
  ipcMain.on('pf:media:state', () => {})
}
