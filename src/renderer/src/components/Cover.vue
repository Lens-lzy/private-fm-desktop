<script setup lang="ts">
import { ref, watch } from 'vue'
import { DEFAULT_COVER, imageURL } from '@/services/urls'
import { resolveCover } from '@/services/covers'
import type { Song } from '@/types'

const props = withDefaults(
  defineProps<{
    song: Song | null | undefined
    /** true 时缺图调 /api/pic 兜底（播放条/正在播放用）；false 仅用 song.img（列表用）。 */
    resolve?: boolean
    klass?: string
    alt?: string
  }>(),
  { resolve: false, klass: '', alt: '' }
)

const src = ref<string>(DEFAULT_COVER)

watch(
  () => props.song,
  async (song) => {
    if (!song) {
      src.value = DEFAULT_COVER
      return
    }
    if (props.resolve) {
      const url = await resolveCover(song)
      // 防竞态：song 已变则丢弃
      if (props.song === song) src.value = url
    } else {
      src.value = imageURL(song)
    }
  },
  { immediate: true }
)

function onError(e: Event): void {
  const el = e.target as HTMLImageElement
  if (el.src !== DEFAULT_COVER) el.src = DEFAULT_COVER
}
</script>

<template>
  <img :class="klass" :src="src" :alt="alt" loading="lazy" @error="onError" />
</template>
