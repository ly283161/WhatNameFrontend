<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { session } from '../session.js'
defineProps({ title: String })
const emit = defineEmits(['close']),
  panel = ref(null)
const previous = document.activeElement,
  overflow = document.body.style.overflow
onMounted(() => {
  panel.value.showModal()
  document.body.style.overflow = 'hidden'
})
watch(
  () => session.accessVersion,
  () => emit('close'),
)
onBeforeUnmount(() => {
  panel.value?.close()
  document.body.style.overflow = overflow
  previous?.focus?.()
})
function backdrop(event) {
  if (event.target === panel.value) {
    const rect = panel.value.getBoundingClientRect()
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      emit('close')
  }
}
</script>
<template>
  <dialog
    ref="panel"
    class="modal resource-modal content-dialog"
    :aria-label="title"
    @cancel.prevent="emit('close')"
    @click="backdrop"
  >
    <div class="modal-heading">
      <h2>{{ title }}</h2>
      <button class="icon-button" type="button" :aria-label="'关闭' + title" @click="emit('close')">
        <X :size="20" />
      </button>
    </div>
    <div class="resource-modal-body"><slot /></div>
  </dialog>
</template>
<style scoped>
.content-dialog {
  border: 0;
  padding: 0;
  margin: auto;
  max-width: calc(100vw - 32px);
  color: inherit;
}
.content-dialog::backdrop {
  background: #142a2460;
  backdrop-filter: blur(3px);
}
</style>
