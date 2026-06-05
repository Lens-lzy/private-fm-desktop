import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { keyOf } from '@/services/songKey'
import type { LyricLine, Song } from '@/types'

const TS_RE = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g

/** 解析 LRC：支持一行多时间标签，按时间排序。 */
function parseLrc(lrc: string): { time: number; text: string }[] {
  const out: { time: number; text: string }[] = []
  for (const raw of lrc.split('\n')) {
    TS_RE.lastIndex = 0
    const stamps: number[] = []
    let m: RegExpExecArray | null
    while ((m = TS_RE.exec(raw))) {
      const frac = m[3] ? Number('0.' + m[3]) : 0
      stamps.push(Number(m[1]) * 60 + Number(m[2]) + frac)
    }
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    if (!text || !stamps.length) continue
    for (const t of stamps) out.push({ time: t, text })
  }
  return out.sort((a, b) => a.time - b.time)
}

/** 翻译轴按 10ms 量化为 key 的 map（移植 LRCParser.swift 的就近匹配）。 */
function buildTransMap(tlyric: string): Map<number, string> {
  const map = new Map<number, string>()
  for (const l of parseLrc(tlyric)) map.set(Math.round(l.time * 100), l.text)
  return map
}

function merge(lyric: string, tlyric?: string): LyricLine[] {
  const main = parseLrc(lyric || '')
  if (!tlyric) return main
  const tmap = buildTransMap(tlyric)
  return main.map((l) => {
    const tr = tmap.get(Math.round(l.time * 100))
    return tr && tr !== l.text ? { ...l, trans: tr } : l
  })
}

export const useLyricsStore = defineStore('lyrics', () => {
  const lines = ref<LyricLine[]>([])
  const currentIndex = ref(-1)
  const epoch = ref(0) // 每次换新歌词自增，供视图重置滚动
  const isLoading = ref(false)
  const lyricsKey = ref('')

  function reset(): void {
    lines.value = []
    currentIndex.value = -1
    lyricsKey.value = ''
    epoch.value++
  }

  async function load(song: Song): Promise<void> {
    const k = keyOf(song)
    if (k === lyricsKey.value) return // 同曲不重复拉取
    lyricsKey.value = k
    lines.value = []
    currentIndex.value = -1
    isLoading.value = true
    try {
      const r = await api.lyric(song)
      if (k !== lyricsKey.value) return // 期间已切歌
      lines.value = merge(r.lyric || '', r.tlyric)
      epoch.value++
    } catch {
      lines.value = []
    } finally {
      if (k === lyricsKey.value) isLoading.value = false
    }
  }

  /** 二分查找最后一个 time<=t 的歌词行（已排序）。 */
  function updateIndex(t: number): void {
    const arr = lines.value
    if (!arr.length) {
      if (currentIndex.value !== -1) currentIndex.value = -1
      return
    }
    let lo = 0
    let hi = arr.length - 1
    let res = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid].time <= t) {
        res = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if (res !== currentIndex.value) currentIndex.value = res
  }

  return { lines, currentIndex, epoch, isLoading, lyricsKey, reset, load, updateIndex }
})
