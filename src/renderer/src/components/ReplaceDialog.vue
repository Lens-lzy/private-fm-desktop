<script setup lang="ts">
import { usePlayerStore } from '@/stores/player'
import { useMenusStore } from '@/stores/menus'

const player = usePlayerStore()
const menus = useMenusStore()

function replaceAll(): void {
  const { song, list } = menus.replace
  menus.closeReplace()
  if (song) player.playInList(song, list)
}
function onlyOne(): void {
  const { song } = menus.replace
  menus.closeReplace()
  if (song) player.playNow(song)
}
</script>

<template>
  <div v-if="menus.replace.open" class="modal-mask" @click.self="menus.closeReplace()">
    <div class="modal modal-sm">
      <div class="modal-head">
        <h3>播放</h3>
        <span class="modal-close" @click="menus.closeReplace()">×</span>
      </div>
      <div class="modal-body">
        <div>用{{ menus.replace.label }}替换当前播放队列，还是只播放这一首？</div>
        <button class="primary" @click="replaceAll">替换并连播</button>
        <button @click="onlyOne">只播这一首</button>
      </div>
    </div>
  </div>
</template>
