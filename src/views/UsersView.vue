<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Search } from 'lucide-vue-next'
import { api } from '../session.js'
import { ApiError } from '../api/client.js'

const keyword = ref(''), rows = ref([]), page = ref(1), total = ref(0), busy = ref(false), error = ref('')
const pageSize = 20
let controller
let requestNumber = 0
async function load(targetPage = 1) {
  controller?.abort()
  controller = new AbortController()
  const currentRequest = ++requestNumber
  busy.value = true; error.value = ''; rows.value = []; total.value = 0
  try {
    const data = await api('/users', { query: { keyword: keyword.value.trim(), page: targetPage, pageSize }, signal: controller.signal })
    if (currentRequest !== requestNumber) return
    if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0 || data.page !== targetPage || data.pageSize !== pageSize || data.items.some(u => !u || typeof u.userId !== 'string')) throw new ApiError('用户列表响应不符合接口约定')
    rows.value = data.items; total.value = data.total; page.value = data.page
  } catch (failure) {
    if (currentRequest === requestNumber) error.value = failure.message + (failure.requestId ? `（请求编号：${failure.requestId}）` : '')
  } finally { if (currentRequest === requestNumber) busy.value = false }
}
onMounted(() => load())
onBeforeUnmount(() => { requestNumber++; controller?.abort() })
</script>

<template>
  <div class="page-heading"><div><h1>用户账号</h1><p>查询管理范围内的用户</p></div></div>
  <section class="panel table-panel" :aria-busy="busy">
    <form class="table-toolbar" @submit.prevent="load(1)"><label class="search-field"><Search :size="17" /><input v-model="keyword" aria-label="搜索姓名、账号或工号" placeholder="搜索姓名、账号或工号" maxlength="100" /></label><button class="button light" type="submit" :disabled="busy">查询</button></form>
    <div v-if="error" class="list-error"><p role="alert" class="app-error">{{ error }}</p><button class="button light" :disabled="busy" @click="load(page)">重新加载</button></div>
    <div v-else class="table-scroll"><table><thead><tr><th>姓名</th><th>账号 / 工号</th><th>手机号</th><th>部门 ID</th><th>状态</th></tr></thead><tbody><tr v-for="user in rows" :key="user.userId"><td><strong>{{ user.realName }}</strong></td><td>{{ user.username }}<small class="cell-secondary">{{ user.sgNo || '无工号' }}</small></td><td>{{ user.phoneMasked }}</td><td>{{ user.deptId }}</td><td><span class="tag neutral">{{ ({ 1: '可用', 2: '暂停', 3: '离职' })[user.status] || '未知状态' }}</span></td></tr><tr v-if="!rows.length"><td colspan="5" class="empty" role="status">{{ busy ? '正在加载…' : '没有找到符合条件的账号' }}</td></tr></tbody></table></div>
    <div v-if="!error" class="table-footer"><span>共 {{ total }} 个账号 · 第 {{ page }} 页</span><div class="pagination"><button class="button light" :disabled="busy || page <= 1" @click="load(page - 1)">上一页</button><button class="button light" :disabled="busy || page * pageSize >= total" @click="load(page + 1)">下一页</button></div></div>
  </section>
</template>
