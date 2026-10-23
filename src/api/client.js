export class ApiError extends Error {
  constructor(message, { status = 0, code = '', requestId = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    Object.assign(this, { status, code, requestId })
  }
}

export function createApiClient({
  baseUrl = '/api/v1',
  getToken = () => null,
  onUnauthorized = () => {},
  onForbidden = () => {},
  getAccessVersion = () => 0,
} = {}) {
  return async function request(
    path,
    {
      method = 'GET',
      query,
      body,
      authenticated = true,
      signal,
      headers = {},
      allowPending = false,
      refreshAccessOnError = true,
    } = {},
  ) {
    const token = authenticated ? getToken() : null
    const accessVersion = getAccessVersion()
    if (authenticated && !token) throw new ApiError('请先登录', { status: 401 })
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const timer = setTimeout(abort, 35_000)
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
      }
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}${path}${params.size ? '?' + params : ''}`,
        {
          method,
          headers: {
            ...headers,
            Accept: 'application/json',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
        },
      )
      if (token && getToken() !== token) throw new ApiError('会话已变化，请重新操作')
      if (response.status === 401 && authenticated) onUnauthorized()
      const payload = await response.json().catch(() => null)
      if (response.status !== 401 && token && getToken() !== token)
        throw new ApiError('会话已变化，请重新操作')
      if (response.ok && token && method === 'GET' && getAccessVersion() !== accessVersion)
        throw new ApiError('管理权限或范围已变化，请重新查询')
      if ([403, 404].includes(response.status) && authenticated && refreshAccessOnError)
        onForbidden()
      if (!response.ok || payload?.success === false) {
        const messages = {
          OUT_OF_SCOPE: '目标已超出当前管理范围',
          ROLE_NOT_DELEGABLE: '当前角色不在可授权范围内',
          VERSION_CONFLICT: '数据已被其他操作修改',
          IDEMPOTENCY_CONFLICT: '同一请求标识对应的内容发生变化，请重新确认操作',
          INTEGRITY_FAILURE: '服务端完整性验证失败，操作已拒绝',
          AUDIT_UNAVAILABLE: '审计服务不可用，操作未确认完成',
          AUTH_STATE_UNAVAILABLE: '服务暂时不可用，权限状态暂时无法确认',
          PENDING_RECOVERY: '变更结果仍待服务端恢复，请先查询结果，不要重复提交',
          RATE_LIMITED: '请求过于频繁，请稍后再试',
          RESOURCE_NOT_FOUND: '目标不存在或已不在可见范围',
          GRANT_SOURCE_NOT_FOUND: '所选授权依据已失效，请重新读取',
          SMS_DELIVERY_UNAVAILABLE: '短信服务暂不可用，请稍后重试',
        }
        const message =
          response.status === 401
            ? '账号或密码错误，或登录已失效'
            : messages[payload?.code] ||
              (response.status === 403
                ? '你没有执行此操作的权限'
                : payload?.message || '服务暂时不可用，请稍后重试')
        throw new ApiError(message, {
          status: response.status,
          code: payload?.code,
          requestId: payload?.requestId,
        })
      }
      if (
        (response.status === 202 && !allowPending) ||
        payload?.success !== true ||
        !Object.hasOwn(payload, 'data')
      ) {
        throw new ApiError('服务返回的数据不符合接口约定', {
          status: response.status,
          requestId: payload?.requestId,
        })
      }
      return payload.data
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        method === 'GET' || path === '/auth/login'
          ? controller.signal.aborted
            ? '查询已取消或超时，请重新查询'
            : '无法连接服务，请确认后端已启动'
          : '未能确认提交结果，请先查询用户角色及授权来源；批量操作可能部分成功，请勿直接全部重试',
      )
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
}
