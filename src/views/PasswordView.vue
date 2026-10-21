<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { api } from '../session.js'
import { errorText } from '../utils/formatters.js'
defineEmits(['back'])
const purpose = ref('RESET_PASSWORD'), phone = ref(''), code = ref(''), password = ref(''), confirm = ref(''), busy = ref(false), cooldown = ref(0), error = ref(''), notice = ref('')
let timer
onBeforeUnmount(() => { clearInterval(timer); password.value = ''; confirm.value = ''; code.value = '' })
async function send() {
  if (busy.value || cooldown.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    if (!/^1\d{10}$/.test(phone.value)) throw new Error('请输入有效的 11 位手机号')
    const data = await api('/auth/sms/send', { method: 'POST', authenticated: false, body: { phone: phone.value, purpose: purpose.value } })
    if (data.accepted !== true) throw new Error('服务未确认接收验证码请求')
    cooldown.value = Math.max(1, Number(data.retryAfterSeconds) || 60)
    clearInterval(timer); timer = setInterval(() => { if (--cooldown.value <= 0) clearInterval(timer) }, 1000)
    notice.value = '验证码请求已提交，请查看手机短信'
  } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    if ([...password.value].length < 8 || [...password.value].length > 64 || !/\p{L}/u.test(password.value) || !/\p{Nd}/u.test(password.value)) throw new Error('密码需为 8～64 个字符，包含字母和数字；个人信息与历史密码由服务端核验')
    if (password.value !== confirm.value) throw new Error('两次输入的密码不一致')
    const body = { phone: phone.value, code: code.value, newPassword: password.value }
    const data = await api(purpose.value === 'SET_PASSWORD' ? '/auth/password/initialize' : '/auth/password/reset', { method: 'POST', authenticated: false, body })
    body.newPassword = ''
    if (purpose.value === 'SET_PASSWORD' ? data.initialized !== true : data.passwordReset !== true || data.sessionsInvalidated !== true) throw new Error('服务未确认密码操作完成')
    password.value = ''; confirm.value = ''; code.value = ''; notice.value = '密码操作已完成，请返回登录'
  } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
</script>
<template><section class="login-card"><h2>设置或重置密码</h2><p class="muted">验证码仅用于验证本人身份，不用于免密登录</p><form @submit.prevent="submit"><label>用途<select aria-label="用途" v-model="purpose" :disabled="busy || cooldown > 0"><option value="RESET_PASSWORD">忘记密码</option><option value="SET_PASSWORD">首次设置密码</option></select></label><label>手机号<input v-model="phone" type="tel" pattern="1[0-9]{10}" maxlength="11" required :disabled="busy || cooldown > 0" /></label><div class="inline-form"><label>验证码<input v-model="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required :disabled="busy" /></label><button type="button" class="button light" :disabled="busy || cooldown > 0" @click="send">{{ cooldown ? cooldown + ' 秒后重发' : '获取验证码' }}</button></div><p class="muted">密码为 8～64 个字符，须包含字母和数字。</p><label>新密码<input v-model="password" type="password" autocomplete="new-password" required maxlength="128" :disabled="busy" /></label><label>确认密码<input v-model="confirm" type="password" autocomplete="new-password" required maxlength="128" :disabled="busy" /></label><p v-if="error" role="alert" class="app-error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p><button class="button primary" :disabled="busy">{{ busy ? '正在提交…' : '确认设置密码' }}</button><button type="button" class="text-button" :disabled="busy" @click="$emit('back')">返回登录</button></form></section></template>
