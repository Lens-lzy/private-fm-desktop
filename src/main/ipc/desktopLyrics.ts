import { ipcMain } from 'electron'
import { getConfig, setConfig } from './config'
import { sendMediaKey, type MediaCommand } from './media'
import { getMainWindow } from '../windows/mainWindow'
import {
  createLyricsWindow,
  destroyLyricsWindow,
  getLyricsWindow
} from '../windows/desktopLyricsWindow'

export interface LyricPayload {
  top: string
  bottom: string
  activeRow: number
  start: number
  end: number
  pos: number
  playing: boolean
  twoLines?: boolean
}

let lastPayload: LyricPayload = {
  top: '',
  bottom: '',
  activeRow: 0,
  start: 0,
  end: 0,
  pos: 0,
  playing: false
}

function pushToWindow(): void {
  const win = getLyricsWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('lyric:update', {
      ...lastPayload,
      twoLines: getConfig().desktopLyrics.twoLines
    })
  }
}

export function isDesktopLyricsShowing(): boolean {
  const win = getLyricsWindow()
  return !!win && !win.isDestroyed()
}

/** 通知主窗口渲染层桌面歌词的开关状态，使播放条「词」按钮保持同步。 */
function notifyMainWindow(on: boolean): void {
  const mw = getMainWindow()
  if (mw && !mw.isDestroyed()) mw.webContents.send('pf:dl:state', on)
}

export function setDesktopLyricsEnabled(on: boolean): boolean {
  setConfig({ desktopLyrics: { ...getConfig().desktopLyrics, enabled: on } })
  if (on) {
    const win = createLyricsWindow()
    win.webContents.once('did-finish-load', () => pushToWindow())
  } else {
    destroyLyricsWindow()
  }
  notifyMainWindow(on)
  return on
}

export function toggleDesktopLyrics(): boolean {
  return setDesktopLyricsEnabled(!isDesktopLyricsShowing())
}

export function registerDesktopLyricsIpc(): void {
  ipcMain.handle('pf:dl:toggle', () => toggleDesktopLyrics())
  ipcMain.handle('pf:dl:set-enabled', (_e, on: boolean) => setDesktopLyricsEnabled(!!on))
  ipcMain.handle('pf:dl:is-showing', () => isDesktopLyricsShowing())

  // 主窗口推送当前/下一句 + 播放态
  ipcMain.on('pf:dl:push', (_e, payload: LyricPayload) => {
    lastPayload = {
      top: payload.top || '',
      bottom: payload.bottom || '',
      activeRow: payload.activeRow === 1 ? 1 : 0,
      start: Number(payload.start) || 0,
      end: Number(payload.end) || 0,
      pos: Number(payload.pos) || 0,
      playing: !!payload.playing
    }
    pushToWindow()
  })

  // 程序化拖动/缩放（focusable:false 下系统拖动被禁，改由此实现）
  let dragOrigin: [number, number] = [0, 0]
  let sizeOrigin = { x: 0, y: 0, width: 0, height: 0 }
  ipcMain.on('lyric:drag-start', () => {
    const w = getLyricsWindow()
    if (w && !w.isDestroyed()) dragOrigin = w.getPosition() as [number, number]
  })
  ipcMain.on('lyric:drag-move', (_e, { dx, dy }: { dx: number; dy: number }) => {
    const w = getLyricsWindow()
    if (w && !w.isDestroyed()) w.setPosition(Math.round(dragOrigin[0] + dx), Math.round(dragOrigin[1] + dy))
  })
  ipcMain.on('lyric:resize-start', () => {
    const w = getLyricsWindow()
    if (w && !w.isDestroyed()) sizeOrigin = w.getBounds()
  })
  ipcMain.on('lyric:resize-move', (_e, { dx, dy }: { dx: number; dy: number }) => {
    const w = getLyricsWindow()
    if (!w || w.isDestroyed()) return
    const width = Math.max(320, Math.round(sizeOrigin.width + dx))
    const height = Math.max(76, Math.round(sizeOrigin.height + dy))
    w.setBounds({ x: sizeOrigin.x, y: sizeOrigin.y, width, height })
  })

  // 锁定：鼠标穿透（forward 仍转发 move，供渲染层检测悬停解锁按钮）
  ipcMain.on('lyric:set-ignore', (_e, ignore: boolean) => {
    const w = getLyricsWindow()
    if (w && !w.isDestroyed()) w.setIgnoreMouseEvents(!!ignore, { forward: true })
  })

  // 桌面歌词窗口的控制指令
  ipcMain.on('lyric:control', (_e, cmd: string) => {
    if (cmd === 'close') {
      setDesktopLyricsEnabled(false)
      return
    }
    if (cmd === 'toggleLines') {
      const cur = getConfig().desktopLyrics
      setConfig({ desktopLyrics: { ...cur, twoLines: !cur.twoLines } })
      pushToWindow()
      return
    }
    sendMediaKey(cmd as MediaCommand)
  })
}

/** 启动时若上次启用了桌面歌词，则恢复显示。 */
export function restoreDesktopLyrics(): void {
  if (getConfig().desktopLyrics.enabled) setDesktopLyricsEnabled(true)
}
