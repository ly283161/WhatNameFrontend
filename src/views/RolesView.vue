<script setup>
import { api } from '../session.js'
import { canGlobal as can } from '../access.js'
import { readAll } from '../api/contracts.js'
import { useList, id } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
const list = useList('/roles'), { dialog, error, notice, busy, perform, saved } = useActions()
const columns = [{ key: 'roleName', label: '角色名称' }, { key: 'roleCode', label: '角色编码' }, { key: 'roleType', label: '角色类型', format: v => ({ 1: '业务角色', 2: '管理角色', 3: '超级角色' })[v] }, { key: 'status', label: '状态' }]
function create() { dialog.value = { title: '新建角色', initial: { roleCode: '', roleName: '', roleType: 1, description: '' }, fields: [{ key: 'roleCode', label: '角色编码' }, { key: 'roleName', label: '角色名称' }, { key: 'roleType', label: '角色类型', options: [{ value: 1, label: '业务角色' }, { value: 2, label: '管理角色' }] }, { key: 'description', label: '描述', type: 'textarea' }], submit: async body => { if (!can('IAM_ROLES_WRITE')) throw new Error('当前没有一级管理员配置资格'); await api('/roles', { method: 'POST', body }); await list.load() } } }
function edit(row) { perform(async () => { const data = await api(`/roles/${id(row.roleId)}`); dialog.value = { title: '编辑角色', initial: { roleName: data.roleName, status: data.status, reason: '' }, fields: [{ key: 'roleName', label: '角色名称' }, { key: 'status', label: '状态', options: [{ value: 1, label: '启用' }, { value: 0, label: '停用' }] }, { key: 'reason', label: '操作原因', type: 'textarea' }], submit: async body => { if (!can('IAM_ROLES_WRITE')) throw new Error('当前没有一级管理员配置资格'); await api(`/roles/${id(row.roleId)}`, { method: 'PATCH', body }); await list.load(list.page) } } }) }
function configure(row) { perform(async () => {
  const current = await api(`/roles/${id(row.roleId)}/menus`)
  const apps = await readAll(api, '/applications')
  const resources = []; let next = 0
  await Promise.all(Array.from({ length: Math.min(4, apps.length) }, async () => {
    while (next < apps.length) { const app = apps[next++]; resources.push(await api('/applications/' + id(app.appId) + '/menus')) }
  }))
  const options = resources.flatMap(r => r.menus.filter(m => m.menuType === 2).map(m => ({ value: m.menuId, label: m.menuName || m.menuCode || m.menuId })))
  for (const menuId of current.menuIds) if (!options.some(o => o.value === menuId)) options.push({ value: menuId, label: `已有菜单 ${menuId}` })
  dialog.value = { title: `配置菜单 · ${row.roleName}`, initial: { menuIds: current.menuIds }, fields: [{ key: 'menuIds', label: '角色菜单（取消全部将清空授权）', type: 'multi', options }], note: '角色权限取菜单并集；保存前由服务端核验集合版本。', submit: async body => { if (!can('IAM_ROLES_WRITE')) throw new Error('当前没有一级管理员配置资格'); if (!current.permissionRevision) throw new Error('缺少角色菜单版本，无法保存'); await api(`/roles/${id(row.roleId)}/menus`, { method: 'PUT', body: { menuIds: body.menuIds, expectedVersion: current.permissionRevision } }); await list.load(list.page) } }
}) }
</script>
<template><div class="page-heading"><div><h1>角色管理</h1><p>按岗位配置菜单权限</p></div><button v-if="can('IAM_ROLES_WRITE')" class="button primary" @click="create">新建角色</button></div><p v-if="error" role="alert" class="app-error">{{ error }}</p><p v-if="notice" role="status" class="action-notice">{{ notice }}</p><RecordTable :state="list" :columns="columns" row-key="roleId"><template #actions="{ row }"><template v-if="can('IAM_ROLES_WRITE') && row.roleType !== 3"><button class="text-button" :disabled="busy" @click="edit(row)">编辑</button><button class="text-button" :disabled="busy" @click="configure(row)">配置权限</button></template><span v-else class="muted">只读</span></template></RecordTable><FormDialog :allowed="can('IAM_ROLES_WRITE')" v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="saved" /></template>
