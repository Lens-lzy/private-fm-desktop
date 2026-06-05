<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/services/http'

const props = defineProps<{ forced?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const oldPwd = ref('')
const newPwd = ref('')
const msg = ref(props.forced ? '管理员已重置你的密码，请设置一个新密码后继续使用。' : '')
const ok = ref(false)

async function submit(): Promise<void> {
  if (!oldPwd.value || !newPwd.value) {
    msg.value = '请填写原密码和新密码'
    return
  }
  try {
    await auth.changePassword(oldPwd.value, newPwd.value)
    ok.value = true
    msg.value = '修改成功'
    setTimeout(() => emit('close'), 800)
  } catch (e) {
    msg.value = e instanceof ApiError ? e.message : '修改失败'
  }
}

function close(): void {
  if (props.forced) return // 强制改密不可关闭
  emit('close')
}
</script>

<template>
  <div class="modal-mask" @click.self="close">
    <div class="modal modal-sm">
      <div class="modal-head">
        <h3>修改密码</h3>
        <span v-if="!forced" class="modal-close" @click="close">×</span>
      </div>
      <div class="modal-body">
        <div v-if="forced" class="force-note">{{ msg }}</div>
        <input v-model="oldPwd" type="password" placeholder="原密码 / 临时密码" />
        <input v-model="newPwd" type="password" placeholder="新密码" @keyup.enter="submit" />
        <div v-if="!forced && msg" :class="ok ? 'invite-ok' : 'login-err'">{{ msg }}</div>
        <button class="primary" @click="submit">确认修改</button>
      </div>
    </div>
  </div>
</template>
