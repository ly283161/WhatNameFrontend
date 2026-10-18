<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { api, session } from '../session.js'
import { can } from '../access.js'
import { useList, id } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
const keyword = ref(''), selected = ref([]), roleId = ref(''), operation = ref('GRANT'), reason = ref(''), sourceRef = ref('')
const list = useList('/users', () => ({ keyword: keyword.value.trim() }))
const history = useList('/grants/history', () => ({ roleId: roleId.value }), { auto: false })
const { dialog, error, notice, busy, perform } = useActions()
const delegable = ref([]), roleNames = ref({}), result = ref(null), sourceRows = ref([]), selectedSources = ref([]), revision = ref(null)
const seenUsers = new Map(), requestKeys = new Map()
watch(() => list.rows, rows => rows.forEach(u => seenUsers.set(u.userId, u)), { deep: true })
watch([selected, roleId, operation], () => { sourceRows.value = []; selectedSources.value = []; revision.value = null; result.value = null }, { deep: true })
const selectedNames = computed(() => selected.value.map(value => seenUsers.get(value)?.realName || value).join('、'))
const cols = [{ key: 'realName', label: '姓名' }, { key: 'username', label: '账号' }, { key: 'deptId', label: '部门 ID' }, { key: 'status', label: '状态' }]
onMounted(() => perform(async () => { const data = await api(`/admins/${id(session.userId)}/delegable-roles`); delegable.value = data.roleIds; roleId.value = data.roleIds[0] || ''; if (can('IAM_ROLES_VIEW')) { const roles = await api('/roles', { query: { page: 1, pageSize: 500 } }); roleNames.value = Object.fromEntries(roles.items.map(r => [r.roleId, r.roleName])) } }))
function readSources() { perform(async () => {
  if (!roleId.value || !selected.value.length) throw new Error('请先选择用户和角色')
  const responses = await Promise.all(selected.value.map(async userId => {
    const [data, roles] = await Promise.all([api(`/users/${id(userId)}/roles/${id(roleId.value)}/sources`), api(`/users/${id(userId)}/roles`)])
    return { userId, data, roles }
  }))
  sourceRows.value = responses.flatMap(r => r.data.sources.filter(s => s.active).map(s => ({ ...s, userId: r.userId })))
  revision.value = responses.length === 1 ? responses[0].roles.grantRevision || responses[0].data.grantRevision : null
  selectedSources.value = sourceRows.value.filter(s => sourceRows.value.filter(x => x.userId === s.userId).length === 1).map(s => s.grantSourceId)
}) }
function prepare() { perform(async () => {
  if (!selected.value.length || !roleId.value) throw new Error('请先选择用户和角色')
  if (!reason.value.trim()) throw new Error('请填写操作原因')
  if (operation.value === 'GRANT' && !sourceRef.value.trim()) throw new Error('请填写真实业务依据编号')
  const targets = operation.value === 'GRANT' ? selected.value.map(userId => ({ userId, sourceType: 'MANUAL', sourceRef: sourceRef.value.trim() })) : sourceRows.value.filter(s => selectedSources.value.includes(s.grantSourceId)).map(s => ({ userId: s.userId, grantSourceId: s.grantSourceId }))
  if (!targets.length || selected.value.some(userId => !targets.some(t => t.userId === userId))) throw new Error('请先读取授权依据，并为每位用户选择要回收的依据')
  const body = { operation: operation.value, roleId: roleId.value, targets, reason: reason.value.trim(), dryRun: false }
  const signature = JSON.stringify(body)
  if (!requestKeys.has(signature)) requestKeys.set(signature, crypto.randomUUID())
  const key = requestKeys.get(signature)
  dialog.value = { title: '确认权限操作', initial: {}, fields: [], note: `${body.operation === 'GRANT' ? '授予' : '回收'}角色 ${body.roleId}；用户：${selectedNames.value}；原因：${body.reason}。回收仅影响选定依据，其他有效依据保留。`, submit: async () => {
    result.value = await api('/grants/user-roles/batch', { method: 'POST', body, headers: { 'Idempotency-Key': key }, allowPending: true })
    notice.value = '已收到服务端处理结果，请查看逐项状态'
    await history.load()
  } }
}) }
function refreshBatch(page = 1) { perform(async () => { if (result.value?.batchId) result.value = await api(`/grants/batches/${id(result.value.batchId)}`, { query: { page, pageSize: 20 } }) }) }
function single() { perform(async () => {
  if (selected.value.length !== 1 || !roleId.value || !reason.value.trim()) throw new Error('单人操作需要选择一位用户、角色并填写原因')
  const roles = await api(`/users/${id(selected.value[0])}/roles`)
  const version = roles.grantRevision || revision.value
  if (!version) throw new Error('接口未提供用户权限修订号，无法安全提交单人写入；请先使用批量入口或确认版本查询契约')
  const source = sourceRows.value.filter(s => selectedSources.value.includes(s.grantSourceId))
  if (operation.value === 'GRANT' && !sourceRef.value.trim()) throw new Error('请填写真实业务依据编号')
  if (operation.value === 'REVOKE' && source.length !== 1) throw new Error('单人回收需要明确选择一条有效授权依据')
  const body = { userId: selected.value[0], roleId: roleId.value, reason: reason.value.trim(), expectedVersion: version, ...(operation.value === 'GRANT' ? { sourceType: 'MANUAL', sourceRef: sourceRef.value.trim() } : { grantSourceId: source[0].grantSourceId }) }
  dialog.value = { title: '确认单人权限操作', fields: [], initial: {}, note: `${selectedNames.value} · ${operation.value === 'GRANT' ? '授予' : '按依据回收'}角色 ${roleId.value}。`, submit: async () => {
    const data = await api(`/grants/user-roles${operation.value === 'REVOKE' ? '/revoke' : ''}`, { method: 'POST', body })
    result.value = { processingStatus: 'APPLIED', succeeded: 1, failed: 0, items: [{ userId: body.userId, status: data.roleEffective ? '操作完成，角色仍有效' : '操作完成，角色已失效' }] }; await history.load()
  } }
}) }
</script>
<template><div class="page-heading"><div><h1>权限分配</h1><p>按业务依据授予或回收角色</p></div><button class="button light" @click="history.load()">授权历史</button></div><p v-if="error" class="app-error" role="alert">{{ error }}</p><p v-if="notice" role="status" class="action-notice">{{ notice }}</p>
  <section v-if="can('IAM_GRANTS_WRITE')" class="panel grant-controls"><div class="inline-form"><label>操作<select v-model="operation" aria-label="操作"><option value="GRANT">授予角色</option><option value="REVOKE">回收角色</option></select></label><label>操作角色<select v-model="roleId" aria-label="操作角色"><option value="" disabled>请选择角色</option><option v-for="value in delegable" :key="value" :value="value">{{ roleNames[value] || ('角色 ' + value) }}</option></select></label><label v-if="operation === 'GRANT'">业务依据编号<input v-model="sourceRef" aria-label="业务依据编号" maxlength="100" /></label><label>操作原因<input v-model="reason" aria-label="操作原因" maxlength="300" /></label></div><p>已选 {{ selected.length }} 位用户 {{ selectedNames }}</p><div class="inline-form"><button v-if="operation === 'REVOKE'" class="button light" :disabled="busy" @click="readSources">读取授权依据</button><button class="button light" :disabled="busy" @click="single">单人操作</button><button class="button primary" :disabled="busy" @click="prepare()">提交批量操作</button><button class="text-button" @click="selected = []">清空选择</button></div><div v-if="operation === 'REVOKE'" class="source-options"><label v-for="source in sourceRows" :key="source.grantSourceId"><input v-model="selectedSources" type="checkbox" :value="source.grantSourceId" />{{ seenUsers.get(source.userId)?.realName || source.userId }} · {{ source.sourceType }} · {{ source.sourceRef }}</label><p v-if="!sourceRows.length" class="muted">先读取授权依据；每位用户至少选择一条有效依据。</p></div></section>
  <RecordTable v-model:selected="selected" :state="list" :columns="cols" row-key="userId"><template #toolbar><form class="inline-form" @submit.prevent="list.load()"><input v-model="keyword" aria-label="搜索授权用户" placeholder="搜索用户" /><button class="button light">查询</button></form></template></RecordTable>
  <section v-if="result" class="panel result-panel" aria-label="权限操作结果"><h3>执行结果：{{ result.processingStatus }}</h3><p>成功 {{ result.succeeded ?? '—' }} · 失败 {{ result.failed ?? '—' }} · 待处理 {{ result.pending ?? (['PENDING', 'PROCESSING'].includes(result.processingStatus) ? result.total ?? '—' : 0) }}</p><button v-if="result.batchId" class="button light" :disabled="busy" @click="refreshBatch(1)">刷新批量结果</button><div class="table-scroll"><table><thead><tr><th>用户</th><th>结果</th><th>原因</th></tr></thead><tbody><tr v-for="(item, index) in result.items || []" :key="index"><td>{{ seenUsers.get(item.userId)?.realName || item.userId }}</td><td>{{ item.status }}</td><td>{{ item.code || '—' }}</td></tr></tbody></table></div><div v-if="result.page" class="pagination"><button class="button light" :disabled="busy || result.page <= 1" @click="refreshBatch(result.page - 1)">上一页结果</button><button class="button light" :disabled="busy || result.page * result.pageSize >= result.total" @click="refreshBatch(result.page + 1)">下一页结果</button></div></section>
  <RecordTable v-if="history.data || history.error || history.busy" :state="history" :columns="[{ key: 'userId', label: '用户 ID' }, { key: 'roleId', label: '角色 ID' }, { key: 'operation', label: '操作' }, { key: 'grantSourceId', label: '授权依据' }, { key: 'occurredAt', label: '时间' }]" row-key="eventId" /><FormDialog v-if="dialog" v-bind="dialog" @close="dialog = null" />
</template>
