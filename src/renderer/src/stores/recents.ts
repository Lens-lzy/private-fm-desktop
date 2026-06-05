import { defineStore } from 'pinia'
import { ref } from 'vue'
import { keyOf } from '@/services/songKey'
import type { Song } from '@/types'

const KEY = 'pf.recents'
const MAX = 60

function read(): Song[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** 最近播放：本地存储（localStorage，设备级），最多 60 首。对齐 Swift RecentStore。 */
export const useRecentsStore = defineStore('recents', () => {
  const list = ref<Song[]>(read())

  function add(song: Song): void {
    if (!song) return
    const k = keyOf(song)
    const arr = list.value.filter((s) => keyOf(s) !== k)
    arr.unshift(song)
    if (arr.length > MAX) arr.length = MAX
    list.value = arr
    localStorage.setItem(KEY, JSON.stringify(arr))
  }

  function clear(): void {
    list.value = []
    localStorage.removeItem(KEY)
  }

  return { list, add, clear }
})
