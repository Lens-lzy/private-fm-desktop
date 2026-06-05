<script setup lang="ts">
import { useLibraryStore } from '@/stores/library'
import { useMenusStore } from '@/stores/menus'

const library = useLibraryStore()
const menus = useMenusStore()

function addTo(id: number): void {
  const song = menus.add.song
  menus.add.open = false
  if (song) void library.addSongToPlaylist(id, song)
}
</script>

<template>
  <div
    v-if="menus.add.open"
    class="add-menu"
    :style="{ left: menus.add.x + 'px', top: menus.add.y + 'px' }"
    @click.stop
  >
    <div class="add-menu-title">加入歌单</div>
    <div v-for="p in library.playlists" :key="p.id" class="add-menu-item" @click="addTo(p.id)">
      {{ p.name }}
    </div>
    <div v-if="!library.playlists.length" class="add-menu-title">暂无歌单</div>
  </div>
</template>
