<script setup lang="ts">
import { computed, ref } from 'vue'
import Cover from './Cover.vue'
import Icon from './Icon.vue'
import { usePlayerStore } from '@/stores/player'
import { useMenusStore } from '@/stores/menus'
import { keyOf, sameSong } from '@/services/songKey'
import { songSinger } from '@/utils/format'
import type { ChartCard, Song } from '@/types'

const props = defineProps<{ card: ChartCard }>()
const player = usePlayerStore()
const menus = useMenusStore()

const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.card.songs : props.card.songs.slice(0, 5)))

function playAll(): void {
  if (props.card.songs.length) player.playList(props.card.songs, 0)
}
function playSong(song: Song): void {
  if (!player.count) player.playInList(song, props.card.songs)
  else menus.openReplace(song, props.card.songs, `「${props.card.title}」`)
}
</script>

<template>
  <div class="chart-card">
    <div class="card-head">
      <Cover :song="card.songs[0]" klass="card-cover" />
      <div class="card-headtxt">
        <div class="card-title">{{ card.title }}</div>
        <div v-if="card.desc" class="card-desc">{{ card.desc }}</div>
      </div>
      <button class="card-play" title="播放整张" @click="playAll"><Icon name="play" :size="18" /></button>
    </div>
    <ul class="card-songs">
      <li
        v-for="(s, i) in shown"
        :key="keyOf(s) + ':' + i"
        :class="{ playing: sameSong(s, player.current) }"
        @dblclick="playSong(s)"
        @contextmenu.prevent="menus.openCtx(s, card.songs, $event)"
      >
        <span class="cs-rank" :class="{ top: i < 3 }">{{ i + 1 }}</span>
        <span class="cs-name">{{ s.name }}</span>
        <span class="cs-singer">{{ songSinger(s) }}</span>
        <span class="cs-op" title="播放" @click="playSong(s)"><Icon name="play" :size="16" /></span>
        <span class="cs-op" title="加入歌单" @click="menus.openAdd(s, $event)"><Icon name="plus" :size="16" /></span>
      </li>
    </ul>
    <div v-if="card.songs.length > 5" class="card-expand" @click="expanded = !expanded">
      {{ expanded ? '收起' : `展开全部 ${card.songs.length} 首` }}
    </div>
  </div>
</template>

<style scoped>
.card-expand {
  margin-top: 8px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.card-expand:hover {
  color: #fff;
}
</style>
