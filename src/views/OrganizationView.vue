<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { X, Building2 } from 'lucide-vue-next'
import { api, session } from '../session.js'
import { can } from '../access.js'
import { useList, id } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
const departments = useList('/departments', () => ({ includeDescendants: true }), { paginated: false })
const selectedDept = ref(null), tab = ref('people')
const people = useList(() => `/departments/${id(selectedDept.value?.deptId)}/users`, () => ({ includeDescendants: true }), { auto: false })
const { dialog, error, notice, saved } = useActions()
function toggle(row) { const freeze = row.status !== 0; if (row.merged) return; dialog.value = { title: freeze ? '冻结部门' : '解冻部门', fields: [{ key: 'reason', label: '操作原因', type: 'textarea' }], initial: { reason: '' }, note: `${row.deptName}：冻结影响本部门及下属部门的业务权限，账号状态和原有角色关系保留。`, submit: async body => { await api(`/departments/${id(row.deptId)}/${freeze ? 'freeze' : 'unfreeze'}`, { method: 'POST', body }); await departments.load() } } }
watch(() => session.accessVersion, () => { selectedDept.value = null })
const peoplePanel = ref(null)
let peopleTrigger, previousOverflow
function show(row, event) { peopleTrigger = event.currentTarget; selectedDept.value = row; people.load() }
async function closePeople() { selectedDept.value = null; await nextTick(); peopleTrigger?.focus() }
watch(selectedDept, async value => {
  if (value) {
    if (previousOverflow === undefined) previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    await nextTick(); peoplePanel.value?.querySelector('button')?.focus()
  } else if (previousOverflow !== undefined) { document.body.style.overflow = previousOverflow; previousOverflow = undefined }
})
onBeforeUnmount(() => { if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow })
function peopleKeys(event) {
  if (event.key === 'Escape') { event.preventDefault(); closePeople(); return }
  if (event.key !== 'Tab') return
  const controls = [...peoplePanel.value.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')]
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>
<template><div class="page-heading"><div><h1>人员与组织变动</h1><p>查看人员变动与管理部门冻结</p></div></div><div class="page-tabs" role="tablist" aria-label="变动管理"><button role="tab" :aria-selected="tab === 'people'" @click="tab = 'people'">人员变动</button><button role="tab" :aria-selected="tab === 'departments'" @click="tab = 'departments'">部门冻结</button></div><p v-if="error" role="alert" class="app-error">{{ error }}</p><p v-if="notice" role="status" class="action-notice">{{ notice }}</p>
<section v-if="tab === 'people'" class="panel table-panel"><div class="panel-heading"><h3>人员变动记录</h3><span class="tag neutral">HR 同步</span></div><div class="table-scroll"><table><thead><tr><th>员工</th><th>变动类型</th><th>原部门</th><th>新部门</th><th>处理状态</th><th>操作</th></tr></thead><tbody><tr><td colspan="6" class="empty" role="status">人员变动记录暂不可查询</td></tr></tbody></table></div></section>
<section v-else class="panel department-panel" :inert="!!selectedDept || !!dialog"><div class="panel-heading"><div><h3>部门权限冻结</h3><p>冻结整个部门的访问权限，保留原角色与操作现场。</p></div></div><div v-if="departments.error" class="list-error"><p role="alert" class="app-error">{{ departments.error }}</p><button class="button light" @click="departments.load()">重新加载</button></div><p v-else-if="departments.busy" class="empty">正在加载…</p><div v-else class="department-grid"><div v-for="row in departments.rows" :key="row.deptId"><span class="icon-tile neutral"><Building2 :size="20" /></span><strong>{{ row.deptName }}<small>{{ row.merged ? '已合并' : row.status === 0 ? '冻结' : row.effectivelyFrozen ? '上级部门冻结' : '正常' }}</small></strong><div class="department-actions"><button v-if="can('IAM_USERS_VIEW')" class="text-button" @click="show(row, $event)">查看人员</button><button v-if="can('IAM_DEPTS_FREEZE') && !row.merged" :class="['button', row.status === 0 ? 'light' : 'danger-light']" @click="toggle(row)">{{ row.status === 0 ? '解除冻结' : '冻结权限' }}</button></div></div><p v-if="!departments.rows.length" class="empty">暂无部门</p></div></section>
<div v-if="selectedDept" class="modal-backdrop" @click.self="closePeople" @keydown="peopleKeys"><section ref="peoplePanel" class="modal resource-modal" role="dialog" aria-modal="true" :aria-label="selectedDept.deptName + ' · 部门及下属人员'"><div class="modal-heading"><h2>{{ selectedDept.deptName }} · 部门及下属人员</h2><button class="icon-button" type="button" aria-label="关闭部门人员弹窗" @click="closePeople"><X :size="20" /></button></div><div class="resource-modal-body"><RecordTable :state="people" :columns="[{ key: 'userId', label: '用户 ID' }, { key: 'sgNo', label: '工号' }, { key: 'deptId', label: '所属部门 ID' }, { key: 'status', label: '状态' }]" row-key="userId" /></div></section></div><FormDialog :allowed="can('IAM_DEPTS_FREEZE')" v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="saved" /></template>
