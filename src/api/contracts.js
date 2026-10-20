import { ApiError } from './client.js'

export function count(value, field = '数量') {
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) value = Number(value)
  if (!Number.isSafeInteger(value) || value < 0) throw new ApiError(field + '不符合接口约定')
  return value
}
export function pageResult(data, page, pageSize = 20, collection = 'items') {
  if (!data || !Array.isArray(data[collection]) || data.page !== page || data.pageSize !== pageSize) throw new ApiError('列表响应不符合接口约定')
  return { ...data, total: count(data.total, '总数') }
}
export function recordId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) throw new ApiError('ID 必须是正整数十进制字符串')
  return value
}
export function idsFromText(text) {
  const values = [...new Set(text.split(/[\s,，;；]+/).filter(Boolean))]
  if (!values.length) throw new ApiError('请至少提供一个用户 ID')
  return values.map(recordId)
}
export async function readAll(request, path, query = {}, signal) {
  const rows = []; let expectedTotal
  for (let page = 1; ; page++) {
    const data = pageResult(await request(path, { query: { ...query, page, pageSize: 500 }, signal }), page, 500)
    if (expectedTotal !== undefined && data.total !== expectedTotal) throw new ApiError('读取期间列表发生变化，请重新加载')
    expectedTotal = data.total; rows.push(...data.items)
    if (rows.length >= data.total) return rows
    if (!data.items.length) throw new ApiError('分页数据不完整，请重新加载')
  }
}
