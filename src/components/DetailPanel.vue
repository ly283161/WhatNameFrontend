<script setup>
import { ref } from 'vue'
const props = defineProps({ title: String, entries: Array, collapsible: Boolean })
const expanded = ref(true)
const emit = defineEmits(['close'])
function toggle() {
  if (props.collapsible) expanded.value = !expanded.value
  else emit('close')
}
</script>
<template>
  <section class="panel detail-panel">
    <div class="panel-heading">
      <h3>{{ title }}</h3>
      <button
        class="text-button"
        :aria-expanded="collapsible ? expanded : undefined"
        @click="toggle"
      >
        {{ collapsible ? (expanded ? '收起' : '展开') : '关闭详情' }}
      </button>
    </div>
    <dl v-if="!collapsible || expanded">
      <template v-for="[label, value] in entries" :key="label"
        ><dt>{{ label }}</dt>
        <dd>{{ value ?? '—' }}</dd></template
      >
    </dl>
  </section>
</template>

<style scoped>
dd {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 24rem;
  overflow: auto;
}
</style>
