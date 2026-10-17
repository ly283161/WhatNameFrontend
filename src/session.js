import { reactive } from 'vue'
import { ApiError, createApiClient } from './api/client.js'

export const session = reactive({ userId: null, menus: [], notice: '' })
let accessToken = null
let expiryTimer
let generation = 0

function clearSession(notice = '') {
  generation++
  accessToken = null
  clearTimeout(expiryTimer)
  session.userId = null
  session.menus = []
  session.notice = notice
}

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  getToken: () => accessToken,
  onUnauthorized: () => clearSession('登录已失效，请重新登录'),
})

export async function login(credentials) {
  clearSession()
  const attempt = generation
  const result = await api('/auth/login', { method: 'POST', body: credentials, authenticated: false })
  if (attempt !== generation) return
  if (!result || typeof result.accessToken !== 'string' || !result.accessToken || result.tokenType !== 'Bearer' || typeof result.userId !== 'string' || !result.userId || !Number.isFinite(result.expiresIn) || result.expiresIn <= 0 || result.expiresIn > 2_147_483) {
    throw new ApiError('登录响应不符合接口约定')
  }
  accessToken = result.accessToken
  expiryTimer = setTimeout(() => clearSession('登录已过期，请重新登录'), result.expiresIn * 1000)
  try {
    const appCode = import.meta.env.VITE_IAM_APP_CODE || 'IAM'
    const data = await api('/auth/menus', { query: { appCode } })
    if (attempt !== generation) return
    if (!data || data.appCode !== appCode || !Array.isArray(data.menus) || data.menus.some(m => !m || typeof m.menuId !== 'string' || typeof m.menuCode !== 'string' || typeof m.menuName !== 'string' || typeof m.path !== 'string')) {
      throw new ApiError('菜单响应不符合接口约定')
    }
    session.menus = data.menus
    session.userId = result.userId
  } catch (error) {
    if (attempt === generation) clearSession()
    throw error
  }
}

export async function logout() {
  const result = await api('/auth/logout', { method: 'POST' })
  if (result?.revoked !== true) throw new ApiError('服务端尚未确认退出，请重试')
  clearSession('已安全退出')
}
