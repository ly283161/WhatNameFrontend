<script setup>
import { computed, ref, watch } from 'vue'
import { ShieldCheck, Users, LayoutDashboard, ChevronRight, LogOut, Menu, KeyRound, Blocks, UserCheck, ArrowLeftRight, ScrollText, Shield } from 'lucide-vue-next'
import { session, logout } from '../session.js'
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
const available = computed(() => pages.filter(canVisit))
const title = computed(() => available.value.find(p => p.id === page.value)?.label || '工作台')
watch(available, list => { if (page.value !== 'overview' && !list.some(p => p.id === page.value)) page.value = 'overview' })
async function signOut() { if (busy.value) return; busy.value = true; error.value = ''; try { await logout() } catch (failure) { error.value = failure.message } finally { busy.value = false } }
function navigate(value) { if (value === 'overview' || available.value.some(p => p.id === value)) page.value = value; mobileNav.value = false }
</script>
<template>
  <div class="shell"><aside :class="['sidebar', { shown: mobileNav }]">
    <a class="brand" href="#" @click.prevent="navigate('overview')"><span class="brand-icon"><ShieldCheck :size="25" /></span><span>统一权限管理<small>ACCESS HUB</small></span></a>
    <div class="workspace"><div>管理空间<small>当前账号 ID：{{ session.userId }}</small></div></div><div class="nav-label">管理控制台</div>
    <nav><button :class="{ active: page === 'overview' }" @click="navigate('overview')"><LayoutDashboard :size="19" />工作台</button><button v-for="item in available" :key="item.id" :class="{ active: page === item.id }" @click="navigate(item.id)"><component :is="icons[item.id]" :size="19" />{{ item.label }}</button></nav>
    <div class="sidebar-bottom"><button class="profile" :disabled="busy" @click="signOut"><LogOut :size="19" />{{ busy ? '正在退出…' : '退出账号' }}</button></div>
  </aside><div class="body"><header><button class="icon-button mobile-menu" aria-label="展开导航" @click="mobileNav = !mobileNav"><Menu :size="20" /></button><div class="breadcrumb">管理控制台<ChevronRight :size="13" /><strong>{{ title }}</strong></div></header>
    <main><p v-if="error" role="alert" class="app-error">{{ error }}</p><template v-if="page === 'overview'"><p v-if="!session.menus.length" class="action-notice" role="status">当前没有可用菜单，请联系管理员确认权限或部门状态。</p><OverviewView @navigate="navigate" /></template><component :is="views[page]" v-else :key="page" /></main>
  </div></div>
</template>
