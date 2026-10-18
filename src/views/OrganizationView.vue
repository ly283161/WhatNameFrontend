<script setup>
import { ref } from 'vue'
import { api } from '../session.js'
import { can } from '../access.js'
import { useList, id } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
const departments = useList('/departments', () => ({ includeDescendants: true }), { paginated: false })
const selectedDept = ref(null)
const people = useList(() => `/departments/${id(selectedDept.value.deptId)}/users`, () => ({ includeDescendants: true }), { auto: false })
const { dialog, error, notice, saved } = useActions()
const depthName = (value, row) => { let parent = row.parentId, depth = 0; const seen = new Set([row.deptId]); while (parent && parent !== '0' && !seen.has(parent)) { const p = departments.rows.find(d => d.deptId === parent); if (!p) break; seen.add(parent); depth++; parent = p.parentId } return '　'.repeat(Math.min(depth, 8)) + value }
function toggle(row) { const freeze = row.status !== 0; dialog.value = { title: freeze ? '冻结部门' : '解冻部门', fields: [{ key: 'reason', label: '操作原因', type: 'textarea' }], initial: { reason: '' }, note: `${row.deptName}：冻结影响本部门及下属部门的业务权限，账号状态和原有角色关系保留。`, submit: async body => { await api(`/departments/${id(row.deptId)}/${freeze ? 'freeze' : 'unfreeze'}`, { method: 'POST', body }); await departments.load() } } }
function show(row) { selectedDept.value = row; people.load() }
</script>
<template><div class="page-heading"><div><h1>人员与组织变动</h1><p>查看组织范围和人员，管理部门冻结状态</p></div></div><p v-if="error" role="alert" class="app-error">{{ error }}</p><p v-if="notice" role="status" class="action-notice">{{ notice }}</p><RecordTable :state="departments" :columns="[{ key: 'deptName', label: '部门名称', format: depthName }, { key: 'deptId', label: '部门 ID' }, { key: 'parentId', label: '上级部门 ID' }, { key: 'status', label: '状态', format: v => v === 0 ? '冻结' : '正常' }]" row-key="deptId" :paginated="false"><template #actions="{ row }"><button class="text-button" @click="show(row)">查看人员</button><button v-if="can('IAM_DEPTS_FREEZE')" class="text-button" @click="toggle(row)">{{ row.status === 0 ? '解冻' : '冻结' }}</button></template></RecordTable><section v-if="selectedDept" class="resource-section"><h2>{{ selectedDept.deptName }} · 部门及下属人员</h2><RecordTable :state="people" :columns="[{ key: 'userId', label: '用户 ID' }, { key: 'sgNo', label: '工号' }, { key: 'deptId', label: '所属部门 ID' }, { key: 'status', label: '状态' }]" row-key="userId" /></section><p class="contract-note">调岗、离职和部门合并由后端接收 HR 事件处理。变动列表与单条处理结果的查询接口尚待后端提供，当前不提供人工调岗或模拟完成按钮。</p><FormDialog v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="saved" /></template>
