import { test, expect } from '@playwright/test'

const codes = [
  'IAM_USERS_VIEW',
  'IAM_USERS_WRITE',
  'IAM_SCOPE_WRITE',
  'IAM_PASSWORD_RESET',
  'IAM_ROLES_VIEW',
  'IAM_ROLES_WRITE',
  'IAM_ROLE_PERMISSIONS_WRITE',
  'IAM_RESOURCES_VIEW',
  'IAM_RESOURCES_WRITE',
  'IAM_GRANTS_VIEW',
  'IAM_GRANTS_WRITE',
  'IAM_DEPTS_VIEW',
  'IAM_DEPTS_FREEZE',
  'IAM_AUDIT_VIEW',
]
async function fixture(page, permissions = codes) {
  const state = {
    user: {
      id: '1',
      username: 'manager',
      realName: '测试管理者',
      phone: '13800000001',
      deptId: '1',
      status: 1,
      source: 3,
      managementScope: 'ALL',
    },
    people: [
      {
        id: '2',
        username: 'worker',
        realName: '演示员工',
        phone: '13800000002',
        deptId: '1',
        status: 1,
        source: 1,
        managementScope: 'DEPT_TREE',
      },
      {
        id: '3',
        username: 'temp',
        realName: '临时人员',
        phone: '13800000003',
        deptId: '1',
        status: 1,
        source: 2,
        managementScope: 'DEPT_TREE',
      },
    ],
    roles: [
      { id: '1', roleCode: 'MANAGER', roleName: '管理角色', status: 1 },
      { id: '2', roleCode: 'WORKER', roleName: '业务角色', status: 1 },
    ],
    depts: [{ id: '1', deptCode: 'D01', deptName: '测试部门', parentId: '0', status: 1 }],
    roleIds: ['2'],
    lastBody: null,
  }
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace('/api/v1', ''),
      method = request.method()
    const body = request.postDataJSON()
    if (method !== 'GET') state.lastBody = body
    let data = {},
      status = 200
    if (path === '/auth/login')
      data = { token: 'test-token', authenticated: true, user: state.user }
    else if (path === '/auth/me')
      data = {
        user: state.user,
        menus: permissions.map((menuCode, i) => ({ id: String(i + 1), menuCode, menuType: 2 })),
      }
    else if (path === '/users' && method === 'GET') {
      const key = new URL(request.url()).searchParams.get('keyword') || ''
      const items = state.people.filter((p) => p.realName.includes(key) || p.username.includes(key))
      data = { items, total: items.length }
    } else if (path === '/departments') data = state.depts
    else if (path === '/roles') data = state.roles
    else if (/\/users\/\d+\/roles$/.test(path)) {
      if (method === 'PUT') state.roleIds = body.roleIds
      data = state.roleIds
    } else if (/\/users\/\d+\/scope$/.test(path))
      state.people[0].managementScope = body.managementScope
    else if (/\/users\/\d+\/status$/.test(path)) state.people[1].status = body.status
    else if (path === '/users/temporary') {
      state.people.push({ ...body, id: '4', status: 1, source: 2, managementScope: 'DEPT_TREE' })
      data = state.people.at(-1)
    } else if (path === '/applications')
      data = [{ id: '1', appCode: 'IAM', appName: '权限平台', status: 1 }]
    else if (path === '/applications/1/menus')
      data = [
        {
          id: '11',
          menuCode: 'VIEW',
          menuName: '用户查看',
          menuType: 2,
          appId: '1',
          parentId: '0',
          status: 1,
        },
      ]
    else if (path === '/applications/1/apis')
      data = [
        {
          id: '12',
          apiCode: 'GET_USERS',
          apiName: '用户列表',
          apiPath: '/users',
          httpMethod: 'GET',
          status: 1,
        },
      ]
    else if (path === '/roles/1/menus' || path === '/menus/11/apis') data = []
    else if (path === '/grants/batch')
      data = {
        items: body.userIds.map((userId) => ({ userId, success: true })),
        succeeded: body.userIds.length,
        total: body.userIds.length,
      }
    else if (path === '/audit/operations')
      data = {
        items: [
          {
            id: '1',
            operationType: 'LOGIN',
            success: true,
            detail: '登录成功',
            createdAt: '2026-10-24T12:00:00',
          },
        ],
        total: 1,
      }
    else if (path === '/auth/menus')
      data = { menus: [{ id: '30', menuName: '考勤打卡', path: '/demo/HR/feature1', menuType: 2 }] }
    else if (path.startsWith('/demo/')) data = { message: '业务接口鉴权通过' }
    else if (method === 'GET') {
      status = 404
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ success: status === 200, data, message: '未匹配测试请求' }),
    })
  })
  await page.goto('/')
  await page.getByLabel('账号', { exact: true }).fill('manager')
  await page.getByLabel('密码', { exact: true }).fill('Example123!')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  return state
}
test('登录后按角色权限展示账号管理功能', async ({ page }) => {
  await page.goto('/')
  await fixture(page)
  await expect(page.getByRole('heading', { name: '用户账号' })).toBeVisible()
  await expect(page.getByText('演示员工', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '创建临时账号' })).toBeVisible()
  await page.screenshot({ path: 'test-results/coursework-desktop.png', fullPage: true })
})
test('创建临时账号并保存人员来源', async ({ page }) => {
  const state = await fixture(page)
  await page.getByRole('button', { name: '创建临时账号' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('账号', { exact: true }).fill('visitor')
  await dialog.getByLabel('姓名', { exact: true }).fill('新临时人员')
  await dialog.getByLabel('手机号', { exact: true }).fill('13800000004')
  await dialog.getByLabel('初始密码').fill('Temporary123!')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('新临时人员', { exact: true })).toBeVisible()
  expect(state.people.at(-1).source).toBe(2)
})
test('保存用户选择的完整角色集合', async ({ page }) => {
  const state = await fixture(page)
  await page
    .getByRole('row')
    .filter({ hasText: '演示员工' })
    .getByRole('button', { name: '角色', exact: true })
    .click()
  await page.getByRole('dialog').getByLabel('管理角色').check()
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.lastBody).toEqual({ roleIds: ['2', '1'] })
})
test('配置用户的部门管理范围', async ({ page }) => {
  const state = await fixture(page)
  await page
    .getByRole('row')
    .filter({ hasText: '演示员工' })
    .getByRole('button', { name: '范围', exact: true })
    .click()
  await page.getByRole('dialog').getByLabel('数据范围').selectOption('ALL')
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.people[0].managementScope).toBe('ALL')
})
test('只读用户看不到维护按钮和其他管理页面', async ({ page }) => {
  await fixture(page, ['IAM_USERS_VIEW'])
  await expect(page.getByRole('button', { name: '创建临时账号' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '角色管理', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '范围', exact: true })).toHaveCount(0)
})
test('角色权限和菜单接口关联均可保存', async ({ page }) => {
  const state = await fixture(page)
  await page.getByRole('button', { name: '角色管理', exact: true }).click()
  await page
    .getByRole('row')
    .filter({ hasText: '管理角色' })
    .getByRole('button', { name: '配置权限' })
    .click()
  await page.getByRole('dialog').getByLabel('权限平台 / 用户查看').check()
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.lastBody).toEqual({ menuIds: ['11'] })
  await page.getByRole('button', { name: '应用资源', exact: true }).click()
  await page.getByRole('button', { name: '关联接口' }).click()
  await page.getByRole('dialog').getByLabel('GET /users · 用户列表').check()
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.lastBody).toEqual({ apiIds: ['12'] })
})
test('移动端可登录并打开业务演示', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await fixture(page)
  await page.getByRole('button', { name: '业务演示', exact: true }).click()
  await page.getByRole('button', { name: /考勤打卡/ }).click()
  await expect(page.getByRole('status')).toContainText('业务接口鉴权通过')
  await page.screenshot({ path: 'test-results/coursework-mobile.png', fullPage: true })
})
