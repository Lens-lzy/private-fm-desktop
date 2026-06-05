import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 全局 UI 状态：轻提示 toast、正在播放浮层、队列面板开关。 */
export const useUiStore = defineStore('ui', () => {
  const toastMsg = ref('')
  const nowPlayingOpen = ref(false)
  const queueOpen = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function toast(msg: string): void {
    toastMsg.value = msg
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (toastMsg.value = ''), 3000)
  }

  function toggleNowPlaying(): void {
    nowPlayingOpen.value = !nowPlayingOpen.value
  }
  function openNowPlaying(): void {
    nowPlayingOpen.value = true
  }
  function closeNowPlaying(): void {
    nowPlayingOpen.value = false
  }
  function toggleQueue(): void {
    queueOpen.value = !queueOpen.value
  }

  return {
    toastMsg,
    nowPlayingOpen,
    queueOpen,
    toast,
    toggleNowPlaying,
    openNowPlaying,
    closeNowPlaying,
    toggleQueue
  }
})
