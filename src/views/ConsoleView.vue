<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { ShieldCheck, Users, LayoutDashboard, ChevronRight, LogOut, Menu, KeyRound, Blocks, UserCheck, ArrowLeftRight, ScrollText, Shield, Building2 } from 'lucide-vue-next'
import { session, logout, refreshAccess, monitorAccess } from '../session.js'
import { pages, canVisit } from '../access.js'
import UsersView from './UsersView.vue'
import RolesView from './RolesView.vue'
import ResourcesView from './ResourcesView.vue'
import GrantsView from './GrantsView.vue'
import OrganizationView from './OrganizationView.vue'
import AdminsView from './AdminsView.vue'
import AuditView from './AuditView.vue'
import OverviewView from './OverviewView.vue'
const views = { users: UsersView, roles: RolesView, resources: ResourcesView, grants: GrantsView, organization: OrganizationView, admins: AdminsView, audit: AuditView }
const icons = { users: Users, roles: KeyRound, resources: Blocks, grants: UserCheck, organization: ArrowLeftRight, admins: Shield, audit: ScrollText }
const page = ref('overview'), mobileNav = ref(false), busy = ref(false), error = ref('')
const accountOpen = ref(false), accountArea = ref(null)
const accountName = computed(() => session.accountLabel || '账号 ' + session.userId)
const accountLevel = computed(() => session.scope?.appointed ? (session.scope.adminLevel === 1 ? '总公司管理员' : session.scope.adminLevel + ' 级管理员') : '当前账号')
function showAccount() { accountOpen.value = true; accountArea.value?.querySelector('.account-trigger')?.focus() }
function outsideAccount(event) { if (!accountArea.value?.contains(event.target)) accountOpen.value = false }
const available = computed(() => pages.filter(canVisit))
const title = computed(() => available.value.find(p => p.id === page.value)?.label || '工作台')
watch(available, list => { if (page.value !== 'overview' && !list.some(p => p.id === page.value)) page.value = 'overview' })
async function signOut() { if (busy.value) return; busy.value = true; error.value = ''; try { await logout() } catch (failure) { error.value = failure.message } finally { busy.value = false } }
let stopMonitor
onMounted(() => { stopMonitor = monitorAccess(); document.addEventListener('pointerdown', outsideAccount) })
onBeforeUnmount(() => { stopMonitor?.(); document.removeEventListener('pointerdown', outsideAccount) })
function navigate(value) { accountOpen.value = false; if (value === 'overview' || available.value.some(p => p.id === value)) page.value = value; mobileNav.value = false }
</script>
<template>
  <div class="shell"><aside :class="['sidebar', { shown: mobileNav }]">
    <a class="brand" href="#" @click.prevent="navigate('overview')"><span class="brand-icon"><ShieldCheck :size="25" /></span><span>统一权限管理<small>ACCESS HUB</small></span></a>
    <div class="workspace"><span class="workspace-icon"><Building2 :size="18" /></span><div>{{ session.scope?.appointed && session.scope.adminLevel === 1 ? '集团管理空间' : '组织管理空间' }}<small>{{ session.scope?.appointed && session.scope.adminLevel === 1 ? '总公司 · 全集团数据范围' : '按当前任命范围管理' }}</small></div></div><div class="nav-label">管理控制台</div>
    <nav><button :class="{ active: page === 'overview' }" @click="navigate('overview')"><LayoutDashboard :size="19" />工作台</button><button v-for="item in available" :key="item.id" :class="{ active: page === item.id }" @click="navigate(item.id)"><component :is="icons[item.id]" :size="19" />{{ item.label }}</button></nav>
    <div class="sidebar-bottom"><button class="profile" aria-label="账号信息" @click="showAccount"><span class="avatar admin">{{ accountName.slice(0, 1).toUpperCase() }}</span><span>{{ accountName }}<small>{{ accountLevel }}</small></span><ChevronRight :size="16" /></button></div>
  </aside><div class="body"><header><button class="icon-button mobile-menu" aria-label="展开导航" @click="mobileNav = !mobileNav"><Menu :size="20" /></button><div class="breadcrumb">管理控制台<ChevronRight :size="13" /><strong>{{ title }}</strong></div><div ref="accountArea" class="header-right account-area" @keydown.esc="accountOpen = false">
      <button class="account-trigger" aria-label="当前账号" :aria-expanded="accountOpen" aria-controls="current-account-panel" @click="accountOpen = !accountOpen"><span class="header-avatar">{{ accountName.slice(0, 1).toUpperCase() }}</span></button>
      <section v-if="accountOpen" id="current-account-panel" class="account-menu" aria-label="账号信息"><strong>账号信息</strong><dl><dt>登录账号</dt><dd>{{ accountName }}</dd><dt>账号 ID</dt><dd>{{ session.userId }}</dd><dt>管理身份</dt><dd>{{ accountLevel }}</dd></dl><button class="button light" :disabled="busy" @click="signOut"><LogOut :size="16" />{{ busy ? '正在退出…' : '退出登录' }}</button></section>
    </div></header>
    <main><div v-if="session.accessError" class="action-notice" role="alert">权限信息暂时无法确认：{{ session.accessError }} <button class="text-button" :disabled="session.accessBusy" @click="refreshAccess">重新读取权限</button></div><p v-if="error" role="alert" class="app-error">{{ error }}</p><template v-if="page === 'overview'"><p v-if="!session.menus.length" class="action-notice" role="status">当前没有可用菜单，请联系管理员确认权限或部门状态。</p><OverviewView @navigate="navigate" /></template><component :is="views[page]" v-else :key="page" /></main>
  </div></div>
</template>
