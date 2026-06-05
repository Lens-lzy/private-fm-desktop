<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'

const auth = useAuthStore()
</script>

<template>
  <div class="app-root">
    <AppShell v-if="auth.user" />
    <router-view v-else />
    <ChangePasswordModal v-if="auth.forceChangePassword" :forced="true" />
  </div>
</template>

<style scoped>
.app-root {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}
</style>
