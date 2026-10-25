<script setup>
defineProps({ rows: Array, columns: Array, loading: Boolean })
</script>
<template>
  <div class="table-wrap" :aria-busy="loading">
    <table>
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" scope="col">{{ c.label }}</th>
          <th v-if="$slots.actions" scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td v-for="c in columns" :key="c.key">
            {{ c.format ? c.format(row[c.key], row) : (row[c.key] ?? '—') }}
          </td>
          <td v-if="$slots.actions" class="actions"><slot name="actions" :row="row" /></td>
        </tr>
        <tr v-if="!rows?.length">
          <td :colspan="columns.length + ($slots.actions ? 1 : 0)" class="empty">
            {{ loading ? '正在加载…' : '暂无记录' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
