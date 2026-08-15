<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['change'])
const pageCount = computed(() => Math.max(1, Math.ceil(Number(props.total || 0) / Number(props.pageSize || 20))))
const canPrev = computed(() => props.page > 1 && !props.loading)
const canNext = computed(() => props.page < pageCount.value && !props.loading)
const go = (page) => {
  const next = Math.min(pageCount.value, Math.max(1, Number(page) || 1))
  if (next !== props.page && !props.loading) emit('change', next)
}
</script>

<template>
  <div class="directory-pagination" v-if="total || loading">
    <span>共 {{ total }} 条</span>
    <div class="button-pair">
      <button class="ghost" type="button" :disabled="!canPrev" @click="go(page - 1)">上一页</button>
      <span class="directory-page-number">{{ page }} / {{ pageCount }}</span>
      <button class="ghost" type="button" :disabled="!canNext" @click="go(page + 1)">下一页</button>
    </div>
  </div>
</template>
