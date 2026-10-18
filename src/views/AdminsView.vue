<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../session.js'
import { can } from '../access.js'
import { useList, id } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
import DetailPanel from '../components/DetailPanel.vue'
const deptId = ref(''), scope = ref(null), list = useList('/admins', () => ({ deptId: deptId.value }))
const { dialog, error, notice, busy, perform, saved } = useActions()
onMounted(() => perform(async () => { const data = await api('/admins/me/scope'); scope.value = [['任命状态', data.appointed ? '有效' : '未任命'], ['管理员等级', data.adminLevel], ['所属部门 ID', data.deptId], ['管理根部门', data.scopeRootIds.join('、')]] }))
function appoint() { dialog.value = { title: '任命管理员', initial: { userId: '', adminLevel: 2, deptId: '', reason: '' }, fields: [{ key: 'userId', label: '用户 ID' }, { key: 'adminLevel', label: '管理员等级', type: 'number', min: 1, max: 100 }, { key: 'deptId', label: '管理部门 ID' }, { key: 'reason', label: '任命原因', type: 'textarea' }], note: '由服务端核验等级和管理范围，任命不直接授予角色。', submit: async body => { await api('/admins/appointments', { method: 'POST', body }); await list.load() } } }
function revoke(row) { dialog.value = { title: '撤销管理员任命', fields: [{ key: 'reason', label: '撤销原因', type: 'textarea' }], initial: { reason: '' }, note: `用户 ${row.userId} 的管理资格将撤销，历史授予的普通角色不自动删除。`, submit: async body => { await api(`/admins/${id(row.userId)}/revoke`, { method: 'POST', body }); await list.load(list.page) } } }
function delegate(row) { perform(async () => {
  const current = await api(`/admins/${id(row.userId)}/delegable-roles`)
  const options = current.roleIds.map(value => ({ value, label: `角色 ${value}` }))
  if (can('IAM_ROLES_VIEW')) { const roles = await api('/roles', { query: { page: 1, pageSize: 500 } }); if (roles.total > roles.items.length) throw new Error('角色清单未完整加载，无法全量替换'); for (const role of roles.items.filter(r => r.roleType !== 3)) { const existing = options.find(o => o.value === role.roleId); if (existing) existing.label = role.roleName; else options.push({ value: role.roleId, label: role.roleName }) } }
  dialog.value = { title: '配置可授权角色清单', initial: { roleIds: current.roleIds, reason: '' }, fields: [{ key: 'roleIds', label: '可授予角色（取消全部将清空清单）', type: 'multi', options }, { key: 'reason', label: '配置原因', type: 'textarea' }], submit: async body => { if (!current.delegationVersion) throw new Error('缺少清单版本，无法保存'); await api(`/admins/${id(row.userId)}/delegable-roles`, { method: 'PUT', body: { ...body, expectedVersion: current.delegationVersion } }); await list.load(list.page) } }
}) }
</script>
<template><div class="page-heading"><div><h1>管理员管理</h1><p>管理员任命、等级与管理范围</p></div><button v-if="can('IAM_ADMINS_WRITE')" class="button primary" @click="appoint">任命管理员</button></div><p v-if="error" role="alert" class="app-error">{{ error }}</p><p v-if="notice" role="status" class="action-notice">{{ notice }}</p><DetailPanel v-if="scope" title="本人管理范围" :entries="scope" @close="scope = null" /><RecordTable :state="list" :columns="[{ key: 'userId', label: '用户 ID' }, { key: 'adminLevel', label: '管理员等级' }, { key: 'deptId', label: '管理部门 ID' }, { key: 'status', label: '状态' }]" row-key="userId"><template #toolbar><form class="inline-form" @submit.prevent="list.load()"><input v-model="deptId" aria-label="管理员部门 ID" placeholder="按部门 ID 查询" /><button class="button light">查询</button></form></template><template #actions="{ row }"><button v-if="can('IAM_ADMINS_WRITE') && row.status === 1" class="text-button" @click="revoke(row)">撤销任命</button><button v-if="can('IAM_GRANTS_DELEGATE')" class="text-button" :disabled="busy" @click="delegate(row)">可授权清单</button></template></RecordTable><FormDialog v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="saved" /></template>
