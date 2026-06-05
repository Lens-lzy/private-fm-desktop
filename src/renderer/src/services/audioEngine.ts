/**
 * 单例 HTML5 <audio> 引擎：渲染层实际播放音频的唯一出口。
 * 不在 DOM 树中（new Audio()），事件通过 handlers 回调给 player store。
 * 不 import 任何 store，避免循环依赖。
 */
export interface AudioHandlers {
  onTime?: (t: number) => void
  onDuration?: (d: number) => void
  onEnded?: () => void
  onPlay?: () => void
  onPause?: () => void
  onError?: () => void
}

const audio = new Audio()
audio.preload = 'auto'

let handlers: AudioHandlers = {}
let hasSource = false

audio.addEventListener('timeupdate', () => handlers.onTime?.(audio.currentTime))
// 传原始 duration（可能是 NaN/Infinity，比如不报时长的代理流）；由 store 决定是否采用
audio.addEventListener('durationchange', () => handlers.onDuration?.(audio.duration))
audio.addEventListener('loadedmetadata', () => handlers.onDuration?.(audio.duration))
audio.addEventListener('ended', () => handlers.onEnded?.())
audio.addEventListener('play', () => handlers.onPlay?.())
audio.addEventListener('playing', () => handlers.onPlay?.())
audio.addEventListener('pause', () => handlers.onPause?.())

export const audioEngine = {
  setHandlers(h: AudioHandlers): void {
    handlers = h
  },
  load(url: string): void {
    audio.src = url
    hasSource = true
  },
  play(): Promise<void> {
    return audio.play()
  },
  pause(): void {
    audio.pause()
  },
  seek(t: number): void {
    try {
      audio.currentTime = t
    } catch {
      /* metadata 未就绪时忽略 */
    }
  },
  setVolume(v: number): void {
    audio.volume = Math.max(0, Math.min(1, v))
  },
  clear(): void {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    hasSource = false
  },
  hasSrc(): boolean {
    return hasSource
  },
  /** 给 M3 可视化用：暴露底层元素以接入 Web Audio AnalyserNode。 */
  get element(): HTMLAudioElement {
    return audio
  }
}
