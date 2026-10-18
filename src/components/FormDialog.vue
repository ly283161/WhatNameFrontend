<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'
import { errorText } from '../composables/useList.js'
const props = defineProps({ title: String, fields: Array, initial: Object, submit: Function, note: String })
const emit = defineEmits(['close', 'saved'])
const values = ref(JSON.parse(JSON.stringify(props.initial || {}))), busy = ref(false), error = ref(''), panel = ref()
const previous = document.activeElement
onMounted(() => panel.value?.querySelector('input,select,textarea,button')?.focus())
onBeforeUnmount(() => previous?.focus?.())
async function save() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    const body = { ...values.value }
    for (const field of props.fields) {
      if (field.type === 'number') body[field.key] = Number(body[field.key])
      if (typeof body[field.key] === 'string') body[field.key] = body[field.key].trim()
      if (field.required !== false && field.type !== 'multi' && (body[field.key] === '' || body[field.key] === undefined)) throw new Error('请填写' + field.label)
    }
    const result = await props.submit(body)
    emit('saved', result); emit('close')
  } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
function keys(event) {
  if (event.key === 'Escape' && !busy.value) emit('close')
  if (event.key !== 'Tab') return
  const controls = [...panel.value.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')]
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>
<template>
  <div class="modal-backdrop" @keydown="keys"><section ref="panel" class="modal stage-form" role="dialog" aria-modal="true" aria-labelledby="form-title"><div class="modal-heading"><h3 id="form-title">{{ title }}</h3><button type="button" aria-label="关闭" :disabled="busy" @click="emit('close')"><X :size="20" /></button></div>
    <form @submit.prevent="save"><p v-if="note" class="form-note">{{ note }}</p>
      <template v-for="field in fields" :key="field.key">
        <fieldset v-if="field.type === 'multi'"><legend>{{ field.label }}</legend><p v-if="!field.options?.length" class="muted">暂无可选项</p><div class="checkbox-grid"><label v-for="option in field.options" :key="option.value"><input v-model="values[field.key]" type="checkbox" :value="option.value" :disabled="busy" />{{ option.label }}</label></div></fieldset>
        <label v-else>{{ field.label }}<select :aria-label="field.label" v-if="field.options" v-model="values[field.key]" :required="field.required !== false" :disabled="busy"><option value="" disabled>请选择</option><option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option></select><textarea :aria-label="field.label" v-else-if="field.type === 'textarea'" v-model="values[field.key]" :required="field.required !== false" :disabled="busy" maxlength="1000" rows="3" /><input :aria-label="field.label" v-else v-model="values[field.key]" :type="field.type || 'text'" :required="field.required !== false" :disabled="busy" :pattern="field.pattern" :min="field.min" :max="field.max" :maxlength="field.maxlength || 200" /></label>
      </template>
      <p v-if="error" role="alert" class="app-error">{{ error }}</p><div class="modal-actions"><button type="button" class="button light" :disabled="busy" @click="emit('close')">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '正在提交…' : '确认提交' }}</button></div>
    </form>
  </section></div>
</template>
