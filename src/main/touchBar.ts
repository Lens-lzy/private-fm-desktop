import { TouchBar } from 'electron'
import { sendMediaKey } from './ipc/media'
import { getMainWindow } from './windows/mainWindow'

/**
 * Touch Bar 歌词条：上一首 / 播放暂停 / 下一首 + 当前歌词文字。
 * 无 Touch Bar 的机器 setTouchBar 是空操作，安全。仅在「触控栏歌词」开启时挂载。
 */
const { TouchBarButton, TouchBarLabel, TouchBarSpacer } = TouchBar

let label: Electron.TouchBarLabel | null = null
let playBtn: Electron.TouchBarButton | null = null
let bar: TouchBar | null = null

function build(): TouchBar {
  label = new TouchBarLabel({ label: '♪ Private FM' })
  playBtn = new TouchBarButton({ label: '⏯', click: () => sendMediaKey('playpause') })
  return new TouchBar({
    items: [
      new TouchBarButton({ label: '⏮', click: () => sendMediaKey('prev') }),
      playBtn,
      new TouchBarButton({ label: '⏭', click: () => sendMediaKey('next') }),
      new TouchBarSpacer({ size: 'small' }),
      label
    ]
  })
}

/** 开/关 Touch Bar 歌词条。 */
export function applyTouchBar(on: boolean): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  if (!on) {
    win.setTouchBar(null)
    return
  }
  if (!bar) bar = build()
  win.setTouchBar(bar)
}

/** 更新 Touch Bar 上的歌词与播放/暂停图标。 */
export function updateTouchBar(line: string, playing: boolean): void {
  if (label) label.label = line || '♪ Private FM'
  if (playBtn) playBtn.label = playing ? '⏸' : '⏯'
}
