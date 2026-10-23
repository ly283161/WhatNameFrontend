<script setup>
import { Users, KeyRound, Blocks } from 'lucide-vue-next'
import { session } from '../session.js'
import { useList } from '../composables/useList.js'
import { can } from '../access.js'
defineEmits(['navigate'])
const users = useList('/users', () => ({}), { auto: can('IAM_USERS_VIEW') })
const roles = useList('/roles', () => ({}), { auto: can('IAM_ROLES_VIEW') })
const apps = useList('/applications', () => ({}), { auto: can('IAM_RESOURCES_VIEW') })
const summaries = [
  { label: '用户账号', page: 'users', permission: 'IAM_USERS_VIEW', icon: Users, state: users },
  { label: '角色', page: 'roles', permission: 'IAM_ROLES_VIEW', icon: KeyRound, state: roles },
  {
    label: '接入应用',
    page: 'resources',
    permission: 'IAM_RESOURCES_VIEW',
    icon: Blocks,
    state: apps,
  },
]
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>工作台</h1>
      <p>你好，{{ session.accountLabel || '当前账号' }}。</p>
    </div>
  </div>
  <div class="simple-stats">
    <button
      v-for="item in summaries.filter((s) => can(s.permission))"
      :key="item.page"
      @click="$emit('navigate', item.page)"
    >
      <div>
        <span>{{ item.label }}</span
        ><strong>{{
          item.state.error
            ? '读取失败'
            : item.state.busy
              ? '…'
              : item.state.data
                ? item.state.total
                : '—'
        }}</strong>
      </div>
      <component :is="item.icon" :size="23" :stroke-width="1.5" />
    </button>
  </div>
</template>
