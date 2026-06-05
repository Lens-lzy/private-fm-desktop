<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'
import { usePlayerStore } from '@/stores/player'
import { keyOf } from '@/services/songKey'
import { songSinger } from '@/utils/format'

const player = usePlayerStore()
const dragIndex = ref(-1)

function onDragStart(i: number): void {
  dragIndex.value = i
}
function onDrop(i: number): void {
  if (dragIndex.value >= 0 && dragIndex.value !== i) player.moveItem(dragIndex.value, i)
  dragIndex.value = -1
}
</script>

<template>
  <div class="queue-panel" @click.stop>
    <div class="queue-head">
      <span>播放队列 · {{ player.count }}</span>
      <span class="queue-clear" @click="player.clearQueue()">清空</span>
    </div>
    <div class="queue-list">
      <div
        v-for="(s, i) in player.queue"
        :key="keyOf(s) + ':' + i"
        class="queue-item"
        :class="{ playing: i === player.index }"
        draggable="true"
        @click="player.jump(i)"
        @dragstart="onDragStart(i)"
        @dragover.prevent
        @drop="onDrop(i)"
      >
        <span class="qi-name">{{ s.name }}</span>
        <span class="qi-singer">{{ songSinger(s) }}</span>
        <span class="qi-del" title="移除" @click.stop="player.removeAt(i)"><Icon name="x" :size="15" /></span>
      </div>
      <div v-if="!player.count" class="hint" style="padding: 24px 0">队列为空</div>
    </div>
  </div>
</template>
