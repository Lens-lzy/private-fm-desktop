<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { imageURLFromRaw } from '@/services/urls'
import type { NewsItem } from '@/types'

const props = defineProps<{ items: NewsItem[] }>()
const router = useRouter()

// 轮播是视觉橱窗：优先只放有封面的条目；全无封面再回退全部。
const pages = computed(() => {
  const withCover = props.items.filter((it) => it.cover)
  return (withCover.length ? withCover : props.items).slice(0, 8)
})

const index = ref(0)
let timer: number | undefined

function go(i: number): void {
  const n = pages.value.length
  if (n) index.value = ((i % n) + n) % n
}
function start(): void {
  stop()
  if (pages.value.length > 1) timer = window.setInterval(() => go(index.value + 1), 4000)
}
function stop(): void {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}

function open(it: NewsItem): void {
  router.push({ name: 'news', params: { id: it.id } })
}
function title(it: NewsItem): string {
  return it.titleZh && it.titleZh.length ? it.titleZh : it.title
}

watch(pages, () => {
  if (index.value >= pages.value.length) index.value = 0
  start()
})
onMounted(start)
onUnmounted(stop)
</script>

<template>
  <div v-if="pages.length" class="news-carousel" @mouseenter="stop" @mouseleave="start">
    <div
      v-for="(it, i) in pages"
      :key="it.id"
      class="nc-slide"
      :class="{ on: i === index }"
      @click="open(it)"
    >
      <img class="nc-img" :src="imageURLFromRaw(it.cover || '')" alt="" />
      <div class="nc-grad"></div>
      <div class="nc-meta">
        <span v-if="it.source" class="nc-src">{{ it.source }}</span>
        <div class="nc-title">{{ title(it) }}</div>
      </div>
    </div>

    <template v-if="pages.length > 1">
      <button class="nc-arrow nc-prev" title="上一条" @click.stop="go(index - 1)">‹</button>
      <button class="nc-arrow nc-next" title="下一条" @click.stop="go(index + 1)">›</button>
      <div class="nc-dots">
        <span
          v-for="(_, i) in pages"
          :key="i"
          class="nc-dot"
          :class="{ on: i === index }"
          @click.stop="go(i)"
        ></span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.news-carousel {
  position: relative;
  width: 100%;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 22px;
  background: var(--panel);
}
.nc-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.5s ease;
  cursor: pointer;
  pointer-events: none;
}
.nc-slide.on {
  opacity: 1;
  pointer-events: auto;
}
.nc-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.nc-grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.8) 100%);
}
.nc-meta {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 16px;
}
.nc-src {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--green);
  padding: 2px 8px;
  border-radius: 999px;
  margin-bottom: 8px;
}
.nc-title {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
.nc-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}
.news-carousel:hover .nc-arrow {
  opacity: 1;
}
.nc-arrow:hover {
  background: rgba(0, 0, 0, 0.7);
}
.nc-prev {
  left: 12px;
}
.nc-next {
  right: 12px;
}
.nc-dots {
  position: absolute;
  bottom: 14px;
  right: 20px;
  display: flex;
  gap: 6px;
}
.nc-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: all 0.25s;
}
.nc-dot.on {
  width: 18px;
  background: var(--green-bright);
}
</style>
