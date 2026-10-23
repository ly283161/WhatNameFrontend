<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { Plus, Search } from 'lucide-vue-next'
import { api, session } from '../session.js'
import { can } from '../access.js'
import { useList, id, statusText, errorText } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import ContentDialog from '../components/ContentDialog.vue'
import AccountTable from '../components/AccountTable.vue'
import FormDialog from '../components/FormDialog.vue'
const keyword = ref(''),
  deptId = ref(''),
  accountStatus = ref('')
const list = useList('/users', () => ({
  keyword: keyword.value.trim(),
  deptId: deptId.value,
  status: accountStatus.value,
}))
const depts = useList('/departments', () => ({ includeDescendants: true }), {
  paginated: false,
  auto: can('IAM_DEPTS_VIEW'),
})
const { dialog, error, notice, saved } = useActions()
const detailId = ref(null),
  detail = ref(null),
  detailError = ref(''),
  detailBusy = ref(false)
let detailController,
  detailSequence = 0
const detailEntries = computed(() =>
  detail.value
    ? [
        ['用户 ID', detail.value.userId],
        ['姓名', detail.value.realName],
        ['账号', detail.value.username],
        ['工号', detail.value.sgNo || '无工号'],
        ['手机号', detail.value.phone],
        [
          '所属部门',
          depts.rows.find((d) => d.deptId === detail.value.deptId)?.deptName || detail.value.deptId,
        ],
        ['来源', { 1: 'HR 同步', 2: '临时', 3: '受控初始化' }[detail.value.source] || '未提供'],
        ['状态', statusText(detail.value.status)],
        [
          '密码初始化',
          typeof detail.value.passwordInitialized === 'boolean'
            ? detail.value.passwordInitialized
              ? '已完成'
              : '未完成'
            : '未提供',
        ],
      ]
    : [],
)
async function showDetail(user) {
  detailController?.abort()
  detailController = new AbortController()
  const current = ++detailSequence
  detailId.value = user.userId
  detail.value = null
  detailError.value = ''
  detailBusy.value = true
  try {
    const data = await api('/users/' + id(user.userId), { signal: detailController.signal })
    if (current === detailSequence) detail.value = data
  } catch (e) {
    if (current === detailSequence) detailError.value = errorText(e)
  } finally {
    if (current === detailSequence) detailBusy.value = false
  }
}
function closeDetail() {
  detailSequence++
  detailController?.abort()
  detailId.value = null
  detail.value = null
}
watch(() => session.accessVersion, closeDetail)
onBeforeUnmount(closeDetail)
const editable = (user) => user.source === 2 && !user.sgNo && [1, 2].includes(user.status)
let searchTimer
function search() {
  clearTimeout(searchTimer)
  void list.load()
}
watch(keyword, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(search, 350)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
function create() {
  dialog.value = {
    title: '新建临时账号',
    initial: { deptId: '', realName: '', phone: '', reason: '' },
    fields: [
      { key: 'realName', label: '姓名', maxlength: 64 },
      { key: 'phone', label: '手机号', type: 'tel', pattern: '1[0-9]{10}', maxlength: 11 },
      {
        key: 'deptId',
        label: '所属部门',
        ...(depts.rows.length
          ? { options: depts.rows.map((d) => ({ value: d.deptId, label: d.deptName })) }
          : {}),
      },
      { key: 'reason', label: '用途', type: 'textarea' },
    ],
    note: '账号由服务端生成，无工号；本人首次验证设密后才能登录。',
    submit: async (body) => {
      await api('/users/temporary', { method: 'POST', body })
      await list.load()
    },
  }
}
function toggle(user) {
  if (!can('IAM_USERS_WRITE') || !editable(user)) return
  dialog.value = {
    title: user.status === 1 ? '暂停账号' : '恢复账号',
    initial: { reason: '' },
    fields: [{ key: 'reason', label: '操作原因', type: 'textarea' }],
    note: '目标账号：' + user.username + '。历史记录和角色关系保留；恢复账号不会解除部门冻结。',
    submit: async (body) => {
      await api('/users/' + id(user.userId) + '/status', {
        method: 'PATCH',
        body: { ...body, status: user.status === 1 ? 2 : 1 },
      })
      await list.load(list.page)
    },
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>用户账号</h1>
      <p>管理账号与账号状态</p>
    </div>
    <button v-if="can('IAM_USERS_WRITE')" class="button primary" @click="create">
      <Plus :size="16" />新建临时账号
    </button>
  </div>
  <p v-if="error" class="app-error" role="alert">{{ error }}</p>
  <p v-if="notice" class="action-notice" role="status">{{ notice }}</p>
  <AccountTable :state="list" :departments="depts.rows">
    <template #toolbar
      ><form class="inline-form account-filters" @submit.prevent="search">
        <div class="search-field">
          <button type="submit" aria-label="查询" :disabled="list.busy">
            <Search :size="17" /></button
          ><input
            v-model="keyword"
            aria-label="搜索姓名、账号或工号"
            placeholder="搜索姓名、账号或工号"
            maxlength="64"
          />
        </div>
        <select v-if="depts.rows.length" v-model="deptId" aria-label="筛选部门" @change="search">
          <option value="">全部部门</option>
          <option v-for="d in depts.rows" :key="d.deptId" :value="d.deptId">
            {{ d.deptName }}
          </option></select
        ><select v-model="accountStatus" aria-label="筛选账号状态" @change="search">
          <option value="">全部状态</option>
          <option :value="1">可用</option>
          <option :value="2">暂停</option>
          <option :value="3">离职</option></select
        ><span class="toolbar-summary">共 {{ list.total }} 个账号</span>
      </form></template
    >
    <template #actions="{ row }"
      ><button class="text-button" @click="showDetail(row)">详情</button
      ><button
        v-if="can('IAM_USERS_WRITE') && editable(row)"
        class="text-button secondary-action"
        @click="toggle(row)"
      >
        {{ row.status === 1 ? '暂停' : '恢复' }}
      </button></template
    >
  </AccountTable>
  <p class="contract-note">
    手动创建的临时账号可暂停或恢复；HR
    同步账号的状态由人员事件更新。部门冻结独立生效，不改变账号状态。
  </p>
  <ContentDialog
    v-if="detailId !== null"
    class="account-detail-dialog"
    title="账号详情"
    @close="closeDetail"
    ><p v-if="detailBusy" class="muted">正在读取…</p>
    <div v-else-if="detailError">
      <p role="alert" class="app-error">{{ detailError }}</p>
      <button class="button light" @click="showDetail({ userId: detailId })">重新加载</button>
    </div>
    <dl v-else class="account-details">
      <template v-for="[label, value] in detailEntries" :key="label"
        ><dt>{{ label }}</dt>
        <dd>{{ value ?? '—' }}</dd></template
      >
    </dl></ContentDialog
  >
  <FormDialog
    :allowed="can('IAM_USERS_WRITE')"
    v-if="dialog"
    v-bind="dialog"
    @close="dialog = null"
    @saved="saved"
  />
</template>

<style scoped>
.account-detail-dialog {
  width: 520px;
}
.account-details {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 12px;
  margin: 0;
}
.account-details dt {
  color: #7c8983;
}
.account-details dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
