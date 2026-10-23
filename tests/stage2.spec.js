import { test, expect } from '@playwright/test'

const person = { userId: '9007199254740993', username: 'stage2', realName: '第二阶段用户', sgNo: '', phone: '13800000000', deptId: '17', status: 1, source: 2 }
const menu = (code, extra = {}) => ({ menuId: code, menuCode: code, menuName: code, menuType: 2, navigationOnly: false, path: null, ...extra })
const nav = (page, name) => page.locator('aside nav').getByRole('button', { name, exact: true }).click()
const confirm = page => page.locator('.stage-form').getByRole('button', { name: '确认提交', exact: true }).click()
const slice = (items, query) => { const page = Number(query.get('page') || 1), pageSize = Number(query.get('pageSize') || 20); return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: String(items.length) } }

test('本人等级摘要支持资源配置，不要求额外授予管理员查看权限', async ({ page }) => {
  const state = await backend(page, ['IAM_RESOURCES_VIEW', 'IAM_RESOURCES_WRITE'], (call, state) => {
    if (call.path === '/auth/menus') return { data: { appCode: 'IAM', menus: state.menus, management: { appointed: true, adminLevel: state.level } } }
    if (call.path === '/applications') return { data: slice([], call.query) }
  })
  await login(page)
  await nav(page, '应用管理')
  await expect(page.getByRole('button', { name: '登记应用', exact: true })).toBeVisible()
  expect(state.calls.some(call => call.path === '/admins/me/scope')).toBe(false)
  state.level = 2
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('button', { name: '登记应用', exact: true })).toHaveCount(0)
})
async function backend(page, codes, reply = () => undefined) {
  const state = { menus: codes.map(code => typeof code === 'string' ? menu(code) : code), level: 1, roots: ['17'], calls: [], unexpected: [], users: [person] }
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.slice('/api/v1'.length)
    const call = { path, method: request.method(), body: request.postDataJSON(), query: url.searchParams, headers: request.headers() }
    state.calls.push(call)
    let result = await reply(call, state)
    if (result?.abort) return route.abort('connectionrefused')
    if (!result) {
      let data
      if (path === '/auth/login') data = { accessToken: 'stage2-memory-token', tokenType: 'Bearer', userId: '101', expiresIn: 3600 }
      else if (path === '/auth/menus') data = { appCode: 'IAM', menus: state.menus }
      else if (path === '/admins/me/scope') data = { appointed: true, adminLevel: state.level, deptId: '17', scopeRootIds: state.roots, delegableRolesVersion: 'v3' }
      else if (path === '/users') data = slice(state.users, call.query)
      else if (/^\/users\/\d+\/roles$/.test(path)) data = { userId: path.split('/')[2], grantRevision: 'v1', roles: [] }
      else if (path === '/roles') data = slice([{ roleId: '2', roleName: '验证角色', roleCode: 'STAGE2', roleType: 1, status: 1 }], call.query)
      else if (path === '/applications') data = slice([{ appId: '18', appCode: 'IAM', appName: '验证应用', status: 1 }], call.query)
      else if (path === '/admins/101/delegable-roles') data = { roleIds: ['2'], delegationVersion: 'v3' }
      else if (path === '/grants/history' || path === '/admins') data = slice([], call.query)
      else { state.unexpected.push(path); return route.fulfill({ status: 500, json: { success: false, code: 'UNEXPECTED_TEST_REQUEST', message: path } }) }
      result = { data }
    }
    await route.fulfill({ status: result.status || 200, json: result.status >= 400 ? { success: false, code: result.code, requestId: 'stage2-failure' } : { success: true, code: 'OK', requestId: 'stage2-request', data: result.data } })
  })
  return state
}
async function login(page) {
  await page.goto('/')
  await page.getByRole('textbox', { name: '账号', exact: true }).fill('stage2')
  await page.getByLabel('密码', { exact: true }).fill('Stage2Password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
}
async function grantInput(page, ids = [person.userId]) {
  await nav(page, '权限分配')
  await page.getByLabel('角色', { exact: true }).selectOption('2')
  const total = new Set(ids).size
  let selected = 0
  while (selected < total) {
    const table = page.locator('.table-panel').first(), boxes = table.locator('tbody').getByRole('checkbox')
    await expect(boxes.first()).toBeVisible()
    const first = await boxes.first().getAttribute('aria-label'), count = await boxes.count()
    await table.getByRole('checkbox', { name: '全选本页用户' }).check()
    selected += count
    await expect(page.getByText(new RegExp('已选 ' + selected + ' 位用户'))).toBeVisible()
    if (selected < total) {
      await table.getByRole('button', { name: '下一页', exact: true }).click()
      await expect(boxes.first()).not.toHaveAttribute('aria-label', first)
    }
  }
  await page.getByLabel('业务依据编号').fill('STAGE2-BUSINESS-REF')
  await page.getByLabel('操作原因', { exact: true }).fill('第二阶段授权验证')
}

test('字符串总数、超安全整数 ID 和空路径菜单；导航祖先及相同路径不构成授权', async ({ page }) => {
  const state = await backend(page, ['IAM_USERS_VIEW', menu('IAM_USERS_WRITE', { navigationOnly: true }), menu('OTHER_ROLE', { path: '/roles' })])
  await login(page); await nav(page, '用户账号')
  await expect(page.getByText('共 1 条 · 第 1 页')).toBeVisible()
  await expect(page.getByRole('button', { name: '新建临时账号' })).toHaveCount(0)
  await expect(page.locator('aside nav').getByRole('button', { name: '角色管理' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '详情', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '有效菜单', exact: true })).toHaveCount(0)
  expect(state.users[0].userId).toBe('9007199254740993')
  expect(state.unexpected).toEqual([])
})

test('一级资格与功能权限同时满足才显示全局配置；等级下降关闭未提交表单', async ({ page }) => {
  const state = await backend(page, ['IAM_ROLES_VIEW', 'IAM_ROLES_WRITE', 'IAM_ADMINS_VIEW'])
  await login(page); await nav(page, '角色管理')
  await page.getByRole('button', { name: '新建角色' }).click()
  await expect(page.locator('.stage-form')).toBeVisible()
  state.level = 2
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.stage-form')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '新建角色' })).toHaveCount(0)
  expect(state.calls.filter(c => c.method === 'POST' && c.path === '/roles')).toHaveLength(0)
})

test('403 后重读功能权限，撤权后清空列表并退出失效页面', async ({ page }) => {
  let denied = false
  const state = await backend(page, ['IAM_USERS_VIEW'], call => call.path === '/users' && denied ? { status: 403, code: 'OUT_OF_SCOPE' } : undefined)
  await login(page); await nav(page, '用户账号')
  await expect(page.getByRole('cell', { name: person.realName, exact: true })).toBeVisible()
  denied = true; state.menus = []
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: person.realName, exact: true })).toHaveCount(0)
  await expect(page.locator('aside nav').getByRole('button', { name: '用户账号' })).toHaveCount(0)
})

test('范围变化保留功能入口时关闭旧账号操作，并重新查询当前范围', async ({ page }) => {
  const state = await backend(page, ['IAM_USERS_VIEW', 'IAM_USERS_WRITE', 'IAM_ADMINS_VIEW'])
  await login(page); await nav(page, '用户账号')
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  await expect(page.locator('.stage-form')).toBeVisible()
  state.roots = ['19']; state.users = []
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.stage-form')).toHaveCount(0)
  await expect(page.getByText('共 0 条 · 第 1 页')).toBeVisible()
})

test('继承冻结与合并部门有独立状态，合并部门没有解冻按钮', async ({ page }) => {
  const state = await backend(page, ['IAM_DEPTS_VIEW', 'IAM_DEPTS_FREEZE', 'IAM_USERS_VIEW'], call => call.path === '/departments' ? { data: { items: [{ deptId: '17', parentId: '0', deptName: '继承冻结部门', status: 1, effectivelyFrozen: true, merged: false }, { deptId: '18', parentId: '0', deptName: '已合并部门', status: 0, effectivelyFrozen: true, merged: true, mergedIntoDeptId: '17' }] } } : undefined)
  await login(page); await nav(page, '组织管理')
  await expect(page.locator('.department-grid > div').filter({ hasText: '继承冻结部门' })).toContainText('上级部门冻结')
  const merged = page.locator('.department-grid > div').filter({ hasText: '已合并部门' })
  await expect(merged.getByText('已合并', { exact: true })).toBeVisible()
  await expect(merged.getByRole('button', { name: '解除冻结', exact: true })).toHaveCount(0)
  await nav(page, '用户账号')
  const userRow = page.locator('tbody tr').filter({ hasText: person.realName })
  await expect(userRow).toContainText('部门已冻结')
  await expect(userRow.getByRole('cell', { name: '可用', exact: true })).toBeVisible()
  expect(state.unexpected).toEqual([])
})

test('B 最小资源响应可维护，不把缺失的 API 名称写成空字符串', async ({ page }) => {
  const state = await backend(page, ['IAM_RESOURCES_VIEW', 'IAM_RESOURCES_WRITE', 'IAM_ADMINS_VIEW'], call => {
    if (call.path === '/applications/18/menus') return { data: { appId: '18', menus: [{ menuId: '25', menuType: 2, status: 1, parentId: '0' }] } }
    if (call.path === '/menus/25/apis') return { data: { menuId: '25', apiIds: [], mappingVersion: 'v1' } }
    if (call.path === '/menus/25' && call.method === 'PATCH') return { data: { menuId: '25', status: call.body.status, parentId: '0' } }
    if (call.path === '/applications/18/apis') return { data: slice([{ apiId: '51', apiCode: 'READ', apiPath: '/records', httpMethod: 'GET', status: 1 }], call.query) }
    if (call.path === '/apis/51' && call.method === 'PATCH') return { data: { apiId: '51', status: 0 } }
  })
  await login(page); await nav(page, '应用管理')
  await page.getByRole('button', { name: '查看资源' }).click()
  await expect(page.getByRole('dialog', { name: '验证应用 · 应用资源' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '菜单 25', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '调整菜单', exact: true }).click()
  await expect(page.locator('.stage-form').getByLabel('菜单名称')).toHaveValue('')
  await expect(page.locator('.stage-form')).toContainText('留空保留原名称')
  await page.locator('.stage-form').getByLabel('操作原因').fill('保留名称调整状态')
  await confirm(page); await expect(page.locator('.stage-form')).toHaveCount(0)
  expect(state.calls.filter(c => c.path === '/menus/25').at(-1).body).not.toHaveProperty('menuName')
  await page.getByRole('button', { name: '调整菜单', exact: true }).click()
  await page.locator('.stage-form').getByLabel('菜单名称').fill('补充菜单名称')
  await page.locator('.stage-form').getByLabel('操作原因').fill('明确修改名称')
  await confirm(page); await expect(page.locator('.stage-form')).toHaveCount(0)
  expect(state.calls.filter(c => c.path === '/menus/25').at(-1).body).toMatchObject({ menuName: '补充菜单名称' })
  await page.getByRole('tab', { name: 'API 资源' }).click()
  await page.locator('tbody tr').filter({ hasText: '/records' }).getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page.locator('.stage-form').getByLabel('接口名称')).toHaveCount(0)
  await page.locator('.stage-form').getByLabel('状态', { exact: true }).selectOption('0')
  await page.locator('.stage-form').getByLabel('操作原因').fill('停用验证接口')
  await confirm(page); await expect(page.locator('.stage-form')).toHaveCount(0)
  expect(state.calls.find(c => c.path === '/apis/51').body).toEqual({ status: 0, reason: '停用验证接口' })
  await expect(page.getByRole('dialog', { name: '验证应用 · 应用资源' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '验证应用 · 应用资源' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '查看资源' })).toBeFocused()
})

test('全量替换配置读取全部应用页，并保留不可见的已有菜单及修订号', async ({ page }) => {
  const apps = Array.from({ length: 501 }, (_, i) => ({ appId: String(i + 1), appCode: 'APP' + i, appName: '应用' + i, status: 1 }))
  const state = await backend(page, ['IAM_ROLES_VIEW', 'IAM_ROLES_WRITE', 'IAM_ADMINS_VIEW'], call => {
    if (call.path === '/applications') return { data: slice(apps, call.query) }
    if (/^\/applications\/\d+\/menus$/.test(call.path)) return { data: { menus: call.path === '/applications/501/menus' ? [{ menuId: '601', menuType: 2, status: 1, parentId: '0' }] : [] } }
    if (call.path === '/roles/2/menus') return { data: { roleId: '2', menuIds: ['999'], permissionRevision: 'v7' } }
  })
  await login(page); await nav(page, '角色管理')
  await page.getByRole('button', { name: '配置权限', exact: true }).click()
  await expect(page.locator('.stage-form').getByRole('checkbox', { name: '601', exact: true })).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.stage-form').getByRole('checkbox', { name: '已有菜单 999' })).toBeChecked()
  await page.locator('.stage-form').getByRole('checkbox', { name: '601', exact: true }).check()
  await confirm(page); await expect(page.locator('.stage-form')).toHaveCount(0)
  expect(state.calls.find(c => c.path === '/roles/2/menus' && c.method === 'PUT').body).toEqual({ menuIds: ['999', '601'], expectedVersion: 'v7' })
  expect(state.calls.some(c => c.path === '/applications' && c.query.get('page') === '2')).toBe(true)
})

test('同步批量直接显示全部结果，只重试明确失败的用户且不查询任务', async ({ page }) => {
  const second = { ...person, userId: '9007199254740994', realName: '第二位用户' }
  let posts = 0
  const state = await backend(page, ['IAM_GRANTS_VIEW', 'IAM_GRANTS_WRITE', 'IAM_USERS_VIEW'], call => {
    if (call.path === '/grants/user-roles/batch') {
      posts++
      return { data: posts === 1
        ? { processingStatus: 'PARTIAL_SUCCESS', succeeded: 1, failed: 1, total: 2, items: [{ userId: person.userId, status: 'APPLIED', grantSourceId: '31' }, { userId: second.userId, status: 'FAILED', code: 'OUT_OF_SCOPE' }] }
        : { processingStatus: 'COMPLETED', succeeded: 1, failed: 0, total: 1, items: [{ userId: second.userId, status: 'APPLIED', grantSourceId: '32' }] } }
    }
  })
  state.users = [person, second]
  await login(page); await grantInput(page, [person.userId, second.userId])
  await page.getByRole('button', { name: '提交', exact: true }).click(); await confirm(page)
  await expect(page.getByRole('heading', { name: '执行结果：部分成功' })).toBeVisible()
  await page.getByRole('button', { name: '仅重试失败目标' }).click(); await confirm(page)
  await expect(page.getByRole('region', { name: '权限操作结果' })).toContainText('全部完成')
  const calls = state.calls.filter(call => call.path === '/grants/user-roles/batch')
  expect(calls).toHaveLength(2)
  expect(calls[1].body.targets.map(target => target.userId)).toEqual([second.userId])
  expect(state.calls.some(call => call.path.startsWith('/grants/batches/'))).toBe(false)
})

test('批量响应丢失提示核对授权状态，不自动重发或报告完成', async ({ page }) => {
  const state = await backend(page, ['IAM_GRANTS_VIEW', 'IAM_GRANTS_WRITE', 'IAM_USERS_VIEW'], call => call.path === '/grants/user-roles/batch' ? { abort: true } : undefined)
  await login(page); await grantInput(page)
  await page.getByRole('button', { name: '提交', exact: true }).click(); await confirm(page)
  await expect(page.locator('.stage-form').getByRole('alert')).toContainText('请先查询用户角色及授权来源')
  expect(state.calls.filter(call => call.path === '/grants/user-roles/batch')).toHaveLength(1)
  await expect(page.getByRole('region', { name: '权限操作结果' })).toHaveCount(0)
})

for (const response of [
  { name: '缺少逐人结果', data: { processingStatus: 'COMPLETED', succeeded: 1, failed: 0, total: 1 } },
  { name: '返回已取消的异步状态', data: { processingStatus: 'PENDING', succeeded: 0, failed: 0, total: 1, items: [{ userId: person.userId, status: 'PENDING' }] } },
]) {
  test(`批量${response.name}时不报告成功且不允许重试未知结果`, async ({ page }) => {
    const state = await backend(page, ['IAM_GRANTS_VIEW', 'IAM_GRANTS_WRITE', 'IAM_USERS_VIEW'], call =>
      call.path === '/grants/user-roles/batch' ? { data: response.data } : undefined)
    await login(page); await grantInput(page)
    await page.getByRole('button', { name: '提交', exact: true }).click(); await confirm(page)
    await expect(page.locator('.stage-form').getByRole('alert')).toContainText('批量结果不符合接口约定')
    await expect(page.getByRole('region', { name: '权限操作结果' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '仅重试失败目标' })).toHaveCount(0)
    expect(state.calls.filter(call => call.path === '/grants/user-roles/batch')).toHaveLength(1)
    expect(state.calls.some(call => call.path.startsWith('/grants/batches/'))).toBe(false)
  })
}

test('重登不恢复旧批量任务，也不自动提交操作', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('iam-batch-id:101', '920'))
  const state = await backend(page, ['IAM_GRANTS_VIEW', 'IAM_GRANTS_WRITE', 'IAM_USERS_VIEW'])
  await login(page); await nav(page, '权限分配')
  await expect(page.getByRole('region', { name: '权限操作结果' })).toHaveCount(0)
  expect(state.calls.some(call => call.path.startsWith('/grants/batches/') || call.path === '/grants/user-roles/batch')).toBe(false)
})

test('统一提交按所选来源回收；同批次同人多来源回收在提交前拦截', async ({ page }) => {
  const sources = [{ grantSourceId: '31', sourceType: 'MANUAL', sourceRef: 'SOURCE-A', active: true }, { grantSourceId: '32', sourceType: 'MANUAL', sourceRef: 'SOURCE-B', active: true }]
  const state = await backend(page, ['IAM_GRANTS_VIEW', 'IAM_GRANTS_WRITE', 'IAM_USERS_VIEW'], call => {
    if (call.path === '/users/' + person.userId + '/roles/2/sources') return { data: { userId: person.userId, roleId: '2', grantRevision: 'v9', sources } }
    if (call.path === '/grants/user-roles/batch') return { data: { processingStatus: 'COMPLETED', succeeded: 1, failed: 0, total: 1, items: [{ userId: person.userId, status: 'APPLIED', grantSourceId: '31' }] } }
  })
  await login(page); await grantInput(page)
  await page.getByLabel('操作', { exact: true }).selectOption('REVOKE')
  await page.getByRole('checkbox', { name: /SOURCE-A/ }).check(); await page.getByRole('checkbox', { name: /SOURCE-B/ }).check()
  await page.getByRole('button', { name: '提交', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('每位用户仅有一个目标')
  await page.getByRole('checkbox', { name: /SOURCE-B/ }).uncheck()
  await page.getByRole('button', { name: '提交', exact: true }).click()
  await confirm(page); await expect(page.locator('.stage-form')).toHaveCount(0)
  expect(state.calls.find(c => c.path === '/grants/user-roles/batch').body).toEqual({ operation: 'REVOKE', roleId: '2', targets: [{ userId: person.userId, grantSourceId: '31' }], reason: '第二阶段授权验证', dryRun: false })
  expect(state.calls.some(c => c.path === '/users/' + person.userId + '/roles')).toBe(true)
})

test('日志详情只显示记录本身，不展示或请求审计证据', async ({ page }) => {
  const state = await backend(page, ['IAM_AUDIT_VIEW'], call => {
    if (call.path === '/audit/operations') return { data: slice([{ eventId: '71', operationType: 'USER_ROLE_REVOKE', actorUserId: '101', targetId: person.userId, occurredAt: '2026-10-20T10:00:00+08:00' }], call.query) }
  })
  await login(page); await nav(page, '操作日志')
  await page.getByRole('button', { name: '查看详情' }).click()
  const detail = page.getByRole('dialog', { name: '日志详情' })
  await expect(detail).toContainText('回收用户角色')
  await expect(detail.getByRole('button', { name: /证据/ })).toHaveCount(0)
  await expect(detail).not.toContainText('审计证据')
  await expect(detail.getByRole('alert')).toHaveCount(0)
  expect(state.calls.some(c => c.path.startsWith('/audit/evidence/'))).toBe(false)
  expect(state.unexpected).toEqual([])
})

test('旧范围的账号列表晚返回时，不重新显示旧用户信息', async ({ page }) => {
  let release, held = false
  const gate = new Promise(resolve => { release = resolve })
  const state = await backend(page, ['IAM_USERS_VIEW', 'IAM_ADMINS_VIEW'], async call => {
    if (call.path === '/users' && call.query.get('keyword') === '等待旧查询' && !held) { held = true; await gate; return { data: slice([person], call.query) } }
  })
  await login(page); await nav(page, '用户账号')
  await page.getByRole('textbox', { name: '搜索姓名、账号或工号' }).fill('等待旧查询')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect.poll(() => held).toBe(true)
  state.roots = ['99']; state.users = []
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('共 0 条 · 第 1 页')).toBeVisible()
  const response = page.waitForResponse(r => new URL(r.url()).searchParams.get('keyword') === '等待旧查询')
  release(); await response
  await page.evaluate(() => new Promise(requestAnimationFrame))
  await expect(page.getByRole('cell', { name: person.realName, exact: true })).toHaveCount(0)
  await expect(page.getByText('共 0 条 · 第 1 页')).toBeVisible()
})

test('页面在提交前拦截超过100人的批量操作', async ({ page }) => {
  const state = await backend(page, ['IAM_GRANTS_VIEW', 'IAM_GRANTS_WRITE', 'IAM_USERS_VIEW'])
  state.users = Array.from({ length: 101 }, (_, index) => ({ ...person, userId: String(1000 + index), realName: '用户' + index }))
  await login(page); await grantInput(page, state.users.map(user => user.userId))
  await page.getByRole('button', { name: '提交', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('最多操作 100 位用户')
  expect(state.calls.some(call => call.path === '/grants/user-roles/batch')).toBe(false)
})

test('管理范围变更清空已选授权用户和旧姓名，重新读取可授权清单', async ({ page }) => {
  const state = await backend(page, ['IAM_GRANTS_VIEW', 'IAM_GRANTS_WRITE', 'IAM_ADMINS_VIEW', 'IAM_USERS_VIEW'])
  await login(page); await grantInput(page)
  await expect(page.getByText(/已选 1 位用户/)).toBeVisible()
  state.roots = ['99']; state.users = []
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('已选 0 位用户', { exact: true })).toBeVisible()
  await expect(page.getByText(person.realName, { exact: true })).toHaveCount(0)
  await expect.poll(() => state.calls.filter(c => c.path === '/admins/101/delegable-roles').length).toBe(2)
})

test('三类日志明确表头，显示真实账号、北京时间与未知结果，缺少权限时不读取用户', async ({ page }) => {
  const state = await backend(page, ['IAM_AUDIT_VIEW', 'IAM_USERS_VIEW'], call => {
    if (call.path === '/users/101') return { data: { userId: '101', realName: '真实管理员', username: 'admin_real' } }
    if (call.path === '/users/' + person.userId) return { data: person }
    if (call.path === '/users/999') return { status: 403, code: 'OUT_OF_SCOPE' }
    if (call.path === '/audit/operations') return { data: slice([{ eventId: '71', operationType: 'USER_ROLE_GRANT', actorUserId: '101', targetId: person.userId, occurredAt: '2026-10-20T02:00:00Z' }], call.query) }
    if (call.path === '/audit/authorizations') return { data: slice([
      { userId: '101', apiId: '51', allowed: true, occurredAt: '2026-10-20T02:00:00Z' },
      { userId: person.userId, apiId: '52', allowed: false, occurredAt: '2026-10-20T02:00:00Z' },
      { userId: '999', apiId: null, allowed: null, occurredAt: null },
    ], call.query) }
    if (call.path === '/audit/logins') return { data: slice([
      { userId: '101', loginMethod: 'USERNAME_PASSWORD', success: true, occurredAt: '2026-10-20T02:00:00Z' },
      { userId: person.userId, loginMethod: 'PHONE_PASSWORD', success: false, occurredAt: '2026-10-20T10:00:00+08:00' },
      { userId: null, loginMethod: null, success: null, occurredAt: 'invalid-time' },
    ], call.query) }
  })
  await login(page); await nav(page, '操作日志')
  await expect(page.getByRole('columnheader', { name: '操作类型', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '详情', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '操作', exact: true })).toHaveCount(0)
  await expect(page.locator('tbody')).toContainText('授予用户角色')
  await expect(page.locator('tbody')).toContainText('真实管理员')
  await expect(page.locator('tbody')).toContainText('admin_real')
  await expect(page.locator('tbody')).toContainText('用户 ID：101')
  await expect(page.locator('tbody')).toContainText('2026-10-20 10:00:00')
  await page.getByRole('tab', { name: '接口权限校验' }).click()
  await expect(page.locator('tbody tr').nth(0)).toContainText('允许访问')
  await expect(page.locator('tbody tr').nth(1)).toContainText('拒绝访问')
  await expect(page.locator('tbody tr').nth(2)).toContainText('未提供')
  await expect(page.locator('tbody tr').nth(2)).toContainText('账号资料不可查询')
  await expect(page.locator('tbody tr').nth(2)).not.toContainText('拒绝访问')
  await page.getByRole('tab', { name: '统一账号登录' }).click()
  await expect(page.locator('tbody tr').nth(0)).toContainText('账号密码')
  await expect(page.locator('tbody tr').nth(0)).toContainText('登录成功')
  await expect(page.locator('tbody tr').nth(1)).toContainText('手机号密码')
  await expect(page.locator('tbody tr').nth(1)).toContainText('登录失败')
  await expect(page.locator('tbody tr').nth(2)).toContainText('未关联用户')
  await expect(page.locator('tbody tr').nth(2)).not.toContainText('登录失败')
  await page.locator('tbody tr').nth(2).getByRole('button', { name: '查看详情' }).click()
  const detail = page.getByRole('dialog', { name: '日志详情' })
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('未提供')
  await page.keyboard.press('Escape')
  const lookups = state.calls.filter(c => /^\/users\/\d+$/.test(c.path)).length
  state.menus = [menu('IAM_AUDIT_VIEW')]
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('tbody')).toContainText('无账号查询权限')
  expect(state.calls.filter(c => /^\/users\/\d+$/.test(c.path))).toHaveLength(lookups)
  expect(state.unexpected).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('日志按姓名账号工号解析用户，同名需选择，无匹配不扩大查询范围', async ({ page }) => {
  const user = { ...person, sgNo: 'SG000001' }
  const state = await backend(page, ['IAM_AUDIT_VIEW', 'IAM_USERS_VIEW'], call => {
    if (call.path === '/audit/operations') return { data: slice([], call.query) }
    if (call.path === '/audit/logins' || call.path === '/audit/authorizations') return { data: slice([], call.query) }
    if (call.path === '/users' && call.query.has('keyword')) {
      const term = call.query.get('keyword')
      const items = term === '无匹配' ? [] : term === '同名' ? [user, { ...user, userId: '102', username: 'another', sgNo: 'SG000002' }] : [user]
      return { data: slice(items, call.query) }
    }
  })
  await login(page); await nav(page, '操作日志')
  await page.getByRole('tab', { name: '统一账号登录' }).click()
  const input = page.getByRole('textbox', { name: '按姓名、账号或工号查询日志' })
  const query = page.getByRole('button', { name: '查询', exact: true })
  for (const term of [user.realName, user.username, user.sgNo]) {
    await input.fill(term)
    const resolved = page.waitForRequest(r => new URL(r.url()).pathname.endsWith('/audit/logins') && new URL(r.url()).searchParams.get('userId') === user.userId)
    await query.click(); await resolved
    await expect(page.getByText('当前用户：', { exact: false })).toContainText(user.username)
  }
  await input.fill('同名'); await query.click()
  await expect(page.getByRole('region', { name: '匹配用户' })).toBeVisible()
  const second = page.waitForRequest(r => new URL(r.url()).pathname.endsWith('/audit/logins') && new URL(r.url()).searchParams.get('userId') === '102')
  await page.getByRole('button', { name: /another/ }).click(); await second
  await expect(page.getByText('当前用户：', { exact: false })).toContainText('another')
  const before = state.calls.filter(c => c.path === '/audit/logins').length
  await input.fill('无匹配'); await query.click()
  await expect(page.getByText('未找到匹配用户', { exact: true })).toBeVisible()
  expect(state.calls.filter(c => c.path === '/audit/logins')).toHaveLength(before)
  await expect(page.locator('tbody')).not.toContainText(user.realName)
  await expect(page.getByRole('button', { name: '导出当前页' })).toHaveCount(0)
  await input.fill('')
  const all = page.waitForRequest(r => new URL(r.url()).pathname.endsWith('/audit/logins') && !new URL(r.url()).searchParams.has('userId'))
  await query.click(); await all
  expect(state.unexpected).toEqual([])
})

test('管理操作没有查询入口，按服务端分页读取且不全量下载', async ({ page }) => {
  const records = Array.from({ length: 41 }, (_, index) => ({ eventId: String(index + 1), operationType: 'USER_ROLE_GRANT', actorUserId: '101', targetId: person.userId, occurredAt: '2026-10-20T10:00:00+08:00' }))
  const state = await backend(page, ['IAM_AUDIT_VIEW'], call => call.path === '/audit/operations' ? { data: slice(records, call.query) } : undefined)
  await login(page); await nav(page, '操作日志')
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '查询', exact: true })).toHaveCount(0)
  await expect(page.getByText('共 41 条 · 第 1 页')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(20)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page.getByText('共 41 条 · 第 2 页')).toBeVisible()
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page.getByText('共 41 条 · 第 3 页')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  const reads = state.calls.filter(call => call.path === '/audit/operations')
  expect(reads.map(call => call.query.get('page'))).toEqual(['1', '2', '3'])
  expect(reads.every(call => call.query.get('pageSize') === '20' && !call.query.has('userId'))).toBe(true)
  expect(state.calls.some(call => call.path === '/users')).toBe(false)
  expect(state.unexpected).toEqual([])
})

test('管理员按部门名称选择，查询传内部字符串 ID，全部部门不传筛选参数', async ({ page }) => {
  const departmentId = '9007199254740993'
  const state = await backend(page, ['IAM_ADMINS_VIEW', 'IAM_DEPTS_VIEW'], call => {
    if (call.path === '/departments') return { data: { items: [{ deptId: departmentId, parentId: '0', deptName: '财务管理部', status: 1 }] } }
  })
  await login(page); await nav(page, '管理员管理')
  const dropdown = page.getByRole('combobox', { name: '筛选管理部门' })
  await expect(dropdown).toBeEnabled()
  await expect(page.getByRole('textbox', { name: '管理员部门 ID' })).toHaveCount(0)
  await dropdown.selectOption({ label: '财务管理部' })
  const filtered = page.waitForRequest(r => new URL(r.url()).pathname.endsWith('/admins') && new URL(r.url()).searchParams.get('deptId') === departmentId)
  await page.getByRole('button', { name: '查询', exact: true }).click()
  expect(new URL((await filtered).url()).searchParams.get('page')).toBe('1')
  await dropdown.selectOption({ label: '全部部门' })
  const all = page.waitForRequest(r => new URL(r.url()).pathname.endsWith('/admins') && !new URL(r.url()).searchParams.has('deptId'))
  await page.getByRole('button', { name: '查询', exact: true }).click(); await all
  expect(state.unexpected).toEqual([])
})

test('本人管理范围展示身份和部门名称，可反复收起展开并随任命范围更新', async ({ page }) => {
  let appointed = true
  const state = await backend(page, ['IAM_ADMINS_VIEW', 'IAM_DEPTS_VIEW'], call => {
    if (call.path === '/departments') return { data: { items: [{ deptId: '17', parentId: '0', deptName: '财务管理部', status: 1 }] } }
    if (call.path === '/admins/me/scope' && !appointed) return { data: { appointed: false, adminLevel: null, deptId: null, scopeRootIds: [] } }
  })
  await login(page); await nav(page, '管理员管理')
  const scope = page.locator('.detail-panel').filter({ has: page.getByRole('heading', { name: '本人管理范围', exact: true }) })
  await expect(scope).toContainText('总公司管理员')
  await expect(scope).toContainText('财务管理部')
  await expect(scope).toContainText('全集团')
  await expect(scope.locator('dt')).not.toContainText(['所属部门 ID'])
  for (let index = 0; index < 2; index++) {
    await scope.getByRole('button', { name: '收起', exact: true }).click()
    await expect(scope.getByRole('heading', { name: '本人管理范围', exact: true })).toBeVisible()
    await expect(scope.locator('dl')).toHaveCount(0)
    await scope.getByRole('button', { name: '展开', exact: true }).click()
    await expect(scope.locator('dl')).toBeVisible()
  }
  state.level = 2
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(scope).toContainText('部门管理员（二级）')
  await expect(scope).toContainText('财务管理部及其下属部门')
  await expect(scope).not.toContainText('全集团')
  state.roots = ['99']
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(scope).toContainText('部门名称未提供（ID：99）')
  appointed = false
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(scope).toContainText('无有效管理员任命')
  await expect(scope).toContainText('暂无管理范围')
  expect(state.unexpected).toEqual([])
})

test.describe('授权历史时间范围', () => {
  test.use({ timezoneId: 'America/Los_Angeles' })
  test('按北京时间筛选，支持单边范围、分页及多人查询，错误范围不发请求', async ({ page }) => {
    const second = { ...person, userId: '102', realName: '另一位用户', username: 'second' }
    const records = [person.userId, second.userId].flatMap((userId, userIndex) => Array.from({ length: 24 }, (_, index) => ({ eventId: String(userIndex * 24 + index + 1), userId, roleId: '2', operation: 'GRANT', grantSourceId: String(index + 1), occurredAt: index === 0 ? '2026-10-19T23:59:59+08:00' : index === 23 ? '2026-10-21T00:00:00+08:00' : index === 22 ? '2026-10-20T23:59:59+08:00' : index === 1 ? '2026-10-20T00:00:00+08:00' : '2026-10-20T12:00:00+08:00' })))
    const state = await backend(page, ['IAM_GRANTS_VIEW', 'IAM_GRANTS_WRITE', 'IAM_USERS_VIEW'], call => {
      if (call.path === '/users') return { data: slice([person, second], call.query) }
      if (call.path === '/grants/history') {
        const from = call.query.get('from'), to = call.query.get('to'), userId = call.query.get('userId')
        return { data: slice(records.filter(row => (!userId || row.userId === userId) && (!from || Date.parse(row.occurredAt) >= Date.parse(from)) && (!to || Date.parse(row.occurredAt) <= Date.parse(to))), call.query) }
      }
    })
    await login(page); await nav(page, '权限分配')
    await page.getByRole('button', { name: '查询授权历史', exact: true }).click()
    const modal = page.getByRole('dialog', { name: '授权历史', exact: true })
    const start = modal.getByLabel('开始时间'), end = modal.getByLabel('结束时间')
    const query = modal.getByRole('button', { name: '查询', exact: true })
    await expect(modal.getByText('共 48 条 · 第 1 页')).toBeVisible()
    await start.fill('2026-10-20T00:00'); await end.fill('2026-10-20T23:59:59')
    await query.click()
    await expect(modal.getByText('共 44 条 · 第 1 页')).toBeVisible()
    let call = state.calls.filter(call => call.path === '/grants/history').at(-1)
    expect(call.query.get('from')).toBe('2026-10-20T00:00:00+08:00')
    expect(call.query.get('to')).toBe('2026-10-20T23:59:59+08:00')
    await modal.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(modal.getByText('共 44 条 · 第 2 页')).toBeVisible()
    call = state.calls.filter(call => call.path === '/grants/history').at(-1)
    expect(call.query.get('from')).toBe('2026-10-20T00:00:00+08:00')
    const before = state.calls.filter(call => call.path === '/grants/history').length
    await start.fill('2026-10-21T00:00'); await query.click()
    await expect(modal.getByRole('alert')).toContainText('开始时间不能晚于结束时间')
    expect(state.calls.filter(call => call.path === '/grants/history')).toHaveLength(before)
    await start.fill('2026-10-20T00:00'); await end.fill(''); await query.click()
    await expect(modal.getByText('共 46 条 · 第 1 页')).toBeVisible()
    expect(state.calls.filter(call => call.path === '/grants/history').at(-1).query.has('to')).toBe(false)
    await start.fill(''); await end.fill('2026-10-20T23:59:59'); await query.click()
    await expect(modal.getByText('共 46 条 · 第 1 页')).toBeVisible()
    expect(state.calls.filter(call => call.path === '/grants/history').at(-1).query.has('from')).toBe(false)
    await end.fill(''); await query.click()
    await expect(modal.getByText('共 48 条 · 第 1 页')).toBeVisible()
    await page.keyboard.press('Escape')
    const boxes = page.locator('.table-panel tbody input[type=checkbox]')
    await boxes.nth(0).check()
    await page.getByRole('button', { name: '查询授权历史', exact: true }).click()
    await start.fill('2026-10-20T00:00'); await end.fill('2026-10-20T23:59:59'); await query.click()
    await expect(modal.getByText('共 22 条 · 第 1 页')).toBeVisible()
    call = state.calls.filter(call => call.path === '/grants/history').at(-1)
    expect(call.query.get('userId')).toBe(person.userId); expect(call.query.get('roleId')).toBe('2')
    await page.keyboard.press('Escape'); await boxes.nth(1).check()
    await page.getByRole('button', { name: '查询授权历史', exact: true }).click()
    await expect(modal.getByText('共 48 条 · 第 1 页')).toBeVisible()
    await start.fill('2026-10-20T00:00'); await end.fill('2026-10-20T23:59:59'); await query.click()
    await expect(modal.getByText('共 44 条 · 第 1 页')).toBeVisible()
    const filtered = state.calls.filter(call => call.path === '/grants/history' && call.query.get('pageSize') === '500' && call.query.has('from'))
    expect(new Set(filtered.map(call => call.query.get('userId')))).toEqual(new Set([person.userId, second.userId]))
    expect(filtered.every(call => call.query.get('to') === '2026-10-20T23:59:59+08:00')).toBe(true)
    await modal.getByRole('button', { name: '下一页', exact: true }).click()
    await modal.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(modal.getByText('共 44 条 · 第 3 页')).toBeVisible()
    await expect(modal.locator('tbody tr')).toHaveCount(4)
    expect(state.unexpected).toEqual([])
  })
})
