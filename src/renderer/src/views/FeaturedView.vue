<script setup lang="ts">
import { onMounted } from 'vue'
import ChartCard from '@/components/ChartCard.vue'
import { useDiscoverStore } from '@/stores/discover'

const discover = useDiscoverStore()

onMounted(() => {
  if (!discover.featured.cards.length) void discover.loadFeatured()
})
</script>

<template>
  <div class="featured-view">
    <h1 class="list-title">
      热门榜单
      <span v-if="discover.featuredTime()" class="muted" style="font-size: 13px; font-weight: 400">
        {{ discover.featuredTime() }}
      </span>
    </h1>
    <p v-if="discover.featuredLoading && !discover.featured.cards.length" class="hint">加载中…</p>
    <div class="card-grid">
      <ChartCard v-for="card in discover.featured.cards" :key="card.key" :card="card" />
    </div>
  </div>
</template>
