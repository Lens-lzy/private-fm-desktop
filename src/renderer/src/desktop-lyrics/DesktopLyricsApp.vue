<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Icon from '@/components/Icon.vue'

const cur = ref('♪ Private FM')
const next = ref('')
const playing = ref(false)
const twoLines = ref(false)
const winH = ref(window.innerHeight)
const hovering = ref(false)
const locked = ref(false) // 默认解锁：可拖动/缩放/操作；点锁按钮后才点击穿透

const lockBtn = ref<HTMLElement | null>(null)

const mainSize = computed(() =>
  Math.max(14, Math.min(winH.value * (twoLines.value ? 0.24 : 0.32), 48))
)
const subSize = computed(() => mainSize.value) // 双行两句字号一致（仅靠颜色区分）

// ---- 鼠标穿透管理（仅锁定态需要切换）----
let ignoreNow = false
function applyIgnore(v: boolean): void {
  if (v === ignoreNow) return
  ignoreNow = v
  window.pfLyrics?.setIgnore(v)
}

let hideTimer: ReturnType<typeof setTimeout> | undefined
function overLock(e: MouseEvent): boolean {
  const el = lockBtn.value
  if (!el) return false
  const r = el.getBoundingClientRect()
  // 较大的判定区：光标靠近解锁按钮就提前取消穿透，避免点击在穿透未撤销时穿到下层主窗口
  const pad = 22
  return (
    e.clientX >= r.left - pad &&
    e.clientX <= r.right + pad &&
    e.clientY >= r.top - pad &&
    e.clientY <= r.bottom + pad
  )
}
function onLeave(): void {
  // 离开窗口 / 失焦 → 背景框立即消失
  if (hideTimer) clearTimeout(hideTimer)
  hovering.value = false
}
function onMove(e: MouseEvent): void {
  hovering.value = true
  if (hideTimer) clearTimeout(hideTimer)
  // 锁定（穿透）态收不到 mouseleave，只能靠短定时兜底隐藏；解锁态由 mouseleave/blur 即时隐藏
  if (locked.value) {
    hideTimer = setTimeout(() => (hovering.value = false), 500)
    applyIgnore(!overLock(e)) // 悬停解锁按钮时才放行点击
  }
}

onMounted(() => {
  window.addEventListener('resize', () => (winH.value = window.innerHeight))
  window.addEventListener('mousemove', onMove)
  window.addEventListener('blur', onLeave)
  window.pfLyrics?.onLyric((p) => {
    cur.value = p.cur || ''
    next.value = p.next || ''
    playing.value = !!p.playing
    twoLines.value = !!p.twoLines
  })
  applyIgnore(locked.value) // 默认解锁 → 可交互（非穿透）
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('blur', onLeave)
})

function toggleLock(): void {
  locked.value = !locked.value
  applyIgnore(locked.value) // 解锁→全交互；锁定→穿透
}
function ctl(cmd: string): void {
  window.pfLyrics?.sendControl(cmd)
}

// ---- 拖动整窗（仅解锁态）----
let startX = 0
let startY = 0
function onDragMove(e: MouseEvent): void {
  window.pfLyrics?.dragMove(e.screenX - startX, e.screenY - startY)
}
function onDragUp(): void {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragUp)
}
function onBodyDown(e: MouseEvent): void {
  if (locked.value || e.button !== 0) return
  const t = e.target as HTMLElement
  if (t.closest('.dl-bar') || t.closest('.dl-resize')) return
  startX = e.screenX
  startY = e.screenY
  window.pfLyrics?.dragStart()
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragUp)
}

// ---- 右下角手柄缩放（仅解锁态）----
function onResizeMove(e: MouseEvent): void {
  window.pfLyrics?.resizeMove(e.screenX - startX, e.screenY - startY)
}
function onResizeUp(): void {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeUp)
}
function onResizeDown(e: MouseEvent): void {
  if (e.button !== 0) return
  e.stopPropagation()
  startX = e.screenX
  startY = e.screenY
  window.pfLyrics?.resizeStart()
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeUp)
}
</script>

<template>
  <div
    class="dl-root"
    :class="{ hover: hovering, locked, unlocked: !locked }"
    @mousedown="onBodyDown"
    @mouseleave="onLeave"
  >
    <div class="dl-lines" :class="{ two: twoLines && next }">
      <div class="dl-cur" :style="{ fontSize: mainSize + 'px' }">{{ cur || '♪' }}</div>
      <div v-if="twoLines && next" class="dl-next" :style="{ fontSize: subSize + 'px' }">
        {{ next }}
      </div>
    </div>

    <!-- 顶部按钮条：左=关闭、中=播放控制、右=锁定。锁定后只剩右上角解锁按钮（小背景） -->
    <div class="dl-bar">
      <button v-show="!locked" class="dl-btn dl-close" title="关闭桌面歌词" @click="ctl('close')">
        <Icon name="x" :size="14" />
      </button>
      <div v-show="!locked" class="dl-ctrls">
        <button class="dl-btn" title="上一首" @click="ctl('prev')"><Icon name="prev" :size="15" /></button>
        <button class="dl-btn" :title="playing ? '暂停' : '播放'" @click="ctl('playpause')">
          <Icon :name="playing ? 'pause' : 'play'" :size="15" />
        </button>
        <button class="dl-btn" title="下一首" @click="ctl('next')"><Icon name="next" :size="15" /></button>
        <button class="dl-btn" title="单行/双行" @click="ctl('toggleLines')"><Icon name="rows" :size="14" /></button>
      </div>
      <button
        ref="lockBtn"
        class="dl-btn dl-lock"
        :title="locked ? '解锁（可拖动/缩放）' : '锁定（点击穿透，不挡其他窗口）'"
        @mousedown.stop
        @click="toggleLock"
      >
        <Icon :name="locked ? 'lock' : 'unlock'" :size="15" />
      </button>
    </div>

    <!-- 右下角缩放手柄：仅解锁态 -->
    <div v-show="!locked" class="dl-resize" title="拖动缩放" @mousedown="onResizeDown">
      <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
        <path d="M12 5 5 12M12 9l-3 3" stroke="rgba(255,255,255,.85)" stroke-width="1.5" fill="none" stroke-linecap="round" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.dl-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 12px;
  background: transparent;
  transition: background 0.2s;
  padding: 6px 14px;
}
.dl-root.unlocked {
  cursor: move;
}
/* 悬停时给个淡背景，便于看清边界（仅解锁态明显）。 */
.dl-root.unlocked.hover {
  background: rgba(0, 0, 0, 0.38);
}
/* 锁定态不再显示整框背景：只在解锁按钮上给一小块背景（见 .dl-root.locked .dl-lock） */
.dl-lines {
  text-align: center;
  width: 100%;
  overflow: hidden;
}
/* 两行模式：第一行左对齐、第二行右对齐（错位卡拉OK式） */
.dl-lines.two {
  text-align: left;
}
.dl-lines.two .dl-next {
  text-align: right;
}
.dl-cur {
  color: #1ed760;
  font-weight: 800;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 紧贴字形的 1px 描边（无模糊）：任意背景都清晰，且不会在浅色背景上糊出深色方块 */
  text-shadow:
    -1px -1px 0 rgba(0, 0, 0, 0.4),
    1px -1px 0 rgba(0, 0, 0, 0.4),
    -1px 1px 0 rgba(0, 0, 0, 0.4),
    1px 1px 0 rgba(0, 0, 0, 0.4);
}
.dl-next {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow:
    -1px -1px 0 rgba(0, 0, 0, 0.4),
    1px -1px 0 rgba(0, 0, 0, 0.4),
    -1px 1px 0 rgba(0, 0, 0, 0.4),
    1px 1px 0 rgba(0, 0, 0, 0.4);
}

/* 扁平小按钮（无圆形背景） */
.dl-btn {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
  opacity: 0.85;
}
.dl-btn:hover {
  opacity: 1;
  color: #fff;
}
/* 顶部按钮条：左=关闭、中=控制、右=锁定（绝对定位，互不挤压） */
.dl-bar {
  position: absolute;
  top: 3px;
  left: 0;
  right: 0;
  height: 24px;
  opacity: 0;
  transition: opacity 0.2s;
}
.dl-root.hover .dl-bar {
  opacity: 1;
}
.dl-close {
  position: absolute;
  top: 0;
  left: 12px;
}
.dl-lock {
  position: absolute;
  top: 0;
  right: 12px;
}
/* 控制组只占中间内容宽度并居中：避免整条横跨盖住左右两个按钮、导致点击失效 */
.dl-ctrls {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
}
/* 锁定态：解锁按钮移到顶部正中央，并显示一小块圆形背景；整框无背景 */
.dl-root.locked .dl-lock {
  left: 50%;
  right: auto;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.55);
  border-radius: 50%;
}
.dl-resize {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  cursor: nwse-resize;
  opacity: 0;
  transition: opacity 0.2s;
}
.dl-root.hover .dl-resize {
  opacity: 0.9;
}
</style>
