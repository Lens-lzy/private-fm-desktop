<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { useSearchStore } from '@/stores/search'
import { useUiStore } from '@/stores/ui'
import { useLibraryStore } from '@/stores/library'
import { useMenusStore } from '@/stores/menus'
import { useSettingsStore } from '@/stores/settings'
import PlayerBar from './PlayerBar.vue'
import QueuePanel from './QueuePanel.vue'
import NowPlaying from './NowPlaying.vue'
import Toast from './Toast.vue'
import ContextMenu from './ContextMenu.vue'
import AddToPlaylistMenu from './AddToPlaylistMenu.vue'
import ReplaceDialog from './ReplaceDialog.vue'
import UpdateModal from './UpdateModal.vue'
import Icon from './Icon.vue'
import { useUpdatesStore } from '@/stores/updates'
import { useNowPlayingSync } from '@/composables/useNowPlayingSync'
import { useMediaKeys } from '@/composables/useMediaKeys'
import { useShortcuts } from '@/composables/useShortcuts'
import { useDesktopLyricsSync } from '@/composables/useDesktopLyricsSync'

const auth = useAuthStore()
const player = usePlayerStore()
const search = useSearchStore()
const ui = useUiStore()
const library = useLibraryStore()
const menus = useMenusStore()
const settings = useSettingsStore()
const updates = useUpdatesStore()
const router = useRouter()
const route = useRoute()

useNowPlayingSync()
useMediaKeys()
useShortcuts()
useDesktopLyricsSync()

const keyword = ref('')
const userMenuOpen = ref(false)
const searchFocused = ref(false)
const showNewPl = ref(false)
const newPlName = ref('')

function go(name: string): void {
  router.push({ name })
}
function isActive(name: string): boolean {
  return route.name === name
}
function isPlaylistActive(id: number): boolean {
  return route.name === 'playlist' && String(route.params.id) === String(id)
}
function doSearch(kw?: string): void {
  const q = (typeof kw === 'string' ? kw : keyword.value).trim()
  if (!q) return
  keyword.value = q
  searchFocused.value = false
  router.push({ name: 'search', query: { q } })
}
function onSearchFocus(): void {
  searchFocused.value = true
  if (!search.history.length) void search.loadHistory()
}
function openPlaylist(id: number): void {
  router.push({ name: 'playlist', params: { id: String(id) } })
}
async function createPl(): Promise<void> {
  const n = newPlName.value.trim()
  if (!n) return
  await library.createPlaylist(n)
  newPlName.value = ''
  showNewPl.value = false
}
async function delPl(id: number, name: string, isDefault: boolean): Promise<void> {
  if (isDefault) return
  if (confirm(`删除歌单「${name}」？`)) {
    await library.deletePlaylist({ id, name, isDefault, count: 0 })
    if (isPlaylistActive(id)) router.push({ name: 'home' })
  }
}
async function logout(): Promise<void> {
  userMenuOpen.value = false
  player.reset()
  library.reset()
  await auth.logout()
  router.replace({ name: 'login' })
}
function skinSoon(): void {
  ui.toast('皮肤功能开发中，敬请期待 👕')
}
function closeOverlays(): void {
  userMenuOpen.value = false
  ui.queueOpen = false
  searchFocused.value = false
  menus.closeMenus()
}

onMounted(() => {
  void player.restoreQueue()
  void search.loadPlatforms()
  void library.loadPlaylists()
  void settings.syncDesktopLyrics()
  settings.watchDesktopLyricsState()
  updates.bind()
})
</script>

<template>
  <div class="shell" @click="closeOverlays">
    <div class="titlebar"></div>
    <header class="topbar">
      <div class="brand"><span class="logo">Private FM</span></div>
      <div class="search">
        <div class="search-box" @click.stop>
          <input
            v-model="keyword"
            placeholder="搜索歌曲、歌手"
            @focus="onSearchFocus"
            @keyup.enter="doSearch()"
          />
          <div v-if="searchFocused && search.history.length" class="search-history">
            <div class="sh-head">
              <span>搜索历史</span>
              <span class="sh-clear" @click="search.clearHistory()">清空</span>
            </div>
            <div v-for="kw in search.history" :key="kw" class="sh-item" @click="doSearch(kw)">
              <span class="sh-kw">{{ kw }}</span>
              <span class="sh-del" @click.stop="search.removeHistory(kw)">×</span>
            </div>
          </div>
        </div>
        <button @click="doSearch()">搜索</button>
      </div>
      <div class="topbar-right">
        <div class="user-menu" @click.stop>
          <div class="user-name" @click="userMenuOpen = !userMenuOpen">
            {{ auth.user?.username }}
            <span v-if="auth.user?.isAdmin" class="badge-admin">管理员</span>
          </div>
          <div v-if="userMenuOpen" class="user-dropdown">
            <div v-if="auth.user?.isAdmin" class="dd-item" @click="go('admin'); userMenuOpen = false">
              成员管理
            </div>
            <div class="dd-item" @click="logout">退出登录</div>
          </div>
        </div>
        <button class="icon-btn" :class="{ active: isActive('settings') }" title="设置" @click="go('settings')">
          <Icon name="settings" :size="18" />
        </button>
        <button class="icon-btn" title="皮肤（开发中）" @click="skinSoon">
          <Icon name="shirt" :size="18" />
        </button>
      </div>
    </header>

    <div class="main">
      <aside class="sidebar">
        <div class="nav-group">
          <div class="nav-title">发现</div>
          <div class="nav-item" :class="{ active: isActive('home') }" @click="go('home')">
            <Icon name="sparkles" :size="17" /><span>推荐</span>
          </div>
          <div class="nav-item" :class="{ active: isActive('featured') }" @click="go('featured')">
            <Icon name="trophy" :size="17" /><span>热门榜单</span>
          </div>
          <div class="nav-item" :class="{ active: isActive('recents') }" @click="go('recents')">
            <Icon name="clock" :size="17" /><span>最近播放</span>
          </div>
        </div>
        <div class="nav-group">
          <div class="nav-title">
            我的歌单
            <span class="nav-add" title="新建歌单" @click.stop="showNewPl = !showNewPl">
              <Icon name="plus" :size="16" />
            </span>
          </div>
          <div v-if="showNewPl" class="new-pl" @click.stop>
            <input v-model="newPlName" placeholder="歌单名" @keyup.enter="createPl" />
            <button @click="createPl">建</button>
          </div>
          <div
            v-for="p in library.playlists"
            :key="p.id"
            class="nav-item playlist-item"
            :class="{ active: isPlaylistActive(p.id) }"
            @click="openPlaylist(p.id)"
          >
            <Icon :name="p.isDefault ? 'heart-fill' : 'music'" :size="16" :class="{ 'pl-heart': p.isDefault }" />
            <span class="pl-name">{{ p.name }}</span>
            <span class="pl-count">{{ p.count }}</span>
            <span
              v-if="!p.isDefault"
              class="pl-del"
              title="删除"
              @click.stop="delPl(p.id, p.name, p.isDefault)"
            >
              <Icon name="x" :size="15" />
            </span>
          </div>
        </div>
      </aside>

      <main class="content">
        <router-view />
      </main>
    </div>

    <PlayerBar />
    <QueuePanel v-if="ui.queueOpen" />
    <NowPlaying />
    <ContextMenu />
    <AddToPlaylistMenu />
    <ReplaceDialog />
    <UpdateModal />
    <Toast />
  </div>
</template>

<style scoped>
.shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-deep);
  overflow: hidden;
  position: relative;
}
</style>
