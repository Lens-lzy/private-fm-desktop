export interface DesktopLyricsPrefs {
  enabled: boolean
  twoLines: boolean
}

export type ThemeName = 'dark' | 'light'

export interface AppConfig {
  serverURL: string
  quality: string
  theme: ThemeName
  desktopLyrics: DesktopLyricsPrefs
}

export interface LyricPushPayload {
  cur: string
  next: string
  playing: boolean
}

export interface UpdateInfo {
  current: string
  latest: string
  notes: string
  zipUrl: string
  dmgUrl: string
  hasUpdate: boolean
}

export interface UpdateProgress {
  percent: number
  received?: number
  total?: number
  phase?: string
}
export interface UpdateError {
  message: string
  dmgUrl?: string
}

export interface PFBridge {
  secrets: {
    getToken: () => Promise<string>
    setToken: (token: string) => Promise<void>
    clearToken: () => Promise<void>
  }
  config: {
    getAll: () => Promise<AppConfig>
    set: (patch: Partial<AppConfig>) => Promise<AppConfig>
  }
  desktopLyrics: {
    toggle: () => Promise<boolean>
    setEnabled: (on: boolean) => Promise<boolean>
    isShowing: () => Promise<boolean>
    push: (payload: LyricPushPayload) => void
    onStateChanged: (cb: (on: boolean) => void) => void
  }
  media: {
    onMediaKey: (cb: (cmd: string) => void) => void
  }
  app: {
    getVersion: () => Promise<string>
  }
  updates: {
    check: () => Promise<UpdateInfo | null>
    downloadAndInstall: () => Promise<void>
    skip: (version: string) => Promise<boolean>
    openManual: (url: string) => Promise<void>
    onAvailable: (cb: (info: UpdateInfo) => void) => void
    onProgress: (cb: (p: UpdateProgress) => void) => void
    onError: (cb: (e: UpdateError) => void) => void
  }
}

/** 桌面歌词窗口的桥（desktop-lyrics.html 用）。 */
export interface PFLyricsBridge {
  onLyric: (cb: (payload: { cur: string; next: string; playing: boolean; twoLines: boolean }) => void) => void
  sendControl: (cmd: string) => void
  dragStart: () => void
  dragMove: (dx: number, dy: number) => void
  resizeStart: () => void
  resizeMove: (dx: number, dy: number) => void
  setIgnore: (ignore: boolean) => void
}

declare global {
  interface Window {
    pf: PFBridge
    pfLyrics: PFLyricsBridge
  }
}

export {}
