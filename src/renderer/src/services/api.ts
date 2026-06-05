import { http, rawPost } from './http'
import type {
  AuthResponse,
  ChartCard,
  Featured,
  PlaylistDetail,
  PlaylistMeta,
  Recommend,
  SearchResult,
  Song,
  UrlResult,
  User,
  Invite
} from '@/types'

/** 与 web-music-dist/server/index.js 一一对照的 API 方法。 */
export const api = {
  // ---- meta / config ----
  config: () => http.get<{ allowRegister: boolean; inviteRequired: boolean }>('/api/config'),

  // ---- auth ----
  login: (username: string, password: string) =>
    rawPost<AuthResponse>('/api/login', { username, password }),
  register: (username: string, password: string, inviteCode: string) =>
    rawPost<AuthResponse>('/api/register', { username, password, inviteCode }),
  me: () => http.get<{ user: User }>('/api/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    http.post<{ ok: true }>('/api/me/password', { oldPassword, newPassword }),

  // ---- platforms / sources ----
  platforms: () => http.get<{ platforms: string[] }>('/api/platforms'),
  sources: () =>
    http.get<{ sources: Array<{ id: string; name: string; ready: boolean; priority: number }> }>(
      '/api/sources'
    ),

  // ---- search ----
  search: (keyword: string, platform: string, page = 1, limit = 30) =>
    http.get<SearchResult>(
      `/api/search?keyword=${encodeURIComponent(keyword)}&platform=${encodeURIComponent(
        platform
      )}&page=${page}&limit=${limit}`
    ),
  searchHistory: () => http.get<{ history: string[] }>('/api/search/history'),
  removeSearchHistory: (keyword: string) =>
    http.del<{ history: string[] }>('/api/search/history?keyword=' + encodeURIComponent(keyword)),
  clearSearchHistory: () => http.del<{ history: string[] }>('/api/search/history'),

  // ---- resolve / lyric / pic ----
  resolveUrl: (musicInfo: Song, quality: string, sourceScript?: string) =>
    http.post<UrlResult>('/api/url', { musicInfo, quality, sourceScript: sourceScript || undefined }),
  lyric: (musicInfo: Song) =>
    http.post<{ lyric?: string; tlyric?: string }>('/api/lyric', { musicInfo }),
  pic: (musicInfo: Song) => http.post<{ pic?: string }>('/api/pic', { musicInfo }),

  // ---- discover ----
  featured: () => http.get<Featured>('/api/featured'),
  recommend: (force = false) =>
    http.get<Recommend>('/api/recommend' + (force ? '?force=1' : '')),
  shuffle: () => http.get<{ songs: Song[] }>('/api/shuffle'),

  // ---- history ----
  recordHistory: (song: Song) => http.post<{ ok: true }>('/api/history', { song }),

  // ---- playlists ----
  playlists: () => http.get<{ playlists: PlaylistMeta[] }>('/api/playlists'),
  playlist: (id: number | string) =>
    http.get<{ playlist: PlaylistDetail }>('/api/playlists/' + id),
  createPlaylist: (name: string) =>
    http.post<{ playlist: PlaylistMeta }>('/api/playlists', { name }),
  deletePlaylist: (id: number | string) => http.del<{ ok: true }>('/api/playlists/' + id),
  renamePlaylist: (id: number | string, name: string) =>
    http.post<{ playlist: PlaylistMeta }>('/api/playlists/' + id + '/rename', { name }),
  addToPlaylist: (id: number | string, song: Song) =>
    http.post<{ id: number; count: number }>('/api/playlists/' + id + '/songs', { song }),
  removeFromPlaylist: (id: number | string, key: string) =>
    http.del<{ id: number; count: number }>(
      '/api/playlists/' + id + '/songs?key=' + encodeURIComponent(key)
    ),

  // ---- queue ----
  getQueue: () => http.get<{ songs: Song[]; idx: number }>('/api/queue'),
  setQueue: (songs: Song[], idx: number) =>
    http.put<{ songs: Song[]; idx: number }>('/api/queue', { songs, idx }),

  // ---- admin ----
  adminUsers: () => http.get<{ users: User[] }>('/api/admin/users'),
  adminCreateUser: (username: string, password: string, isAdmin: boolean) =>
    http.post<{ user: User }>('/api/admin/users', { username, password, isAdmin }),
  adminDeleteUser: (id: number) => http.del<{ ok: true }>('/api/admin/users/' + id),
  adminResetPassword: (id: number, newPassword?: string) =>
    http.post<{ ok: true; password?: string }>(
      '/api/admin/users/' + id + '/password',
      newPassword ? { newPassword } : {}
    ),
  adminSetAdmin: (id: number, isAdmin: boolean) =>
    http.post<{ user: User }>('/api/admin/users/' + id + '/admin', { isAdmin }),
  adminInvites: () => http.get<{ invites: Invite[] }>('/api/admin/invites'),
  adminCreateInvite: (maxUses = 1) =>
    http.post<{ invite: Invite }>('/api/admin/invites', { maxUses }),
  adminDeleteInvite: (code: string) =>
    http.del<{ ok: true }>('/api/admin/invites/' + encodeURIComponent(code))
}

export type { ChartCard }
