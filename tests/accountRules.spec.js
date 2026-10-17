import { test, expect } from '@playwright/test'
import { normalizeUser, applyHrTransfer, updateRoleAuthorization } from '../src/accountRules.js'

test('同角色按不同业务依据独立登记，缺失依据拒绝，回收全部有效依据', () => {
  const user = normalizeUser({ id: 'u', roles: [] })
  const grant = { role: '普通员工', mode: 'grant', sourceType: '工单', businessBasis: 'WO-1', actor: 'admin' }
  expect(() => updateRoleAuthorization(user, { ...grant, businessBasis: '' })).toThrow()
  updateRoleAuthorization(user, grant)
  updateRoleAuthorization(user, { ...grant, businessBasis: 'WO-2' })
  expect(user.roleGrants).toHaveLength(2)
  expect(user.roleGrants.map(g => g.basisId)).toEqual(['WO-1', 'WO-2'])
  expect(user.roles).toEqual(['普通员工'])
  updateRoleAuthorization(user, { role: '普通员工', mode: 'revoke', basisIds:[user.roleGrants[0].id] })
  expect(user.roles).toEqual(['普通员工'])
  updateRoleAuthorization(user, { role: '普通员工', mode: 'revoke', basisIds:[user.roleGrants[1].id] })
  expect(user.roleGrants.every(g => g.status === '已回收')).toBeTruthy()
  expect(user.roles).toEqual([])
})

test('调岗先限制并按依据回收，同一角色的其他依据保留且事件幂等', () => {
  const user = normalizeUser({ id: 'hr-user', type: '正式员工', employee: 'H1', dept: '旧部门', status: '暂停', roles: ['普通员工', '旧岗位角色', '独立角色'], roleGrants: [
    { id: 'a', role: '普通员工', basisType: '部门', department: '旧部门', basisId: 'old-dept', status: '有效' },
    { id: 'b', role: '普通员工', basisType: '任职', basisId: 'employment', status: '有效' },
    { id: 'c', role: '旧岗位角色', basisType: '岗位', department: '旧部门', basisId: 'old-position', status: '有效' },
    { id: 'd', role: '独立角色', basisType: '手工授权', basisId: 'approval-1', status: '有效' },
  ] })
  const event = { id: 'HR-1', from: '旧部门', to: '新部门', oldPositionId: 'old-position' }
  const result = applyHrTransfer(user, event)
  expect(result.revoked).toHaveLength(2)
  expect(result.restrictedRoles).toEqual(['普通员工', '独立角色'])
  expect(user.roles).toEqual(['普通员工', '独立角色'])
  expect(user.roleGrants.filter(g => g.status === '已回收')).toHaveLength(2)
  expect(user.dept).toBe('新部门')
  expect(user.status).toBe('暂停')
  expect(event.state).toBe('待新部门授权')
  const snapshot = JSON.stringify({ user, event })
  expect(applyHrTransfer(user, event)).toBeNull()
  expect(JSON.stringify({ user, event })).toBe(snapshot)
})

test('历史临时账号转为手动来源并清空工号，未知来源的角色依据不凭空删除', () => {
  const user = normalizeUser({ id: 'old', type: '临时账号', employee: 'OLD01', roles: ['运维工程师'] })
  expect(user.source).toBe('手动')
  expect(user.employee).toBe('')
  expect(user.type).toBeUndefined()
  expect(user.roleGrants[0].basisType).toBe('历史授权')
})

test('再次调岗回收前次岗位依据，独立手工依据保留且不允许无依据回收', () => {
  const user = normalizeUser({ id: 'transfer-again', dept: '财务部', roles: [] })
  updateRoleAuthorization(user, { role: '普通员工', mode: 'grant', sourceType: '人员调职', businessBasis: 'HR-previous', department: '财务部' })
  updateRoleAuthorization(user, { role: '普通员工', mode: 'grant', sourceType: '手工授权', businessBasis: 'WORK-independent' })
  expect(() => updateRoleAuthorization(user, { role: '普通员工', mode: 'revoke' })).toThrow('回收必须指定授权依据')
  const result = applyHrTransfer(user, { id: 'next', from: '财务部', to: '信息技术部' })
  expect(result.revoked.map(g => g.basisId)).toEqual(['HR-previous'])
  expect(user.roles).toEqual(['普通员工'])
  expect(user.roleGrants.find(g => g.basisId === 'WORK-independent').status).toBe('有效')
})
