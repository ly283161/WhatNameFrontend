<script setup>
import { ref, computed, watch } from 'vue'
import { api, session } from '../session.js'
import { can } from '../access.js'
import { readAll } from '../api/contracts.js'
import { useList, id } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
import DetailPanel from '../components/DetailPanel.vue'
const deptId = ref(''),
  list = useList('/admins', () => ({ deptId: deptId.value }))
const departments = useList('/departments', () => ({ includeDescendants: true }), {
  paginated: false,
  auto: can('IAM_DEPTS_VIEW'),
})
watch(
  () => session.accessVersion,
  () => {
    deptId.value = ''
    void list.load()
  },
)
const { dialog, error, notice, busy, perform, saved } = useActions()
function departmentName(departmentId) {
  if (departmentId == null || departmentId === '') return '未设置'
  const name =
    can('IAM_DEPTS_VIEW') && departments.rows.find((item) => item.deptId === departmentId)?.deptName
  return name || '部门名称未提供（ID：' + departmentId + '）'
}
function adminIdentity(level) {
  if (level === 1) return '总公司管理员'
  if (level === 2) return '部门管理员（二级）'
  if (level === 3) return '部门管理员（三级）'
  return Number.isInteger(level) && level > 0 ? '部门管理员（第 ' + level + ' 级）' : '未提供'
}
const scope = computed(() => {
  const data = session.scope
  if (!data) return null
  if (!data.appointed)
    return [
      ['管理资格', '未任命'],
      ['管理身份', '无有效管理员任命'],
      ['管理部门', '未设置'],
      ['可管理范围', '暂无管理范围'],
    ]
  const roots = Array.isArray(data.scopeRootIds) ? data.scopeRootIds : []
  return [
    ['管理资格', '任命有效'],
    ['管理身份', adminIdentity(data.adminLevel)],
    ['管理部门', departmentName(data.deptId)],
    [
      '可管理范围',
      data.adminLevel === 1
        ? '全集团'
        : roots.length
          ? roots.map(departmentName).join('、') + '及其下属部门'
          : '未提供',
    ],
  ]
})

function appoint() {
  dialog.value = {
    title: '任命管理员',
    initial: { userId: '', adminLevel: 2, deptId: '', reason: '' },
    fields: [
      { key: 'userId', label: '用户 ID' },
      { key: 'adminLevel', label: '管理员等级', type: 'number', min: 1, max: 65535 },
      { key: 'deptId', label: '管理部门 ID' },
      { key: 'reason', label: '任命原因', type: 'textarea' },
    ],
    note: '由服务端核验等级和管理范围，任命不直接授予角色。',
    submit: async (body) => {
      await api('/admins/appointments', { method: 'POST', body })
      await list.load()
    },
  }
}
function revoke(row) {
  dialog.value = {
    title: '撤销管理员任命',
    fields: [{ key: 'reason', label: '撤销原因', type: 'textarea' }],
    initial: { reason: '' },
    note: `用户 ${row.userId} 的管理资格将撤销，历史授予的普通角色不自动删除。`,
    submit: async (body) => {
      await api(`/admins/${id(row.userId)}/revoke`, { method: 'POST', body })
      await list.load(list.page)
    },
  }
}
function delegate(row) {
  perform(async () => {
    const current = await api(`/admins/${id(row.userId)}/delegable-roles`)
    const options = current.roleIds.map((value) => ({ value, label: `角色 ${value}` }))
    if (can('IAM_ROLES_VIEW')) {
      const roles = await readAll(api, '/roles')
      for (const role of roles.filter((r) => r.roleType !== 3)) {
        const existing = options.find((o) => o.value === role.roleId)
        if (existing) existing.label = role.roleName
        else options.push({ value: role.roleId, label: role.roleName })
      }
    }
    dialog.value = {
      title: '配置可授权角色清单',
      initial: { roleIds: current.roleIds, reason: '' },
      fields: [
        { key: 'roleIds', label: '可授予角色（取消全部将清空清单）', type: 'multi', options },
        { key: 'reason', label: '配置原因', type: 'textarea' },
      ],
      submit: async (body) => {
        if (!current.delegationVersion) throw new Error('缺少清单版本，无法保存')
        await api(`/admins/${id(row.userId)}/delegable-roles`, {
          method: 'PUT',
          body: { ...body, expectedVersion: current.delegationVersion },
        })
        await list.load(list.page)
      },
    }
  })
}
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>管理员管理</h1>
      <p>管理员任命、等级与管理范围</p>
    </div>
    <button v-if="can('IAM_ADMINS_WRITE')" class="button primary" @click="appoint">
      任命管理员
    </button>
  </div>
  <p v-if="error" role="alert" class="app-error">{{ error }}</p>
  <p v-if="notice" role="status" class="action-notice">{{ notice }}</p>
  <DetailPanel v-if="scope" title="本人管理范围" :entries="scope" collapsible /><RecordTable
    :state="list"
    :columns="[
      { key: 'userId', label: '用户 ID' },
      { key: 'adminLevel', label: '管理员等级' },
      { key: 'deptId', label: '管理部门 ID' },
      { key: 'status', label: '状态' },
    ]"
    row-key="userId"
    ><template #toolbar
      ><form class="inline-form" @submit.prevent="list.load()">
        <select
          v-model="deptId"
          aria-label="筛选管理部门"
          :disabled="departments.busy || !!departments.error || !can('IAM_DEPTS_VIEW')"
          :title="!can('IAM_DEPTS_VIEW') ? '当前没有部门查询权限' : undefined"
        >
          <option value="">全部部门</option>
          <option
            v-for="department in can('IAM_DEPTS_VIEW') ? departments.rows : []"
            :key="department.deptId"
            :value="department.deptId"
          >
            {{ department.deptName }}
          </option></select
        ><button class="button light" :disabled="list.busy">查询</button
        ><span v-if="departments.error && can('IAM_DEPTS_VIEW')" class="app-error" role="alert"
          >部门列表读取失败</span
        ><button
          v-if="departments.error && can('IAM_DEPTS_VIEW')"
          type="button"
          class="text-button"
          @click="departments.load()"
        >
          重新加载部门
        </button>
      </form></template
    ><template #actions="{ row }"
      ><button
        v-if="can('IAM_ADMINS_WRITE') && row.status === 1"
        class="text-button"
        @click="revoke(row)"
      >
        撤销任命</button
      ><button
        v-if="can('IAM_GRANTS_DELEGATE') && can('IAM_GRANTS_VIEW')"
        class="text-button"
        :disabled="busy"
        @click="delegate(row)"
      >
        可授权清单
      </button></template
    ></RecordTable
  ><FormDialog
    :allowed="
      can(dialog.title === '配置可授权角色清单' ? 'IAM_GRANTS_DELEGATE' : 'IAM_ADMINS_WRITE')
    "
    v-if="dialog"
    v-bind="dialog"
    @close="dialog = null"
    @saved="saved"
  />
</template>
