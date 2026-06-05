import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null
let quitting = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * 标记 app 正在真正退出（Cmd+Q / 托盘退出等）。
 * 此后主窗口的 close 才放行销毁；否则点红灯只隐藏到 Dock（保活渲染层）。
 */
export function setQuitting(v: boolean): void {
  quitting = v
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset', // macOS：保留红绿灯但隐藏标题栏，留出沉浸感
    trafficLightPosition: { x: 16, y: 11 }, // 居中于 34px 的拖拽条
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // 渲染层用 <audio> 自动播放，需允许（无用户手势）
      autoplayPolicy: 'no-user-gesture-required',
      // 关窗后仍在 Dock 后台运行：关掉后台节流，音乐/歌词时间轴推送保持满速、桌面歌词不卡顿
      backgroundThrottling: false
    }
  })

  win.on('ready-to-show', () => win.show())
  // macOS：点红灯/关闭主窗口只隐藏（保活渲染层 → 音乐继续、状态保留），真正退出时才销毁
  win.on('close', (e) => {
    if (process.platform === 'darwin' && !quitting) {
      e.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => {
    mainWindow = null
  })

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  return win
}
