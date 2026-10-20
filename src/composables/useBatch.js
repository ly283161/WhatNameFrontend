import { reactive, onBeforeUnmount, watch } from 'vue'
import { api, session } from '../session.js'
import { ApiError } from '../api/client.js'
import { count, pageResult, recordId } from '../api/contracts.js'
import { errorText, id } from './useList.js'

const terminal = value => ['COMPLETED', 'PARTIAL_SUCCESS', 'FAILED'].includes(value)
export function useBatch() {
  let disposed = false, timer, controller, sequence = 0, original = null
  const keys = new Map()
  const storageKey = () => 'iam-batch-id:' + session.userId
  const state = reactive({ result: null, busy: false, error: '', querying: false, canRetry: false, updatedAt: '',
    async submit(command, { fresh = false } = {}) {
      const body = JSON.parse(JSON.stringify(command))
      body.targets.sort((a, b) => BigInt(a.userId) < BigInt(b.userId) ? -1 : BigInt(a.userId) > BigInt(b.userId) ? 1 : 0)
      const signature = JSON.stringify(body)
      if (fresh || !keys.has(signature)) keys.set(signature, crypto.randomUUID())
      clearTimeout(timer); controller?.abort(); sequence++
      state.busy = true; state.error = ''; original = body
      try {
        const data = await api('/grants/user-roles/batch', { method: 'POST', body, headers: { 'Idempotency-Key': keys.get(signature) }, allowPending: true })
        if (disposed) return data
        recordId(data.batchId)
        state.result = { ...data, total: count(data.total), items: data.items || [] }
        state.canRetry = terminal(data.processingStatus) && count(data.failed ?? 0) > 0
        state.updatedAt = new Date().toLocaleTimeString('zh-CN')
        try { sessionStorage.setItem(storageKey(), data.batchId) } catch { /* Optional task lookup only. */ }
        schedule()
        return data
      } finally { state.busy = false }
    },
    async load(page = state.result?.page || 1) {
      if (!state.result?.batchId || disposed) return
      clearTimeout(timer); controller?.abort(); controller = new AbortController()
      const current = ++sequence, batchId = state.result.batchId
      state.busy = true; state.error = ''
      try {
        const data = pageResult(await api('/grants/batches/' + id(batchId), { query: { page, pageSize: 20 }, signal: controller.signal }), page)
        if (current !== sequence || disposed) return
        for (const key of ['succeeded', 'failed', 'pending']) data[key] = count(data[key], '任务计数')
        if (data.batchId !== batchId || !['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL_SUCCESS', 'FAILED'].includes(data.processingStatus) || data.items.some(item => typeof item.userId !== 'string' || !['PENDING', 'APPLIED', 'FAILED'].includes(item.status))) throw new ApiError('批量结果不符合接口约定')
        state.result = data; state.canRetry = !!original && terminal(data.processingStatus) && data.pending === 0 && data.failed > 0
        state.updatedAt = new Date().toLocaleTimeString('zh-CN')
        schedule()
      } catch (e) {
        if (current !== sequence || disposed) return
        if ([401, 403, 404].includes(e.status)) { state.result = null; state.canRetry = false }
        state.error = errorText(e) + '；查询失败不会重新提交任务'
        state.querying = false
      } finally { if (current === sequence) state.busy = false }
    },
    async resume() {
      let batchId
      try { batchId = sessionStorage.getItem(storageKey()) } catch { return }
      if (!batchId) return
      try { recordId(batchId) } catch { return }
      original = null; state.result = { batchId, processingStatus: 'PENDING', items: [] }
      await state.load(1)
    },
    async failedCommand() {
      if (!state.canRetry || !original || !state.result) throw new ApiError('仅可在原提交页面重试已确认失败的目标')
      const batchId = state.result.batchId, failedIds = new Set(); let total
      for (let page = 1; ; page++) {
        const data = pageResult(await api('/grants/batches/' + id(batchId), { query: { page, pageSize: 500 } }), page, 500)
        if (disposed) throw new ApiError('页面已离开，操作已取消')
        if (!terminal(data.processingStatus) || count(data.pending) !== 0) throw new ApiError('任务仍在执行，不能重新提交')
        if (total !== undefined && total !== data.total) throw new ApiError('任务可见范围发生变化，请重新查询后操作')
        total = data.total
        data.items.filter(item => item.status === 'FAILED').forEach(item => failedIds.add(item.userId))
        if (page * 500 >= data.total) break
        if (!data.items.length) throw new ApiError('任务分页结果不完整')
      }
      const targets = original.targets.filter(target => failedIds.has(target.userId))
      if (!targets.length) throw new ApiError('当前没有可重试的已知失败目标')
      return { ...JSON.parse(JSON.stringify(original)), targets }
    },
  })
  function schedule() {
    clearTimeout(timer)
    state.querying = !!state.result && !terminal(state.result.processingStatus)
    if (!state.querying || disposed || document.hidden) return
    timer = setTimeout(() => { void state.load(state.result?.page || 1) }, 2000)
  }
  watch(() => session.accessVersion, () => {
    if (!state.result?.batchId) return
    state.result = { batchId: state.result.batchId, processingStatus: 'PENDING', items: [] }; state.canRetry = false
    void state.load(1)
  })
  const visible = () => { if (document.hidden) clearTimeout(timer); else if (state.querying && !state.busy) void state.load(state.result?.page || 1) }
  document.addEventListener('visibilitychange', visible)
  onBeforeUnmount(() => { disposed = true; sequence++; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visible) })
  return state
}
