import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/services/api'
import { keyOf } from '@/services/songKey'
import { useUiStore } from './ui'
import type { Song } from '@/types'

export const useSearchStore = defineStore('search', () => {
  const platforms = ref<string[]>(['kg'])
  const platform = ref('kg')
  const results = ref<Song[]>([])
  const keyword = ref('')
  const lastKeyword = ref('')
  const page = ref(1)
  const total = ref(0)
  const hasMore = ref(false)
  const loading = ref(false)
  const loadingMore = ref(false)
  const history = ref<string[]>([])

  async function loadPlatforms(): Promise<void> {
    try {
      platforms.value = (await api.platforms()).platforms || ['kg']
      if (platforms.value.length && !platforms.value.includes(platform.value)) {
        platform.value = platforms.value[0]
      }
    } catch {
      /* 静默 */
    }
  }

  async function loadHistory(): Promise<void> {
    try {
      history.value = (await api.searchHistory()).history || []
    } catch {
      /* 静默 */
    }
  }

  async function run(kw: string): Promise<void> {
    const q = (kw ?? '').trim()
    if (!q) return
    keyword.value = q
    lastKeyword.value = q
    loading.value = true
    page.value = 1
    results.value = []
    total.value = 0
    hasMore.value = false
    try {
      const r = await api.search(q, platform.value, 1, 30)
      results.value = r.list || []
      total.value = r.total || results.value.length
      hasMore.value = results.value.length < total.value
      void loadHistory()
    } catch (e) {
      useUiStore().toast('搜索失败：' + (e instanceof Error ? e.message : String(e)))
      results.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value) return
    loadingMore.value = true
    const next = page.value + 1
    try {
      const r = await api.search(lastKeyword.value, platform.value, next, 30)
      const more = r.list || []
      const seen = new Set(results.value.map((s) => keyOf(s)))
      for (const s of more) if (!seen.has(keyOf(s))) results.value.push(s)
      page.value = next
      if (r.total) total.value = r.total
      hasMore.value = more.length > 0 && results.value.length < total.value
    } catch (e) {
      useUiStore().toast('加载更多失败：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      loadingMore.value = false
    }
  }

  async function removeHistory(kw: string): Promise<void> {
    try {
      history.value = (await api.removeSearchHistory(kw)).history || []
    } catch {
      /* 静默 */
    }
  }
  async function clearHistory(): Promise<void> {
    try {
      history.value = (await api.clearSearchHistory()).history || []
    } catch {
      /* 静默 */
    }
  }

  return {
    platforms,
    platform,
    results,
    keyword,
    lastKeyword,
    page,
    total,
    hasMore,
    loading,
    loadingMore,
    history,
    loadPlatforms,
    loadHistory,
    run,
    loadMore,
    removeHistory,
    clearHistory
  }
})
