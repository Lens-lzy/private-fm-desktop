<script setup lang="ts">
import Icon from './Icon.vue'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useMenusStore } from '@/stores/menus'

const player = usePlayerStore()
const library = useLibraryStore()
const menus = useMenusStore()

function play(): void {
  if (menus.ctx.song) player.playNow(menus.ctx.song)
  menus.closeMenus()
}
function playNext(): void {
  if (menus.ctx.song) player.playNext(menus.ctx.song)
  menus.closeMenus()
}
function like(): void {
  if (menus.ctx.song) void library.toggleLike(menus.ctx.song)
  menus.closeMenus()
}
function addTo(ev: MouseEvent): void {
  const song = menus.ctx.song
  if (song) menus.openAdd(song, ev)
}
</script>

<template>
  <div
    v-if="menus.ctx.open && menus.ctx.song"
    class="ctx-menu"
    :style="{ left: menus.ctx.x + 'px', top: menus.ctx.y + 'px' }"
    @click.stop
  >
    <div class="ctx-item" @click="play"><Icon name="play" :size="15" /><span>播放</span></div>
    <div class="ctx-item" @click="playNext"><Icon name="plus" :size="15" /><span>下一首播放</span></div>
    <div class="ctx-item" @click="like">
      <Icon :name="library.isLiked(menus.ctx.song) ? 'heart-fill' : 'heart'" :size="15" />
      <span>{{ library.isLiked(menus.ctx.song) ? '取消喜欢' : '喜欢' }}</span>
    </div>
    <div class="ctx-item" @click="addTo"><Icon name="music" :size="15" /><span>加入歌单</span></div>
  </div>
</template>
