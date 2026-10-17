export function isManualAccount(user) {
  return user.source === '手动' && !user.employee
}

export function normalizeUser(user) {
  const manual = user.source === '手动' || user.type === '临时账号'
  const normalized = { ...user, source: manual ? '手动' : 'HR', personType: user.personType || (manual ? '' : user.type === '外包员工' ? '外包' : '正式') }
  if (manual) normalized.employee = ''
  delete normalized.type
  // Legacy role associations have no reliable department provenance: preserve them.
  normalized.roleGrants = user.roleGrants || (user.roles || []).map((role, i) => ({ id: `${user.id}-legacy-${i}`, role, basisType: '历史授权', basisId: `legacy-${i}`, status: '有效' }))
  normalized.roles = effectiveRoles(normalized)
  return normalized
}

export function effectiveRoles(user) {
  return [...new Set((user.roleGrants || []).filter(g => g.status === '有效').map(g => g.role))]
}

export function updateRoleAuthorization(user, { role, mode, sourceType, businessBasis, actor, basisIds, revocationBasis, reason, department }) {
  if (mode === 'grant') {
    if (!sourceType?.trim() || !businessBasis?.trim()) throw new Error('请填写授权来源类型和业务依据')
    if (!user.roleGrants.some(g => g.role === role && g.basisType === sourceType.trim() && g.basisId === businessBasis.trim() && g.status === '有效')) {
      user.roleGrants.push({ id: crypto.randomUUID(), role, basisType: sourceType.trim(), basisId: businessBasis.trim(), actor, reason, department, status: '有效' })
    }
  } else {
    if (!basisIds?.length) throw new Error('回收必须指定授权依据')
    user.roleGrants.filter(g => g.role === role && g.status === '有效' && (!basisIds || basisIds.includes(g.id))).forEach(g => { g.status = '已回收'; if (revocationBasis) { g.revocationBasis = revocationBasis.trim(); g.revokedBy = actor } })
  }
  user.roles = effectiveRoles(user)
}

export function applyHrTransfer(user, event) {
  if (event.processed) return null
  const affected = user.roleGrants.filter(g => g.status === '有效' && ['部门', '岗位', '人员调职'].includes(g.basisType) && (g.department === event.from || (event.oldPositionId && g.basisId === event.oldPositionId)))
  // First restrict the invalidated basis, then reclaim only that basis.
  affected.forEach(g => { g.status = '受限' })
  user.roles = effectiveRoles(user)
  const restrictedRoles = [...user.roles]
  affected.forEach(g => { g.status = '已回收'; g.revokedByEvent = event.id })
  user.roles = effectiveRoles(user)
  user.dept = event.to
  event.userId = user.id
  event.processed = true
  event.state = '待新部门授权'
  event.recoveryResult = { revoked: affected.map(g => ({ role: g.role, basisType: g.basisType, basisId: g.basisId })), retainedRoles: [...user.roles], restrictedRoles }
  event.transferResult = { department: user.dept, status: user.status, stage: event.state }
  return event.recoveryResult
}

export async function phoneFingerprint(phone) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(phone))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Local prototype of the server response. Production creates the account server-side.
export async function createTemporaryAccount({ name, phone, dept, purpose }, users) {
  const fingerprint = await phoneFingerprint(phone)
  if (users.some(u => u.phoneFingerprint === fingerprint)) throw new Error('手机号已存在，请使用全局唯一的手机号')
  if (users.some(u => !u.phoneFingerprint && u.phone === phone.slice(0, 3) + '****' + phone.slice(-4))) throw new Error('历史脱敏手机号无法确认唯一性，需通过后端核验')
  const base = 'u' + phone.slice(-8)
  let account = base, suffix = 1
  while (users.some(u => u.account === account)) account = base + '_' + suffix++
  return { id: 'T' + crypto.randomUUID(), name: name.trim(), account, employee: '', phone: phone.slice(0, 3) + '****' + phone.slice(-4), phoneFingerprint: fingerprint, dept, purpose: purpose.trim(), source: '手动', personType: '', status: '可用', credentialStatus: '未设密', roles: [], roleGrants: [], color: 'blue' }
}
