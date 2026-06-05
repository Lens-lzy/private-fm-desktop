/**
 * Song 是「保真透传」对象：搜索返回的整条原始字段必须原样保存、原样回传
 * （含 hash / _interval 等），取链/歌词/封面/歌单/队列都直接回传整条。
 * 因此用宽松的索引签名 + 已知字段，绝不裁字段重建。
 */
export interface Song {
  source: string
  name?: string
  singer?: string
  albumName?: string
  album?: string
  img?: string
  songmid?: string | number
  songId?: string | number
  hash?: string
  interval?: string
  _interval?: number
  [key: string]: unknown
}

export interface User {
  id: number
  username: string
  isAdmin: boolean
  isSuper?: boolean
  mustChangePassword?: boolean
  createdAt?: string
}

export interface InviteUse {
  username: string
  at: string
}

export interface Invite {
  code: string
  createdBy: string
  createdAt: string
  maxUses: number
  useCount: number
  remaining: number
  used: boolean
  uses: InviteUse[]
  usedBy?: string | null
}

export interface PlaylistMeta {
  id: number
  name: string
  isDefault: boolean
  count: number
  createdAt?: string
}

export interface PlaylistDetail {
  id: number
  name: string
  isDefault: boolean
  createdAt?: string
  songs: Song[]
}

export interface ChartCard {
  key: string
  title: string
  desc?: string
  source?: string
  songs: Song[]
}

export interface Featured {
  updatedAt: number
  cards: ChartCard[]
}

export interface Recommend {
  day: string
  daily: Song[]
  cards: ChartCard[]
}

export interface LyricLine {
  time: number
  text: string
  trans?: string
}

export interface SearchResult {
  list: Song[]
  total?: number
  [key: string]: unknown
}

export interface UrlResult {
  url?: string
  proxied: string
  sourceScript?: string
  validated?: boolean
  warning?: string
  detail?: unknown
}

export interface AuthResponse {
  token: string
  user: User
}

export type RepeatMode = 'off' | 'all' | 'one'

export type Quality = '128k' | '320k' | 'flac'

export interface DesktopLyricsPrefs {
  enabled: boolean
  twoLines: boolean
}

export type ThemeName = 'dark' | 'light'

/** 主进程 electron-store 的运行时配置（结构与 preload AppConfig 一致）。 */
export interface RuntimeConfig {
  serverURL: string
  quality: string
  theme: ThemeName
  desktopLyrics: DesktopLyricsPrefs
}
