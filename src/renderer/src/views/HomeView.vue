<script setup lang="ts">
import { onMounted } from 'vue'
import ChartCard from '@/components/ChartCard.vue'
import SongTable from '@/components/SongTable.vue'
import { useAuthStore } from '@/stores/auth'
import { useDiscoverStore } from '@/stores/discover'
import { usePlayerStore } from '@/stores/player'

const auth = useAuthStore()
const discover = useDiscoverStore()
const player = usePlayerStore()

const hour = new Date().getHours()
const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

onMounted(() => {
  if (!discover.recommend.daily.length) void discover.loadRecommend()
})

function playDaily(): void {
  if (discover.recommend.daily.length) player.playList(discover.recommend.daily, 0)
}
</script>

<template>
  <div class="home-view">
    <h1 class="list-title">{{ greeting }}，{{ auth.user?.username }}</h1>

    <div class="hero-row">
      <div class="hero-shuffle" @click="discover.shufflePlay()">
        <span class="hero-shuffle-ic">🔀</span>
        <div>
          <div class="hs-title">随便听听</div>
          <div class="hs-sub">{{ discover.shuffling ? '正在准备…' : '基于你的口味随机 30 首' }}</div>
        </div>
      </div>
      <div class="hero-daily" @click="playDaily">
        <span class="hero-daily-ic">📅</span>
        <div>
          <div class="hs-title">每日推荐</div>
          <div class="hs-sub">{{ discover.recommend.daily.length }} 首 · 点击播放</div>
        </div>
        <button class="hero-refresh" title="换一批" :disabled="discover.recommendLoading" @click.stop="discover.loadRecommend(true)">
          ↻
        </button>
      </div>
    </div>

    <template v-for="card in discover.recommend.cards" :key="card.key">
      <div class="section-sub">{{ card.title }}</div>
      <div class="card-grid"><ChartCard :card="card" /></div>
    </template>

    <template v-if="discover.recommend.daily.length">
      <div class="section-sub">每日推荐</div>
      <SongTable :songs="discover.recommend.daily" label="每日推荐" />
    </template>
    <p v-else-if="discover.recommendLoading" class="hint">正在生成推荐…</p>
  </div>
</template>
