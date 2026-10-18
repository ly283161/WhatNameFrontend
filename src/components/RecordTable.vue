<script setup>
import { statusText } from '../composables/useList.js'
const props = defineProps({ state: Object, columns: Array, selected: Array, rowKey: { type: String, default: 'id' }, paginated: { type: Boolean, default: true } })
const emit = defineEmits(['update:selected'])
function select(row, checked) { const values = new Set(props.selected); checked ? values.add(row[props.rowKey]) : values.delete(row[props.rowKey]); emit('update:selected', [...values]) }
const cell = (row, col) => col.format ? col.format(row[col.key], row) : col.key === 'status' ? statusText(row[col.key]) : row[col.key] ?? '—'
</script>
<template>
  <section class="panel table-panel" :aria-busy="state.busy">
    <div v-if="$slots.toolbar" class="table-toolbar"><slot name="toolbar" /></div>
    <div v-if="state.error" class="list-error"><p role="alert" class="app-error">{{ state.error }}</p><button class="button light" @click="state.load(state.page)">重新加载</button></div>
    <div v-else class="table-scroll"><table><thead><tr><th v-if="selected">选择</th><th v-for="col in columns" :key="col.key">{{ col.label }}</th><th v-if="$slots.actions">操作</th></tr></thead><tbody><tr v-for="row in state.rows" :key="row[rowKey]"><td v-if="selected"><input type="checkbox" :checked="selected.includes(row[rowKey])" :aria-label="'选择' + (row.realName || row.roleName || row[rowKey])" @change="select(row, $event.target.checked)" /></td><td v-for="col in columns" :key="col.key">{{ cell(row, col) }}</td><td v-if="$slots.actions" class="row-actions"><slot name="actions" :row="row" /></td></tr><tr v-if="!state.rows.length"><td :colspan="columns.length + 2" class="empty" role="status">{{ state.busy ? '正在加载…' : '暂无记录' }}</td></tr></tbody></table></div>
    <div v-if="paginated && !state.error" class="table-footer"><span>共 {{ state.total }} 条 · 第 {{ state.page }} 页</span><div class="pagination"><button class="button light" :disabled="state.busy || state.page <= 1" @click="state.load(state.page - 1)">上一页</button><button class="button light" :disabled="state.busy || state.page * 20 >= state.total" @click="state.load(state.page + 1)">下一页</button></div></div>
  </section>
</template>
