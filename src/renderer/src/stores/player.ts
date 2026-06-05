import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { audioEngine } from '@/services/audioEngine'
import { api } from '@/services/api'
import { audioURL } from '@/services/urls'
import { keyOf, sameSong } from '@/services/songKey'
import { useLyricsStore } from './lyrics'
import { useUiStore } from './ui'
import { useSettingsStore } from './settings'
import { useRecentsStore } from './recents'
import type { RepeatMode, Song } from '@/types'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * 从歌曲元数据估算时长（秒）：优先 `_interval`，回退 `interval` 的 "mm:ss"。
 * 用于音源尚未加载（恢复/暂停态）时，进度条仍有可用的 max、点击歌词跳转能反映到进度条。
 */
function songDur(s: Song | null): number {
  if (!s) return 0
  const n = Number((s as Record<string, unknown>)._interval)
  if (Number.isFinite(n) && n > 0) return n
  const iv = (s as Record<string, unknown>).interval
  if (typeof iv === 'string') {
    const m = /^(\d+):(\d{2})$/.exec(iv)
    if (m) return Number(m[1]) * 60 + Number(m[2])
  }
  return 0
}

const VOL_KEY = 'pf.volume'
/** 音量持久化（设备级 localStorage），避免每次启动重置。 */
function readVolume(): number {
  const v = Number(localStorage.getItem(VOL_KEY))
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.8
}

const LAST_POS_KEY = 'pf.lastpos'
/** 记住上次播放进度：按歌曲 key 存最后位置（设备级 localStorage）。 */
function saveLastPos(key: string, t: number): void {
  if (!key || !(t > 1)) return
  try {
    localStorage.setItem(LAST_POS_KEY, JSON.stringify({ key, t }))
  } catch {
    /* ignore */
  }
}
function readLastPos(key: string): number {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_POS_KEY) || 'null')
    return v && v.key === key && typeof v.t === 'number' ? v.t : 0
  } catch {
    return 0
  }
}

export const usePlayerStore = defineStore('player', () => {
  const lyrics = useLyricsStore()
  const ui = useUiStore()
  const settings = useSettingsStore()
  const recents = useRecentsStore()

  const queue = ref<Song[]>([])
  const index = ref(-1)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(readVolume())
  const repeatMode = ref<RepeatMode>('off')
  const shuffle = ref(false)
  const isLoadingTrack = ref(false)
  const statusMessage = ref('')

  // 睡眠定时（M4 接 UI；这里先放状态与判定）
  const sleepUntil = ref<number | null>(null)
  const sleepAfterCurrent = ref(false)
  let sleepTimer: ReturnType<typeof setTimeout> | undefined

  let playToken = 0
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  let posTick = 0 // onTime 节流计数，约每 5 秒存一次播放进度

  const current = computed<Song | null>(() =>
    index.value >= 0 && index.value < queue.value.length ? queue.value[index.value] : null
  )
  const count = computed(() => queue.value.length)

  // ---- 持久化 ----
  function persistQueue(): void {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      void api.setQueue(queue.value, index.value).catch(() => {})
    }, 500)
  }

  /** 登录后恢复队列为暂停态（不自动播放）。 */
  async function restoreQueue(): Promise<void> {
    try {
      const q = await api.getQueue()
      if (q.songs && q.songs.length) {
        queue.value = q.songs
        index.value = q.idx >= 0 && q.idx < q.songs.length ? q.idx : 0
        const c = current.value
        if (c) {
          lyrics.load(c)
          duration.value = songDur(c) // 进度条 max 可用（音源尚未加载）
          // 记住上次进度：恢复 currentTime，播放时 loadAndPlay 的 startAt 会从此处续播
          const pos = settings.playback.resume ? readLastPos(keyOf(c)) : 0
          currentTime.value = pos > 1 ? pos : 0
          lyrics.updateIndex(currentTime.value)
          // 启动自动播放（默认关；开启则从续播位置开始播）
          if (settings.playback.autoplay) void loadAndPlay(index.value)
        }
      }
    } catch {
      /* 恢复失败静默 */
    }
  }

  // ---- 取链与播放（移植 app.js playAt + Swift 重试）----
  async function loadAndPlay(idx: number, attempt = 0): Promise<void> {
    if (idx < 0 || idx >= queue.value.length) return
    const prevKey = keyOf(current.value)
    const wasUnloaded = !audioEngine.hasSrc()
    index.value = idx
    persistQueue()
    const s = queue.value[idx]
    if (keyOf(s) !== prevKey) {
      lyrics.reset()
      currentTime.value = 0
      duration.value = songDur(s) // 先用元数据时长，metadata 就绪后由 onDuration 校准
    }
    // 恢复/暂停态下点歌词跳转后再按播放：从跳转位置续播（仅同曲、且此前未加载音源）
    const startAt = wasUnloaded && keyOf(s) === prevKey ? currentTime.value : 0
    const tk = ++playToken
    statusMessage.value = ''
    isLoadingTrack.value = true
    try {
      const r = await api.resolveUrl(s, settings.audioQuality)
      if (tk !== playToken) return // 已切到别的歌
      audioEngine.load(audioURL(r))
      await audioEngine.play()
      if (startAt > 0.5) audioEngine.seek(startAt) // 续播到之前跳转的位置
    } catch (e) {
      if (tk !== playToken) return
      if (attempt === 0) {
        statusMessage.value = `「${s.name ?? ''}」加载较慢，重试中…`
        await delay(600)
        if (tk !== playToken) return
        return loadAndPlay(idx, 1)
      }
      isLoadingTrack.value = false
      statusMessage.value = ''
      ui.toast(`「${s.name ?? ''}」暂时无法播放，已跳到下一首`)
      if (queue.value.length > 1) next(true)
      return
    }
    isLoadingTrack.value = false
    statusMessage.value = ''
    if (settings.playback.syncRecents) void api.recordHistory(s).catch(() => {})
    recents.add(s)
    lyrics.load(s)
  }

  // ---- 队列操作 ----
  /** 用 list 作为队列，从 song 开始播（app.js replaceQueueAndPlay）。 */
  function playInList(song: Song, list: Song[]): void {
    const q = (list && list.length ? list : [song]).slice()
    const i = q.findIndex((x) => sameSong(x, song))
    queue.value = q
    index.value = i >= 0 ? i : 0
    persistQueue()
    void loadAndPlay(index.value)
  }

  function playList(list: Song[], start = 0): void {
    if (!list.length) return
    queue.value = list.slice()
    index.value = start >= 0 && start < list.length ? start : 0
    persistQueue()
    void loadAndPlay(index.value)
  }

  /** 只播这一首：插到队首并立即播（app.js playOneNow）。 */
  function playNow(song: Song): void {
    const key = keyOf(song)
    const existing = queue.value.findIndex((x) => keyOf(x) === key)
    if (existing >= 0) queue.value.splice(existing, 1)
    queue.value.unshift(song)
    index.value = 0
    persistQueue()
    void loadAndPlay(0)
  }

  /** 下一首播放：插到当前曲之后（app.js playNext）。 */
  function playNext(song: Song): void {
    const key = keyOf(song)
    const existing = queue.value.findIndex((x) => keyOf(x) === key)
    if (existing >= 0) {
      if (existing <= index.value) index.value--
      queue.value.splice(existing, 1)
    }
    const at = index.value >= 0 ? index.value + 1 : queue.value.length
    queue.value.splice(at, 0, song)
    if (index.value < 0) {
      index.value = 0
      persistQueue()
      void loadAndPlay(0)
      return
    }
    persistQueue()
  }

  function addToEnd(song: Song): void {
    const key = keyOf(song)
    if (queue.value.some((x) => keyOf(x) === key)) return
    queue.value.push(song)
    persistQueue()
  }

  /** 拖拽重排：保持当前曲指针跟随（Swift moveQueueItem）。 */
  function moveItem(from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || from >= queue.value.length || to >= queue.value.length)
      return
    const curKey = keyOf(current.value)
    const [item] = queue.value.splice(from, 1)
    queue.value.splice(to, 0, item)
    const ni = queue.value.findIndex((x) => keyOf(x) === curKey)
    if (ni >= 0) index.value = ni
    persistQueue()
  }

  /** 移除队列中某项；若是当前曲则跳播（app.js removeFromQueue）。 */
  function removeAt(idx: number): void {
    if (idx < 0 || idx >= queue.value.length) return
    const wasCurrent = idx === index.value
    queue.value.splice(idx, 1)
    if (queue.value.length === 0) {
      index.value = -1
      audioEngine.clear()
      isPlaying.value = false
      lyrics.reset()
      currentTime.value = 0
      duration.value = 0
      persistQueue()
      return
    }
    if (idx < index.value) index.value--
    else if (wasCurrent) {
      if (index.value >= queue.value.length) index.value = 0
      void loadAndPlay(index.value)
    }
    persistQueue()
  }

  function clearQueue(): void {
    audioEngine.clear()
    queue.value = []
    index.value = -1
    isPlaying.value = false
    lyrics.reset()
    currentTime.value = 0
    duration.value = 0
    persistQueue()
  }

  function jump(idx: number): void {
    void loadAndPlay(idx)
  }

  // ---- 上一首 / 下一首 ----
  function randomIndex(): number {
    if (queue.value.length <= 1) return index.value
    let i = index.value
    while (i === index.value) i = Math.floor(Math.random() * queue.value.length)
    return i
  }

  function next(auto = false): void {
    if (!queue.value.length) return
    if (shuffle.value) {
      void loadAndPlay(randomIndex())
      return
    }
    let i = index.value + 1
    if (i >= queue.value.length) {
      if (auto && repeatMode.value !== 'all') {
        audioEngine.pause()
        return
      }
      i = 0
    }
    void loadAndPlay(i)
  }

  function prev(): void {
    if (!queue.value.length) return
    if (currentTime.value > 3) {
      audioEngine.seek(0)
      lyrics.updateIndex(0)
      return
    }
    if (shuffle.value) {
      void loadAndPlay(randomIndex())
      return
    }
    let i = index.value - 1
    if (i < 0) i = queue.value.length - 1
    void loadAndPlay(i)
  }

  function handleEnd(): void {
    if (sleepAfterCurrent.value) {
      sleepAfterCurrent.value = false
      audioEngine.pause()
      return
    }
    if (repeatMode.value === 'one') {
      audioEngine.seek(0)
      void audioEngine.play()
      return
    }
    next(true)
  }

  // ---- 播放控制 ----
  function togglePlay(): void {
    if (!audioEngine.hasSrc()) {
      if (queue.value.length && index.value >= 0) void loadAndPlay(index.value)
      return
    }
    if (isPlaying.value) audioEngine.pause()
    else void audioEngine.play()
  }

  function seek(t: number): void {
    audioEngine.seek(t)
    currentTime.value = t
    lyrics.updateIndex(t)
  }

  function setVolume(v: number): void {
    volume.value = v
    audioEngine.setVolume(v)
    try {
      localStorage.setItem(VOL_KEY, String(v))
    } catch {
      /* ignore */
    }
  }

  function cycleRepeat(): void {
    repeatMode.value =
      repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off'
  }

  function toggleShuffle(): void {
    shuffle.value = !shuffle.value
  }

  // ---- 睡眠定时（基础，M4 接 UI）----
  function setSleepTimer(minutes: number): void {
    cancelSleepTimer()
    sleepAfterCurrent.value = false
    sleepUntil.value = Date.now() + minutes * 60000
    sleepTimer = setTimeout(() => {
      audioEngine.pause()
      sleepUntil.value = null
    }, minutes * 60000)
  }
  function setSleepAfterCurrentTrack(): void {
    cancelSleepTimer()
    sleepAfterCurrent.value = true
  }
  function cancelSleepTimer(): void {
    if (sleepTimer) clearTimeout(sleepTimer)
    sleepTimer = undefined
    sleepUntil.value = null
    sleepAfterCurrent.value = false
  }

  function reset(): void {
    clearQueue()
    cancelSleepTimer()
    repeatMode.value = 'off'
    shuffle.value = false
  }

  // ---- 绑定音频引擎事件 ----
  audioEngine.setHandlers({
    onTime: (t) => {
      currentTime.value = t
      lyrics.updateIndex(t)
      if (++posTick >= 20) {
        posTick = 0
        saveLastPos(keyOf(current.value), t) // 节流存进度，供下次启动续播
      }
    },
    onDuration: (d) => {
      // 仅采用有效时长；流不报时长（NaN/Infinity）时保留 _interval 兜底，避免进度条 max 被清零
      if (Number.isFinite(d) && d > 0) duration.value = d
    },
    onEnded: handleEnd,
    onPlay: () => {
      isPlaying.value = true
    },
    onPause: () => {
      isPlaying.value = false
      saveLastPos(keyOf(current.value), currentTime.value) // 暂停即存进度
    }
  })
  audioEngine.setVolume(volume.value)

  return {
    queue,
    index,
    isPlaying,
    currentTime,
    duration,
    volume,
    repeatMode,
    shuffle,
    isLoadingTrack,
    statusMessage,
    sleepUntil,
    sleepAfterCurrent,
    current,
    count,
    restoreQueue,
    loadAndPlay,
    playInList,
    playList,
    playNow,
    playNext,
    addToEnd,
    moveItem,
    removeAt,
    clearQueue,
    jump,
    next,
    prev,
    togglePlay,
    seek,
    setVolume,
    cycleRepeat,
    toggleShuffle,
    setSleepTimer,
    setSleepAfterCurrentTrack,
    cancelSleepTimer,
    reset
  }
})
