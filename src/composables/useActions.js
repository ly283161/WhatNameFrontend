import { ref } from 'vue'
import { errorText } from './useList.js'
export function useActions() {
  const dialog = ref(null), error = ref(''), notice = ref(''), busy = ref(false)
  async function perform(action) {
    if (busy.value) return
    busy.value = true; error.value = ''; notice.value = ''
    try { return await action() } catch (e) { error.value = errorText(e) } finally { busy.value = false }
  }
  function saved() { notice.value = '操作已完成' }
  return { dialog, error, notice, busy, perform, saved }
}
