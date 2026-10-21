export const id = value => encodeURIComponent(String(value))

export const errorText = error =>
  `${error.message}${error.code === 'VERSION_CONFLICT' ? '；请关闭表单，重新读取最新记录后再操作' : ''}${error.requestId ? `（请求编号：${error.requestId}）` : ''}`

export const statusText = value => ({ 0: '停用', 1: '可用', 2: '暂停', 3: '离职' })[value] || '未知状态'
export const sourceText = value => ({ 1: 'HR 同步', 2: '临时', 3: '受控初始化' })[value] || '未提供'
