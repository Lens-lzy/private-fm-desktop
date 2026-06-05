<script setup lang="ts">
import { computed } from 'vue'
import Cover from './Cover.vue'
import Icon from './Icon.vue'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useMenusStore } from '@/stores/menus'
import { keyOf, sameSong } from '@/services/songKey'
import { songDuration, songSinger, songAlbum } from '@/utils/format'
import type { Song } from '@/types'

const props = withDefaults(
  defineProps<{
    songs: Song[]
    /** 双击连播时作为队列的列表，默认即 songs。 */
    list?: Song[]
    showAlbum?: boolean
    /** 歌单详情视图：操作列显示「移除」。 */
    removable?: boolean
    /** 列表上下文标签（替换队列确认弹窗用）。 */
    label?: string
  }>(),
  { showAlbum: true, removable: false, label: '当前列表' }
)

const player = usePlayerStore()
const library = useLibraryStore()
const menus = useMenusStore()
const ctxList = computed(() => props.list ?? props.songs)

function isCurrent(s: Song): boolean {
  return sameSong(s, player.current)
}
function onDblClick(s: Song): void {
  // 队列为空直接连播；否则弹「替换 / 只播这首」确认（对齐 app.js）
  if (!player.count) player.playInList(s, ctxList.value)
  else menus.openReplace(s, ctxList.value, `「${props.label}」`)
}
function onContext(s: Song, ev: MouseEvent): void {
  ev.preventDefault()
  menus.openCtx(s, ctxList.value, ev)
}
</script>

<template>
  <table class="song-table">
    <thead>
      <tr>
        <th class="col-idx">#</th>
        <th>歌曲</th>
        <th>歌手</th>
        <th v-if="showAlbum">专辑</th>
        <th class="col-dur">时长</th>
        <th class="col-op">操作</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(s, i) in songs"
        :key="keyOf(s) + ':' + i"
        :class="{ playing: isCurrent(s) }"
        @dblclick="onDblClick(s)"
        @contextmenu="onContext(s, $event)"
      >
        <td class="col-idx">{{ i + 1 }}</td>
        <td class="song-name">
          <Cover :song="s" klass="row-thumb" />
          <span>{{ s.name }}</span>
        </td>
        <td class="muted">{{ songSinger(s) }}</td>
        <td v-if="showAlbum" class="muted">{{ songAlbum(s) }}</td>
        <td class="col-dur muted">{{ songDuration(s) }}</td>
        <td class="col-op">
          <span
            class="op"
            :class="{ liked: library.isLiked(s) }"
            :title="library.isLiked(s) ? '取消喜欢' : '喜欢'"
            @click="library.toggleLike(s)"
          >
            <Icon :name="library.isLiked(s) ? 'heart-fill' : 'heart'" :size="17" />
          </span>
          <span class="op" title="加入歌单" @click="menus.openAdd(s, $event)"><Icon name="plus" :size="17" /></span>
          <span v-if="removable" class="op" title="从歌单移除" @click="library.removeSongFromActive(s)">
            <Icon name="x" :size="17" />
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
