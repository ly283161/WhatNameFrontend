import { reactive, watch } from 'vue'
import { api, session } from '../session.js'
import { ApiError } from '../api/client.js'
import { count } from '../api/contracts.js'

// The response contains all results. No background task, polling or reload recovery.
export function useBatch() {
  let original = null
  const state = reactive({
    result: null,
    busy: false,
    error: '',
    querying: false,
    canRetry: false,
    updatedAt: '',
    async submit(command) {
      if (!command.targets?.length || command.targets.length > 100)
        throw new ApiError('每次请选择 1–100 位用户')
      state.busy = true
      state.error = ''
      state.result = null
      state.canRetry = false
      original = JSON.parse(JSON.stringify(command))
      try {
        const data = await api('/grants/user-roles/batch', { method: 'POST', body: original })
        if (
          !Array.isArray(data.items) ||
          data.items.length !== command.targets.length ||
          !['COMPLETED', 'PARTIAL_SUCCESS', 'FAILED'].includes(data.processingStatus) ||
          data.items.some(
            (item) =>
              typeof item.userId !== 'string' || !['APPLIED', 'FAILED'].includes(item.status),
          )
        )
          throw new ApiError('批量结果不符合接口约定')
        state.result = { ...data, succeeded: count(data.succeeded), failed: count(data.failed) }
        state.canRetry = data.failed > 0
        state.updatedAt = new Date().toLocaleTimeString('zh-CN')
        return data
      } finally {
        state.busy = false
      }
    },
    async failedCommand() {
      if (!state.canRetry || !original || !state.result)
        throw new ApiError('仅可重试已明确返回失败的用户')
      const failed = new Set(
        state.result.items.filter((item) => item.status === 'FAILED').map((item) => item.userId),
      )
      return {
        ...original,
        targets: original.targets.filter((target) => failed.has(target.userId)),
      }
    },
  })
  watch(
    () => session.accessVersion,
    () => {
      state.result = null
      state.canRetry = false
      original = null
    },
  )
  return state
}
