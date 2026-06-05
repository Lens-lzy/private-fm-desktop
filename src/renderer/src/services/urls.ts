import { serverURL, token } from './session'
import type { Song, UrlResult } from '@/types'

/** 默认封面占位（无图时用，移植自 app.js defaultCover）。 */
export const DEFAULT_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#222"/><text x="60" y="70" font-size="44" text-anchor="middle" fill="#555">♪</text></svg>'
  )

/**
 * 音频播放地址：serverURL + resp.proxied + &token=...
 * proxied 已含 `?url=`，故 token 用 `&` 追加（对齐 app.js:473）。
 */
export function audioURL(resp: UrlResult): string {
  const t = token()
  return serverURL() + resp.proxied + (t ? '&token=' + encodeURIComponent(t) : '')
}

/** 封面图地址：走图片代理，带 token query（对齐 app.js:362）。无图返回默认占位。 */
export function imageURL(song: Song | null | undefined): string {
  const raw = song?.img
  if (!raw || typeof raw !== 'string') return DEFAULT_COVER
  const t = token()
  return (
    serverURL() +
    '/api/proxy/img?token=' +
    encodeURIComponent(t) +
    '&url=' +
    encodeURIComponent(raw)
  )
}

/** 由原始图片 URL 直接构造代理地址（封面已知 raw url 时用）。 */
export function imageURLFromRaw(raw: string): string {
  if (!raw) return DEFAULT_COVER
  const t = token()
  return (
    serverURL() + '/api/proxy/img?token=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(raw)
  )
}
