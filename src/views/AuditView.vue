<script setup>
import { ref, onMounted } from 'vue'
import { request, query } from '../api.js'
import DataTable from '../components/DataTable.vue'
const rows = ref([]),
  total = ref(0),
  page = ref(1),
  operation = ref(''),
  error = ref(''),
  busy = ref(false)
async function load() {
  busy.value = true
  error.value = ''
  rows.value = []
  try {
    const data = await request(
      '/audit/operations' + query({ page: page.value, operation: operation.value }),
    )
    rows.value = data.items
    total.value = Number(data.total)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
onMounted(load)
function search() {
  page.value = 1
  return load()
}
function changePage(delta) {
  page.value += delta
  return load()
}
</script>
<template>
  <p class="description">查询登录、管理操作与鉴权记录。部门范围用户只能查看范围内的日志。</p>
  <section class="panel">
    <form class="toolbar" @submit.prevent="search">
      <select v-model="operation" aria-label="日志类型">
        <option value="">全部类型</option>
        <option value="LOGIN">登录</option>
        <option value="AUTH_CHECK">接口鉴权</option>
        <option value="USER_ROLES_REPLACE">角色分配</option>
        <option value="USER_ROLE_CHANGE">单个角色变更</option>
        <option value="OA_ROLE_CHANGE">OA 角色变更</option>
        <option value="HR_TRANSFER">调岗</option>
        <option value="HR_TERMINATE">离职</option>
        <option value="ROLE_MENUS_REPLACE">角色权限配置</option></select
      ><button :disabled="busy">查询</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <DataTable
      :rows="rows"
      :loading="busy"
      :columns="[
        { key: 'createdAt', label: '时间' },
        { key: 'userId', label: '操作人 ID' },
        { key: 'operationType', label: '操作' },
        { key: 'targetId', label: '对象 ID' },
        { key: 'success', label: '结果', format: (v) => (v ? '成功 / 允许' : '失败 / 拒绝') },
        { key: 'detail', label: '详情' },
      ]"
    />
    <footer class="pagination">
      <span>共 {{ total }} 条 · 第 {{ page }} 页</span
      ><button :disabled="page === 1 || busy" @click="changePage(-1)">上一页</button
      ><button :disabled="page * 20 >= total || busy" @click="changePage(1)">下一页</button>
    </footer>
  </section>
</template>
