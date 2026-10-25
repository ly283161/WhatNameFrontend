<script setup>
import { ref, onMounted } from 'vue'
import { request, can, refreshSession } from '../api.js'
import DataTable from '../components/DataTable.vue'
import EditDialog from '../components/EditDialog.vue'
const apps = ref([]),
  appId = ref(''),
  menus = ref([]),
  apis = ref([]),
  tab = ref('menus'),
  busy = ref(false),
  error = ref(''),
  dialog = ref(null)
const statusField = {
  key: 'status',
  label: '状态',
  type: 'select',
  options: [
    { value: 1, label: '启用' },
    { value: 0, label: '停用' },
  ],
}
async function loadApps() {
  try {
    apps.value = await request('/applications')
    if (!appId.value) appId.value = apps.value[0]?.id || ''
    await load()
  } catch (e) {
    error.value = e.message
  }
}
async function load() {
  menus.value = []
  apis.value = []
  error.value = ''
  if (!appId.value) return
  busy.value = true
  try {
    ;[menus.value, apis.value] = await Promise.all([
      request(`/applications/${appId.value}/menus`),
      request(`/applications/${appId.value}/apis`),
    ])
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
onMounted(loadApps)
function open(title, fields, initial, path, method) {
  dialog.value = {
    title,
    fields,
    initial,
    save: async (body) => {
      await request(path, { method, body })
      await refreshSession()
    },
  }
}
function appEdit(row) {
  open(
    row ? '编辑应用' : '新建应用',
    [
      ...(row ? [] : [{ key: 'appCode', label: '应用编码', max: 64 }]),
      { key: 'appName', label: '应用名称' },
      { key: 'appDesc', label: '描述', type: 'textarea', optional: true },
      statusField,
    ],
    row || { status: '1' },
    '/applications' + (row ? '/' + row.id : ''),
    row ? 'PATCH' : 'POST',
  )
}
function menuEdit(row) {
  open(
    row ? '编辑菜单' : '新建菜单',
    [
      ...(row ? [] : [{ key: 'menuCode', label: '菜单编码', max: 64 }]),
      { key: 'menuName', label: '菜单名称' },
      {
        key: 'menuType',
        label: '类型',
        type: 'select',
        options: [
          { value: 1, label: '目录（仅导航）' },
          { value: 2, label: '菜单（权限单元）' },
        ],
      },
      {
        key: 'parentId',
        label: '上级节点',
        type: 'select',
        options: [
          { value: '0', label: '顶级节点' },
          ...menus.value
            .filter((m) => m.id !== row?.id)
            .map((m) => ({ value: m.id, label: m.menuName })),
        ],
      },
      { key: 'path', label: '页面路径', optional: true, max: 256 },
      statusField,
    ],
    row || { parentId: '0', menuType: '2', status: '1' },
    `/applications/${appId.value}/menus` + (row ? '/' + row.id : ''),
    row ? 'PATCH' : 'POST',
  )
}
function apiEdit(row) {
  open(
    row ? '编辑接口' : '新建接口',
    [
      ...(row ? [] : [{ key: 'apiCode', label: '接口编码' }]),
      { key: 'apiName', label: '接口名称' },
      { key: 'apiPath', label: '接口路径模板', max: 256, hint: '例如 /orders/{id}' },
      {
        key: 'httpMethod',
        label: '请求方法',
        type: 'select',
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((value) => ({
          value,
          label: value,
        })),
      },
      statusField,
    ],
    row || { httpMethod: 'GET', status: '1' },
    `/applications/${appId.value}/apis` + (row ? '/' + row.id : ''),
    row ? 'PATCH' : 'POST',
  )
}
async function associate(row) {
  try {
    const ids = await request(`/menus/${row.id}/apis`)
    open(
      '关联接口 · ' + row.menuName,
      [
        {
          key: 'apiIds',
          label: '此菜单允许调用的接口',
          type: 'checks',
          options: apis.value.map((a) => ({
            value: a.id,
            label: `${a.httpMethod} ${a.apiPath} · ${a.apiName}`,
          })),
        },
      ],
      { apiIds: ids.map(String) },
      `/menus/${row.id}/apis`,
      'PUT',
    )
  } catch (e) {
    error.value = e.message
  }
}
</script>
<template>
  <p class="description">
    按应用维护菜单和后端接口。角色获得菜单权限后，即可调用该菜单关联的接口。
  </p>
  <section class="panel">
    <div class="toolbar">
      <select v-model="appId" aria-label="当前应用" @change="load">
        <option v-for="app in apps" :key="app.id" :value="app.id">
          {{ app.appName }}{{ app.status === 0 ? '（停用）' : '' }}
        </option></select
      ><template v-if="can('IAM_RESOURCES_WRITE')"
        ><button @click="appEdit(null)">新建应用</button
        ><button v-if="appId" @click="appEdit(apps.find((a) => a.id === appId))">编辑应用</button
        ><button
          v-if="appId"
          class="primary"
          @click="tab === 'menus' ? menuEdit(null) : apiEdit(null)"
        >
          {{ tab === 'menus' ? '新建菜单' : '新建接口' }}
        </button></template
      >
    </div>
    <div class="tabs">
      <button :class="{ selected: tab === 'menus' }" @click="tab = 'menus'">
        菜单权限 · {{ menus.length }}</button
      ><button :class="{ selected: tab === 'apis' }" @click="tab = 'apis'">
        接口资源 · {{ apis.length }}
      </button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <DataTable
      v-if="tab === 'menus'"
      :rows="menus"
      :loading="busy"
      :columns="[
        { key: 'menuCode', label: '编码' },
        { key: 'menuName', label: '名称' },
        { key: 'menuType', label: '类型', format: (v) => (v === 1 ? '目录' : '权限菜单') },
        {
          key: 'parentId',
          label: '上级',
          format: (id) => (id === '0' ? '顶级' : menus.find((m) => m.id === id)?.menuName || id),
        },
        { key: 'path', label: '页面路径' },
        { key: 'status', label: '状态', format: (v) => (v === 1 ? '启用' : '停用') },
      ]"
      ><template #actions="{ row }"
        ><button v-if="can('IAM_RESOURCES_WRITE')" @click="menuEdit(row)">编辑</button
        ><button v-if="can('IAM_RESOURCES_WRITE') && row.menuType === 2" @click="associate(row)">
          关联接口
        </button></template
      ></DataTable
    >
    <DataTable
      v-else
      :rows="apis"
      :loading="busy"
      :columns="[
        { key: 'apiName', label: '接口名称' },
        { key: 'httpMethod', label: '方法' },
        { key: 'apiPath', label: '路径模板' },
        { key: 'status', label: '状态', format: (v) => (v === 1 ? '启用' : '停用') },
      ]"
      ><template #actions="{ row }"
        ><button v-if="can('IAM_RESOURCES_WRITE')" @click="apiEdit(row)">编辑</button></template
      ></DataTable
    >
  </section>
  <EditDialog v-if="dialog" v-bind="dialog" @close="dialog = null" @saved="loadApps" />
</template>
