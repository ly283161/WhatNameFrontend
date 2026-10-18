<script setup>
defineProps({ title: String, entries: Array })
defineEmits(['close'])
</script>
<template><section class="panel detail-panel"><div class="panel-heading"><h3>{{ title }}</h3><button class="text-button" @click="$emit('close')">关闭详情</button></div><dl><template v-for="[label, value] in entries" :key="label"><dt>{{ label }}</dt><dd>{{ value ?? '—' }}</dd></template></dl></section></template>
