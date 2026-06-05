<script setup lang="ts">
import { useUpdatesStore } from '@/stores/updates'
const u = useUpdatesStore()
</script>

<template>
  <div v-if="u.phase !== 'idle'" class="upd-mask">
    <div class="upd-box">
      <!-- 发现新版本 -->
      <template v-if="u.phase === 'available'">
        <h3>发现新版本 {{ u.info?.latest }}</h3>
        <p class="upd-cur">当前版本 {{ u.info?.current }}</p>
        <pre v-if="u.info?.notes" class="upd-notes">{{ u.info?.notes }}</pre>
        <div class="upd-actions">
          <button @click="u.later()">稍后</button>
          <button @click="u.skip()">跳过此版本</button>
          <button class="primary" @click="u.start()">立即更新</button>
        </div>
      </template>

      <!-- 下载 / 安装中 -->
      <template v-else-if="u.phase === 'downloading'">
        <h3>{{ u.percent >= 100 ? '正在安装，即将自动重启…' : '正在下载更新…' }}</h3>
        <div class="upd-bar"><div class="upd-fill" :style="{ width: u.percent + '%' }"></div></div>
        <p class="upd-pct">{{ u.percent }}%</p>
      </template>

      <!-- 失败兜底 -->
      <template v-else-if="u.phase === 'error'">
        <h3>自动更新未成功</h3>
        <p class="upd-cur">{{ u.errorMsg }}</p>
        <div class="upd-actions">
          <button @click="u.close()">关闭</button>
          <button v-if="u.errorDmg || u.info?.dmgUrl" class="primary" @click="u.openManual()">
            手动下载安装
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.upd-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
}
.upd-box {
  width: 420px;
  max-width: 90vw;
  background: var(--elevated);
  border-radius: 12px;
  padding: 22px 24px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  color: var(--text);
}
.upd-box h3 {
  font-size: 17px;
  margin-bottom: 8px;
}
.upd-cur {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 12px;
}
.upd-notes {
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  background: var(--input-bg);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 16px;
  font-family: inherit;
}
.upd-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.upd-actions button {
  border: 1px solid var(--border-2);
  background: transparent;
  color: var(--text);
  border-radius: 500px;
  padding: 8px 18px;
  cursor: pointer;
  font-weight: 600;
}
.upd-actions button.primary {
  background: var(--green);
  color: #000;
  border-color: var(--green);
}
.upd-bar {
  height: 8px;
  background: var(--input-bg-2);
  border-radius: 4px;
  overflow: hidden;
  margin: 14px 0 8px;
}
.upd-fill {
  height: 100%;
  background: var(--green-bright);
  transition: width 0.2s;
}
.upd-pct {
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}
</style>
