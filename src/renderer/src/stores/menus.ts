import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Song } from '@/types'

interface CtxState {
  open: boolean
  song: Song | null
  list: Song[]
  x: number
  y: number
}
interface AddState {
  open: boolean
  song: Song | null
  x: number
  y: number
}
interface ReplaceState {
  open: boolean
  song: Song | null
  list: Song[]
  label: string
}

/** 右键菜单 / 加入歌单浮层 / 替换队列确认弹窗 的全局状态。 */
export const useMenusStore = defineStore('menus', () => {
  const ctx = ref<CtxState>({ open: false, song: null, list: [], x: 0, y: 0 })
  const add = ref<AddState>({ open: false, song: null, x: 0, y: 0 })
  const replace = ref<ReplaceState>({ open: false, song: null, list: [], label: '' })

  function openCtx(song: Song, list: Song[], ev: MouseEvent): void {
    ctx.value = { open: true, song, list: (list || []).slice(), x: ev.clientX, y: ev.clientY }
    add.value.open = false
  }
  function openAdd(song: Song, ev: MouseEvent): void {
    add.value = { open: true, song, x: ev.clientX, y: ev.clientY }
    ctx.value.open = false
  }
  function openReplace(song: Song, list: Song[], label: string): void {
    replace.value = { open: true, song, list: (list || []).slice(), label }
  }
  function closeMenus(): void {
    ctx.value.open = false
    add.value.open = false
  }
  function closeReplace(): void {
    replace.value.open = false
  }

  return { ctx, add, replace, openCtx, openAdd, openReplace, closeMenus, closeReplace }
})
