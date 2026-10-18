<script setup>
import { ref, watch } from 'vue'
import { api } from '../session.js'
import { can } from '../access.js'
import { useList, id } from '../composables/useList.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
const apps = useList('/applications'), app = ref(null), tab = ref('menus')
const menus = useList(() => `/applications/${id(app.value?.appId)}/menus`, () => ({}), { collection: 'menus', paginated: false, auto: false })
const apis = useList(() => `/applications/${id(app.value?.appId)}/apis`, () => ({}), { auto: false })
const { dialog, error, notice, busy, perform, saved } = useActions()
watch(app, value => { if (value) { menus.load(); apis.load() } })
const appColumns = [{ key: 'appName', label: '应用名称' }, { key: 'appCode', label: '编码' }, { key: 'status', label: '状态' }]
const menuColumns = [{ key: 'menuName', label: '菜单' }, { key: 'menuCode', label: '编码' }, { key: 'menuType', label: '类型', format: v => v === 1 ? '目录' : '权限菜单' }, { key: 'parentId', label: '父菜单 ID' }, { key: 'status', label: '状态' }]
const apiColumns = [{ key: 'apiName', label: '接口名称' }, { key: 'httpMethod', label: '方法' }, { key: 'apiPath', label: '路径' }, { key: 'status', label: '状态' }]
const statusOptions = [{ value: 1, label: '启用' }, { value: 0, label: '停用' }]
function create(kind) {
  const fields = kind === 'app' ? [{ key: 'appCode', label: '应用编码' }, { key: 'appName', label: '应用名称' }, { key: 'description', label: '描述' }] : kind === 'menu' ? [{ key: 'menuCode', label: '菜单编码' }, { key: 'menuName', label: '菜单名称' }, { key: 'menuType', label: '类型', options: [{ value: 1, label: '目录' }, { value: 2, label: '权限菜单' }] }, { key: 'parentId', label: '父菜单', options: [{ value: '0', label: '根目录' }, ...menus.rows.filter(m => m.menuType === 1).map(m => ({ value: m.menuId, label: m.menuName || m.menuId }))] }, { key: 'path', label: '前端路径' }] : [{ key: 'apiCode', label: '接口编码' }, { key: 'apiName', label: '接口名称' }, { key: 'httpMethod', label: '请求方法', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(value => ({ value, label: value })) }, { key: 'apiPath', label: '后端路由模板' }]
  const path = kind === 'app' ? '/applications' : `/applications/${id(app.value.appId)}/${kind === 'menu' ? 'menus' : 'apis'}`
  dialog.value = { title: { app: '登记应用', menu: '添加菜单', api: '登记 API' }[kind], initial: Object.fromEntries(fields.map(f => [f.key, f.key === 'menuType' ? 2 : f.key === 'parentId' ? '0' : f.key === 'httpMethod' ? 'GET' : ''])), fields, submit: async body => { await api(path, { method: 'POST', body }); await (kind === 'app' ? apps.load() : kind === 'menu' ? menus.load() : apis.load()) } }
}
function edit(kind, row) {
  const fields = kind === 'app' ? [{ key: 'appName', label: '应用名称' }] : kind === 'menu' ? [{ key: 'parentId', label: '父菜单 ID' }] : [{ key: 'apiName', label: '接口名称' }]
  fields.push({ key: 'status', label: '状态', options: statusOptions }, { key: 'reason', label: '操作原因', type: 'textarea' })
  const path = kind === 'app' ? `/applications/${id(row.appId)}` : kind === 'menu' ? `/menus/${id(row.menuId)}` : `/apis/${id(row.apiId)}`
  dialog.value = { title: { app: '编辑应用', menu: '调整菜单', api: '编辑 API' }[kind], fields, initial: Object.fromEntries(fields.map(f => [f.key, row[f.key] ?? ''])), submit: async body => { await api(path, { method: 'PATCH', body }); await (kind === 'app' ? apps.load(apps.page) : kind === 'menu' ? menus.load() : apis.load(apis.page)) } }
}
function mapping(row) { perform(async () => {
  const [current, resources] = await Promise.all([api(`/menus/${id(row.menuId)}/apis`), api(`/applications/${id(app.value.appId)}/apis`, { query: { page: 1, pageSize: 500 } })])
  if (resources.total > resources.items.length) throw new Error('API 数量超过当前加载范围，不能执行不完整的全量替换')
  const options = resources.items.map(a => ({ value: a.apiId, label: `${a.httpMethod} ${a.apiPath}` }))
  for (const apiId of current.apiIds) if (!options.some(o => o.value === apiId)) options.push({ value: apiId, label: `已有 API ${apiId}` })
  dialog.value = { title: '配置 API 映射', fields: [{ key: 'apiIds', label: '关联接口（取消全部将清空映射）', type: 'multi', options }], initial: { apiIds: current.apiIds }, submit: async body => { if (!current.mappingVersion) throw new Error('缺少映射版本，无法保存'); await api(`/menus/${id(row.menuId)}/apis`, { method: 'PUT', body: { apiIds: body.apiIds, expectedVersion: current.mappingVersion } }); await menus.load() } }
}) }
</script>
<template><div class="page-heading"><div><h1>应用管理</h1><p>维护应用、菜单与 API 映射</p></div><button v-if="can('IAM_RESOURCES_WRITE')" class="button primary" @click="create('app')">登记应用</button></div><p v-if="error" role="alert" class="app-error">{{ error }}</p><p v-if="notice" role="status" class="action-notice">{{ notice }}</p><RecordTable :state="apps" :columns="appColumns" row-key="appId"><template #actions="{ row }"><button class="text-button" @click="app = row">查看资源</button><button v-if="can('IAM_RESOURCES_WRITE')" class="text-button" @click="edit('app', row)">编辑</button></template></RecordTable>
  <section v-if="app" class="resource-section"><div class="section-heading"><h2>{{ app.appName }}</h2><div class="page-tabs" role="tablist" aria-label="应用资源"><button role="tab" :aria-selected="tab === 'menus'" @click="tab = 'menus'">菜单资源</button><button role="tab" :aria-selected="tab === 'apis'" @click="tab = 'apis'">API 资源</button></div><button v-if="can('IAM_RESOURCES_WRITE')" class="button primary" @click="create(tab === 'menus' ? 'menu' : 'api')">{{ tab === 'menus' ? '添加菜单' : '登记 API' }}</button></div><RecordTable v-if="tab === 'menus'" :state="menus" :columns="menuColumns" row-key="menuId" :paginated="false"><template #actions="{ row }"><template v-if="can('IAM_RESOURCES_WRITE')"><button class="text-button" @click="edit('menu', row)">调整菜单</button><button v-if="row.menuType === 2" class="text-button" :disabled="busy" @click="mapping(row)">配置 API</button></template></template></RecordTable><RecordTable v-else :state="apis" :columns="apiColumns" row-key="apiId"><template #actions="{ row }"><button v-if="can('IAM_RESOURCES_WRITE')" class="text-button" @click="edit('api', row)">编辑</button></template></RecordTable></section><FormDialog v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="saved" /></template>
