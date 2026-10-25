<script setup>
import { ref, onMounted } from 'vue'
import { request, can, refreshSession } from '../api.js'
import DataTable from '../components/DataTable.vue'
import EditDialog from '../components/EditDialog.vue'
const rows = ref([]),
  error = ref(''),
  busy = ref(false),
  dialog = ref(null)
async function load() {
  busy.value = true
  error.value = ''
  rows.value = []
  try {
    rows.value = await request('/roles')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
onMounted(load)
function edit(row) {
  dialog.value = {
    title: row ? '编辑角色' : '新建角色',
    fields: [
      ...(row ? [] : [{ key: 'roleCode', label: '角色编码', max: 64 }]),
      { key: 'roleName', label: '角色名称' },
      { key: 'roleDesc', label: '描述', type: 'textarea', optional: true },
      {
        key: 'status',
        label: '状态',
        type: 'select',
        options: [
          { value: 1, label: '启用' },
          { value: 0, label: '停用' },
        ],
      },
    ],
    initial: row || { status: '1' },
    save: async (body) => {
      await request('/roles' + (row ? '/' + row.id : ''), { method: row ? 'PATCH' : 'POST', body })
      await refreshSession()
    },
  }
}
async function permissions(row) {
  try {
    const selected = await request(`/roles/${row.id}/menus`)
    const apps = await request('/applications'),
      options = []
    for (const app of apps) {
      const menus = await request(`/applications/${app.id}/menus`)
      options.push(
        ...menus
          .filter((m) => m.menuType === 2)
          .map((m) => ({ value: m.id, label: `${app.appName} / ${m.menuName}` })),
      )
    }
    dialog.value = {
      title: '配置权限 · ' + row.roleName,
      fields: [
        {
          key: 'menuIds',
          label: '菜单权限',
          type: 'checks',
          options,
          hint: '目录只负责导航；菜单权限决定可以调用的接口',
        },
      ],
      initial: { menuIds: selected.map(String) },
      save: async (body) => {
        await request(`/roles/${row.id}/menus`, { method: 'PUT', body })
        await refreshSession()
      },
    }
  } catch (e) {
    error.value = e.message
  }
}
</script>
<template>
  <p class="description">按岗位或职责组织角色，再为角色配置菜单权限。角色之间没有等级和继承。</p>
  <section class="panel">
    <div class="toolbar">
      <span class="muted">共 {{ rows.length }} 个角色</span
      ><button v-if="can('IAM_ROLES_WRITE')" class="primary" @click="edit(null)">新建角色</button>
    </div>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <DataTable
      :rows="rows"
      :loading="busy"
      :columns="[
        { key: 'roleCode', label: '角色编码' },
        { key: 'roleName', label: '名称' },
        { key: 'roleDesc', label: '描述' },
        { key: 'status', label: '状态', format: (v) => (v === 1 ? '启用' : '停用') },
      ]"
      ><template #actions="{ row }"
        ><button v-if="can('IAM_ROLES_WRITE')" @click="edit(row)">编辑</button
        ><button
          v-if="can('IAM_ROLE_PERMISSIONS_WRITE') && can('IAM_RESOURCES_VIEW')"
          @click="permissions(row)"
        >
          配置权限
        </button></template
      ></DataTable
    >
  </section>
  <EditDialog v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="load" />
</template>
