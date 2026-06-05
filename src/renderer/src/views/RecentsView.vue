<script setup lang="ts">
import SongTable from '@/components/SongTable.vue'
import { useRecentsStore } from '@/stores/recents'

const recents = useRecentsStore()
</script>

<template>
  <div class="recents-view">
    <h1 class="list-title">
      最近播放
      <button v-if="recents.list.length" class="mini-btn" @click="recents.clear()">清空</button>
    </h1>
    <SongTable v-if="recents.list.length" :songs="recents.list" label="最近播放" />
    <p v-else class="hint">还没有播放记录。</p>
  </div>
</template>

<style scoped>
.mini-btn {
  margin-left: 12px;
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
</style>
