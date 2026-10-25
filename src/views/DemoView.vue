<script setup>
import { ref, onMounted } from 'vue'
import { request } from '../api.js'
const app = ref('OA'),
  menus = ref([]),
  error = ref(''),
  result = ref(''),
  busy = ref(false)
async function load() {
  menus.value = []
  result.value = ''
  error.value = ''
  try {
    menus.value = (await request('/auth/menus?appCode=' + app.value)).menus.filter((m) => m.path)
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)
async function call(menu) {
  busy.value = true
  error.value = ''
  try {
    const data = await request('/demo/' + app.value + '/' + menu.path.split('/').at(-1))
    result.value = menu.menuName + '：' + data.message
  } catch (e) {
    error.value = e.message
    await load()
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <p class="description">
    同一账号访问不同业务系统。点击功能时，后端会再次校验当前权限；回收角色后下一次调用即拒绝。
  </p>
  <section class="panel">
    <div class="toolbar">
      <select v-model="app" aria-label="演示应用" @change="load">
        <option value="OA">协同办公 OA</option>
        <option value="HR">人力资源 HR</option></select
      ><button @click="load">刷新菜单</button>
    </div>
    <div class="demo-grid">
      <button
        v-for="menu in menus"
        :key="menu.id"
        class="demo-card"
        :disabled="busy"
        @click="call(menu)"
      >
        <span>◈</span>{{ menu.menuName }}<small>进入功能 →</small>
      </button>
    </div>
    <p v-if="!menus.length" class="empty">当前账号没有此应用的菜单权限，请联系管理者分配角色。</p>
    <p v-if="result" role="status" class="notice">{{ result }}</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>
