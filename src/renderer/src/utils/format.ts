import type { Song } from '@/types'

/** 秒 → mm:ss */
export function fmtTime(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return '00:00'
  const s = Math.floor(sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 歌曲时长展示：优先 interval 字符串（mm:ss），否则用 _interval 秒数。 */
export function songDuration(song: Song | null | undefined): string {
  if (!song) return ''
  if (typeof song.interval === 'string' && song.interval.includes(':')) return song.interval
  if (typeof song._interval === 'number' && song._interval > 0) return fmtTime(song._interval)
  return ''
}

export function songSinger(song: Song | null | undefined): string {
  return (song?.singer as string) || ''
}

export function songAlbum(song: Song | null | undefined): string {
  return (song?.albumName as string) || (song?.album as string) || ''
}

const PLATFORM_NAMES: Record<string, string> = {
  kw: '酷我',
  kg: '酷狗',
  tx: 'QQ音乐',
  wy: '网易云',
  mg: '咪咕'
}
export function platformName(p: string): string {
  return PLATFORM_NAMES[p] || p
}
