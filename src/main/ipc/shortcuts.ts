import { app, ipcMain, globalShortcut } from 'electron'
import { getConfig } from './config'
import { getMainWindow } from '../windows/mainWindow'

/**
 * 全局系统级快捷键：按 config.shortcuts 注册 Electron globalShortcut，
 * 触发时把 action id 转发给主窗口渲染层（与应用内快捷键共用同一 runAction 分发）。
 * accelerator 字符串格式见渲染层 services/shortcuts.ts，直接兼容 globalShortcut。
 */
function sendShortcutAction(action: string): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send('pf:shortcut:action', action)
}

/**
 * 重新注册全部全局快捷键（先全清再按当前 config 注册）。
 * 返回注册失败的 action id 列表（被系统/其他应用占用、或 accelerator 非法），供 UI 标红。
 */
export function applyGlobalShortcuts(): string[] {
  globalShortcut.unregisterAll()
  const sc = getConfig().shortcuts
  if (!sc.enableGlobal) return []
  const failed: string[] = []
  for (const [action, bind] of Object.entries(sc.keys)) {
    const accel = bind?.global
    if (!accel) continue
    try {
      const ok = globalShortcut.register(accel, () => sendShortcutAction(action))
      if (!ok) failed.push(action)
    } catch {
      failed.push(action)
    }
  }
  return failed
}

export function registerShortcutsIpc(): void {
  ipcMain.handle('pf:shortcuts:apply', () => applyGlobalShortcuts())
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
