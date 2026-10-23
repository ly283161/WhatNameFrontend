import { reactive } from 'vue'
import { ApiError, createApiClient } from './api/client.js'

export const session = reactive({
  userId: null,
  accountLabel: '',
  menus: [],
  scope: null,
  accessError: '',
  accessBusy: false,
  accessVersion: 0,
  notice: '',
})
let accessToken = null,
  expiryTimer,
  generation = 0,
  accessRequest = null
function clearSession(notice = '') {
  generation++
  accessToken = null
  clearTimeout(expiryTimer)
  accessRequest = null
  Object.assign(session, {
    userId: null,
    accountLabel: '',
    menus: [],
    scope: null,
    accessError: '',
    accessBusy: false,
    notice,
  })
}
const granted = (m) => m.navigationOnly !== true && m.menuType !== 1
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  getToken: () => accessToken,
  getAccessVersion: () => session.accessVersion,
  onUnauthorized: () => clearSession('登录已失效，请重新登录'),
  onForbidden: () => {
    void refreshAccess()
  },
})
function validateMenus(data, appCode) {
  if (
    !data ||
    data.appCode !== appCode ||
    !Array.isArray(data.menus) ||
    data.menus.some(
      (m) =>
        !m ||
        typeof m.menuId !== 'string' ||
        typeof m.menuCode !== 'string' ||
        typeof m.menuName !== 'string' ||
        (m.path != null && typeof m.path !== 'string') ||
        (m.navigationOnly !== undefined && typeof m.navigationOnly !== 'boolean') ||
        (m.menuType !== undefined && ![1, 2].includes(m.menuType)),
    )
  )
    throw new ApiError('菜单响应不符合接口约定')
  return data.menus
}
export async function refreshAccess() {
  if (!accessToken) return false
  if (accessRequest) return accessRequest
  const attempt = generation
  const request = (async () => {
    session.accessBusy = true
    try {
      const appCode = import.meta.env.VITE_IAM_APP_CODE || 'IAM'
      const menuResponse = await api('/auth/menus', {
        query: { appCode },
        refreshAccessOnError: false,
      })
      const menus = validateMenus(menuResponse, appCode)
      let scope = menuResponse.management ?? null
      if (
        scope &&
        (typeof scope.appointed !== 'boolean' ||
          (scope.appointed &&
            (!Number.isInteger(scope.adminLevel) ||
              scope.adminLevel < 1 ||
              scope.adminLevel > 65535)))
      )
        throw new ApiError('本人管理资格响应不符合接口约定')
      if (menus.some((m) => granted(m) && m.menuCode === 'IAM_ADMINS_VIEW')) {
        scope = await api('/admins/me/scope', { refreshAccessOnError: false })
        if (
          !scope ||
          typeof scope.appointed !== 'boolean' ||
          (scope.appointed &&
            (!Number.isInteger(scope.adminLevel) ||
              scope.adminLevel < 1 ||
              scope.adminLevel > 65535 ||
              !Array.isArray(scope.scopeRootIds) ||
              scope.scopeRootIds.some((v) => typeof v !== 'string')))
        )
          throw new ApiError('管理范围响应不符合接口约定')
      }
      if (attempt !== generation) return false
      if (JSON.stringify([session.menus, session.scope]) !== JSON.stringify([menus, scope]))
        session.accessVersion++
      session.menus = menus
      session.scope = scope
      session.accessError = ''
      return true
    } catch (e) {
      if (attempt === generation) {
        session.menus = []
        session.scope = null
        session.accessError = e.message
      }
      return false
    } finally {
      if (attempt === generation) session.accessBusy = false
    }
  })()
  accessRequest = request
  try {
    return await request
  } finally {
    if (accessRequest === request) accessRequest = null
  }
}
export async function login(credentials) {
  clearSession()
  const attempt = generation
  const result = await api('/auth/login', {
    method: 'POST',
    body: credentials,
    authenticated: false,
  })
  if (attempt !== generation) return
  if (
    !result ||
    typeof result.accessToken !== 'string' ||
    !result.accessToken ||
    result.tokenType !== 'Bearer' ||
    typeof result.userId !== 'string' ||
    !result.userId ||
    !Number.isSafeInteger(result.expiresIn) ||
    result.expiresIn <= 0 ||
    result.expiresIn > 2_147_483
  )
    throw new ApiError('登录响应不符合接口约定')
  accessToken = result.accessToken
  expiryTimer = setTimeout(() => clearSession('登录已过期，请重新登录'), result.expiresIn * 1000)
  if (!(await refreshAccess())) {
    const message = session.accessError || session.notice || '无法确认当前权限，请重新登录'
    if (attempt === generation) clearSession()
    throw new ApiError(message)
  }
  if (attempt === generation) {
    session.accountLabel =
      credentials.loginType === 'PHONE'
        ? credentials.identifier
        : credentials.identifier
    session.userId = result.userId
  }
}
export async function logout() {
  let result
  try {
    result = await api('/auth/logout', { method: 'POST' })
  } catch (error) {
    throw new ApiError('退出未完成：' + error.message, error)
  }
  if (result?.revoked !== true) throw new ApiError('服务端尚未确认退出，请重试')
  clearSession('已安全退出')
}
export function monitorAccess() {
  const refresh = () => {
    if (!document.hidden) void refreshAccess()
  }
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  const timer = setInterval(refresh, 30_000)
  return () => {
    clearInterval(timer)
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }
}
