import { join } from 'node:path'
import { app, BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'

let lyricsWindow: BrowserWindow | null = null

export function getLyricsWindow(): BrowserWindow | null {
  return lyricsWindow
}

/**
 * 桌面歌词浮窗：透明、无边框、置顶、不夺焦、可拖动、可缩放、跨全屏空间。
 * 复刻 DesktopLyrics.swift 的 NSPanel 行为。
 */
export function createLyricsWindow(): BrowserWindow {
  if (lyricsWindow && !lyricsWindow.isDestroyed()) return lyricsWindow

  const wa = screen.getPrimaryDisplay().workArea // 含 x/y，避开菜单栏与 Dock
  const winW = 720
  const winH = 124
  const win = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 320,
    minHeight: 76,
    x: Math.round(wa.x + (wa.width - winW) / 2),
    y: Math.round(wa.y + wa.height - winH - 48), // 贴屏幕下部居中（Dock 之上）
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    focusable: false, // 不夺焦（对应 .nonactivatingPanel）
    type: 'panel', // 非激活面板：点击歌词不激活 app、不会把主窗口顶到前台
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/desktopLyrics.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver') // 浮在全屏应用之上
  // skipTransformProcessType: 阻止 macOS 把进程类型转成 UIElement —— 否则 Dock 图标会消失
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  })
  // 兜底：确保 Dock 图标始终在（多余调用对单窗口无害）
  if (process.platform === 'darwin' && app.dock && !app.dock.isVisible()) {
    void app.dock.show()
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/desktop-lyrics.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/desktop-lyrics.html'))
  }

  win.on('ready-to-show', () => win.showInactive())
  win.on('closed', () => {
    lyricsWindow = null
  })

  lyricsWindow = win
  return win
}

export function destroyLyricsWindow(): void {
  if (lyricsWindow && !lyricsWindow.isDestroyed()) lyricsWindow.close()
  lyricsWindow = null
}
