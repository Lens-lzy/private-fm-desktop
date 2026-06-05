import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  { path: '/home', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/featured', name: 'featured', component: () => import('@/views/FeaturedView.vue') },
  { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue') },
  { path: '/playlist/:id', name: 'playlist', component: () => import('@/views/PlaylistView.vue') },
  { path: '/recents', name: 'recents', component: () => import('@/views/RecentsView.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  { path: '/admin', name: 'admin', component: () => import('@/views/AdminView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/home' }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.user) return { name: 'login' }
  if (to.name === 'login' && auth.user) return { name: 'home' }
  return true
})
