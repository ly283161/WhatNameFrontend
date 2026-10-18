<script setup>
import { ref } from 'vue'
import { api } from '../session.js'
import { can } from '../access.js'
import { useList, id, statusText } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
import DetailPanel from '../components/DetailPanel.vue'
const keyword = ref(''), deptId = ref(''), detail = ref(null)
const list = useList('/users', () => ({ keyword: keyword.value.trim(), deptId: deptId.value }))
const depts = useList('/departments', () => ({ includeDescendants: true }), { paginated: false, auto: can('IAM_DEPTS_VIEW') })
const { dialog, error, notice, busy, perform, saved } = useActions()
const columns = [{ key: 'realName', label: '姓名' }, { key: 'username', label: '账号' }, { key: 'sgNo', label: '工号' }, { key: 'phoneMasked', label: '手机号' }, { key: 'deptId', label: '部门', format: v => depts.rows.find(d => d.deptId === v)?.deptName || v }, { key: 'status', label: '状态' }]
function create() {
  dialog.value = { title: '新建临时账号', initial: { deptId: '', realName: '', phone: '', reason: '' }, fields: [
    { key: 'realName', label: '姓名' }, { key: 'phone', label: '手机号', type: 'tel', pattern: '1[0-9]{10}', maxlength: 11 },
    { key: 'deptId', label: '所属部门', ...(depts.rows.length ? { options: depts.rows.map(d => ({ value: d.deptId, label: d.deptName })) } : {}) }, { key: 'reason', label: '用途', type: 'textarea' },
  ], note: '账号由服务端生成，无工号；本人首次验证设密后才能登录。', submit: async body => { await api('/users/temporary', { method: 'POST', body }); await list.load() } }
}
function toggle(user) {
  dialog.value = { title: user.status === 1 ? '暂停账号' : '恢复账号', initial: { reason: '' }, fields: [{ key: 'reason', label: '操作原因', type: 'textarea' }], note: `目标账号：${user.username}。历史记录和角色关系保留。`, submit: async body => { await api(`/users/${id(user.userId)}/status`, { method: 'PATCH', body: { ...body, status: user.status === 1 ? 2 : 1 } }); await list.load(list.page) } }
}
function show(user) { perform(async () => { const [data, roles] = await Promise.all([api(`/users/${id(user.userId)}`), api(`/users/${id(user.userId)}/roles`)]); detail.value = [['姓名', data.realName], ['账号', data.username], ['工号', data.sgNo || '无工号'], ['手机号', data.phoneMasked], ['状态', statusText(data.status)], ['密码', data.passwordInitialized ? '已设置' : '未设密'], ['有效角色', roles.roles.filter(r => r.active).map(r => r.roleId).join('、') || '未分配']] }) }
function permissions(user) { dialog.value = { title: '查询用户有效菜单', initial: { appCode: '' }, fields: [{ key: 'appCode', label: '应用编码' }], submit: async body => { const data = await api(`/users/${id(user.userId)}/permissions`, { query: body }); detail.value = [['账号', user.username], ['应用', data.appCode], ['有效菜单', data.menus.map(m => m.menuCode).join('、') || '无可用菜单']] } } }
</script>
<template>
  <div class="page-heading"><div><h1>用户账号</h1><p>管理账号与账号状态</p></div><button v-if="can('IAM_USERS_WRITE')" class="button primary" @click="create">新建临时账号</button></div>
  <p v-if="error" class="app-error" role="alert">{{ error }}</p><p v-if="notice" class="action-notice" role="status">{{ notice }}</p>
  <RecordTable :state="list" :columns="columns" row-key="userId"><template #toolbar><form class="inline-form" @submit.prevent="list.load()"><input v-model="keyword" aria-label="搜索姓名、账号或工号" placeholder="搜索姓名、账号或工号" /><select v-if="depts.rows.length" v-model="deptId" aria-label="筛选部门"><option value="">全部部门</option><option v-for="d in depts.rows" :key="d.deptId" :value="d.deptId">{{ d.deptName }}</option></select><button class="button light" :disabled="list.busy">查询</button></form></template><template #actions="{ row }"><button class="text-button" :disabled="busy" @click="show(row)">详情</button><button class="text-button" @click="permissions(row)">有效菜单</button><button v-if="can('IAM_USERS_WRITE') && row.source === 2 && !row.sgNo && [1, 2].includes(row.status)" class="text-button" @click="toggle(row)">{{ row.status === 1 ? '暂停' : '恢复' }}</button></template></RecordTable>
  <DetailPanel v-if="detail" title="用户详情" :entries="detail" @close="detail = null" /><FormDialog v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="saved" />
</template>
