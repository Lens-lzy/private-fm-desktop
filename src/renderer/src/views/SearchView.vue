<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import SongTable from '@/components/SongTable.vue'
import { useSearchStore } from '@/stores/search'
import { platformName } from '@/utils/format'

const route = useRoute()
const search = useSearchStore()

function runFromRoute(): void {
  const q = (route.query.q as string) || ''
  if (q && q !== search.lastKeyword) void search.run(q)
}

onMounted(() => {
  if (!search.platforms.length || search.platforms[0] === 'kg') void search.loadPlatforms()
  runFromRoute()
})
watch(() => route.query.q, runFromRoute)

function onPlatformChange(): void {
  if (search.lastKeyword) void search.run(search.lastKeyword)
}
</script>

<template>
  <div class="search-view">
    <h1 class="list-title">
      搜索：{{ search.lastKeyword || route.query.q || '' }}
      <select v-model="search.platform" class="platform-select" @change="onPlatformChange">
        <option v-for="p in search.platforms" :key="p" :value="p">{{ platformName(p) }}</option>
      </select>
    </h1>

    <p v-if="search.loading" class="hint">搜索中…</p>
    <template v-else-if="search.results.length">
      <SongTable :songs="search.results" />
      <div v-if="search.hasMore" class="load-more-wrap">
        <button class="load-more" :disabled="search.loadingMore" @click="search.loadMore()">
          {{ search.loadingMore ? '加载中…' : '加载更多' }}
        </button>
      </div>
    </template>
    <p v-else class="hint">没有找到结果，换个关键词或音源试试。</p>
  </div>
</template>
