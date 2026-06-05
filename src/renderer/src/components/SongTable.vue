<script setup lang="ts">
import { computed } from 'vue'
import Cover from './Cover.vue'
import Icon from './Icon.vue'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useMenusStore } from '@/stores/menus'
import { useSettingsStore } from '@/stores/settings'
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
const settings = useSettingsStore()
const ctxList = computed(() => props.list ?? props.songs)

function isCurrent(s: Song): boolean {
  return sameSong(s, player.current)
}
function onDblClick(s: Song): void {
  // 双击行为由设置「播放列表」决定：
  //  replace = 用当前列表替换播放队列并从这首播；add = 仅把这首插队立即播
  if (player.count && settings.playback.doubleClick === 'add') player.playNow(s)
  else player.playInList(s, ctxList.value)
}
/** 悬停封面上的播放按钮：插入当前队列第一首并立即播放。 */
function onCoverPlay(s: Song): void {
  player.playNow(s)
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
          <span class="row-cover">
            <Cover :song="s" klass="rc-img" />
            <span class="cover-play" title="立即播放" @click.stop="onCoverPlay(s)">
              <Icon name="play" :size="15" />
            </span>
          </span>
          <span class="rc-title">{{ s.name }}</span>
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

<style scoped>
/* 行内封面：悬停时灰色蒙版 + 播放按钮（点它=插队立即播放） */
.row-cover {
  position: relative;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  margin-right: 12px;
  border-radius: 4px;
  overflow: hidden;
}
.row-cover :deep(.rc-img) {
  display: block;
  width: 40px;
  height: 40px;
  object-fit: cover;
  background: #333;
}
.cover-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  opacity: 0;
  transition: opacity 0.15s;
  cursor: pointer;
}
.cover-play:hover {
  background: rgba(0, 0, 0, 0.55);
}
.song-table tbody tr:hover .cover-play {
  opacity: 1;
}
.rc-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
