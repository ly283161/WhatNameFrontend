<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { api, session } from '../session.js'
import { can } from '../access.js'
import { useList, id, errorText } from '../composables/useList.js'
import RecordTable from '../components/RecordTable.vue'
import ContentDialog from '../components/ContentDialog.vue'
import AuditIdentity from '../components/AuditIdentity.vue'

const categories = [
  { key: 'operations', name: '管理操作', description: '查看账号、角色、应用及权限配置等操作记录' },
  {
    key: 'authorizations',
    name: '接口权限校验',
    description: '查看业务接口权限校验的允许或拒绝记录',
  },
  {
    key: 'logins',
    name: '统一账号登录',
    description: '查看统一账号认证的登录记录，不包含各业务系统的登录记录',
  },
]
const tab = ref('operations'),
  searchText = ref(''),
  filterError = ref(''),
  activeUserId = ref(''),
  appliedUser = ref(null)
const candidatesShown = ref(false),
  hideRecords = ref(false)
const candidates = useList('/users', () => ({ keyword: searchText.value.trim() }), { auto: false })
let searchSequence = 0,
  searchDisposed = false
const category = computed(() => categories.find((item) => item.key === tab.value))
const list = useList(
  () => '/audit/' + tab.value,
  () => (tab.value === 'operations' ? {} : { userId: activeUserId.value }),
)
const people = ref({})
let peopleController,
  peopleSequence = 0
async function readPeople(records) {
  peopleController?.abort()
  peopleController = new AbortController()
  const signal = peopleController.signal,
    current = ++peopleSequence
  const ids = [
    ...new Set(
      records
        .map((row) => (tab.value === 'operations' ? row.actorUserId : row.userId))
        .filter((value) => value != null && value !== ''),
    ),
  ]
  people.value = {}
  if (!can('IAM_USERS_VIEW')) return
  people.value = Object.fromEntries(ids.map((userId) => [userId, { loading: true }]))
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (cursor < ids.length && current === peopleSequence) {
        const userId = ids[cursor++]
        try {
          const user = await api('/users/' + id(userId), { signal, refreshAccessOnError: false })
          if (current === peopleSequence) people.value[userId] = { user }
        } catch (e) {
          if (current === peopleSequence) people.value[userId] = { error: errorText(e) }
        }
      }
    }),
  )
}
watch(
  () => list.rows,
  (records) => {
    void readPeople(records)
  },
)
const operationNames = {
  MOCK_INITIALIZATION: '环境初始化',
  USER_CREATE: '创建临时账号',
  US03_CREATE: '创建临时账号',
  USER_STATUS: '修改账号状态',
  US04_STATUS: '修改账号状态',
  US01_LIST: '查询账号列表',
  US02_DETAIL: '查询账号详情',
  USER_ROLE_GRANT: '授予用户角色',
  USER_ROLE_REVOKE: '回收用户角色',
  APPLICATION_CREATE: '登记应用',
  APPLICATION_UPDATE: '修改应用',
  MENU_CREATE: '添加菜单',
  MENU_UPDATE: '修改菜单',
  API_CREATE: '登记接口',
  API_UPDATE: '修改接口',
  MENU_API_UPDATE: '修改菜单接口映射',
  ROLE_CREATE: '创建角色',
  ROLE_UPDATE: '修改角色',
  ROLE_MENUS_UPDATE: '修改角色菜单权限',
  ADMIN_APPOINT: '任命管理员',
  ADMIN_REVOKE: '撤销管理员任命',
  ADMIN_DELEGATE: '修改可授权角色清单',
  ADMIN_DELEGATION: '修改可授权角色清单',
  ADMIN_HR_REVIEW: '人员变动后复核管理资格',
  ADMIN_ORG_REVIEW: '组织变动后复核管理资格',
  DEPT_FREEZE: '冻结部门权限',
  DEPT_UNFREEZE: '解除部门冻结',
  HR_DEPARTMENT: '同步组织信息',
  HR_MERGE: '合并部门',
  HR_EMPLOYEE: '同步人员信息',
  HR_TRANSFER: '人员调岗',
  HR_TERMINATION: '人员离职',
  OA_DECISION: '处理 OA 审批结果',
  AU01_LOGIN: '账号登录',
  AU04_LOGOUT: '退出登录',
  AU05_SMS: '发送短信验证码',
}
const operationName = (value) => operationNames[value] || value || '未提供'
const loginMethod = (value) =>
  ({ USERNAME_PASSWORD: '账号密码', PHONE_PASSWORD: '手机号密码' })[value] || value || '未提供'
const resultText = (value, yes, no) => (value === true ? yes : value === false ? no : '未提供')
const timeFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
function timeText(value) {
  if (
    typeof value !== 'string' ||
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    return '未提供'
  return timeFormat.format(new Date(value))
}
function personText(userId) {
  if (userId == null || userId === '') return '未关联用户'
  const user = people.value[userId]?.user
  return user
    ? [user.realName, user.username, '用户 ID：' + userId].filter(Boolean).join(' / ')
    : '用户 ID：' + userId
}
const columns = computed(() =>
  tab.value === 'operations'
    ? [
        { key: 'occurredAt', label: '操作时间', format: timeText },
        { key: 'operationType', label: '操作类型', format: operationName },
        { key: 'actorUserId', label: '操作者', format: personText },
        { key: 'targetId', label: '操作对象 ID' },
      ]
    : tab.value === 'authorizations'
      ? [
          { key: 'occurredAt', label: '访问时间', format: timeText },
          { key: 'userId', label: '访问用户', format: personText },
          { key: 'apiId', label: '访问接口 ID' },
          {
            key: 'allowed',
            label: '访问结果',
            format: (value) => resultText(value, '允许访问', '拒绝访问'),
          },
        ]
      : [
          { key: 'occurredAt', label: '登录时间', format: timeText },
          { key: 'userId', label: '登录用户', format: personText },
          { key: 'loginMethod', label: '登录方式', format: loginMethod },
          {
            key: 'success',
            label: '登录结果',
            format: (value) => resultText(value, '登录成功', '登录失败'),
          },
        ],
)
const rows = computed(() => ({
  ...list,
  total: hideRecords.value ? 0 : list.total,
  busy: list.busy || candidates.busy,
  rows: (hideRecords.value ? [] : list.rows).map((row, index) => ({
    ...row,
    key: [row.eventId, row.decisionId, row.userId, row.occurredAt, index].join(':'),
  })),
}))
watch(
  searchText,
  () => {
    searchSequence++
    candidatesShown.value = false
    filterError.value = ''
  },
  { flush: 'sync' },
)
async function search(page = 1) {
  if (tab.value === 'operations') return
  const current = ++searchSequence
  filterError.value = ''
  candidatesShown.value = false
  if (!searchText.value.trim()) {
    activeUserId.value = ''
    appliedUser.value = null
    hideRecords.value = false
    await list.load()
    return
  }
  hideRecords.value = true
  if (!can('IAM_USERS_VIEW')) {
    filterError.value = '当前没有用户查询权限，无法按姓名、账号或工号查找'
    return
  }
  await candidates.load(page)
  if (current !== searchSequence || searchDisposed) return
  if (candidates.error) {
    filterError.value = candidates.error
    return
  }
  if (candidates.total === 1 && candidates.rows.length === 1) {
    chooseUser(candidates.rows[0])
    return
  }
  candidatesShown.value = true
}
function chooseUser(user) {
  activeUserId.value = user.userId
  appliedUser.value = user
  candidatesShown.value = false
  hideRecords.value = false
  void list.load()
}
function resetSearch() {
  searchSequence++
  searchText.value = ''
  activeUserId.value = ''
  appliedUser.value = null
  candidatesShown.value = false
  hideRecords.value = false
  filterError.value = ''
}
watch(tab, () => {
  closeDetail()
  resetSearch()
  void list.load()
})

const detail = ref(null),
  detailKind = ref('')
const detailEntries = computed(() => {
  if (!detail.value) return []
  const row = detail.value
  const entries = [
    ['记录时间', timeText(row.occurredAt)],
    ['用户信息', personText(detailKind.value === 'operations' ? row.actorUserId : row.userId)],
  ]
  if (detailKind.value === 'operations')
    entries.push(
      ['操作类型', operationName(row.operationType)],
      ['操作代码', row.operationType],
      ['操作对象 ID', row.targetId],
    )
  else if (detailKind.value === 'authorizations')
    entries.push(
      ['访问接口 ID', row.apiId],
      ['访问结果', resultText(row.allowed, '允许访问', '拒绝访问')],
      ['鉴权记录编号', row.decisionId],
    )
  else
    entries.push(
      ['登录方式', loginMethod(row.loginMethod)],
      ['登录结果', resultText(row.success, '登录成功', '登录失败')],
    )
  if (row.eventId) entries.push(['日志编号', row.eventId])
  return entries
})
function closeDetail() {
  detail.value = null
}
function showDetail(row) {
  detail.value = { ...row }
  detailKind.value = tab.value
}
watch(
  () => session.accessVersion,
  () => {
    closeDetail()
    resetSearch()
    peopleSequence++
    peopleController?.abort()
    people.value = {}
    void list.load()
  },
)
onBeforeUnmount(() => {
  searchDisposed = true
  searchSequence++
  closeDetail()
  peopleSequence++
  peopleController?.abort()
})
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>操作日志</h1>
      <p>{{ category.description }}</p>
    </div>
  </div>
  <div class="page-tabs" role="tablist" aria-label="日志分类">
    <button
      v-for="item in categories"
      :key="item.key"
      role="tab"
      :aria-selected="tab === item.key"
      @click="tab = item.key"
    >
      {{ item.name }}
    </button>
  </div>
  <p v-if="filterError" class="app-error" role="alert">{{ filterError }}</p>
  <RecordTable :state="rows" :columns="columns" row-key="key" actions-label="详情">
    <template v-if="tab !== 'operations'" #toolbar
      ><div class="audit-toolbar">
        <form class="audit-filters" @submit.prevent="search()">
          <input
            v-model="searchText"
            aria-label="按姓名、账号或工号查询日志"
            placeholder="搜索姓名、账号或工号"
            maxlength="64"
          /><button class="button light" :disabled="list.busy || candidates.busy">查询</button>
        </form>
        <p v-if="appliedUser && !hideRecords" class="muted">
          当前用户：{{ appliedUser.realName }}（{{ appliedUser.username }} ·
          {{ appliedUser.sgNo || '无工号' }}）
        </p>
        <section v-if="candidatesShown" class="audit-candidates" aria-label="匹配用户">
          <p class="muted">
            {{ candidates.total ? '匹配到多位用户，请选择要查询的用户' : '未找到匹配用户' }}
          </p>
          <button
            v-for="user in candidates.rows"
            :key="user.userId"
            type="button"
            @click="chooseUser(user)"
          >
            <strong>{{ user.realName }}</strong
            ><span>{{ user.username }} · {{ user.sgNo || '无工号' }}</span
            ><span>查看日志</span>
          </button>
          <div v-if="candidates.total > 20" class="pagination">
            <button
              class="button light"
              :disabled="candidates.busy || candidates.page <= 1"
              @click="search(candidates.page - 1)"
            >
              上一页用户</button
            ><button
              class="button light"
              :disabled="candidates.busy || candidates.page * 20 >= candidates.total"
              @click="search(candidates.page + 1)"
            >
              下一页用户
            </button>
          </div>
        </section>
      </div></template
    >
    <template #cell-actorUserId="{ row }"
      ><AuditIdentity
        :user-id="row.actorUserId"
        :info="people[row.actorUserId]"
        :can-view="can('IAM_USERS_VIEW')"
    /></template>
    <template #cell-userId="{ row }"
      ><AuditIdentity
        :user-id="row.userId"
        :info="people[row.userId]"
        :can-view="can('IAM_USERS_VIEW')"
    /></template>
    <template #cell-occurredAt="{ row }"
      ><time :datetime="row.occurredAt" :title="row.occurredAt">{{
        timeText(row.occurredAt)
      }}</time></template
    >
    <template #cell-allowed="{ row }"
      ><span
        :class="[
          'tag',
          row.allowed === true ? 'green' : row.allowed === false ? 'orange' : 'neutral',
        ]"
        >{{ resultText(row.allowed, '允许访问', '拒绝访问') }}</span
      ></template
    >
    <template #cell-success="{ row }"
      ><span
        :class="[
          'tag',
          row.success === true ? 'green' : row.success === false ? 'orange' : 'neutral',
        ]"
        >{{ resultText(row.success, '登录成功', '登录失败') }}</span
      ></template
    >
    <template #actions="{ row }"
      ><button class="text-button" @click="showDetail(row)">查看详情</button></template
    >
  </RecordTable>
  <ContentDialog v-if="detail" title="日志详情" @close="closeDetail"
    ><dl class="audit-detail">
      <template v-for="[label, value] in detailEntries" :key="label"
        ><dt>{{ label }}</dt>
        <dd>{{ value ?? '未提供' }}</dd></template
      >
    </dl></ContentDialog
  >
</template>
<style scoped>
.audit-toolbar {
  display: grid;
  gap: 14px;
  width: 100%;
}
.audit-candidates {
  display: grid;
  gap: 8px;
}
.audit-candidates > button {
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  width: 100%;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.audit-candidates > button:hover {
  background: #f6f7f9;
}
.audit-candidates > button > span:last-child {
  margin-left: auto;
  color: var(--green);
}
.audit-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}
.audit-filters input {
  width: 290px;
  min-width: 0;
  max-width: 100%;
}
.audit-detail {
  display: grid;
  grid-template-columns: 155px minmax(0, 1fr);
  gap: 16px;
  margin: 0;
}
.audit-detail dt {
  color: var(--muted);
}
.audit-detail dd {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
@media (max-width: 700px) {
  .audit-filters {
    flex-wrap: nowrap;
  }
  .audit-filters input {
    flex: 1;
    width: 0;
  }
  .audit-detail {
    grid-template-columns: 110px minmax(0, 1fr);
  }
}
</style>
