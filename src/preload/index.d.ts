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
  top: string // 上行（双行对句的偶数句；单行模式下若 activeRow=0 即为正在唱的句）
  bottom: string // 下行（对句的奇数句；单行模式留空）
  activeRow: number // 0=上行正在唱，1=下行正在唱
  start: number // 当前句开始时间(s)
  end: number // 当前句结束时间(s)，<=start 表示无有效时长
  pos: number // 推送时刻的播放位置(s)，供窗口侧锚定扫光
  playing: boolean
}

/** 主进程注入 twoLines 后下发给桌面歌词窗口的载荷。 */
export interface LyricRenderPayload extends LyricPushPayload {
  twoLines: boolean
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
  onLyric: (cb: (payload: LyricRenderPayload) => void) => void
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
