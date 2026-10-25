<script setup>
import { ref, onMounted } from 'vue'
import { can, request, query, refreshSession } from '../api.js'
import DataTable from '../components/DataTable.vue'
import EditDialog from '../components/EditDialog.vue'
const props = defineProps({ grantMode: Boolean })
const rows = ref([]),
  departments = ref([]),
  roles = ref([]),
  total = ref(0),
  page = ref(1),
  keyword = ref(''),
  deptId = ref(''),
  error = ref(''),
  busy = ref(false),
  dialog = ref(null),
  selected = ref([]),
  batchRole = ref(''),
  batchResult = ref(null)
const columns = [
  { key: 'username', label: '账号' },
  { key: 'realName', label: '姓名' },
  { key: 'phone', label: '手机号' },
  {
    key: 'deptId',
    label: '所属部门',
    format: (id) => departments.value.find((d) => d.id === id)?.deptName || id,
  },
  {
    key: 'source',
    label: '来源',
    format: (v) => ({ 1: 'HR 同步', 2: '临时账号', 3: '受控初始化' })[v],
  },
  { key: 'status', label: '状态', format: (v) => ({ 1: '可用', 2: '暂停', 3: '离职' })[v] },
  {
    key: 'managementScope',
    label: '管理范围',
    format: (v) => (v === 'ALL' ? '全公司' : '本部门及下属'),
  },
]
function search() {
  page.value = 1
  return load()
}
function changePage(delta) {
  page.value += delta
  return load()
}
async function load() {
  busy.value = true
  error.value = ''
  rows.value = []
  selected.value = []
  try {
    const data = await request(
      '/users' +
        query({ keyword: keyword.value, deptId: deptId.value, page: page.value, pageSize: 20 }),
    )
    rows.value = data.items
    total.value = Number(data.total)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
onMounted(async () => {
  try {
    departments.value = await request('/departments')
    if (can('IAM_GRANTS_VIEW')) roles.value = await request('/roles')
  } catch (e) {
    error.value = e.message
  }
  await load()
})
function open(title, fields, initial, save) {
  dialog.value = {
    title,
    fields,
    initial,
    save: async (body) => {
      await save(body)
      await refreshSession()
    },
  }
}
function temporary() {
  open(
    '创建临时账号',
    [
      { key: 'username', label: '账号', max: 64 },
      { key: 'realName', label: '姓名', max: 64 },
      { key: 'phone', label: '手机号', max: 11 },
      {
        key: 'deptId',
        label: '所属部门',
        type: 'select',
        options: departments.value.map((d) => ({ value: d.id, label: d.deptName })),
      },
      { key: 'password', label: '初始密码', type: 'password', hint: '8–64 位，包含字母和数字' },
    ],
    { deptId: departments.value[0]?.id },
    (body) => request('/users/temporary', { method: 'POST', body }),
  )
}
function edit(row) {
  open(
    '维护临时账号',
    [
      { key: 'realName', label: '姓名', max: 64 },
      { key: 'phone', label: '手机号', max: 11 },
    ],
    row,
    (body) => request('/users/' + row.id, { method: 'PATCH', body }),
  )
}
function reset(row) {
  open(
    '重置密码 · ' + row.realName,
    [{ key: 'password', label: '新密码', type: 'password', hint: '保存后，该账号全部旧会话失效' }],
    {},
    (body) => request(`/users/${row.id}/password`, { method: 'PUT', body }),
  )
}
function scope(row) {
  open(
    '管理数据范围 · ' + row.realName,
    [
      {
        key: 'managementScope',
        label: '数据范围',
        type: 'select',
        options: [
          { value: 'DEPT_TREE', label: '本部门及下属部门' },
          { value: 'ALL', label: '全公司' },
        ],
        hint: '范围只限定管理对象，实际操作仍需角色权限',
      },
    ],
    row,
    (body) => request(`/users/${row.id}/scope`, { method: 'PUT', body }),
  )
}
async function assign(row) {
  try {
    const roleIds = await request(`/users/${row.id}/roles`)
    open(
      '分配角色 · ' + row.realName,
      [
        {
          key: 'roleIds',
          label: '角色',
          type: 'checks',
          options: roles.value
            .filter((r) => r.status === 1 || roleIds.includes(r.id))
            .map((r) => ({
              value: r.id,
              label: r.roleName + (r.status === 1 ? '' : '（已停用）'),
            })),
          hint: '勾选即拥有，取消即回收；保存完整配置',
        },
      ],
      { roleIds: roleIds.map(String) },
      (body) => request(`/users/${row.id}/roles`, { method: 'PUT', body }),
    )
  } catch (e) {
    error.value = e.message
  }
}
async function status(row) {
  if (
    !window.confirm(
      row.status === 1
        ? `暂停 ${row.realName}？该账号的角色将清空，旧会话失效。`
        : `恢复 ${row.realName}？恢复后需重新分配角色。`,
    )
  )
    return
  try {
    await request(`/users/${row.id}/status`, {
      method: 'PATCH',
      body: { status: row.status === 1 ? 2 : 1 },
    })
    await refreshSession()
    await load()
  } catch (e) {
    error.value = e.message
  }
}
async function batch(operation) {
  if (!selected.value.length || !batchRole.value || busy.value) return
  if (
    !window.confirm(
      `对所选 ${selected.value.length} 人${operation === 'GRANT' ? '授予' : '回收'}角色？`,
    )
  )
    return
  busy.value = true
  error.value = ''
  try {
    batchResult.value = await request('/grants/batch', {
      method: 'POST',
      body: { userIds: selected.value, roleId: batchRole.value, operation },
    })
    await refreshSession()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <p class="description">
    {{
      grantMode
        ? '为管理范围内的用户授予或回收角色。多个角色的权限共同生效。'
        : '统一维护账号，正式员工由 HR 同步，外部人员使用临时账号。'
    }}
  </p>
  <section class="panel">
    <form class="toolbar" @submit.prevent="search">
      <input v-model="keyword" aria-label="搜索用户" placeholder="搜索姓名、账号或工号" /><select
        v-model="deptId"
        aria-label="筛选部门"
      >
        <option value="">全部可见部门</option>
        <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.deptName }}</option></select
      ><button :disabled="busy">查询</button
      ><button
        v-if="can('IAM_USERS_WRITE') && !grantMode"
        type="button"
        class="primary"
        @click="temporary"
      >
        创建临时账号
      </button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div v-if="grantMode && can('IAM_GRANTS_WRITE')" class="batch-bar">
      <span>已选 {{ selected.length }} 人</span
      ><select v-model="batchRole" aria-label="批量角色">
        <option value="">选择角色</option>
        <option v-for="r in roles.filter((r) => r.status === 1)" :key="r.id" :value="r.id">
          {{ r.roleName }}
        </option></select
      ><button :disabled="busy || !selected.length || !batchRole" @click="batch('GRANT')">
        批量授予</button
      ><button :disabled="busy || !selected.length || !batchRole" @click="batch('REVOKE')">
        批量回收
      </button>
    </div>
    <DataTable :rows="rows" :columns="columns" :loading="busy"
      ><template #actions="{ row }">
        <label v-if="grantMode && can('IAM_GRANTS_WRITE')" class="check"
          ><input
            v-model="selected"
            type="checkbox"
            :value="row.id"
            :aria-label="'选择' + row.realName"
          />选择</label
        >
        <button v-if="can('IAM_GRANTS_VIEW') && can('IAM_GRANTS_WRITE')" @click="assign(row)">
          角色
        </button>
        <button v-if="!grantMode && row.source === 2 && can('IAM_USERS_WRITE')" @click="edit(row)">
          编辑
        </button>
        <button
          v-if="!grantMode && row.source === 2 && can('IAM_USERS_WRITE')"
          @click="status(row)"
        >
          {{ row.status === 1 ? '暂停' : '恢复' }}
        </button>
        <button
          v-if="!grantMode && row.status !== 3 && can('IAM_PASSWORD_RESET')"
          @click="reset(row)"
        >
          重置密码
        </button>
        <button v-if="!grantMode && can('IAM_SCOPE_WRITE')" @click="scope(row)">范围</button>
      </template></DataTable
    >
    <footer class="pagination">
      <span>共 {{ total }} 人 · 第 {{ page }} 页</span
      ><button :disabled="page === 1 || busy" @click="changePage(-1)">上一页</button
      ><button :disabled="page * 20 >= total || busy" @click="changePage(1)">下一页</button>
    </footer>
  </section>
  <section v-if="batchResult" class="panel result">
    <h3>批量结果：{{ batchResult.succeeded }} / {{ batchResult.total }} 人成功</h3>
    <ul>
      <li v-for="item in batchResult.items" :key="item.userId">
        用户 {{ item.userId }}：{{ item.success ? '成功' : item.message }}
      </li>
    </ul>
  </section>
  <EditDialog v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="load" />
</template>
