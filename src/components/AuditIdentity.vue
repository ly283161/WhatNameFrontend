<script setup>
defineProps({ userId: [String, Number], info: Object, canView: Boolean })
</script>
<template>
  <div class="audit-identity">
    <template v-if="userId != null && userId !== ''"
      ><strong>{{ info?.user?.realName || info?.user?.username || '用户 ID：' + userId }}</strong
      ><small v-if="info?.user?.realName && info?.user?.username">{{ info.user.username }}</small
      ><small v-if="info?.user">用户 ID：{{ userId }}</small
      ><small v-else :title="info?.error">{{
        info?.loading ? '正在读取账号资料…' : canView ? '账号资料不可查询' : '无账号查询权限'
      }}</small></template
    ><span v-else class="muted">未关联用户</span>
  </div>
</template>
<style scoped>
.audit-identity {
  display: grid;
  gap: 4px;
  min-width: 120px;
  overflow-wrap: anywhere;
}
.audit-identity small {
  color: var(--muted);
  font-size: 11px;
}
</style>
