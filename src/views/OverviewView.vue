<script setup>
import { useList } from '../composables/useList.js'
import { can } from '../access.js'
defineEmits(['navigate'])
const users = useList('/users', () => ({}), { auto: can('IAM_USERS_VIEW') })
const roles = useList('/roles', () => ({}), { auto: can('IAM_ROLES_VIEW') })
const apps = useList('/applications', () => ({}), { auto: can('IAM_RESOURCES_VIEW') })
const summaries = [{ label: '用户账号', page: 'users', permission: 'IAM_USERS_VIEW', state: users }, { label: '角色', page: 'roles', permission: 'IAM_ROLES_VIEW', state: roles }, { label: '接入应用', page: 'resources', permission: 'IAM_RESOURCES_VIEW', state: apps }]
</script>
<template><div class="page-heading"><div><h1>工作台</h1><p>统一管理账号、角色与应用权限</p></div></div><div class="simple-stats"><button v-for="item in summaries.filter(s => can(s.permission))" :key="item.page" @click="$emit('navigate', item.page)"><div><span>{{ item.label }}</span><strong>{{ item.state.error ? '读取失败' : item.state.busy ? '…' : item.state.data ? item.state.total : '—' }}</strong></div></button></div><section class="panel live-welcome"><h3>管理工作入口</h3><p>从左侧选择有权限的功能。统计数量、列表和操作结果均以当前接口响应为准。</p><p>人员变动由 HR 事件驱动；角色授予或回收须保留明确的业务依据。</p></section></template>
