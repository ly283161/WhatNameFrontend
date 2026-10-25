<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
const props = defineProps({ title: String, fields: Array, initial: Object, save: Function })
const emit = defineEmits(['close', 'saved'])
const form = ref(JSON.parse(JSON.stringify(props.initial || {}))),
  busy = ref(false),
  error = ref('')
let previousFocus
onMounted(() => {
  previousFocus = document.activeElement
  document.querySelector('[role="dialog"] input, [role="dialog"] select')?.focus()
})
onUnmounted(() => previousFocus?.focus())
async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await props.save(form.value)
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
function keydown(e) {
  if (e.key === 'Escape' && !busy.value) emit('close')
  if (e.key !== 'Tab') return
  const items = [...e.currentTarget.querySelectorAll('input,select,textarea,button')].filter(
    (el) => !el.disabled && el.offsetParent !== null,
  )
  const first = items[0],
    last = items.at(-1)
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last?.focus()
  }
  if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first?.focus()
  }
}
</script>
<template>
  <div class="overlay" @click.self="!busy && emit('close')">
    <section
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      @keydown="keydown"
    >
      <header>
        <h2 id="dialog-title">{{ title }}</h2>
        <button type="button" :disabled="busy" aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <form @submit.prevent="submit">
        <template v-for="field in fields" :key="field.key">
          <fieldset v-if="field.type === 'checks'">
            <legend>{{ field.label }}</legend>
            <p v-if="field.hint" class="muted">{{ field.hint }}</p>
            <div class="check-list">
              <label v-for="option in field.options" :key="option.value" class="check"
                ><input
                  v-model="form[field.key]"
                  type="checkbox"
                  :value="String(option.value)"
                  :disabled="busy"
                />{{ option.label }}</label
              >
            </div>
          </fieldset>
          <label v-else class="field"
            >{{ field.label }}
            <select
              v-if="field.type === 'select'"
              v-model="form[field.key]"
              :required="!field.optional"
              :disabled="busy"
            >
              <option
                v-for="option in field.options"
                :key="option.value"
                :value="String(option.value)"
              >
                {{ option.label }}
              </option>
            </select>
            <textarea
              v-else-if="field.type === 'textarea'"
              v-model="form[field.key]"
              :disabled="busy"
              :maxlength="field.max || 512"
            />
            <input
              v-else
              v-model="form[field.key]"
              :type="field.type || 'text'"
              :required="!field.optional"
              :disabled="busy"
              :maxlength="field.max || 128"
              :minlength="field.type === 'password' ? 8 : undefined"
              :autocomplete="field.type === 'password' ? 'new-password' : 'off'"
            />
            <small v-if="field.hint">{{ field.hint }}</small>
          </label>
        </template>
        <p v-if="error" role="alert" class="error">{{ error }}</p>
        <footer>
          <button type="button" :disabled="busy" @click="emit('close')">取消</button
          ><button class="primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button>
        </footer>
      </form>
    </section>
  </div>
</template>
