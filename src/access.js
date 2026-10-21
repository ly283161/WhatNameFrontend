import { session } from './session.js'
export const pages = [
  { id: 'users', label: '用户账号', code: 'IAM_USERS_VIEW', path: '/users' },
  { id: 'roles', label: '角色管理', code: 'IAM_ROLES_VIEW', path: '/roles' },
  { id: 'resources', label: '应用管理', code: 'IAM_RESOURCES_VIEW', path: '/resources' },
  { id: 'grants', label: '权限分配', code: 'IAM_GRANTS_VIEW', path: '/grants' },
  { id: 'organization', label: '人员与组织变动', code: 'IAM_DEPTS_VIEW', path: '/departments' },
  { id: 'admins', label: '管理员管理', code: 'IAM_ADMINS_VIEW', path: '/admins' },
  { id: 'audit', label: '操作日志', code: 'IAM_AUDIT_VIEW', path: '/audit' },
]
// 前端权限控制入口显示，接口访问权限由后端独立校验。
export const can = code => !session.accessError && session.menus.some(menu => menu.menuCode === code && menu.navigationOnly !== true && menu.menuType !== 1)
export const canVisit = page => can(page.code)
export const canGlobal = code => can(code) && session.scope?.appointed === true && session.scope.adminLevel === 1
