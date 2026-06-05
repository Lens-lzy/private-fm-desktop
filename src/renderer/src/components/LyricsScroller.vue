<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useLyricsStore } from '@/stores/lyrics'
import { usePlayerStore } from '@/stores/player'
import { fmtTime } from '@/utils/format'

const lyrics = useLyricsStore()
const player = usePlayerStore()

const viewport = ref<HTMLElement | null>(null)
const inner = ref<HTMLElement | null>(null)
const offset = ref(0)
const autoFollow = ref(true)
let resumeTimer: ReturnType<typeof setTimeout> | undefined

/** 让当前句在视口垂直居中（仅自动跟随时生效）。 */
function recenter(force = false): void {
  if (!autoFollow.value && !force) return
  const vp = viewport.value
  const box = inner.value
  if (!vp || !box) return
  const idx = lyrics.currentIndex
  const ps = box.querySelectorAll<HTMLElement>('.ly-line')
  if (idx < 0 || idx >= ps.length) {
    offset.value = vp.clientHeight / 2
    return
  }
  const el = ps[idx]
  offset.value = vp.clientHeight / 2 - (el.offsetTop + el.offsetHeight / 2)
}

watch(
  () => lyrics.currentIndex,
  () => void nextTick(() => recenter())
)
watch(
  () => lyrics.epoch,
  () => {
    autoFollow.value = true // 换歌词回到自动跟随
    void nextTick(() => recenter(true))
  }
)

/** 滚轮浏览：暂停自动跟随，手动平移；4 秒无操作后恢复跟随。 */
function onWheel(e: WheelEvent): void {
  const vp = viewport.value
  const box = inner.value
  if (!vp || !box) return
  autoFollow.value = false
  const innerH = box.scrollHeight
  const maxOff = vp.clientHeight / 2
  const minOff = vp.clientHeight / 2 - innerH
  offset.value = Math.min(maxOff, Math.max(minOff, offset.value - e.deltaY))
  if (resumeTimer) clearTimeout(resumeTimer)
  resumeTimer = setTimeout(() => {
    autoFollow.value = true
    recenter(true)
  }, 4000)
}

function onClickLine(i: number): void {
  const line = lyrics.lines[i]
  if (line) player.seek(line.time)
}

onUnmounted(() => {
  if (resumeTimer) clearTimeout(resumeTimer)
})
</script>

<template>
  <div ref="viewport" class="ly-viewport" @wheel.prevent="onWheel">
    <div v-if="!lyrics.lines.length" class="ly-empty">
      {{ lyrics.isLoading ? '歌词加载中…' : '暂无歌词' }}
    </div>
    <div v-else ref="inner" class="ly-inner" :style="{ transform: `translateY(${offset}px)` }">
      <p
        v-for="(l, i) in lyrics.lines"
        :key="i"
        class="ly-line"
        :class="{ cur: i === lyrics.currentIndex }"
        @click="onClickLine(i)"
      >
        {{ l.text }}
        <span v-if="l.trans" class="ly-trans">{{ l.trans }}</span>
        <span class="ly-time">{{ fmtTime(l.time) }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.ly-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  text-align: center;
  mask-image: linear-gradient(transparent, #000 10%, #000 90%, transparent);
  -webkit-mask-image: linear-gradient(transparent, #000 10%, #000 90%, transparent);
}
.ly-inner {
  will-change: transform;
  transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.ly-line {
  position: relative;
  color: rgba(127, 127, 127, 0.75);
  font-size: 16px;
  line-height: 2.2;
  cursor: pointer;
  transition: color 0.25s, font-size 0.25s, font-weight 0.25s;
  padding: 2px 12px;
}
.ly-line:hover {
  color: var(--text);
}
/* 悬停某行时在右侧显示该行时间戳，点击即可跳转到此刻 */
.ly-time {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.ly-line:hover .ly-time {
  opacity: 0.85;
}
.ly-line.cur {
  color: var(--green-bright);
  font-size: 19px;
  font-weight: 700;
}
.ly-trans {
  display: block;
  font-size: 0.82em;
  opacity: 0.85;
}
.ly-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
}
</style>
