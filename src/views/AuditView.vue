<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../session.js'
import { useList, id } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import DetailPanel from '../components/DetailPanel.vue'
const tab = ref('operations'), userId = ref(''), detail = ref(null)
const list = useList(() => `/audit/${tab.value}`, () => tab.value === 'operations' ? {} : { userId: userId.value })
const { error, busy, perform } = useActions()
const rows = computed(() => ({ ...list, rows: list.rows.map((r, i) => ({ ...r, key: `${r.eventId || r.decisionId || r.userId}-${r.occurredAt}-${i}` })) }))
const columns = computed(() => tab.value === 'operations' ? [{ key: 'operationType', label: '操作' }, { key: 'actorUserId', label: '操作者 ID' }, { key: 'targetId', label: '目标 ID' }, { key: 'occurredAt', label: '时间' }] : tab.value === 'authorizations' ? [{ key: 'userId', label: '用户 ID' }, { key: 'apiId', label: 'API ID' }, { key: 'allowed', label: '鉴权结果', format: v => v ? '允许' : '拒绝' }, { key: 'permissionVersion', label: '权限版本' }, { key: 'occurredAt', label: '时间' }] : [{ key: 'userId', label: '用户 ID' }, { key: 'loginMethod', label: '登录方式' }, { key: 'success', label: '结果', format: v => v ? '成功' : '失败' }, { key: 'occurredAt', label: '时间' }])
watch(tab, () => { detail.value = null; list.load() })
function evidence(row) { perform(async () => { const data = await api(`/audit/evidence/${id(row.eventId)}`); detail.value = [['事件 ID', data.eventId], ['请求编号', data.requestId], ['证据类型', data.evidenceType], ['权限版本', data.permissionVersion], ['完整性验证', data.integrityVerified ? '通过' : '未通过']] }) }
function exportPage() {
  const cell = value => '"' + String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""') + '"'
  const lines = [columns.value.map(c => c.label), ...list.rows.map(r => columns.value.map(c => c.format ? c.format(r[c.key]) : r[c.key]))]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `audit-${tab.value}-page-${list.page}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>
<template><div class="page-heading"><div><h1>操作日志</h1><p>查询服务端审计记录及历史证据</p></div><button class="button light" :disabled="list.busy || !!list.error || !list.rows.length" @click="exportPage">导出当前页</button></div><div class="page-tabs" role="tablist" aria-label="审计类别"><button v-for="[value, label] in [['operations', '操作日志'], ['authorizations', '鉴权日志'], ['logins', '登录日志']]" :key="value" role="tab" :aria-selected="tab === value" @click="tab = value">{{ label }}</button></div><p v-if="error" role="alert" class="app-error">{{ error }}</p><RecordTable :state="rows" :columns="columns" row-key="key"><template #toolbar><form class="inline-form" @submit.prevent="list.load()"><input v-if="tab !== 'operations'" v-model="userId" placeholder="用户 ID" aria-label="日志用户 ID" /><button class="button light" :disabled="list.busy">查询</button></form></template><template #actions="{ row }"><button v-if="row.eventId" class="text-button" :disabled="busy" @click="evidence(row)">审计证据</button><span v-else class="muted">只读</span></template></RecordTable><DetailPanel v-if="detail" title="审计证据" :entries="detail" @close="detail = null" /></template>
