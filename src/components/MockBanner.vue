<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
const banner = ref(null)
let observer
onMounted(() => {
  observer = new ResizeObserver(() => document.documentElement.style.setProperty('--mock-banner-height', `${banner.value.offsetHeight}px`))
  observer.observe(banner.value)
})
onBeforeUnmount(() => { observer?.disconnect(); document.documentElement.style.removeProperty('--mock-banner-height') })
</script>
<template><div ref="banner" class="mock-banner" role="note">第一阶段模拟接口环境 · 数据已脱敏 · 测试登录：admin / Admin123! · 测试验证码：123456</div></template>
