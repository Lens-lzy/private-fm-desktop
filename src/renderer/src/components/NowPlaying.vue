<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Cover from './Cover.vue'
import Icon from './Icon.vue'
import LyricsScroller from './LyricsScroller.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { resolveCover } from '@/services/covers'
import { songSinger, songAlbum } from '@/utils/format'

const player = usePlayerStore()
const ui = useUiStore()

const bgUrl = ref('')
watch(
  () => player.current,
  async (s) => {
    if (!s) {
      bgUrl.value = ''
      return
    }
    const url = await resolveCover(s)
    if (player.current === s) bgUrl.value = url
  },
  { immediate: true }
)

// 关闭正在播放页：左上角下箭头 / Esc / 点播放条封面 / 点暗色背景
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && ui.nowPlayingOpen) ui.closeNowPlaying()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <transition name="np-slide">
    <div v-if="ui.nowPlayingOpen" class="np-panel">
      <div class="np-bg" :style="{ backgroundImage: bgUrl ? `url('${bgUrl}')` : 'none' }"></div>
      <div class="np-bg-mask" @click="ui.closeNowPlaying()"></div>
      <div class="np-drag"></div>
      <button class="np-collapse" title="收起（Esc）" @click="ui.closeNowPlaying()">
        <Icon name="chevron-down" :size="22" />
      </button>
      <div class="np-body">
        <div class="np-left">
          <Cover :song="player.current" :resolve="true" klass="np-cover" />
          <div class="np-titlerow">
            <div class="np-eq" :class="{ playing: player.isPlaying }" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </div>
            <div class="np-title">{{ player.current?.name || '未在播放' }}</div>
          </div>
          <div class="np-singer">{{ songSinger(player.current) }}</div>
          <div v-if="songAlbum(player.current)" class="np-album">{{ songAlbum(player.current) }}</div>
        </div>
        <div class="np-right">
          <LyricsScroller />
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* 左上角收起按钮：紧贴红绿灯右侧，悬于顶部拖拽条之上且可点击 */
.np-collapse {
  position: absolute;
  top: 5px;
  left: 80px;
  z-index: 2;
  -webkit-app-region: no-drag;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.np-collapse:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}
.np-right {
  position: relative;
  min-height: 0;
}
/* 嵌套 flex 下 height:100% 会塌缩，改用绝对定位铁实填满歌词区 */
.np-right :deep(.ly-viewport) {
  position: absolute;
  inset: 0;
  height: auto;
}
.np-titlerow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}
.np-titlerow .np-title {
  margin-top: 0;
}
/* 装饰性律动均衡器（纯 CSS，随播放态动画，不接音频图，零静音风险） */
.np-eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  height: 22px;
}
.np-eq span {
  width: 3px;
  height: 6px;
  background: var(--green-bright);
  border-radius: 2px;
}
.np-eq.playing span {
  animation: eq 0.9s ease-in-out infinite;
}
.np-eq.playing span:nth-child(2) {
  animation-delay: 0.25s;
}
.np-eq.playing span:nth-child(3) {
  animation-delay: 0.5s;
}
.np-eq.playing span:nth-child(4) {
  animation-delay: 0.15s;
}
@keyframes eq {
  0%,
  100% {
    height: 6px;
  }
  50% {
    height: 20px;
  }
}
</style>
