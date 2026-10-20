import { reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import { api, session } from '../session.js'
import { pageResult } from '../api/contracts.js'

export function useList(path, params = () => ({}), { collection = 'items', paginated = true, auto = true } = {}) {
  let controller, sequence = 0, disposed = false
  const state = reactive({ rows: [], data: null, page: 1, total: 0, busy: false, error: '', async load(page = 1) {
    if (disposed) return
    controller?.abort(); controller = new AbortController()
    const current = ++sequence
    state.busy = true; state.error = ''; state.rows = []; state.total = 0; state.data = null
    try {
      let data = await api(typeof path === 'function' ? path() : path, { query: { ...params(), ...(paginated ? { page, pageSize: 20 } : {}) }, signal: controller.signal })
      if (current !== sequence) return
      if (paginated) data = pageResult(data, page, 20, collection)
      else if (!data || !Array.isArray(data[collection])) throw new Error('列表响应不符合接口约定')
      state.data = data; state.rows = data[collection]; state.page = page; state.total = paginated ? data.total : data[collection].length
    } catch (e) { if (current === sequence) state.error = errorText(e) }
    finally { if (current === sequence) state.busy = false }
  } })
  watch(() => session.accessVersion, () => { if (auto || state.data || state.busy) void state.load() })
  if (auto) onMounted(() => state.load())
  onBeforeUnmount(() => { disposed = true; sequence++; controller?.abort() })
  return state
}
export const errorText = e => `${e.message}${e.code === 'VERSION_CONFLICT' ? '；请关闭表单，重新读取最新记录后再操作' : ''}${e.requestId ? `（请求编号：${e.requestId}）` : ''}`
export const id = value => encodeURIComponent(String(value))
export const statusText = value => ({ 0: '停用', 1: '可用', 2: '暂停', 3: '离职' })[value] || '未知状态'
