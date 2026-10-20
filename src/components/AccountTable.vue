<script setup>
import { computed } from 'vue'
import RecordTable from './RecordTable.vue'
import { statusText } from '../composables/useList.js'
const props = defineProps({ state: Object, departments: { type: Array, default: () => [] }, selected: Array, roles: Object, roleNames: { type: Object, default: () => ({}) } })
const emit = defineEmits(['update:selected'])
const columns = computed(() => [{ key: 'realName', label: '用户' }, { key: 'username', label: '账号 / 工号' }, { key: 'deptId', label: '所属部门' }, { key: 'source', label: '来源' }, ...(props.roles ? [{ key: 'roles', label: '角色' }] : []), { key: 'status', label: '状态' }])
const department = row => props.departments.find(d => d.deptId === row.deptId)
const sourceName = value => ({ 1: 'HR 同步', 2: '临时', 3: '受控初始化' })[value] || '未提供'
const colors = ['green', 'blue', 'orange', 'purple', 'blue', 'pink']
const avatarColor = row => colors[[...String(row.userId)].reduce((sum, letter) => sum + letter.charCodeAt(0), 4) % colors.length]
function frozen(row) {
  let current = department(row); const seen = new Set()
  while (current && !seen.has(current.deptId)) {
    seen.add(current.deptId)
    if (current.effectivelyFrozen === true || current.status === 0) return true
    if (current.effectivelyFrozen === false) return false
    current = props.departments.find(d => d.deptId === current.parentId)
  }
  return false
}
</script>
<template><RecordTable :state="state" :columns="columns" row-key="userId" :selected="selected" @update:selected="emit('update:selected', $event)">
  <template #toolbar><slot name="toolbar" /></template>
  <template #cell-realName="{ row }"><div class="user-cell"><span :class="['avatar', avatarColor(row)]" aria-hidden="true">{{ (row.realName || '').slice(-2) }}</span><strong>{{ row.realName }}</strong></div></template>
  <template #cell-username="{ row }">{{ row.username }}<small class="cell-secondary">{{ row.sgNo || '无工号' }}</small></template>
  <template #cell-deptId="{ row }">{{ department(row)?.deptName || row.deptId }}<small v-if="department(row)?.merged" class="cell-secondary">部门已合并</small><small v-else-if="frozen(row)" class="cell-secondary red-text">部门已冻结</small></template>
  <template #cell-source="{ row }"><span :class="['tag', row.source === 2 ? 'orange' : 'neutral']">{{ sourceName(row.source) }}</span></template>
  <template #cell-roles="{ row }"><span v-if="roles[row.userId]?.loading" class="muted">正在读取…</span><span v-else-if="roles[row.userId]?.error" class="muted" :title="roles[row.userId].error">读取失败</span><template v-else-if="roles[row.userId]?.items?.length"><span v-for="role in roles[row.userId].items" :key="role.roleId" class="role-tag">{{ roleNames[role.roleId] || ('角色 ' + role.roleId) }}</span></template><span v-else class="muted">未分配</span></template>
  <template #cell-status="{ row }"><span :class="['tag', row.status === 1 ? 'green' : row.status === 2 ? 'orange' : 'neutral']"><i></i>{{ statusText(row.status) }}</span></template>
  <template v-if="$slots.actions" #actions="{ row }"><slot name="actions" :row="row" /></template>
</RecordTable></template>
