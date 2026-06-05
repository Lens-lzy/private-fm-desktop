import { contextBridge, ipcRenderer } from 'electron'

/**
 * 窄接口桥：只把白名单 IPC 暴露给渲染层，不暴露 ipcRenderer 原体。
 */
const api = {
  secrets: {
    getToken: (): Promise<string> => ipcRenderer.invoke('pf:secrets:get-token'),
    setToken: (token: string): Promise<void> => ipcRenderer.invoke('pf:secrets:set-token', token),
    clearToken: (): Promise<void> => ipcRenderer.invoke('pf:secrets:clear-token')
  },
  config: {
    getAll: (): Promise<unknown> => ipcRenderer.invoke('pf:config:get-all'),
    set: (patch: unknown): Promise<unknown> => ipcRenderer.invoke('pf:config:set', patch)
  },
  desktopLyrics: {
    toggle: (): Promise<boolean> => ipcRenderer.invoke('pf:dl:toggle'),
    setEnabled: (on: boolean): Promise<boolean> => ipcRenderer.invoke('pf:dl:set-enabled', on),
    isShowing: (): Promise<boolean> => ipcRenderer.invoke('pf:dl:is-showing'),
    push: (payload: { cur: string; next: string; playing: boolean }): void =>
      ipcRenderer.send('pf:dl:push', payload),
    // 主进程在浮窗开/关时回推状态，供「词」按钮同步
    onStateChanged: (cb: (on: boolean) => void): void => {
      ipcRenderer.removeAllListeners('pf:dl:state')
      ipcRenderer.on('pf:dl:state', (_e, on: boolean) => cb(!!on))
    }
  },
  media: {
    onMediaKey: (cb: (cmd: string) => void): void => {
      ipcRenderer.removeAllListeners('pf:media:key')
      ipcRenderer.on('pf:media:key', (_e, cmd: string) => cb(cmd))
    }
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('pf:app:version')
  },
  updates: {
    check: (): Promise<unknown> => ipcRenderer.invoke('pf:updates:check'),
    downloadAndInstall: (): Promise<void> => ipcRenderer.invoke('pf:updates:download'),
    skip: (version: string): Promise<boolean> => ipcRenderer.invoke('pf:updates:skip', version),
    openManual: (url: string): Promise<void> => ipcRenderer.invoke('pf:updates:open-manual', url),
    onAvailable: (cb: (info: unknown) => void): void => {
      ipcRenderer.removeAllListeners('pf:update:available')
      ipcRenderer.on('pf:update:available', (_e, info) => cb(info))
    },
    onProgress: (cb: (p: unknown) => void): void => {
      ipcRenderer.removeAllListeners('pf:update:progress')
      ipcRenderer.on('pf:update:progress', (_e, p) => cb(p))
    },
    onError: (cb: (e: unknown) => void): void => {
      ipcRenderer.removeAllListeners('pf:update:error')
      ipcRenderer.on('pf:update:error', (_e, err) => cb(err))
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('pf', api)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(globalThis as unknown as { pf: typeof api }).pf = api
}
