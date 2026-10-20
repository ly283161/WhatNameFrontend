<script setup>
import { ref } from 'vue'
import { UserRound, Smartphone, LockKeyhole, Eye, EyeOff, ShieldCheck } from 'lucide-vue-next'
import { session, login } from './session.js'
import ConsoleView from './views/ConsoleView.vue'
import PasswordView from './views/PasswordView.vue'

const loginType = ref('USERNAME'), identifier = ref(''), password = ref('')
const busy = ref(false), error = ref('')
const passwordPage = ref(false)
const showPassword = ref(false), remember = ref(false)
try {
  const account = JSON.parse(localStorage.getItem('iam-remembered-account'))
  if (account && ['USERNAME', 'PHONE'].includes(account.loginType) && typeof account.identifier === 'string') {
    loginType.value = account.loginType; identifier.value = account.identifier; remember.value = true
  }
} catch { /* Remembering an account is optional when browser storage is unavailable. */ }
async function submit() {
  if (busy.value) return
  error.value = ''
  if (loginType.value === 'PHONE' && !/^1\d{10}$/.test(identifier.value.trim())) { error.value = '请输入有效的 11 位手机号'; return }
  busy.value = true
  const credentials = { loginType: loginType.value, identifier: identifier.value.trim(), password: password.value }
  password.value = ''
  try {
    await login(credentials)
    if (session.userId) {
      try { remember.value ? localStorage.setItem('iam-remembered-account', JSON.stringify({ loginType: credentials.loginType, identifier: credentials.identifier })) : localStorage.removeItem('iam-remembered-account') } catch { /* Login does not depend on optional preferences. */ }
    }
  } catch (failure) { error.value = failure.message + (failure.requestId ? `（请求编号：${failure.requestId}）` : '') }
  finally { credentials.password = ''; busy.value = false }
}
</script>

<template>
  <ConsoleView v-if="session.userId" />
  <div v-else class="login-stage"><main class="login-page">
    <section class="login-intro" aria-label="城市建筑"><div class="login-photo-brand"><ShieldCheck :size="22" /><span>统一权限管理</span></div><div class="login-photo-caption"><span>连接每一份职责</span><p>让协作有序，让权限清晰。</p></div></section>
    <PasswordView v-if="passwordPage" @back="passwordPage = false" />
    <section v-else class="login-card" aria-labelledby="login-title">
      <p class="login-welcome">WELCOME</p><h2 id="login-title">登录管理控制台</h2>
      <form @submit.prevent="submit">
        <label class="login-mode"><span class="visually-hidden">登录方式</span><select v-model="loginType" aria-label="登录方式" :disabled="busy"><option value="USERNAME">账号密码登录</option><option value="PHONE">手机号密码登录</option></select></label>
        <label class="login-field"><component :is="loginType === 'PHONE' ? Smartphone : UserRound" :size="19" /><span class="visually-hidden">{{ loginType === 'PHONE' ? '手机号' : '账号' }}</span><input v-model="identifier" :aria-label="loginType === 'PHONE' ? '手机号' : '账号'" :placeholder="loginType === 'PHONE' ? '请输入手机号' : '请输入账号'" :disabled="busy" :inputmode="loginType === 'PHONE' ? 'tel' : 'text'" autocomplete="username" required maxlength="100" /></label>
        <label class="login-field"><LockKeyhole :size="19" /><span class="visually-hidden">密码</span><input v-model="password" aria-label="密码" placeholder="请输入密码" :disabled="busy" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required maxlength="128" /><button type="button" class="password-toggle" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" @click="showPassword = !showPassword"><component :is="showPassword ? EyeOff : Eye" :size="18" /></button></label>
        <div class="login-links"><button type="button" :disabled="busy" @click="passwordPage = true">首次设密 / 忘记密码</button></div>
        <p v-if="error" class="app-error" role="alert">{{ error }}</p><p v-else-if="session.notice" role="status">{{ session.notice }}</p>
        <button class="button primary login-submit" type="submit" :disabled="busy">{{ busy ? '正在登录…' : '登录' }}</button>
        <label class="remember-account"><input v-model="remember" type="checkbox" :disabled="busy" />记住账号<span>仅保存账号</span></label>
      </form>
    </section>
  </main></div>
</template>
