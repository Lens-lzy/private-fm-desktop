<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Cover from './Cover.vue'
import Icon from './Icon.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { fmtTime, songSinger } from '@/utils/format'

const player = usePlayerStore()
const ui = useUiStore()
const settings = useSettingsStore()

const seekPos = ref(0)
const seeking = ref(false)

const pct = (v: number, max: number): string =>
  `${Math.max(0, Math.min(100, max > 0 ? (v / max) * 100 : 0))}%`
const progressFill = computed(() => pct(seekPos.value, player.duration))
const volumeFill = computed(() => pct(player.volume, 1))

watch(
  () => player.currentTime,
  (t) => {
    if (!seeking.value) seekPos.value = t
  }
)

function onSeekInput(e: Event): void {
  seeking.value = true
  seekPos.value = Number((e.target as HTMLInputElement).value)
}
function onSeekCommit(): void {
  player.seek(seekPos.value)
  seeking.value = false
}
function onVolume(e: Event): void {
  player.setVolume(Number((e.target as HTMLInputElement).value))
}

const repeatTitle = (): string =>
  player.repeatMode === 'off' ? '循环：关' : player.repeatMode === 'all' ? '循环：列表' : '循环：单曲'
</script>

<template>
  <footer class="player">
    <div class="p-left clickable" @click="ui.toggleNowPlaying()">
      <Cover :song="player.current" :resolve="true" klass="p-cover" />
      <div class="p-meta">
        <div class="p-name">{{ player.current?.name || '未在播放' }}</div>
        <div class="p-singer">
          {{ player.statusMessage || songSinger(player.current) }}
        </div>
      </div>
    </div>

    <div class="p-center">
      <div class="p-ctrls">
        <button :class="{ on: player.shuffle }" title="随机播放" @click="player.toggleShuffle()">
          <Icon name="shuffle" :size="18" />
        </button>
        <button title="上一首" @click="player.prev()"><Icon name="prev" :size="20" /></button>
        <button class="play-btn" :title="player.isPlaying ? '暂停' : '播放'" @click="player.togglePlay()">
          <Icon :name="player.isPlaying ? 'pause' : 'play'" :size="18" />
        </button>
        <button title="下一首" @click="player.next()"><Icon name="next" :size="20" /></button>
        <button :class="{ on: player.repeatMode !== 'off' }" :title="repeatTitle()" @click="player.cycleRepeat()">
          <Icon :name="player.repeatMode === 'one' ? 'repeat-1' : 'repeat'" :size="18" />
        </button>
      </div>
      <div class="p-progress">
        <span class="t">{{ fmtTime(seekPos) }}</span>
        <input
          type="range"
          min="0"
          :max="player.duration || 0"
          step="0.1"
          :value="seekPos"
          :style="{ '--fill': progressFill }"
          @input="onSeekInput"
          @change="onSeekCommit"
          @mousedown="seeking = true"
        />
        <span class="t">{{ fmtTime(player.duration) }}</span>
      </div>
    </div>

    <div class="p-right">
      <button
        class="dl-toggle"
        :class="{ on: settings.desktopLyrics.enabled }"
        title="桌面歌词"
        @click.stop="settings.toggleDesktopLyrics()"
      >
        词
      </button>
      <button
        class="queue-btn"
        :class="{ active: ui.queueOpen }"
        title="播放队列"
        @click.stop="ui.toggleQueue()"
      >
        <Icon name="list" :size="18" />
        <span v-if="player.count" class="queue-count">{{ player.count }}</span>
      </button>
      <span class="vol-ic"><Icon name="volume" :size="16" /></span>
      <input
        class="vol"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="player.volume"
        :style="{ '--fill': volumeFill }"
        @input="onVolume"
      />
    </div>
  </footer>
</template>

<style scoped>
.dl-toggle {
  border: 1px solid var(--border-2);
  background: transparent;
  color: var(--muted);
  width: 28px;
  height: 26px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.dl-toggle:hover {
  color: var(--text);
  border-color: var(--muted);
}
.dl-toggle.on {
  color: #000;
  background: var(--green);
  border-color: var(--green);
}
</style>

