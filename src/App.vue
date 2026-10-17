<script setup>
import { ref } from 'vue'
import { ShieldCheck } from 'lucide-vue-next'
import { session, login } from './session.js'
import ConsoleView from './views/ConsoleView.vue'

const loginType = ref('USERNAME'), identifier = ref(''), password = ref('')
const busy = ref(false), error = ref('')
async function submit() {
  if (busy.value) return
  error.value = ''
  if (loginType.value === 'PHONE' && !/^1\d{10}$/.test(identifier.value.trim())) { error.value = '请输入有效的 11 位手机号'; return }
  busy.value = true
  const credentials = { loginType: loginType.value, identifier: identifier.value.trim(), password: password.value }
  password.value = ''
  try { await login(credentials) } catch (failure) { error.value = failure.message + (failure.requestId ? `（请求编号：${failure.requestId}）` : '') }
  finally { credentials.password = ''; busy.value = false }
}
</script>

<template>
  <ConsoleView v-if="session.userId" />
  <main v-else class="login-page">
    <section class="login-intro"><ShieldCheck :size="46" :stroke-width="1.4" /><h1>统一权限管理</h1><p>以统一身份，进入你的管理空间。</p><div class="login-rule"></div><p class="login-caption">账号 · 角色 · 应用权限</p></section>
    <section class="login-card" aria-labelledby="login-title">
      <h2 id="login-title">登录管理控制台</h2><p class="muted">使用已设置密码的账号登录</p>
      <form @submit.prevent="submit">
        <label>登录方式<select v-model="loginType" :disabled="busy"><option value="USERNAME">账号密码</option><option value="PHONE">手机号密码</option></select></label>
        <label>{{ loginType === 'PHONE' ? '手机号' : '账号' }}<input v-model="identifier" :disabled="busy" :inputmode="loginType === 'PHONE' ? 'tel' : 'text'" autocomplete="username" required maxlength="100" /></label>
        <label>密码<input v-model="password" :disabled="busy" type="password" autocomplete="current-password" required maxlength="128" /></label>
        <p v-if="error" class="app-error" role="alert">{{ error }}</p><p v-else-if="session.notice" role="status">{{ session.notice }}</p>
        <button class="button primary login-submit" type="submit" :disabled="busy">{{ busy ? '正在登录…' : '登录' }}</button>
      </form>
    </section>
  </main>
</template>
