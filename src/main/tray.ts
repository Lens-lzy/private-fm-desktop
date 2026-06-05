import { Tray, Menu, nativeImage, app } from 'electron'
import { getMainWindow } from './windows/mainWindow'
import { sendMediaKey } from './ipc/media'
import { isDesktopLyricsShowing, toggleDesktopLyrics } from './ipc/desktopLyrics'

// 内嵌托盘模板图（音符），dev / 打包态零路径依赖。macOS 自动按菜单栏着色。
const TRAY_1X =
  'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAO0lEQVR4nGNgGAWDEfzHgWliMFUATQxFN5iqgOoGjlCD8SUpsg3GlQEoTg0DZjDZYEAMpgqgWZkwwgAAkx1IuGCe5lwAAAAASUVORK5CYII='
const TRAY_2X =
  'iVBORw0KGgoAAAANSUhEUgAAACwAAAAsCAYAAAAehFoBAAAAbklEQVR4nO3WMQoAIQxE0bn/pbVasFgQWbPJ6P+QUnhVokRERFSotjAlssLqVHCprLByw8oNKzesnKBPgKMDHB3gr4jZnk0Fr/xt28ub0tjUC7cDCzgaCzga/FtW2F1oK3BaVtgxK+yYDZSIbqsDpLkp5d84HQwAAAAASUVORK5CYII='

let tray: Tray | null = null

function buildIcon(): Electron.NativeImage {
  const img = nativeImage.createFromDataURL('data:image/png;base64,' + TRAY_1X)
  img.addRepresentation({
    scaleFactor: 2,
    dataURL: 'data:image/png;base64,' + TRAY_2X
  })
  img.setTemplateImage(true)
  return img
}

function showMain(): void {
  const win = getMainWindow()
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

function buildMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    { label: '显示主窗口', click: showMain },
    { type: 'separator' },
    { label: '播放 / 暂停', click: () => sendMediaKey('playpause') },
    { label: '上一首', click: () => sendMediaKey('prev') },
    { label: '下一首', click: () => sendMediaKey('next') },
    { type: 'separator' },
    {
      label: '桌面歌词',
      type: 'checkbox',
      checked: isDesktopLyricsShowing(),
      click: () => {
        toggleDesktopLyrics()
        refreshMenu()
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
}

function refreshMenu(): void {
  if (tray) tray.setContextMenu(buildMenu())
}

export function createTray(): void {
  if (tray) return
  tray = new Tray(buildIcon())
  tray.setToolTip('Private FM')
  tray.setContextMenu(buildMenu())
  // 左键点击图标也能呼出菜单 / 显示主窗口
  tray.on('click', showMain)
}
