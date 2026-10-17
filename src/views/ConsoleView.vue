<script setup>
import { computed, ref } from 'vue'
import { ShieldCheck, Users, LayoutDashboard, ChevronRight, LogOut, Menu } from 'lucide-vue-next'
import { session, logout } from '../session.js'
import UsersView from './UsersView.vue'

const page = ref('overview'), mobileNav = ref(false), busy = ref(false), error = ref('')
const usersMenu = computed(() => session.menus.find(m => m.menuCode === 'IAM_USERS_VIEW' || m.path === '/users'))
const otherMenus = computed(() => session.menus.filter(m => m !== usersMenu.value))
async function signOut() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await logout() } catch (failure) { error.value = failure.message }
  finally { busy.value = false }
}
function navigate(value) { page.value = value; mobileNav.value = false }
</script>

<template>
  <div class="shell">
    <aside :class="['sidebar', { shown: mobileNav }]">
      <a class="brand" href="#" @click.prevent="navigate('overview')"><span class="brand-icon"><ShieldCheck :size="25" /></span><span>统一权限管理<small>ACCESS HUB</small></span></a>
      <div class="workspace"><div>管理空间<small>当前账号 ID：{{ session.userId }}</small></div></div>
      <div class="nav-label">管理控制台</div>
      <nav><button :class="{ active: page === 'overview' }" @click="navigate('overview')"><LayoutDashboard :size="19" />工作台</button><button v-if="usersMenu" :class="{ active: page === 'users' }" @click="navigate('users')"><Users :size="19" />用户账号</button></nav>
      <div class="sidebar-bottom"><button class="profile" :disabled="busy" @click="signOut"><LogOut :size="19" />{{ busy ? '正在退出…' : '退出账号' }}</button></div>
    </aside>
    <div class="body"><header><button class="icon-button mobile-menu" aria-label="展开导航" @click="mobileNav = !mobileNav"><Menu :size="20" /></button><div class="breadcrumb">管理控制台<ChevronRight :size="13" /><strong>{{ page === 'users' ? '用户账号' : '工作台' }}</strong></div></header>
      <main><p v-if="error" role="alert" class="app-error">{{ error }}</p><UsersView v-if="page === 'users' && usersMenu" />
        <template v-else><div class="page-heading"><div><h1>工作台</h1><p>欢迎进入管理控制台</p></div></div><section class="panel live-welcome"><h3>当前可用功能</h3><p v-if="!session.menus.length" role="status">当前没有可用菜单，请联系管理员确认权限或部门状态。</p><button v-if="usersMenu" class="button primary" @click="navigate('users')">查询用户账号<ChevronRight :size="16" /></button><p v-for="menu in otherMenus" :key="menu.menuId">{{ menu.menuName }} · 功能正在开发</p></section></template>
      </main>
    </div>
  </div>
</template>
