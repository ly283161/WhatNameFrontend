<script setup>
import { ref, onMounted } from 'vue'
import { request, can, refreshSession } from '../api.js'
import DataTable from '../components/DataTable.vue'
const rows = ref([]),
  error = ref(''),
  busy = ref(false)
async function load() {
  busy.value = true
  rows.value = []
  try {
    rows.value = await request('/departments')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
onMounted(load)
async function freeze(row) {
  if (
    !window.confirm(
      `${row.status === 1 ? '冻结' : '解冻'} ${row.deptName}？冻结会影响该部门及下属部门的全部权限。`,
    )
  )
    return
  try {
    await request(`/departments/${row.id}/${row.status === 1 ? 'freeze' : 'unfreeze'}`, {
      method: 'POST',
    })
    await refreshSession()
    await load()
  } catch (e) {
    error.value = e.message
  }
}
</script>
<template>
  <p class="description">
    组织由 HR 同步。冻结部门会阻止该部门及下属部门使用权限，解冻后原授权恢复。
  </p>
  <section class="panel">
    <div class="toolbar">
      <span class="muted">{{ rows.length }} 个可见部门</span
      ><button :disabled="busy" @click="load">刷新</button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <DataTable
      :rows="rows"
      :loading="busy"
      :columns="[
        { key: 'deptCode', label: '部门编码' },
        { key: 'deptName', label: '部门名称' },
        {
          key: 'parentId',
          label: '上级部门',
          format: (id) => (id === '0' ? '顶级部门' : rows.find((d) => d.id === id)?.deptName || id),
        },
        {
          key: 'status',
          label: '状态',
          format: (v, row) => (row.mergedIntoDeptId ? '已合并' : v === 1 ? '正常' : '冻结'),
        },
      ]"
      ><template #actions="{ row }"
        ><button v-if="can('IAM_DEPTS_FREEZE') && !row.mergedIntoDeptId" @click="freeze(row)">
          {{ row.status === 1 ? '冻结' : '解冻' }}
        </button></template
      ></DataTable
    >
  </section>
</template>
