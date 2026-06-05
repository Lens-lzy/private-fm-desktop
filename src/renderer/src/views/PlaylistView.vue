<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import SongTable from '@/components/SongTable.vue'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'

const route = useRoute()
const library = useLibraryStore()
const player = usePlayerStore()

const pl = computed(() => library.activePlaylist)
const renaming = ref(false)
const newName = ref('')

async function load(): Promise<void> {
  const id = route.params.id as string
  if (id) await library.openPlaylist(id)
}
watch(() => route.params.id, load, { immediate: true })

function playAll(): void {
  if (pl.value?.songs.length) player.playList(pl.value.songs, 0)
}
function startRename(): void {
  if (!pl.value) return
  newName.value = pl.value.name
  renaming.value = true
}
async function commitRename(): Promise<void> {
  if (pl.value) await library.renamePlaylist(pl.value.id, newName.value)
  renaming.value = false
}
async function del(): Promise<void> {
  if (pl.value && !pl.value.isDefault && confirm(`删除歌单「${pl.value.name}」？`)) {
    await library.deletePlaylist({ id: pl.value.id, name: pl.value.name, isDefault: false, count: 0 })
  }
}
</script>

<template>
  <div v-if="pl" class="playlist-view">
    <h1 class="list-title">
      <template v-if="!renaming">{{ pl.name }}</template>
      <input v-else v-model="newName" class="rename-input" @keyup.enter="commitRename" @blur="commitRename" />
      <button class="play-all" :disabled="!pl.songs.length" @click="playAll">▶ 播放全部</button>
      <template v-if="!pl.isDefault">
        <button class="mini-btn" @click="startRename">重命名</button>
        <button class="mini-btn danger" @click="del">删除</button>
      </template>
    </h1>
    <SongTable v-if="pl.songs.length" :songs="pl.songs" :removable="true" :label="pl.name" />
    <p v-else class="hint">这个歌单还没有歌曲。</p>
  </div>
  <p v-else class="hint">加载中…</p>
</template>

<style scoped>
.rename-input {
  height: 34px;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 0 12px;
  background: #1f1f1f;
  color: #fff;
  font-size: 20px;
  outline: none;
}
.mini-btn {
  margin-left: 10px;
  border: 1px solid #4a4a4a;
  background: transparent;
  color: #fff;
  border-radius: 500px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  vertical-align: middle;
}
.mini-btn:hover {
  border-color: #fff;
}
.mini-btn.danger {
  color: #f15e6c;
  border-color: #5a3030;
}
</style>
