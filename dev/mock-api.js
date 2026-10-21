// 提供本地模拟接口和内存数据处理。
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const pageDefinitions = [
  ['users', '用户账号', 'IAM_USERS_VIEW', '/users'], ['roles', '角色管理', 'IAM_ROLES_VIEW', '/roles'],
  ['resources', '应用管理', 'IAM_RESOURCES_VIEW', '/resources'], ['grants', '权限分配', 'IAM_GRANTS_VIEW', '/grants'],
  ['organization', '人员与组织变动', 'IAM_DEPTS_VIEW', '/departments'], ['admins', '管理员管理', 'IAM_ADMINS_VIEW', '/admins'], ['audit', '操作日志', 'IAM_AUDIT_VIEW', '/audit'],
]
const writePermissions = ['IAM_USERS_WRITE', 'IAM_ROLES_WRITE', 'IAM_RESOURCES_WRITE', 'IAM_GRANTS_WRITE', 'IAM_ADMINS_WRITE', 'IAM_GRANTS_DELEGATE', 'IAM_DEPTS_FREEZE']
const fail = (message, code = 'INVALID_ARGUMENT', status = 400) => { throw Object.assign(new Error(message), { code, status }) }
const required = (body, keys) => { for (const key of keys) if (body[key] === undefined || body[key] === null || (typeof body[key] === 'string' && !body[key].trim())) fail(`缺少有效字段：${key}`) }
const fields = (body, keys) => { for (const key of Object.keys(body)) if (!keys.includes(key)) fail(`不支持字段：${key}`) }
const positiveId = value => { if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || BigInt(value) > 9223372036854775807n) fail('ID 必须是正整数十进制字符串'); return value }
const reason = body => { required(body, ['reason']); if (typeof body.reason !== 'string' || body.reason.length > 512) fail('操作原因最长 512 字符') }
const items = value => { if (!Array.isArray(value) || value.some(v => typeof v !== 'string') || new Set(value).size !== value.length) fail('请选择不重复的 ID 集合'); return value.map(positiveId) }
const found = (rows, key, value) => rows.find(r => r[key] === value) || fail('记录不存在', 'RESOURCE_NOT_FOUND', 404)

export function mockApi() {
  let db, tokens, grants, userVersions, roleVersions, mappingVersions, mappings, delegations, delegationVersions, batches, idempotency, phoneUsers, sms, passwords, audit, logins, nextId
  function init() {
    db = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'))
    tokens = new Map(); grants = []; userVersions = new Map(); roleVersions = new Map(); mappingVersions = new Map(); mappings = new Map(); delegations = new Map([['101', db.roles.map(r => r.roleId)]]); delegationVersions = new Map(); batches = new Map(); idempotency = new Map(); phoneUsers = new Map([['13800000000', '101']]); sms = new Map(); passwords = new Map([['101', '123456']]); nextId = 50000
    db.admins = [{ userId: '101', adminLevel: 1, deptId: '1', status: 1 }]
    db.apis = [{ apiId: '41', appId: db.applications.find(a => a.appCode === 'IAM').appId, apiCode: 'IAM_USERS_LIST', apiName: '用户查询', httpMethod: 'GET', apiPath: '/api/v1/users', status: 1 }]
    audit = [{ eventId: '1', operationType: 'MOCK_INITIALIZATION', actorUserId: '101', targetId: '101', occurredAt: new Date().toISOString() }]; logins = []
  }
  const revision = (map, key) => `v${map.get(key) || 1}`
  const bump = (map, key) => { map.set(key, (map.get(key) || 1) + 1); return revision(map, key) }
  const checkVersion = (map, key, expected) => { if (expected !== revision(map, key)) fail('数据已被其他操作修改', 'VERSION_CONFLICT', 409) }
  const record = (operationType, targetId, extra = {}) => audit.unshift({ eventId: String(nextId++), operationType, actorUserId: '101', targetId, occurredAt: new Date().toISOString(), ...extra })
  function paginate(rows, query) {
    const page = Number(query.get('page') || 1), pageSize = Number(query.get('pageSize') || 20)
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) fail('分页参数不合法')
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: String(rows.length) }
  }
  function grant(body, revoke = false) {
    required(body, ['userId', 'roleId', ...(revoke ? ['grantSourceId'] : ['sourceType', 'sourceRef'])]); reason(body)
    positiveId(body.userId); positiveId(body.roleId)
    const user = found(db.users, 'userId', body.userId), role = found(db.roles, 'roleId', body.roleId)
    if (role.status !== 1 || role.roleType === 3) fail('角色不可授予', 'ROLE_NOT_DELEGABLE', 403)
    if (body.expectedVersion !== undefined) checkVersion(userVersions, body.userId, body.expectedVersion)
    let source
    if (revoke) {
      source = grants.find(g => g.userId === body.userId && g.roleId === body.roleId && g.grantSourceId === body.grantSourceId)
      if (!source) fail('授权依据不存在', 'GRANT_SOURCE_NOT_FOUND', 404)
      if (source.active) { source.active = false; bump(userVersions, body.userId); record('USER_ROLE_REVOKE', body.userId, { roleId: body.roleId, grantSourceId: source.grantSourceId }) }
    } else {
      if (user.status !== 1) fail('目标账号不可用', 'BUSINESS_RULE_VIOLATION', 422)
      if (!['MANUAL', 'DEPT_POSITION'].includes(body.sourceType)) fail('不支持的来源类型')
      source = grants.find(g => g.userId === body.userId && g.roleId === body.roleId && g.sourceType === body.sourceType && g.sourceRef === body.sourceRef)
      if (source && !source.active) fail('历史依据不能复活，请使用新业务编号', 'IDEMPOTENCY_CONFLICT', 409)
      if (!source) { source = { grantSourceId: String(nextId++), userId: body.userId, roleId: body.roleId, sourceType: body.sourceType, sourceRef: body.sourceRef, active: true }; grants.push(source); bump(userVersions, body.userId); record('USER_ROLE_GRANT', body.userId, { roleId: body.roleId, grantSourceId: source.grantSourceId }) }
    }
    const count = grants.filter(g => g.userId === body.userId && g.roleId === body.roleId && g.active).length
    return { userId: body.userId, roleId: body.roleId, ...(revoke ? { revokedSourceId: source.grantSourceId, remainingActiveSources: count } : { grantSourceId: source.grantSourceId, permissionRevision: revision(userVersions, body.userId) }), roleEffective: count > 0 }
  }
  function batchResult(batch, query) {
    const rows = paginate(batch.items, query)
    return { batchId: batch.batchId, processingStatus: batch.processingStatus, succeeded: batch.items.filter(i => i.status === 'APPLIED').length, failed: batch.items.filter(i => i.status === 'FAILED').length, pending: batch.items.filter(i => i.status === 'PENDING').length, ...rows }
  }
  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost'), path = url.pathname.slice('/api/v1'.length), method = req.method
    let body = {}, size = 0, raw = ''
    for await (const chunk of req) { size += chunk.length; if (size > 4_000_000) fail('请求过大', 'INVALID_ARGUMENT', 413); raw += chunk }
    if (raw) { try { body = JSON.parse(raw) } catch { fail('请求必须是 JSON') } }
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('请求体必须是对象')
    let status = 200
    const send = data => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify({ success: true, code: status === 202 ? 'ACCEPTED' : 'OK', requestId: randomUUID(), data })) }
    const query = url.searchParams
    if (path === '/auth/login' && method === 'POST') {
      fields(body, ['loginType', 'identifier', 'password']); required(body, ['loginType', 'identifier', 'password'])
      const userId = body.loginType === 'PHONE' ? phoneUsers.get(body.identifier) : body.identifier === 'admin' ? '101' : db.users.find(u => u.username === body.identifier)?.userId
      const user = db.users.find(u => u.userId === userId)
      if (!['USERNAME', 'PHONE'].includes(body.loginType) || !user || user.status !== 1 || passwords.get(userId) !== body.password) fail('账号或密码错误', 'INVALID_CREDENTIALS', 401)
      const token = randomUUID(); tokens.set(token, { userId, expires: Date.now() + 3600_000 }); logins.unshift({ userId, loginMethod: body.loginType + '_PASSWORD', success: true, occurredAt: new Date().toISOString() })
      return send({ accessToken: token, tokenType: 'Bearer', expiresIn: 3600, userId })
    }
    if (path === '/auth/sms/send' && method === 'POST') {
      required(body, ['phone', 'purpose']); if (!/^1\d{10}$/.test(body.phone) || !['SET_PASSWORD', 'RESET_PASSWORD'].includes(body.purpose)) fail('手机号或验证码用途不合法')
      const key = body.phone + ':' + body.purpose, previous = sms.get(key)
      if (previous && Date.now() - previous.sent < 60_000) fail('请稍后重新发送', 'RATE_LIMITED', 429)
      sms.set(key, { sent: Date.now(), expires: Date.now() + 300_000 }); return send({ accepted: true, retryAfterSeconds: 60 })
    }
    if (['/auth/password/initialize', '/auth/password/reset'].includes(path) && method === 'POST') {
      fields(body, ['phone', 'code', 'newPassword']); required(body, ['phone', 'code', 'newPassword'])
      const initial = path.endsWith('/initialize'), key = body.phone + ':' + (initial ? 'SET_PASSWORD' : 'RESET_PASSWORD'), proof = sms.get(key)
      if (!proof || proof.expires < Date.now() || body.code !== '123456' || !phoneUsers.has(body.phone)) fail('验证信息无效', 'INVALID_CREDENTIALS', 400)
      if (body.newPassword.length < 8) fail('测试密码至少 8 位')
      const userId = phoneUsers.get(body.phone), user = found(db.users, 'userId', userId)
      if (initial && user.passwordInitialized) fail('该账号已设置密码', 'BUSINESS_RULE_VIOLATION', 422)
      sms.delete(key); passwords.set(userId, body.newPassword); user.passwordInitialized = true; tokens.clear()
      return send(initial ? { initialized: true } : { passwordReset: true, sessionsInvalidated: true })
    }
    const token = req.headers.authorization?.replace(/^Bearer /, '')
    if (!token || !tokens.has(token) || tokens.get(token).expires < Date.now()) fail('登录已失效', 'INVALID_TOKEN', 401)
    if (path === '/auth/logout' && method === 'POST') { tokens.delete(token); return send({ revoked: true }) }
    if (path === '/auth/menus' && method === 'GET') return send({ appCode: query.get('appCode'), menus: tokens.get(token).userId !== '101' ? [] : [...pageDefinitions.map((p, i) => ({ menuId: String(90001 + i), menuName: p[1], menuCode: p[2], path: p[3] })), ...writePermissions.map((code, i) => ({ menuId: String(90101 + i), menuName: code, menuCode: code, path: '' }))] })
    if (tokens.get(token).userId !== '101') fail('测试普通账号未获管理资格', 'PERMISSION_DENIED', 403)
    if (path === '/users' && method === 'GET') { const keyword = (query.get('keyword') || '').toLowerCase(); return send(paginate(db.users.filter(u => (!query.get('deptId') || u.deptId === query.get('deptId')) && (!query.get('status') || u.status === Number(query.get('status'))) && (!query.get('source') || u.source === Number(query.get('source'))) && [u.realName, u.username, u.sgNo].some(v => String(v || '').toLowerCase().includes(keyword))), query)) }
    if (path === '/users/temporary' && method === 'POST') {
      fields(body, ['realName', 'phone', 'deptId', 'reason']); required(body, ['realName', 'phone', 'deptId']); reason(body); positiveId(body.deptId); found(db.departments, 'deptId', body.deptId)
      if (!/^1\d{10}$/.test(body.phone)) fail('手机号格式不合法')
      if (phoneUsers.has(body.phone)) fail('手机号已存在', 'DUPLICATE_RESOURCE', 409)
      const userId = String(nextId++), user = { userId, realName: body.realName, username: 'temp' + userId, sgNo: null, phoneMasked: body.phone.slice(0, 3) + '****' + body.phone.slice(-4), deptId: body.deptId, status: 1, source: 2, passwordInitialized: false }
      phoneUsers.set(body.phone, userId); db.users.push(user); record('USER_CREATE', userId); return send(user)
    }
    let match
    if ((match = path.match(/^\/users\/(\d+)$/)) && method === 'GET') return send(found(db.users, 'userId', match[1]))
    if ((match = path.match(/^\/users\/(\d+)\/status$/)) && method === 'PATCH') {
      fields(body, ['status', 'reason']); reason(body); const user = found(db.users, 'userId', match[1]); if (user.source !== 2 || user.sgNo || ![1, 2].includes(body.status)) fail('只允许维护手动创建的无工号账号', 'BUSINESS_RULE_VIOLATION', 422)
      user.status = body.status; record('USER_STATUS', user.userId); return send({ userId: user.userId, status: user.status })
    }
    if ((match = path.match(/^\/users\/(\d+)\/roles$/)) && method === 'GET') {
      found(db.users, 'userId', match[1]); const active = grants.filter(g => g.userId === match[1] && g.active)
      return send({ userId: match[1], grantRevision: revision(userVersions, match[1]), roles: [...new Set(active.map(g => g.roleId))].map(roleId => ({ roleId, active: true, activeSourceCount: active.filter(g => g.roleId === roleId).length })) })
    }
    if ((match = path.match(/^\/users\/(\d+)\/roles\/(\d+)\/sources$/)) && method === 'GET') return send({ userId: match[1], roleId: match[2], grantRevision: revision(userVersions, match[1]), sources: grants.filter(g => g.userId === match[1] && g.roleId === match[2]) })
    if ((match = path.match(/^\/users\/(\d+)\/permissions$/)) && method === 'GET') {
      const app = db.applications.find(a => a.appCode === query.get('appCode')); if (!app) fail('应用不存在', 'RESOURCE_NOT_FOUND', 404)
      const roles = grants.filter(g => g.userId === match[1] && g.active).map(g => g.roleId), menuIds = new Set(roles.flatMap(r => db.roleMenus[r] || []))
      return send({ userId: match[1], appCode: app.appCode, menus: db.menus.filter(m => m.appId === app.appId && m.status === 1 && menuIds.has(m.menuId)).map(({ menuId, menuCode }) => ({ menuId, menuCode })) })
    }
    if (path === '/departments' && method === 'GET') return send({ items: db.departments })
    if ((match = path.match(/^\/departments\/(\d+)\/users$/)) && method === 'GET') {
      found(db.departments, 'deptId', match[1]); const ids = new Set([match[1]])
      if (query.get('includeDescendants') === 'true') { let count; do { count = ids.size; db.departments.filter(d => ids.has(d.parentId)).forEach(d => ids.add(d.deptId)) } while (ids.size !== count) }
      return send(paginate(db.users.filter(u => ids.has(u.deptId)), query))
    }
    if ((match = path.match(/^\/departments\/(\d+)\/(freeze|unfreeze)$/)) && method === 'POST') { fields(body, ['reason']); reason(body); const dept = found(db.departments, 'deptId', match[1]); dept.status = match[2] === 'freeze' ? 0 : 1; record('DEPT_' + match[2].toUpperCase(), dept.deptId); return send({ deptId: dept.deptId, status: dept.status }) }
    if (path === '/applications' && method === 'GET') return send(paginate(db.applications, query))
    if (path === '/applications' && method === 'POST') {
      fields(body, ['appCode', 'appName', 'description']); required(body, ['appCode', 'appName', 'description'])
      if (db.applications.some(a => a.appCode === body.appCode)) fail('应用编码重复', 'DUPLICATE_RESOURCE', 409)
      const app = { ...body, appId: String(nextId++), status: 1 }; db.applications.push(app); record('APPLICATION_CREATE', app.appId); return send(app)
    }
    if ((match = path.match(/^\/applications\/(\d+)$/)) && method === 'PATCH') { fields(body, ['appName', 'status', 'reason']); reason(body); required(body, ['appName', 'status']); if (![0, 1].includes(body.status)) fail('状态不合法'); const app = found(db.applications, 'appId', match[1]); Object.assign(app, { appName: body.appName, status: body.status }); record('APPLICATION_UPDATE', app.appId); return send(app) }
    if ((match = path.match(/^\/applications\/(\d+)\/menus$/))) {
      found(db.applications, 'appId', match[1])
      if (method === 'GET') return send({ appId: match[1], menus: db.menus.filter(m => m.appId === match[1]) })
      if (method === 'POST') {
        fields(body, ['menuCode', 'menuName', 'menuType', 'parentId', 'path']); required(body, ['menuCode', 'menuName', 'menuType', 'parentId', 'path']); if (![1, 2].includes(body.menuType)) fail('菜单类型不合法')
        if (body.parentId !== '0') { const parent = found(db.menus, 'menuId', body.parentId); if (parent.appId !== match[1] || parent.menuType !== 1) fail('父目录不合法') }
        if (db.menus.some(m => m.appId === match[1] && m.menuCode === body.menuCode)) fail('菜单编码重复', 'DUPLICATE_RESOURCE', 409)
        const menu = { ...body, menuId: String(nextId++), appId: match[1], status: 1 }; db.menus.push(menu); record('MENU_CREATE', menu.menuId); return send(menu)
      }
    }
    if ((match = path.match(/^\/menus\/(\d+)$/)) && method === 'PATCH') {
      fields(body, ['menuName', 'parentId', 'status', 'reason']); reason(body); required(body, ['parentId', 'status']); if (body.menuName !== undefined) required(body, ['menuName']); const menu = found(db.menus, 'menuId', match[1]); if (![0, 1].includes(body.status)) fail('状态不合法')
      if (body.parentId !== '0') { let parent = found(db.menus, 'menuId', body.parentId); const seen = new Set([menu.menuId]); while (parent) { if (seen.has(parent.menuId) || parent.appId !== menu.appId || parent.menuType !== 1) fail('目录循环或父级不合法'); seen.add(parent.menuId); parent = db.menus.find(m => m.menuId === parent.parentId) } }
      Object.assign(menu, { parentId: body.parentId, status: body.status, ...(body.menuName !== undefined ? { menuName: body.menuName } : {}) }); record('MENU_UPDATE', menu.menuId); return send(menu)
    }
    if ((match = path.match(/^\/applications\/(\d+)\/apis$/))) {
      found(db.applications, 'appId', match[1])
      if (method === 'GET') return send(paginate(db.apis.filter(a => a.appId === match[1]), query))
      if (method === 'POST') { fields(body, ['apiCode', 'apiName', 'apiPath', 'httpMethod']); required(body, ['apiCode', 'apiName', 'apiPath', 'httpMethod']); if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(body.httpMethod) || !body.apiPath.startsWith('/')) fail('方法或路由不合法'); if (db.apis.some(a => a.appId === match[1] && a.httpMethod === body.httpMethod && a.apiPath === body.apiPath)) fail('接口已存在', 'DUPLICATE_RESOURCE', 409); const entry = { ...body, appId: match[1], apiId: String(nextId++), status: 1 }; db.apis.push(entry); record('API_CREATE', entry.apiId); return send(entry) }
    }
    if ((match = path.match(/^\/apis\/(\d+)$/)) && method === 'PATCH') { fields(body, ['apiName', 'status', 'reason']); reason(body); required(body, ['apiName', 'status']); if (![0, 1].includes(body.status)) fail('状态不合法'); const entry = found(db.apis, 'apiId', match[1]); Object.assign(entry, { apiName: body.apiName, status: body.status }); record('API_UPDATE', entry.apiId); return send(entry) }
    if ((match = path.match(/^\/menus\/(\d+)\/apis$/))) {
      const menu = found(db.menus, 'menuId', match[1])
      if (method === 'PUT') { fields(body, ['apiIds', 'expectedVersion']); checkVersion(mappingVersions, menu.menuId, body.expectedVersion); items(body.apiIds).forEach(value => { if (found(db.apis, 'apiId', value).appId !== menu.appId) fail('不能跨应用映射') }); mappings.set(menu.menuId, body.apiIds); bump(mappingVersions, menu.menuId); record('MENU_API_UPDATE', menu.menuId) }
      if (['GET', 'PUT'].includes(method)) return send({ menuId: menu.menuId, apiIds: mappings.get(menu.menuId) || [], mappingVersion: revision(mappingVersions, menu.menuId) })
    }
    if (path === '/roles' && method === 'GET') return send(paginate(db.roles, query))
    if (path === '/roles' && method === 'POST') { fields(body, ['roleCode', 'roleName', 'roleType', 'description']); required(body, ['roleCode', 'roleName', 'roleType', 'description']); if (![1, 2].includes(body.roleType)) fail('禁止创建超级角色'); if (db.roles.some(r => r.roleCode === body.roleCode)) fail('角色编码重复', 'DUPLICATE_RESOURCE', 409); const role = { ...body, roleId: String(nextId++), status: 1 }; db.roles.push(role); db.roleMenus[role.roleId] = []; delegations.get('101').push(role.roleId); record('ROLE_CREATE', role.roleId); return send(role) }
    if ((match = path.match(/^\/roles\/(\d+)$/))) {
      const role = found(db.roles, 'roleId', match[1])
      if (method === 'PATCH') { fields(body, ['roleName', 'status', 'reason']); reason(body); required(body, ['roleName', 'status']); if (![0, 1].includes(body.status)) fail('状态不合法'); Object.assign(role, { roleName: body.roleName, status: body.status }); record('ROLE_UPDATE', role.roleId) }
      if (['GET', 'PATCH'].includes(method)) return send(role)
    }
    if ((match = path.match(/^\/roles\/(\d+)\/menus$/))) {
      found(db.roles, 'roleId', match[1])
      if (method === 'PUT') { fields(body, ['menuIds', 'expectedVersion']); checkVersion(roleVersions, match[1], body.expectedVersion); items(body.menuIds).forEach(value => { if (found(db.menus, 'menuId', value).menuType !== 2) fail('只能授权权限菜单') }); db.roleMenus[match[1]] = body.menuIds; bump(roleVersions, match[1]); record('ROLE_MENUS_UPDATE', match[1]) }
      if (['GET', 'PUT'].includes(method)) return send({ roleId: match[1], menuIds: db.roleMenus[match[1]] || [], permissionRevision: revision(roleVersions, match[1]) })
    }
    if (path === '/grants/user-roles' && method === 'POST') { fields(body, ['userId', 'roleId', 'sourceType', 'sourceRef', 'sourceDeptId', 'reason', 'expectedVersion']); required(body, ['expectedVersion']); return send(grant(body)) }
    if (path === '/grants/user-roles/revoke' && method === 'POST') { fields(body, ['userId', 'roleId', 'grantSourceId', 'reason', 'expectedVersion']); required(body, ['expectedVersion']); return send(grant(body, true)) }
    if (path === '/grants/user-roles/batch' && method === 'POST') {
      fields(body, ['operation', 'roleId', 'targets', 'reason', 'dryRun']); required(body, ['operation', 'roleId', 'targets']); reason(body)
      if (body.dryRun === true) fail('当前后端阶段不支持预检查')
      const key = req.headers['idempotency-key']; if (!key || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('缺少合法幂等键')
      if (!['GRANT', 'REVOKE'].includes(body.operation) || !Array.isArray(body.targets) || !body.targets.length) fail('批量操作不合法')
      positiveId(body.roleId); found(db.roles, 'roleId', body.roleId)
      const userIds = new Set()
      for (const target of body.targets) { fields(target, body.operation === 'GRANT' ? ['userId', 'sourceType', 'sourceRef', 'sourceDeptId'] : ['userId', 'grantSourceId']); positiveId(target.userId); required(target, body.operation === 'GRANT' ? ['sourceType', 'sourceRef'] : ['grantSourceId']); if (userIds.has(target.userId)) fail('批量目标不能重复'); userIds.add(target.userId) }
      const signature = JSON.stringify(body), previous = idempotency.get(key)
      if (previous) { if (previous.signature !== signature) fail('同一幂等键的内容发生变化', 'IDEMPOTENCY_CONFLICT', 409); return send(batchResult(batches.get(previous.batchId), query)) }
      const batchId = String(nextId++), batch = { batchId, processingStatus: 'PENDING', items: body.targets.map(t => ({ userId: t.userId, status: 'PENDING' })) }; batches.set(batchId, batch); idempotency.set(key, { signature, batchId })
      setTimeout(() => {
        for (let i = 0; i < body.targets.length; i++) { try { const data = grant({ ...body.targets[i], roleId: body.roleId, reason: body.reason }, body.operation === 'REVOKE'); batch.items[i] = { userId: body.targets[i].userId, status: 'APPLIED', grantSourceId: data.grantSourceId || data.revokedSourceId } } catch (e) { batch.items[i] = { userId: body.targets[i].userId, status: 'FAILED', code: e.code || 'INVALID_ARGUMENT' } } }
        const failed = batch.items.filter(i => i.status === 'FAILED').length; batch.processingStatus = failed === 0 ? 'COMPLETED' : failed === batch.items.length ? 'FAILED' : 'PARTIAL_SUCCESS'
      }, 100)
      status = 202; return send({ batchId, processingStatus: 'PENDING', total: batch.items.length })
    }
    if ((match = path.match(/^\/grants\/batches\/(\d+)$/)) && method === 'GET') return send(batchResult(batches.get(match[1]) || fail('任务不存在', 'RESOURCE_NOT_FOUND', 404), query))
    if (path === '/grants/history' && method === 'GET') {
      const from = query.get('from'), to = query.get('to')
      if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to))) || (from && to && Date.parse(from) > Date.parse(to))) fail('时间范围不合法')
      return send(paginate(audit.filter(a => a.operationType.startsWith('USER_ROLE') && (!query.get('roleId') || a.roleId === query.get('roleId')) && (!query.get('userId') || a.targetId === query.get('userId')) && (!from || Date.parse(a.occurredAt) >= Date.parse(from)) && (!to || Date.parse(a.occurredAt) <= Date.parse(to))).map(a => ({ eventId: a.eventId, userId: a.targetId, roleId: a.roleId, grantSourceId: a.grantSourceId, operation: a.operationType.endsWith('REVOKE') ? 'REVOKE' : 'GRANT', occurredAt: a.occurredAt })), query))
    }
    if (path === '/admins/me/scope' && method === 'GET') return send({ appointed: true, adminLevel: 1, deptId: '1', scopeRootIds: ['1'], delegableRolesVersion: revision(delegationVersions, '101') })
    if (path === '/admins' && method === 'GET') return send(paginate(db.admins.filter(a => !query.get('deptId') || a.deptId === query.get('deptId')), query))
    if (path === '/admins/appointments' && method === 'POST') { fields(body, ['userId', 'adminLevel', 'deptId', 'reason']); reason(body); required(body, ['userId', 'adminLevel', 'deptId']); positiveId(body.userId); found(db.users, 'userId', body.userId); found(db.departments, 'deptId', body.deptId); if (!Number.isInteger(body.adminLevel) || body.adminLevel < 1 || body.adminLevel > 65535) fail('等级不合法'); let admin = db.admins.find(a => a.userId === body.userId); if (admin) Object.assign(admin, { adminLevel: body.adminLevel, deptId: body.deptId, status: 1 }); else { admin = { userId: body.userId, adminLevel: body.adminLevel, deptId: body.deptId, status: 1 }; db.admins.push(admin) }; delegations.set(body.userId, []); bump(delegationVersions, body.userId); record('ADMIN_APPOINT', body.userId); return send(admin) }
    if ((match = path.match(/^\/admins\/(\d+)\/revoke$/)) && method === 'POST') { fields(body, ['reason']); reason(body); const admin = found(db.admins, 'userId', match[1]); if (admin.userId === '101') fail('模拟环境保留检查账号，不能撤销自身', 'BUSINESS_RULE_VIOLATION', 422); admin.status = 0; record('ADMIN_REVOKE', admin.userId); return send({ userId: admin.userId, status: 0, appointmentRevoked: true }) }
    if ((match = path.match(/^\/admins\/(\d+)\/delegable-roles$/))) {
      found(db.admins, 'userId', match[1])
      if (method === 'PUT') { fields(body, ['roleIds', 'expectedVersion', 'reason']); reason(body); if (match[1] === '101') fail('不能配置本人的委派清单', 'OUT_OF_SCOPE', 403); checkVersion(delegationVersions, match[1], body.expectedVersion); items(body.roleIds).forEach(value => found(db.roles, 'roleId', value)); delegations.set(match[1], body.roleIds); bump(delegationVersions, match[1]); record('ADMIN_DELEGATION', match[1]) }
      if (['GET', 'PUT'].includes(method)) return send({ userId: match[1], roleIds: delegations.get(match[1]) || [], delegationVersion: revision(delegationVersions, match[1]) })
    }
    if (path === '/audit/operations' && method === 'GET') return send(paginate(audit, query))
    if (path === '/audit/logins' && method === 'GET') return send(paginate(logins.filter(a => !query.get('userId') || a.userId === query.get('userId')), query))
    if (path === '/audit/authorizations' && method === 'GET') return send(paginate([], query))
    if ((match = path.match(/^\/audit\/evidence\/(\d+)$/)) && method === 'GET') { const event = found(audit, 'eventId', match[1]); return send({ eventId: event.eventId, requestId: 'mock-' + event.eventId, evidenceType: 'MOCK_OPERATION', permissionVersion: 'v1', integrityVerified: false }) }
    fail('模拟接口未定义；不会回退为成功响应', 'RESOURCE_NOT_FOUND', 404)
  }
  return { name: 'stage1-mock-api', apply: 'serve', configureServer(server) {
    init()
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/v1/')) return next()
      handle(req, res).catch(e => { if (res.writableEnded) return; res.statusCode = e.status || 500; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ success: false, code: e.code || 'MOCK_INTERNAL_ERROR', message: e.status ? e.message : '模拟服务处理失败', requestId: randomUUID() })) })
    })
  } }
}
