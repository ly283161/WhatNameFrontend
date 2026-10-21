<script setup>
import { forEachConcurrent } from '../utils/concurrent.js'
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { trapTab } from '../utils/dialogFocus.js'
import { X, Plus, ChevronRight, Pencil, FolderOpen, Menu as MenuIcon } from 'lucide-vue-next'
import { api, session } from '../session.js'
import { canGlobal as can } from '../access.js'
import { readAll } from '../api/contracts.js'
import { useList } from '../composables/useList.js'
import { id } from '../utils/formatters.js'
import { useActions } from '../composables/useActions.js'
import RecordTable from '../components/RecordTable.vue'
import FormDialog from '../components/FormDialog.vue'
const apps = useList('/applications'), app = ref(null), resourceOpen = ref(false), tab = ref('menus'), previews = ref({})
const menus = useList(() => `/applications/${id(app.value?.appId)}/menus`, () => ({}), { collection: 'menus', paginated: false, auto: false })
const apis = useList(() => `/applications/${id(app.value?.appId)}/apis`, () => ({}), { auto: false })
const { dialog, error, notice, busy, perform, saved } = useActions()
const resourcePanel = ref(null), apiCounts = ref({}), resourceReads = new Map()
// 资源读取仅在页面内复用，列表更新时失效，失败后允许重试。
function readResource(path, all = false) {
  if (!resourceReads.has(path)) {
    const pending = all ? readAll(api, path).then(rows => new Map(rows.map(row => [row.apiId, row]))) : api(path)
    resourceReads.set(path, pending)
    pending.catch(() => { if (resourceReads.get(path) === pending) resourceReads.delete(path) })
  }
  return resourceReads.get(path)
}
let resourceTrigger, previousOverflow, previewVersion = 0, countVersion = 0
const appColor = index => ['orange', 'blue', 'green', 'purple'][index % 4]
const appInitials = row => row.appName.match(/[a-z]{2,}/i)?.[0].slice(0, 3).toUpperCase() || row.appName.slice(0, 2)
const menuName = row => row.menuName || row.menuCode || '菜单 ' + row.menuId
function selectApp(row) { app.value = row }
watch(() => apps.rows, rows => {
  if (apps.busy && !rows.length) return
  const next = rows.find(row => row.appId === app.value?.appId) || rows[0] || null
  if (JSON.stringify(next) !== JSON.stringify(app.value)) app.value = next
})
// 预先读取菜单关联接口数量，并限制并发请求数。
watch(() => menus.rows, async rows => {
  const version = ++countVersion
  resourceReads.clear()
  apiCounts.value = {}
  const pending = rows.filter(row => row.menuType === 2)
  await forEachConcurrent(pending, async row => {
    try {
      const mapped = await readResource('/menus/' + id(row.menuId) + '/apis')
      if (version === countVersion) apiCounts.value[row.menuId] = mapped.apiIds.length
    } catch {
      if (version === countVersion) apiCounts.value[row.menuId] = null
    }
  }, () => version === countVersion)
})
function apiCountLabel(row) {
  const count = apiCounts.value[row.menuId]
  return typeof count === 'number' ? count + ' 个 API' : count === null ? '数量读取失败' : '正在读取…'
}
async function loadPreview(row) {
  if (previews.value[row.menuId]?.loading || previews.value[row.menuId]?.items) return
  const version = previewVersion, appId = app.value.appId
  previews.value[row.menuId] = { loading: true }
  try {
    const [mapped, resources] = await Promise.all([readResource('/menus/' + id(row.menuId) + '/apis'), readResource('/applications/' + id(appId) + '/apis', true)])
    if (version !== previewVersion) return
    apiCounts.value[row.menuId] = mapped.apiIds.length
    previews.value[row.menuId] = { items: mapped.apiIds.map(apiId => resources.get(apiId) || { apiId }) }
  } catch (e) { if (version === previewVersion) previews.value[row.menuId] = { error: e.message } }
}
function openResources(row, event) {
  resourceTrigger = event.currentTarget; tab.value = 'menus'; app.value = row; resourceOpen.value = true
}
async function closeResources() {
  if (busy.value || dialog.value) return
  resourceOpen.value = false; await nextTick(); resourceTrigger?.focus()
}
watch(() => apis.rows, () => { if (app.value) resourceReads.delete('/applications/' + id(app.value.appId) + '/apis') })
watch(app, value => { resourceReads.clear(); previewVersion++; previews.value = {}; if (value) { menus.load(); apis.load() } else resourceOpen.value = false })
watch(resourceOpen, value => {
  if (value) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
  else if (previousOverflow !== undefined) { document.body.style.overflow = previousOverflow; previousOverflow = undefined }
})
watch([resourceOpen, dialog], async ([value, form]) => {
  if (value && !form) { await nextTick(); resourcePanel.value?.querySelector('button')?.focus() }
})
watch(() => session.accessVersion, () => { resourceOpen.value = false; app.value = null })
onBeforeUnmount(() => { resourceReads.clear(); countVersion++; previewVersion++; if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow })
function resourceKeys(event) {
  if (dialog.value) return
  if (event.key === 'Escape') { event.preventDefault(); closeResources(); return }
  trapTab(event, resourcePanel.value, 'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')
}
const menuColumns = [{ key: 'menuName', label: '菜单', format: (v, r) => v || r.menuCode || ('菜单 ' + r.menuId) }, { key: 'menuCode', label: '编码' }, { key: 'menuType', label: '类型', format: v => v === 1 ? '目录' : '权限菜单' }, { key: 'parentId', label: '父菜单 ID' }, { key: 'status', label: '状态' }]
const apiColumns = [{ key: 'apiName', label: '接口名称', format: (v, r) => v || r.apiCode || ('API ' + r.apiId) }, { key: 'httpMethod', label: '方法' }, { key: 'apiPath', label: '路径' }, { key: 'status', label: '状态' }]
const statusOptions = [{ value: 1, label: '启用' }, { value: 0, label: '停用' }]
function create(kind) {
  const fields = kind === 'app' ? [{ key: 'appCode', label: '应用编码' }, { key: 'appName', label: '应用名称' }, { key: 'description', label: '描述' }] : kind === 'menu' ? [{ key: 'menuCode', label: '菜单编码' }, { key: 'menuName', label: '菜单名称' }, { key: 'menuType', label: '类型', options: [{ value: 1, label: '目录' }, { value: 2, label: '权限菜单' }] }, { key: 'parentId', label: '父菜单', options: [{ value: '0', label: '根目录' }, ...menus.rows.map(m => ({ value: m.menuId, label: m.menuName || m.menuId }))] }, { key: 'path', label: '前端路径' }] : [{ key: 'apiCode', label: '接口编码' }, { key: 'apiName', label: '接口名称' }, { key: 'httpMethod', label: '请求方法', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(value => ({ value, label: value })) }, { key: 'apiPath', label: '后端路由模板' }]
  const path = kind === 'app' ? '/applications' : `/applications/${id(app.value.appId)}/${kind === 'menu' ? 'menus' : 'apis'}`
  dialog.value = { title: { app: '登记应用', menu: '添加菜单', api: '登记 API' }[kind], initial: Object.fromEntries(fields.map(f => [f.key, f.key === 'menuType' ? 2 : f.key === 'parentId' ? '0' : f.key === 'httpMethod' ? 'GET' : ''])), fields, submit: async body => { if (!can('IAM_RESOURCES_WRITE')) throw new Error('当前没有一级管理员配置资格'); await api(path, { method: 'POST', body }); await (kind === 'app' ? apps.load() : kind === 'menu' ? menus.load() : apis.load()) } }
}
function edit(kind, row) {
  const fields = kind === 'app' ? [{ key: 'appName', label: '应用名称' }] : kind === 'menu' ? [{ key: 'menuName', label: '菜单名称', required: !!row.menuName }, { key: 'parentId', label: '父菜单 ID' }] : row.apiName ? [{ key: 'apiName', label: '接口名称' }] : []
  fields.push({ key: 'status', label: '状态', options: statusOptions }, { key: 'reason', label: '操作原因', type: 'textarea' })
  const path = kind === 'app' ? `/applications/${id(row.appId)}` : kind === 'menu' ? `/menus/${id(row.menuId)}` : `/apis/${id(row.apiId)}`
  dialog.value = { title: { app: '编辑应用', menu: '调整菜单', api: '编辑 API' }[kind], note: kind === 'menu' && !row.menuName ? '当前菜单名称未返回；留空保留原名称，填写新名称则修改。' : undefined, fields, initial: Object.fromEntries(fields.map(f => [f.key, row[f.key] ?? ''])), submit: async body => { if (!can('IAM_RESOURCES_WRITE')) throw new Error('当前没有一级管理员配置资格'); const update = { ...body }; if (kind === 'menu' && !update.menuName) delete update.menuName; await api(path, { method: 'PATCH', body: update }); await (kind === 'app' ? apps.load(apps.page) : kind === 'menu' ? menus.load() : apis.load(apis.page)) } }
}
function mapping(row) { perform(async () => {
  const [current, resources] = await Promise.all([api(`/menus/${id(row.menuId)}/apis`), readAll(api, `/applications/${id(app.value.appId)}/apis`)])
  const options = resources.map(a => ({ value: a.apiId, label: `${a.httpMethod} ${a.apiPath}` }))
  for (const apiId of current.apiIds) if (!options.some(o => o.value === apiId)) options.push({ value: apiId, label: `已有 API ${apiId}` })
  dialog.value = { title: '配置 API 映射', fields: [{ key: 'apiIds', label: '关联接口（取消全部将清空映射）', type: 'multi', options }], initial: { apiIds: current.apiIds }, submit: async body => { if (!can('IAM_RESOURCES_WRITE')) throw new Error('当前没有一级管理员配置资格'); if (!current.mappingVersion) throw new Error('缺少映射版本，无法保存'); await api(`/menus/${id(row.menuId)}/apis`, { method: 'PUT', body: { apiIds: body.apiIds, expectedVersion: current.mappingVersion } }); const wasExpanded = !!previews.value[row.menuId]; delete previews.value[row.menuId]; await menus.load(); if (wasExpanded) await loadPreview(row) } }
}) }
</script>
<template><div class="page-heading"><div><h1>应用管理</h1><p>选择应用，维护菜单权限</p></div><button v-if="can('IAM_RESOURCES_WRITE')" class="button primary" @click="create('app')"><Plus :size="16" />登记应用</button></div><p v-if="error && !resourceOpen" role="alert" class="app-error">{{ error }}</p><p v-if="notice && !resourceOpen" role="status" class="action-notice">{{ notice }}</p>
<div class="resource-layout" :inert="resourceOpen || !!dialog" :aria-hidden="resourceOpen || dialog ? 'true' : undefined">
<section class="panel app-selector"><div class="panel-heading"><h3>业务应用 <span class="count-badge">{{ apps.data ? apps.total : '—' }}</span></h3></div><p v-if="apps.busy" class="empty">正在加载…</p><div v-else-if="apps.error" class="list-error"><p role="alert" class="app-error">{{ apps.error }}</p><button class="button light" @click="apps.load()">重新加载</button></div><template v-else><button v-for="(item, index) in apps.rows" :key="item.appId" :class="{ chosen: app?.appId === item.appId }" :aria-pressed="app?.appId === item.appId" @click="selectApp(item)"><span :class="['app-logo', appColor(index)]">{{ appInitials(item) }}</span><div><strong>{{ item.appName }}</strong><small>{{ app?.appId === item.appId && menus.data ? menus.rows.filter(row => row.menuType === 2).length + ' 项菜单权限' : item.appCode }}</small></div><ChevronRight :size="16" /></button><p v-if="!apps.rows.length" class="empty">暂无应用</p></template><div v-if="apps.total > 20" class="app-list-pagination"><button class="text-button" :disabled="apps.busy || apps.page <= 1" @click="apps.load(apps.page - 1)">上一页应用</button><button class="text-button" :disabled="apps.busy || apps.page * 20 >= apps.total" @click="apps.load(apps.page + 1)">下一页应用</button></div></section>
<section v-if="app" class="panel app-menu-preview"><div class="panel-heading resource-heading"><div><h3>{{ app.appName }} <span :class="['tag', app.status === 0 ? 'neutral' : 'green']">{{ app.status === 0 ? '停用' : '启用' }}</span></h3><p>{{ app.appCode }}</p></div><div class="heading-actions"><button v-if="can('IAM_RESOURCES_WRITE')" class="button light" @click="edit('app', app)"><Pencil :size="16" :stroke-width="1.8" aria-hidden="true" />编辑应用</button><button class="button light" @click="openResources(app, $event)"><FolderOpen :size="16" :stroke-width="1.8" aria-hidden="true" />查看资源</button><button v-if="can('IAM_RESOURCES_WRITE')" class="button primary" @click="create('menu')"><Plus :size="16" :stroke-width="1.8" aria-hidden="true" />添加菜单</button></div></div><div v-if="menus.error" class="list-error"><p role="alert" class="app-error">{{ menus.error }}</p><button class="button light" @click="menus.load()">重新加载</button></div><p v-else-if="menus.busy" class="empty">正在加载…</p><template v-else><div v-for="item in menus.rows.filter(row => row.menuType === 2)" :key="item.menuId" class="resource-item"><div class="resource-title"><span class="icon-tile neutral"><MenuIcon :size="18" /></span><strong>{{ menuName(item) }}</strong><span class="tag neutral">{{ apiCountLabel(item) }}</span><button v-if="can('IAM_RESOURCES_WRITE')" class="text-button" :disabled="busy" @click="mapping(item)">编辑映射</button></div><details class="api-details" @toggle="$event.target.open && loadPreview(item)"><summary>查看 API</summary><p v-if="previews[item.menuId]?.loading" class="muted">正在读取…</p><p v-else-if="previews[item.menuId]?.error" class="app-error">{{ previews[item.menuId].error }}</p><div v-else class="api-list"><code v-for="resource in previews[item.menuId]?.items || []" :key="resource.apiId"><span :class="{ post: resource.httpMethod && resource.httpMethod !== 'GET' }">{{ resource.httpMethod || 'API' }}</span>{{ resource.apiPath || resource.apiId }}</code><span v-if="!previews[item.menuId]?.items?.length" class="muted">暂无关联 API</span></div></details></div><p v-if="!menus.rows.some(row => row.menuType === 2)" class="empty">暂无菜单权限</p></template></section><section v-else class="panel empty">请选择应用</section>
</div>
  <div v-if="app && resourceOpen" v-show="!dialog" class="modal-backdrop" @click.self="closeResources" @keydown="resourceKeys"><section ref="resourcePanel" class="modal resource-modal" role="dialog" aria-modal="true" :aria-label="app.appName + ' · 应用资源'"><div class="modal-heading"><h2>{{ app.appName }} · 应用资源</h2><button class="icon-button" type="button" aria-label="关闭资源弹窗" :disabled="busy" @click="closeResources"><X :size="20" /></button></div><div class="resource-modal-body"><p v-if="error" role="alert" class="app-error">{{ error }}</p><p v-if="notice" role="status" class="action-notice">{{ notice }}</p><div class="section-heading"><div class="page-tabs" role="tablist" aria-label="应用资源"><button role="tab" :aria-selected="tab === 'menus'" @click="tab = 'menus'">菜单资源</button><button role="tab" :aria-selected="tab === 'apis'" @click="tab = 'apis'">API 资源</button></div><button v-if="can('IAM_RESOURCES_WRITE')" class="button primary" @click="create(tab === 'menus' ? 'menu' : 'api')">{{ tab === 'menus' ? '添加菜单' : '登记 API' }}</button></div><RecordTable v-if="tab === 'menus'" :state="menus" :columns="menuColumns" row-key="menuId" :paginated="false"><template #actions="{ row }"><template v-if="can('IAM_RESOURCES_WRITE')"><button class="text-button" @click="edit('menu', row)">调整菜单</button><button v-if="row.menuType === 2" class="text-button" :disabled="busy" @click="mapping(row)">配置 API</button></template></template></RecordTable><RecordTable v-else :state="apis" :columns="apiColumns" row-key="apiId"><template #actions="{ row }"><button v-if="can('IAM_RESOURCES_WRITE')" class="text-button" @click="edit('api', row)">编辑</button></template></RecordTable></div></section></div><FormDialog :allowed="can('IAM_RESOURCES_WRITE')" v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="saved" /></template>
