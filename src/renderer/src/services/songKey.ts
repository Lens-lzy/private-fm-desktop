import type { Song } from '@/types'

/**
 * 歌曲唯一键 —— 单一真源。前后端 / Swift 三处必须逐字一致：
 *   source + ':' + (songmid || songId || name + singer)
 * 用于收藏去重、队列定位、移除、当前曲比对。
 */
export function keyOf(s: Song | null | undefined): string {
  if (!s) return ''
  const id = s.songmid || s.songId || `${s.name ?? ''}${s.singer ?? ''}`
  return `${s.source ?? ''}:${id}`
}

export function sameSong(a: Song | null | undefined, b: Song | null | undefined): boolean {
  return !!a && !!b && keyOf(a) === keyOf(b)
}
