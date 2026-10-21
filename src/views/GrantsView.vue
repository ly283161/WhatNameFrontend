<script setup>
import { forEachConcurrent } from '../utils/concurrent.js'
import { computed, reactive, ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { Search } from 'lucide-vue-next'
import { api, session } from '../session.js'
import { can } from '../access.js'
import { readAll, recordId } from '../api/contracts.js'
import { useList } from '../composables/useList.js'
import { id, errorText } from '../utils/formatters.js'
import { useActions } from '../composables/useActions.js'
import { useDebouncedSearch } from '../composables/useDebouncedSearch.js'
import { useBatch } from '../composables/useBatch.js'
import RecordTable from '../components/RecordTable.vue'
import ContentDialog from '../components/ContentDialog.vue'
import AccountTable from '../components/AccountTable.vue'
import FormDialog from '../components/FormDialog.vue'
const keyword = ref(''), selected = ref([]), roleId = ref(''), operation = ref('GRANT'), reason = ref(''), sourceRef = ref(''), sourcesBusy = ref(false)
const deptFilter = ref(''), statusFilter = ref(''), rolesByUser = ref({})
const depts = useList('/departments', () => ({ includeDescendants: true }), { paginated: false, auto: can('IAM_DEPTS_VIEW') })
const list = useList('/users', () => ({ keyword: keyword.value.trim(), deptId: deptFilter.value, status: statusFilter.value }), { auto: can('IAM_USERS_VIEW') })
const historyUserIds = ref([]), historyRoleId = ref(''), historyOpen = ref(false), historyUsers = ref([])
const historyStart = ref(''), historyEnd = ref(''), historyRange = ref({}), historyFilterError = ref('')
let historyController, historySequence = 0, historyCache = null
const singleHistory = useList('/grants/history', () => ({ roleId: historyRoleId.value, userId: historyUserIds.value[0] || '', ...historyRange.value }), { auto: false })
const multiHistory = reactive({ rows: [], total: 0, page: 1, busy: false, error: '', load: loadMultiHistory })
const history = computed(() => historyUserIds.value.length > 1 ? multiHistory : singleHistory)
function resetMultiHistory() {
  historySequence++; historyController?.abort(); historyCache = null
  Object.assign(multiHistory, { rows: [], total: 0, page: 1, busy: false, error: '' })
}
// 后端每次按一个用户查询，多人结果合并排序后在本地分页。
async function loadMultiHistory(page = 1) {
  if (historyCache) { multiHistory.rows = historyCache.slice((page - 1) * 20, page * 20); multiHistory.page = page; return }
  historyController?.abort(); historyController = new AbortController()
  const current = ++historySequence, signal = historyController.signal
  const users = [...historyUserIds.value], role = historyRoleId.value, range = { ...historyRange.value }, results = new Array(users.length)
  Object.assign(multiHistory, { rows: [], total: 0, busy: true, error: '' })
  try {
    await forEachConcurrent(users, async (userId, index) => {
      results[index] = await readAll(api, '/grants/history', { userId, roleId: role, ...range }, signal)
    }, () => current === historySequence && !signal.aborted)
    if (current !== historySequence || signal.aborted) return
    historyCache = results.flat().sort((a, b) => (Date.parse(b.occurredAt) || 0) - (Date.parse(a.occurredAt) || 0) || String(b.eventId).localeCompare(String(a.eventId)))
    multiHistory.total = historyCache.length
    multiHistory.rows = historyCache.slice((page - 1) * 20, page * 20); multiHistory.page = page
  } catch (e) {
    if (current === historySequence) { historyController.abort(); multiHistory.error = errorText(e) }
  } finally { if (current === historySequence) multiHistory.busy = false }
}
function openHistory() {
  if (!can('IAM_GRANTS_VIEW')) return
  resetMultiHistory()
  historyStart.value = ''; historyEnd.value = ''; historyRange.value = {}; historyFilterError.value = ''
  historyUserIds.value = [...selected.value]; historyRoleId.value = selected.value.length ? roleId.value : ''
  historyUsers.value = historyUserIds.value.map(userId => seenUsers.get(userId)?.realName || userId)
  historyOpen.value = true; void history.value.load()
}
function rangeTimestamp(value) {
  if (!value) return undefined
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error('请选择有效的日期和时间')
  const timestamp = value + (value.length === 16 ? ':00' : '') + '+08:00'
  if (Number.isNaN(Date.parse(timestamp))) throw new Error('请选择有效的日期和时间')
  return timestamp
}
function queryHistory() {
  historyFilterError.value = ''
  try {
    const from = rangeTimestamp(historyStart.value), to = rangeTimestamp(historyEnd.value)
    if (from && to && Date.parse(from) > Date.parse(to)) throw new Error('开始时间不能晚于结束时间')
    historyRange.value = { from, to }
    resetMultiHistory(); void history.value.load()
  } catch (e) { historyFilterError.value = e.message }
}
function historyTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '未提供'
  return new Date(value).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false })
}
function closeHistory() { historyOpen.value = false; resetMultiHistory() }
watch(() => session.accessVersion, closeHistory)
onBeforeUnmount(resetMultiHistory)
const historyRows = computed(() => ({ ...history.value, rows: history.value.rows.map(r => ({ ...r, key: [r.eventId, r.userId, r.roleId, r.grantSourceId, r.operation].join(':') })) }))
const { dialog, error, notice, busy, perform } = useActions()
const batch = useBatch(), delegable = ref([]), roleNames = ref({}), sourceRows = ref([]), selectedSources = ref([])
const result = computed(() => batch.result), seenUsers = new Map()
let sourceSequence = 0, roleSequence = 0, disposed = false, sourceTimer, sourcesReady = false
onBeforeUnmount(() => { disposed = true; sourceSequence++; roleSequence++; clearTimeout(sourceTimer) })
watch(() => list.rows, rows => rows.forEach(u => seenUsers.set(u.userId, u)), { deep: true })
watch([selected, roleId, operation], () => {
  sourceSequence++; sourcesBusy.value = false; sourcesReady = false; sourceRows.value = []; selectedSources.value = []; clearTimeout(sourceTimer)
  if (operation.value === 'REVOKE' && selected.value.length && roleId.value) sourceTimer = setTimeout(() => { void readSources() }, 350)
}, { deep: true, flush: 'sync' })
const selectedNames = computed(() => selected.value.slice(0, 8).map(value => seenUsers.get(value)?.realName || value).join('、') + (selected.value.length > 8 ? ' 等' : ''))
let userRolesSequence = 0, userRolesController
const search = useDebouncedSearch(keyword, () => list.load())
async function readUserRoles(rows) {
  userRolesController?.abort(); userRolesController = new AbortController()
  const signal = userRolesController.signal, current = ++userRolesSequence
  rolesByUser.value = Object.fromEntries(rows.map(row => [row.userId, { loading: true, items: [] }]))
  await forEachConcurrent(rows, async row => {
    try {
      const data = await api('/users/' + id(row.userId) + '/roles', { signal })
      if (current === userRolesSequence && !disposed) rolesByUser.value[row.userId] = { items: data.roles.filter(role => role.active) }
    } catch (e) { if (current === userRolesSequence && !disposed) rolesByUser.value[row.userId] = { error: errorText(e), items: [] } }
  }, () => current === userRolesSequence && !disposed)
}
watch(() => list.rows, rows => { void readUserRoles(rows) })
onBeforeUnmount(() => { userRolesSequence++; userRolesController?.abort() })
const statusName = value => ({ PENDING: '排队中', PROCESSING: '处理中', COMPLETED: '全部完成', PARTIAL_SUCCESS: '部分成功', FAILED: '失败', APPLIED: '已完成' }[value] || value)
async function loadRoles() {
  if (!can('IAM_GRANTS_WRITE')) return
  const current = ++roleSequence
  try {
    const data = await api('/admins/' + id(session.userId) + '/delegable-roles')
    if (disposed || current !== roleSequence) return
    delegable.value = data.roleIds; roleId.value = data.roleIds[0] || ''
    if (can('IAM_ROLES_VIEW')) { const roles = await readAll(api, '/roles'); if (!disposed && current === roleSequence) roleNames.value = Object.fromEntries(roles.map(r => [r.roleId, r.roleName])) }
  } catch (e) { if (!disposed && current === roleSequence) error.value = errorText(e) }
}
onMounted(() => { void batch.resume(); void loadRoles() })
watch(() => session.accessVersion, () => {
  roleSequence++; selected.value = []; sourceRows.value = []; selectedSources.value = []; seenUsers.clear(); roleNames.value = {}; delegable.value = []; roleId.value = ''
  void loadRoles()
})
async function readSources() {
  clearTimeout(sourceTimer)
  if (!roleId.value || !selected.value.length || operation.value !== 'REVOKE') return
  const current = ++sourceSequence, users = [...selected.value], role = roleId.value, responses = new Array(users.length)
  sourcesBusy.value = true
  try {
    users.forEach(recordId)
    await forEachConcurrent(users, async (userId, index) => {
      const data = await api('/users/' + id(userId) + '/roles/' + id(role) + '/sources')
      responses[index] = data.sources.filter(s => s.active).map(s => ({ ...s, userId }))
    }, () => current === sourceSequence && !disposed)
    if (current !== sourceSequence || disposed) return
    sourceRows.value = responses.flat(); sourcesReady = true
    const counts = new Map()
    sourceRows.value.forEach(s => counts.set(s.userId, (counts.get(s.userId) || 0) + 1))
    selectedSources.value = sourceRows.value.filter(s => counts.get(s.userId) === 1).map(s => s.grantSourceId)
  } catch (e) { if (current === sourceSequence && !disposed) error.value = errorText(e) }
  finally { if (current === sourceSequence) sourcesBusy.value = false }
}
function command() {
  if (!can('IAM_GRANTS_WRITE')) throw new Error('当前没有权限分配资格')
  if (!selected.value.length || !roleId.value) throw new Error('请先选择用户和角色')
  recordId(roleId.value); selected.value.forEach(recordId)
  if (!reason.value.trim()) throw new Error('请填写操作原因')
  if (operation.value === 'GRANT' && !sourceRef.value.trim()) throw new Error('请填写真实业务依据编号')
  const selectedSourceIds = new Set(selectedSources.value)
  const targets = operation.value === 'GRANT' ? selected.value.map(userId => ({ userId, sourceType: 'MANUAL', sourceRef: sourceRef.value.trim() })) : sourceRows.value.filter(s => selectedSourceIds.has(s.grantSourceId)).map(s => ({ userId: s.userId, grantSourceId: s.grantSourceId }))
  const targetUsers = new Set(targets.map(target => target.userId))
  if (!targets.length || selected.value.some(userId => !targetUsers.has(userId))) throw new Error('请为每位用户选择一条有效回收依据；无有效依据的用户请取消选择')
  if (targetUsers.size !== targets.length) throw new Error('后端要求同一批次每位用户仅有一个目标，请为每人选择一条依据；其他依据可分次回收')
  return { operation: operation.value, roleId: roleId.value, targets, reason: reason.value.trim(), dryRun: false }
}
function confirmBatch(body, retry = false) {
  dialog.value = { title: retry ? '确认重试失败目标' : '确认权限操作', initial: {}, fields: [], note: (body.operation === 'GRANT' ? '授予' : '回收') + '角色 ' + body.roleId + '；共 ' + body.targets.length + ' 位用户；原因：' + body.reason + '。回收仅影响选定依据。' + (retry ? '仅提交原任务中已确认失败的目标，使用新的请求标识。' : ''), submit: async () => {
    if (!can('IAM_GRANTS_WRITE')) throw new Error('当前没有权限分配资格')
    await batch.submit(body, { fresh: retry })
    notice.value = '任务已受理，执行结果以服务端逐项查询为准'
    if (can('IAM_GRANTS_VIEW') && historyOpen.value) await history.value.load()
  } }
}
function prepare() { perform(async () => {
  if (operation.value === 'REVOKE' && !sourcesReady) await readSources()
  confirmBatch(command())
}) }
function retryFailed() { perform(async () => confirmBatch(await batch.failedCommand(), true)) }
</script>
<template>
  <div class="page-heading"><div><h1>权限分配</h1><p>按业务依据授予或回收角色</p></div></div>
  <p v-if="error" class="app-error" role="alert">{{ error }}</p><p v-if="notice" role="status" class="action-notice">{{ notice }}</p>
  <section v-if="can('IAM_GRANTS_WRITE') || can('IAM_GRANTS_VIEW')" class="panel grant-controls"><div class="inline-form">
    <label v-if="can('IAM_GRANTS_WRITE')">操作<select v-model="operation" aria-label="操作"><option value="GRANT">授予角色</option><option value="REVOKE">回收角色</option></select></label>
    <label v-if="can('IAM_GRANTS_WRITE')">角色<select v-model="roleId" aria-label="角色"><option value="" disabled>请选择角色</option><option v-for="value in delegable" :key="value" :value="value">{{ roleNames[value] || ('角色 ' + value) }}</option></select></label>
    <label v-if="can('IAM_GRANTS_WRITE') && operation === 'GRANT'">业务依据编号<input v-model="sourceRef" aria-label="业务依据编号" maxlength="128" /></label><label v-if="can('IAM_GRANTS_WRITE')">操作原因<input v-model="reason" aria-label="操作原因" maxlength="512" /></label><div class="grant-buttons"><button v-if="can('IAM_GRANTS_WRITE')" class="button primary" :disabled="busy || batch.busy || batch.querying || sourcesBusy" @click="prepare">提交</button><button v-if="can('IAM_GRANTS_VIEW')" class="button light" @click="openHistory">查询授权历史</button></div></div>
    <p>已选 {{ selected.length }} 位用户 {{ selectedNames }}</p>
    <div v-if="operation === 'REVOKE'" class="source-options"><label v-for="source in sourceRows" :key="source.userId + ':' + source.grantSourceId"><input v-model="selectedSources" type="checkbox" :value="source.grantSourceId" />{{ seenUsers.get(source.userId)?.realName || source.userId }} · {{ source.sourceType }} · {{ source.sourceRef }}</label><p v-if="sourcesBusy" class="muted">正在读取回收依据…</p><p v-else-if="!sourceRows.length" class="muted">选择用户和角色后自动读取回收依据。</p></div>
  </section>
  <AccountTable v-if="can('IAM_USERS_VIEW')" v-model:selected="selected" :state="list" :departments="depts.rows" :roles="rolesByUser" :role-names="roleNames"><template #toolbar><form class="inline-form account-filters" @submit.prevent="search"><div class="search-field"><button type="submit" aria-label="查询" :disabled="list.busy"><Search :size="17" /></button><input v-model="keyword" aria-label="搜索授权用户" placeholder="搜索姓名、账号或工号" maxlength="64" /></div><select v-if="depts.rows.length" v-model="deptFilter" aria-label="筛选部门" @change="search"><option value="">全部部门</option><option v-for="d in depts.rows" :key="d.deptId" :value="d.deptId">{{ d.deptName }}</option></select><select v-model="statusFilter" aria-label="筛选账号状态" @change="search"><option value="">全部状态</option><option :value="1">可用</option><option :value="2">暂停</option><option :value="3">离职</option></select><span class="toolbar-summary">共 {{ list.total }} 个账号</span></form></template></AccountTable>
  <p v-if="!can('IAM_USERS_VIEW')" class="contract-note">当前没有账号查询权限，请联系管理员开通后再选择用户。</p>
  <p v-if="batch.error" class="app-error" role="alert">{{ batch.error }}</p>
  <section v-if="result" class="panel result-panel" aria-label="权限操作结果"><h3>执行结果：{{ statusName(result.processingStatus) }}</h3><p>当前可见：成功 {{ result.succeeded ?? '—' }} · 失败 {{ result.failed ?? '—' }} · 待处理 {{ result.pending ?? result.total ?? '—' }}</p><p class="muted">{{ batch.querying ? '每 2 秒自动查询，离开页面后暂停。' : '以当前管理范围内的逐项结果为准。' }} 最近更新 {{ batch.updatedAt || '—' }}</p>
    <div class="inline-form"><button v-if="result.batchId" class="button light" :disabled="batch.busy" @click="batch.load(1)">刷新批量结果</button><button v-if="batch.canRetry && can('IAM_GRANTS_WRITE')" class="button primary" :disabled="busy || batch.busy" @click="retryFailed">仅重试失败目标</button></div>
    <div class="table-scroll"><table><thead><tr><th>用户</th><th>结果</th><th>原因</th></tr></thead><tbody><tr v-for="item in result.items || []" :key="item.userId"><td>{{ seenUsers.get(item.userId)?.realName || item.userId }}</td><td>{{ statusName(item.status) }}</td><td>{{ item.code || '—' }}</td></tr></tbody></table></div>
    <div v-if="result.page" class="pagination"><button class="button light" :disabled="batch.busy || result.page <= 1" @click="batch.load(result.page - 1)">上一页结果</button><button class="button light" :disabled="batch.busy || result.page * result.pageSize >= result.total" @click="batch.load(result.page + 1)">下一页结果</button></div>
  </section>
  <ContentDialog v-if="historyOpen" title="授权历史" @close="closeHistory"><p v-if="historyUserIds.length" class="muted">已选 {{ historyUserIds.length }} 位用户：{{ historyUsers.slice(0, 8).join('、') }}{{ historyUsers.length > 8 ? ' 等' : '' }}<template v-if="historyRoleId"> · {{ roleNames[historyRoleId] || ('角色 ' + historyRoleId) }}</template></p><p v-else class="muted">全部授权历史</p>
  <form class="history-range" @submit.prevent="queryHistory"><label>开始时间<input v-model="historyStart" type="datetime-local" step="1" aria-label="开始时间" /></label><label>结束时间<input v-model="historyEnd" type="datetime-local" step="1" aria-label="结束时间" /></label><button class="button light" :disabled="history.busy">查询</button></form><p v-if="historyFilterError" class="app-error" role="alert">{{ historyFilterError }}</p>
  <RecordTable :state="historyRows" :columns="[{ key: 'userId', label: '用户 ID' }, { key: 'roleId', label: '角色 ID' }, { key: 'operation', label: '操作' }, { key: 'grantSourceId', label: '授权依据' }, { key: 'occurredAt', label: '发生时间', format: historyTime }]" row-key="key" /></ContentDialog>
  <FormDialog :allowed="can('IAM_GRANTS_WRITE')" v-if="dialog" v-bind="dialog" @close="dialog = null" />
</template>

<style scoped>
.modal .history-range { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; padding:0; margin:18px 0 }
.modal .history-range > label { display:grid; flex:1; min-width:220px; gap:7px; margin:0; font-size:12px }
.modal .history-range input { width:100%; min-width:0; margin:0 }
.history-range > button { flex-shrink:0 }
@media(max-width:700px) { .modal .history-range > label { flex-basis:100%; min-width:0 } }

.grant-buttons { display:flex; align-items:center; gap:12px; flex-wrap:nowrap }
.grant-buttons button { flex-shrink:0 }
</style>
