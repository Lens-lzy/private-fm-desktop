import { defineStore } from 'pinia'
import { ref } from 'vue'

interface UInfo {
  current: string
  latest: string
  notes: string
  zipUrl: string
  dmgUrl: string
  hasUpdate: boolean
}

/** 桌面 App 自动更新的弹窗状态机：available → downloading → (退出重启) / error 兜底。 */
export const useUpdatesStore = defineStore('updates', () => {
  const phase = ref<'idle' | 'available' | 'downloading' | 'error'>('idle')
  const info = ref<UInfo | null>(null)
  const percent = ref(0)
  const errorMsg = ref('')
  const errorDmg = ref('')
  /** 是否有可用新版（红点用）：与弹窗 phase 解耦，关掉弹窗后红点仍在，直到跳过/装好。 */
  const available = ref(false)
  let promptedVersion = '' // 已自动弹过窗的版本，避免半天一次的轮询反复弹窗

  /** 注册主进程事件监听（AppShell 启动时调用一次）。 */
  function bind(): void {
    window.pf.updates.onAvailable((i) => {
      const inf = i as UInfo
      info.value = inf
      available.value = !!inf.hasUpdate
      // 同一版本只自动弹一次窗；后续定时检查只刷新红点
      if (inf.latest && inf.latest !== promptedVersion) {
        phase.value = 'available'
        promptedVersion = inf.latest
      }
    })
    window.pf.updates.onProgress((p) => {
      const pp = p as { percent: number; phase?: string }
      phase.value = 'downloading'
      percent.value = pp.phase === 'extracting' ? 100 : pp.percent ?? 0
    })
    window.pf.updates.onError((e) => {
      const ee = e as { message: string; dmgUrl?: string }
      phase.value = 'error'
      errorMsg.value = ee.message || '更新失败'
      errorDmg.value = ee.dmgUrl || info.value?.dmgUrl || ''
    })
  }

  /** 设置页手动检查到新版时调用，复用同一弹窗。 */
  function prompt(i: UInfo): void {
    info.value = i
    available.value = !!i.hasUpdate
    phase.value = 'available'
    promptedVersion = i.latest
  }
  function start(): void {
    phase.value = 'downloading'
    percent.value = 0
    void window.pf.updates.downloadAndInstall()
  }
  function skip(): void {
    if (info.value) void window.pf.updates.skip(info.value.latest)
    available.value = false // 跳过此版本 → 红点消失
    close()
  }
  function later(): void {
    close()
  }
  function openManual(): void {
    const u = errorDmg.value || info.value?.dmgUrl || ''
    if (u) void window.pf.updates.openManual(u)
    close()
  }
  function close(): void {
    phase.value = 'idle'
  }

  return {
    phase,
    info,
    percent,
    errorMsg,
    errorDmg,
    available,
    bind,
    prompt,
    start,
    skip,
    later,
    openManual,
    close
  }
})
