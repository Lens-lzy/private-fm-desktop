import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { usePlayerStore } from './player'
import { useUiStore } from './ui'
import type { ChartCard, Featured, Recommend } from '@/types'

/** 首页推荐 / 精选榜单 / 随便听听。移植 app.js featured/recommend/shuffle。 */
export const useDiscoverStore = defineStore('discover', () => {
  const featured = ref<Featured>({ updatedAt: 0, cards: [] })
  const featuredLoading = ref(false)
  const recommend = ref<Recommend>({ day: '', daily: [], cards: [] })
  const recommendLoading = ref(false)
  const shuffling = ref(false)

  async function loadFeatured(): Promise<void> {
    featuredLoading.value = true
    try {
      featured.value = await api.featured()
    } catch {
      /* 静默 */
    } finally {
      featuredLoading.value = false
    }
  }

  async function loadRecommend(force = false): Promise<void> {
    recommendLoading.value = true
    try {
      recommend.value = await api.recommend(force)
    } catch {
      /* 静默 */
    } finally {
      recommendLoading.value = false
    }
  }

  async function shufflePlay(): Promise<void> {
    if (shuffling.value) return
    shuffling.value = true
    try {
      const r = await api.shuffle()
      if (r.songs && r.songs.length) usePlayerStore().playList(r.songs, 0)
    } catch (e) {
      useUiStore().toast('随便听听失败：' + (e instanceof Error ? e.message : ''))
    } finally {
      shuffling.value = false
    }
  }

  function playCard(card: ChartCard): void {
    if (card.songs && card.songs.length) usePlayerStore().playList(card.songs, 0)
  }

  function featuredTime(): string {
    if (!featured.value.updatedAt) return ''
    const d = new Date(featured.value.updatedAt)
    return `更新于 ${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`
  }

  return {
    featured,
    featuredLoading,
    recommend,
    recommendLoading,
    shuffling,
    loadFeatured,
    loadRecommend,
    shufflePlay,
    playCard,
    featuredTime
  }
})
