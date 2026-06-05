import { app, BrowserWindow } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import appIcon from '../../resources/icon.png?asset'
import { installCorsBypass } from './cors'
import { registerSecretsIpc } from './ipc/secrets'
import { registerConfigIpc, migrateConfig } from './ipc/config'
import { registerMediaIpc } from './ipc/media'
import { registerDesktopLyricsIpc, restoreDesktopLyrics } from './ipc/desktopLyrics'
import { registerUpdateIpc, checkOnLaunch } from './update'
import { createTray } from './tray'
import { createMainWindow, getMainWindow } from './windows/mainWindow'

// 单实例锁：再次启动只聚焦已有窗口
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.privatefm.desktop')

    // macOS dev：用自定义图标显示在 Dock（仅 dev；打包态由 electron-builder 写入 .icns，
    // 且 resources/ 不在 asar 内，packaged 时该路径无效会清空图标，故 is.dev 守卫）
    if (is.dev && process.platform === 'darwin' && app.dock) app.dock.setIcon(appIcon)

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    migrateConfig() // 纠正 beta 早期残留的本地 serverURL（须在渲染层读取配置前执行）
    installCorsBypass()
    registerSecretsIpc()
    registerConfigIpc()
    registerMediaIpc()
    registerDesktopLyricsIpc()
    registerUpdateIpc()

    createMainWindow()
    createTray()
    restoreDesktopLyrics()

    // 启动几秒后静默检查更新（窗口已就绪，避免拖慢启动）
    setTimeout(() => void checkOnLaunch(), 4000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
