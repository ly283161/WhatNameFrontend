import { test, expect } from '@playwright/test'

const success = data => ({ success: true, code: 'OK', requestId: 'test-request', data })
const user = { userId: '9007199254740993', username: 'zs', realName: '张三', sgNo: 'SG001', phoneMasked: '138****0000', deptId: '17', status: 1 }
const menus = [{ menuId: '21', menuCode: 'IAM_USERS_VIEW', menuName: '用户账号', path: '/users' }]

async function backend(page, { grantedMenus = menus, failLogout = false, expire = false, menuFailure = false } = {}) {
  const calls = []
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    calls.push({ path: url.pathname, query: url.searchParams.toString(), method: request.method(), body: request.postDataJSON(), authorization: request.headers().authorization })
    let data
    if (url.pathname.endsWith('/auth/login')) data = { accessToken: 'test-session-token', tokenType: 'Bearer', expiresIn: 3600, userId: '101' }
    else if (url.pathname.endsWith('/auth/menus')) {
      if (menuFailure) return route.fulfill({ status: 503, json: { success: false, code: 'AUTH_STATE_UNAVAILABLE', message: '权限状态不可用' } })
      data = { appCode: 'IAM', menus: grantedMenus }
    } else if (url.pathname.endsWith('/auth/logout')) {
      if (failLogout) return route.fulfill({ status: 503, json: { success: false, code: 'AUTH_STATE_UNAVAILABLE', message: '退出未完成' } })
      data = { revoked: true }
    } else if (url.pathname.endsWith('/users')) {
      if (expire) return route.fulfill({ status: 401, json: { success: false, code: 'INVALID_TOKEN' } })
      const currentPage = Number(url.searchParams.get('page'))
      data = { items: [{ ...user, realName: currentPage === 2 ? '第二页用户' : '张三' }], total: 21, page: currentPage, pageSize: 20 }
    } else throw new Error('Unexpected API: ' + url.pathname)
    await route.fulfill({ json: success(data) })
  })
  return calls
}

async function signIn(page, type = 'USERNAME') {
  await page.goto('/')
  await page.getByLabel('登录方式').selectOption(type)
  await page.getByRole('textbox', { name: type === 'PHONE' ? '手机号' : '账号', exact: true }).fill(type === 'PHONE' ? '13800000000' : 'zs')
  await page.getByLabel('密码', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
}

test('正式入口不读取原型身份，真实请求登录、菜单、分页查询与注销，令牌不落盘', async ({ page }) => {
  const calls = await backend(page)
  await signIn(page)
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
  expect(calls[0].body).toEqual({ loginType: 'USERNAME', identifier: 'zs', password: 'example-password' })
  expect(calls[0].authorization).toBeUndefined()
  expect(calls[1].authorization).toBe('Bearer test-session-token')
  expect(calls[1].query).toBe('appCode=IAM')
  await page.getByRole('button', { name: '用户账号', exact: true }).click()
  await expect(page.getByRole('cell', { name: '张三', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '展开导航' }).click()
  await expect(page.locator('aside')).toHaveClass(/shown/)
  await page.locator('aside').getByRole('button', { name: '用户账号', exact: true }).click()
  await expect(page.locator('aside')).not.toHaveClass(/shown/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByRole('cell', { name: '第二页用户' })).toBeVisible()
  await page.getByRole('textbox', { name: '搜索姓名、账号或工号' }).fill('张 & 李')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.getByText('共 21 条 · 第 1 页')).toBeVisible()
  const lastQuery = new URLSearchParams(calls.filter(c => c.path.endsWith('/users')).at(-1).query)
  expect(lastQuery.get('keyword')).toBe('张 & 李')
  expect(lastQuery.get('page')).toBe('1')
  expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))).not.toContain('test-session-token')
  await page.getByRole('button', { name: '退出账号' }).click()
  await expect(page.getByRole('heading', { name: '登录管理控制台' })).toBeVisible()
  expect(calls.at(-1).path).toBe('/api/v1/auth/logout')
  expect(calls.at(-1).method).toBe('POST')
})

test('手机号密码登录，服务端返回空菜单时不展示业务入口', async ({ page }) => {
  const calls = await backend(page, { grantedMenus: [] })
  await signIn(page, 'PHONE')
  await expect(page.getByText('当前没有可用菜单', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: '用户账号', exact: true })).toHaveCount(0)
  expect(calls[0].body.loginType).toBe('PHONE')
})

test('后端未运行或登录失败时保留登录页，不使用演示数据兜底', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.abort('connectionrefused'))
  await signIn(page)
  await expect(page.getByRole('alert')).toContainText('无法连接服务')
  await expect(page.getByRole('heading', { name: '登录管理控制台' })).toBeVisible()
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('')
  await page.unroute('**/api/v1/**')
  await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: { success: false, code: 'INVALID_CREDENTIALS' } }))
  await signIn(page)
  await expect(page.getByRole('alert')).toContainText('账号或密码错误')
})

test('菜单读取失败不能进入控制台，401 后清除已登录状态', async ({ page }) => {
  await backend(page, { menuFailure: true })
  await signIn(page)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: '登录管理控制台' })).toBeVisible()
  await page.unroute('**/api/v1/**')
  await backend(page, { expire: true })
  await signIn(page)
  await expect(page.getByRole('heading', { name: '登录管理控制台' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('登录已失效')
})

test('注销失败不虚报成功，刷新需要重新登录且不读取原型账号', async ({ page }) => {
  await backend(page, { failLogout: true })
  await signIn(page)
  await page.getByRole('button', { name: '退出账号' }).click()
  await expect(page.getByRole('alert')).toContainText('退出未完成')
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
  await page.evaluate(() => { localStorage.setItem('access-administrator', JSON.stringify({ id: 'fake-admin' })); sessionStorage.setItem('access-session', 'signed-in') })
  await page.reload()
  await expect(page.getByRole('heading', { name: '登录管理控制台' })).toBeVisible()
})

test('HTML 或非法成功响应不被当作登录成功，手机布局无横向溢出', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ contentType: 'text/html', body: '<html>fallback</html>' }))
  await signIn(page)
  await expect(page.getByRole('alert')).toContainText('接口约定')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
