<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/services/api'
import { imageURLFromRaw } from '@/services/urls'
import type { NewsItem } from '@/types'

const route = useRoute()
const router = useRouter()

const item = ref<NewsItem | null>(null)
const loading = ref(true)

type Block = { type: 'text'; value: string } | { type: 'img'; value: string }

const SENTINEL = String.fromCharCode(1)

const blocks = computed<Block[]>(() => {
  const it = item.value
  if (!it) return []
  // 已翻译：按段落渲染纯文本（封面在顶部）
  if (it.contentZh && it.contentZh.length) {
    return it.contentZh
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((value) => ({ type: 'text', value }) as Block)
  }
  // 未翻译（翻译关闭/失败）：解析英文 HTML
  if (it.content) return parseBody(it.content)
  return []
})

const dateText = computed(() => {
  const ms = item.value?.pubDate
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})

const displayTitle = computed(() => {
  const it = item.value
  return it ? (it.titleZh && it.titleZh.length ? it.titleZh : it.title) : ''
})

onMounted(async () => {
  try {
    const id = String(route.params.id)
    item.value = (await api.newsDetail(id)).item
  } catch {
    /* 静默 */
  } finally {
    loading.value = false
  }
})

function openOriginal(): void {
  const link = item.value?.link
  if (link) window.open(link, '_blank')
}

// --- 把 HTML 正文拆成 段落/图片 块（英文回退用）---
function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
function parseBody(html: string): Block[] {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(
    /<img[^>]*?(?:data-lazy-src|data-src|src)\s*=\s*["']([^"']+)["'][^>]*>/gi,
    SENTINEL + '$1' + SENTINEL
  )
  s = s.replace(/<(?:br|p|div|li|h[1-6]|tr|blockquote)[^>]*>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  const out: Block[] = []
  s.split(SENTINEL).forEach((part, i) => {
    if (i % 2 === 1) {
      const u = part.trim()
      if (u) out.push({ type: 'img', value: u })
    } else {
      part
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((value) => out.push({ type: 'text', value }))
    }
  })
  return out
}
</script>

<template>
  <div class="news-detail">
    <button class="nd-back" @click="router.back()">‹ 返回</button>

    <p v-if="loading" class="hint">加载中…</p>

    <template v-else-if="item">
      <img v-if="item.cover" class="nd-cover" :src="imageURLFromRaw(item.cover)" alt="" />
      <h1 class="nd-title">{{ displayTitle }}</h1>
      <div class="nd-meta">
        <span v-if="item.source" class="nd-src">{{ item.source }}</span>
        <span v-if="dateText" class="muted">{{ dateText }}</span>
      </div>

      <div class="nd-body">
        <template v-for="(b, i) in blocks" :key="i">
          <img v-if="b.type === 'img'" class="nd-bimg" :src="imageURLFromRaw(b.value)" alt="" />
          <p v-else class="nd-p">{{ b.value }}</p>
        </template>
        <p v-if="!blocks.length" class="muted">{{ item.summaryZh || item.summary || '暂无正文。' }}</p>
      </div>

      <button v-if="item.link" class="nd-original" @click="openOriginal">阅读原文 ↗</button>
    </template>

    <p v-else class="hint">没找到这条资讯。</p>
  </div>
</template>

<style scoped>
.news-detail {
  max-width: 720px;
  margin: 0 auto;
  padding-bottom: 40px;
}
.nd-back {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
  padding: 8px 0;
  margin-bottom: 8px;
}
.nd-back:hover {
  color: var(--text);
}
.nd-cover {
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: 12px;
  display: block;
  margin-bottom: 18px;
}
.nd-title {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.35;
  margin: 0 0 12px;
  color: var(--text);
}
.nd-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  margin-bottom: 18px;
}
.nd-src {
  color: var(--green-bright);
  font-weight: 600;
}
.nd-body {
  border-top: 1px solid var(--border);
  padding-top: 18px;
}
.nd-p {
  font-size: 16px;
  line-height: 1.85;
  color: var(--text);
  margin: 0 0 16px;
}
.nd-bimg {
  width: 100%;
  border-radius: 8px;
  margin: 4px 0 18px;
  display: block;
}
.nd-original {
  margin-top: 10px;
  background: var(--elevated);
  border: 1px solid var(--border);
  color: var(--green-bright);
  font-size: 14px;
  padding: 10px 18px;
  border-radius: 999px;
  cursor: pointer;
}
.nd-original:hover {
  background: var(--elevated-hover);
}
</style>
