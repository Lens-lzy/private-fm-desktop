import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/services/api'
import { keyOf } from '@/services/songKey'
import { useUiStore } from './ui'
import type { PlaylistDetail, PlaylistMeta, Song } from '@/types'

/** 歌单 / 收藏：移植 app.js playlists 相关逻辑。默认歌单「我喜欢的」。 */
export const useLibraryStore = defineStore('library', () => {
  const playlists = ref<PlaylistMeta[]>([])
  const activePlaylist = ref<PlaylistDetail | null>(null)
  const likedKeys = ref<string[]>([])

  const defaultPlaylist = computed(() => playlists.value.find((p) => p.isDefault))

  async function loadPlaylists(): Promise<void> {
    try {
      playlists.value = (await api.playlists()).playlists || []
    } catch {
      playlists.value = []
    }
    await refreshLikedKeys()
  }

  async function refreshLikedKeys(): Promise<void> {
    const d = defaultPlaylist.value
    if (!d) {
      likedKeys.value = []
      return
    }
    try {
      const p = (await api.playlist(d.id)).playlist
      likedKeys.value = p.songs.map((s) => keyOf(s))
    } catch {
      /* 静默 */
    }
  }

  async function openPlaylist(id: number | string): Promise<PlaylistDetail | null> {
    try {
      const p = (await api.playlist(id)).playlist
      activePlaylist.value = p
      return p
    } catch (e) {
      useUiStore().toast('打开歌单失败：' + (e instanceof Error ? e.message : ''))
      return null
    }
  }

  function isLiked(s: Song): boolean {
    return likedKeys.value.includes(keyOf(s))
  }

  async function toggleLike(s: Song): Promise<void> {
    const d = defaultPlaylist.value
    if (!d) return
    const k = keyOf(s)
    try {
      if (likedKeys.value.includes(k)) await api.removeFromPlaylist(d.id, k)
      else await api.addToPlaylist(d.id, s)
      await loadPlaylists()
      if (activePlaylist.value && activePlaylist.value.id === d.id) {
        activePlaylist.value = (await api.playlist(d.id)).playlist
      }
    } catch (e) {
      useUiStore().toast(e instanceof Error ? e.message : '操作失败')
    }
  }

  async function createPlaylist(name: string): Promise<void> {
    const n = name.trim()
    if (!n) return
    await api.createPlaylist(n)
    await loadPlaylists()
  }

  async function deletePlaylist(p: PlaylistMeta): Promise<void> {
    if (p.isDefault) return
    await api.deletePlaylist(p.id)
    if (activePlaylist.value && activePlaylist.value.id === p.id) activePlaylist.value = null
    await loadPlaylists()
  }

  async function renamePlaylist(id: number | string, name: string): Promise<void> {
    const n = name.trim()
    if (!n) return
    await api.renamePlaylist(id, n)
    await loadPlaylists()
    if (activePlaylist.value && activePlaylist.value.id === id) activePlaylist.value.name = n
  }

  async function addSongToPlaylist(id: number | string, song: Song): Promise<void> {
    try {
      await api.addToPlaylist(id, song)
      await loadPlaylists()
      if (activePlaylist.value && activePlaylist.value.id === id) {
        activePlaylist.value = (await api.playlist(id)).playlist
      }
      useUiStore().toast('已添加到歌单')
    } catch (e) {
      useUiStore().toast(e instanceof Error ? e.message : '添加失败')
    }
  }

  async function removeSongFromActive(song: Song): Promise<void> {
    const p = activePlaylist.value
    if (!p) return
    try {
      await api.removeFromPlaylist(p.id, keyOf(song))
      activePlaylist.value = (await api.playlist(p.id)).playlist
      await loadPlaylists()
    } catch (e) {
      useUiStore().toast(e instanceof Error ? e.message : '移除失败')
    }
  }

  function reset(): void {
    playlists.value = []
    activePlaylist.value = null
    likedKeys.value = []
  }

  return {
    playlists,
    activePlaylist,
    likedKeys,
    defaultPlaylist,
    loadPlaylists,
    refreshLikedKeys,
    openPlaylist,
    isLiked,
    toggleLike,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromActive,
    reset
  }
})
