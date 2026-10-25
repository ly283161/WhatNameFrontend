import { reactive } from 'vue'

export const session = reactive({ token: '', user: null, menus: [], notice: '' })
export const can = (code) => session.menus.some((m) => m.menuCode === code && m.menuType === 2)
export async function request(path, { method = 'GET', body, authenticated = true } = {}) {
  if (authenticated && !session.token) throw new Error('请先登录')
  const token = session.token
  const response = await fetch('/api/v1' + path, {
    method,
    headers: {
      ...(authenticated ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(35000),
  })
  const result = await response.json().catch(() => null)
  if (authenticated && token !== session.token) throw new Error('会话已变化，请重新操作')
  if (response.status === 401 && authenticated) clearSession()
  if (!response.ok || result?.success !== true)
    throw new Error(result?.message || '请求失败，请检查后端连接')
  return result.data
}
export function clearSession() {
  session.token = ''
  session.user = null
  session.menus = []
}
export async function refreshSession() {
  if (!session.token) return
  const data = await request('/auth/me')
  session.user = data.user
  session.menus = data.menus
}
export async function login(input) {
  const data = await request('/auth/login', { method: 'POST', body: input, authenticated: false })
  session.token = data.token
  try {
    await refreshSession()
  } catch (e) {
    clearSession()
    throw e
  }
}
export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' })
  } finally {
    clearSession()
  }
}
export const query = (values) =>
  '?' +
  new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v != null)).toString()
