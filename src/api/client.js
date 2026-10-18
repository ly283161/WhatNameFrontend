export class ApiError extends Error {
  constructor(message, { status = 0, code = '', requestId = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    Object.assign(this, { status, code, requestId })
  }
}

export function createApiClient({ baseUrl = '/api/v1', getToken = () => null, onUnauthorized = () => {} } = {}) {
  return async function request(path, { method = 'GET', query, body, authenticated = true, signal, headers = {}, allowPending = false } = {}) {
    const token = authenticated ? getToken() : null
    if (authenticated && !token) throw new ApiError('请先登录', { status: 401 })
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const timer = setTimeout(abort, 15_000)
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
      }
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}${params.size ? '?' + params : ''}`, {
        method,
        headers: { ...headers, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
      })
      if (token && getToken() !== token) throw new ApiError('会话已变化，请重新操作')
      if (response.status === 401 && authenticated) onUnauthorized()
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success === false) {
        const message = response.status === 401 ? '账号或密码错误，或登录已失效' : response.status === 403 ? '你没有执行此操作的权限' : payload?.message || '服务暂时不可用，请稍后重试'
        throw new ApiError(message, { status: response.status, code: payload?.code, requestId: payload?.requestId })
      }
      if ((response.status === 202 && !allowPending) || payload?.success !== true || !Object.hasOwn(payload, 'data')) {
        throw new ApiError('服务返回的数据不符合接口约定', { status: response.status, requestId: payload?.requestId })
      }
      return payload.data
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(controller.signal.aborted ? '请求已取消或超时，请重试' : '无法连接服务，请确认后端已启动')
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
}
