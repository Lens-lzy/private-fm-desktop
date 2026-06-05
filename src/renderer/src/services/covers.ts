import { api } from './api'
import { keyOf } from './songKey'
import { DEFAULT_COVER, imageURLFromRaw } from './urls'
import type { Song } from '@/types'

/** 按 songKey 缓存原始封面 URL；inflight 去重，避免重复打音源。 */
const rawCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

/**
 * 解析一首歌的封面（代理后）URL。
 * 优先 song.img；缺失时调 /api/pic 并缓存。返回可直接用于 <img src> 的地址。
 */
export async function resolveCover(song: Song | null | undefined): Promise<string> {
  if (!song) return DEFAULT_COVER
  if (typeof song.img === 'string' && song.img) return imageURLFromRaw(song.img)

  const k = keyOf(song)
  if (rawCache.has(k)) {
    const raw = rawCache.get(k) || ''
    return raw ? imageURLFromRaw(raw) : DEFAULT_COVER
  }
  if (inflight.has(k)) {
    const raw = await inflight.get(k)!
    return raw ? imageURLFromRaw(raw) : DEFAULT_COVER
  }

  const p = api
    .pic(song)
    .then((r) => r.pic || '')
    .catch(() => '')
  inflight.set(k, p)
  const raw = await p
  inflight.delete(k)
  rawCache.set(k, raw)
  return raw ? imageURLFromRaw(raw) : DEFAULT_COVER
}
