<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { session, can, login, logout, request, refreshSession, clearSession } from './api.js'
import EditDialog from './components/EditDialog.vue'
import UsersView from './views/UsersView.vue'
import RolesView from './views/RolesView.vue'
import ResourcesView from './views/ResourcesView.vue'
import OrganizationView from './views/OrganizationView.vue'
import AuditView from './views/AuditView.vue'
import DemoView from './views/DemoView.vue'

const input = ref({ loginType: 'USERNAME', identifier: '', password: '' }),
  busy = ref(false),
  error = ref(''),
  page = ref('users'),
  dialog = ref(null)
const definitions = [
  { id: 'users', label: '用户账号', code: 'IAM_USERS_VIEW', component: UsersView },
  { id: 'roles', label: '角色管理', code: 'IAM_ROLES_VIEW', component: RolesView },
  { id: 'resources', label: '应用资源', code: 'IAM_RESOURCES_VIEW', component: ResourcesView },
  { id: 'grants', label: '权限分配', code: 'IAM_GRANTS_VIEW', component: UsersView },
  { id: 'departments', label: '组织管理', code: 'IAM_DEPTS_VIEW', component: OrganizationView },
  { id: 'audit', label: '操作日志', code: 'IAM_AUDIT_VIEW', component: AuditView },
  { id: 'demo', label: '业务演示', component: DemoView },
]
const pages = computed(() => definitions.filter((p) => !p.code || can(p.code)))
const active = computed(() => pages.value.find((p) => p.id === page.value) || pages.value[0])
async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await login({ ...input.value })
    page.value = pages.value[0]?.id
  } catch (e) {
    error.value = e.message
  } finally {
    input.value.password = ''
    busy.value = false
  }
}
async function exit() {
  try {
    await logout()
  } catch (e) {
    error.value = e.message
  }
}
function passwordDialog() {
  dialog.value = {
    title: '修改本人密码',
    fields: [
      { key: 'oldPassword', label: '原密码', type: 'password' },
      { key: 'password', label: '新密码', type: 'password', hint: '8–64 位，至少包含字母和数字' },
    ],
    save: async (body) => {
      await request('/auth/password', { method: 'PUT', body })
      clearSession()
    },
  }
}
async function refresh() {
  if (session.token) {
    try {
      await refreshSession()
    } catch {
      /* Pages report their own errors; do not retain stale permissions. */ session.menus = []
    }
  }
}
onMounted(() => window.addEventListener('focus', refresh))
onUnmounted(() => window.removeEventListener('focus', refresh))
</script>
<template>
  <main v-if="!session.user" class="login-stage">
    <section class="login-intro">
      <div class="brand">◈ 统一权限管理</div>
      <div>
        <h1>让权限清晰<br />让协作有序</h1>
        <p>统一账号 · 统一登录 · 统一鉴权</p>
      </div>
      <small>课程实践 / ACCESS MANAGEMENT</small>
    </section>
    <section class="login-card">
      <p class="eyebrow">WELCOME BACK</p>
      <h2>登录管理控制台</h2>
      <p class="muted">使用你的账号或手机号登录</p>
      <form @submit.prevent="submit">
        <label class="field"
          >登录方式<select v-model="input.loginType" :disabled="busy">
            <option value="USERNAME">账号密码</option>
            <option value="PHONE">手机号密码</option>
          </select></label
        >
        <label class="field"
          >{{ input.loginType === 'PHONE' ? '手机号' : '账号'
          }}<input
            v-model="input.identifier"
            required
            autocomplete="username"
            :disabled="busy"
            maxlength="100"
        /></label>
        <label class="field"
          >密码<input
            v-model="input.password"
            type="password"
            required
            autocomplete="current-password"
            :disabled="busy"
            maxlength="64"
        /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="primary full" :disabled="busy">{{ busy ? '登录中…' : '登录' }}</button>
        <p class="muted login-help">忘记密码或首次使用，请联系有权限的管理者重置密码。</p>
      </form>
    </section>
  </main>
  <div v-else class="shell">
    <aside class="sidebar">
      <div class="brand">◈ 统一权限管理</div>
      <p class="sidebar-label">工作空间</p>
      <nav aria-label="主导航">
        <button
          v-for="item in pages"
          :key="item.id"
          :class="{ active: active?.id === item.id }"
          @click="page = item.id"
        >
          {{ item.label }}<span v-if="active?.id === item.id">›</span>
        </button>
      </nav>
      <div class="sidebar-note">RBAC0 权限管理<br /><small>用户 → 角色 → 菜单 → 接口</small></div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <span>管理控制台 / {{ active?.label }}</span>
        <div>
          <span>{{ session.user.realName }}</span
          ><span class="badge">{{
            session.user.managementScope === 'ALL' ? '全公司范围' : '本部门及下属'
          }}</span
          ><button @click="passwordDialog">修改密码</button><button @click="exit">退出</button>
        </div>
      </header>
      <main class="content">
        <p class="eyebrow">ACCESS MANAGEMENT</p>
        <h1>{{ active?.label }}</h1>
        <component
          :is="active?.component"
          :key="active?.id"
          :grant-mode="active?.id === 'grants'"
        />
      </main>
    </div>
  </div>
  <EditDialog v-if="dialog" v-bind="dialog" @close="dialog = null" />
</template>
