<script setup>
import { computed, ref, watch } from 'vue'
import AdaptiveSelect from './AdaptiveSelect.vue'
import AppIcon from './AppIcon.vue'
import { DEFAULT_PAGE_SIZE_OPTIONS, buildPageItems, countPages } from '../../utils/pagination.js'

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  // 传入 false 可隐藏“每页条数”选择；列表自己没有接入 size-change 时使用。
  pageSizeOptions: { type: [Array, Boolean], default: () => DEFAULT_PAGE_SIZE_OPTIONS }
})

const emit = defineEmits(['change', 'size-change'])

const pageCount = computed(() => countPages(props.total, props.pageSize))
const items = computed(() => buildPageItems(props.page, pageCount.value))
const canPrev = computed(() => props.page > 1 && !props.loading)
const canNext = computed(() => props.page < pageCount.value && !props.loading)
const sizeChoices = computed(() => {
  if (!Array.isArray(props.pageSizeOptions) || !props.pageSizeOptions.length) return []
  const sizes = new Set([...props.pageSizeOptions, props.pageSize])
  return [...sizes].sort((a, b) => a - b).map((size) => ({ value: size, label: `${size} 条/页` }))
})
const showJump = computed(() => pageCount.value > 7)

const jumpValue = ref('')
watch(() => props.page, () => { jumpValue.value = '' })

const go = (page) => {
  const next = Math.min(pageCount.value, Math.max(1, Number(page) || 1))
  if (next !== props.page && !props.loading) emit('change', next)
}
const jump = () => {
  if (jumpValue.value !== '') go(jumpValue.value)
  jumpValue.value = ''
}
const changeSize = (size) => {
  if (Number(size) !== props.pageSize && !props.loading) emit('size-change', Number(size))
}
</script>

<template>
  <nav v-if="total || loading" class="app-pagination" aria-label="分页">
    <div class="app-pagination-summary">
      <span>共 {{ total }} 条</span>
      <div v-if="sizeChoices.length" class="app-pagination-size">
        <AdaptiveSelect :model-value="pageSize" :options="sizeChoices" :disabled="loading" @update:model-value="changeSize" />
      </div>
    </div>

    <div v-if="pageCount > 1" class="app-pagination-controls">
      <button class="ghost icon-only" type="button" :disabled="!canPrev" aria-label="上一页" @click="go(page - 1)"><AppIcon name="back" :size="15" /></button>
      <span class="app-pagination-compact">{{ page }} / {{ pageCount }}</span>
      <template v-for="(item, index) in items" :key="item === null ? `gap-${index}` : item">
        <span v-if="item === null" class="app-pagination-gap" aria-hidden="true">…</span>
        <button
          v-else
          class="app-pagination-page"
          type="button"
          :class="{ current: item === page }"
          :aria-current="item === page ? 'page' : undefined"
          :disabled="loading"
          @click="go(item)"
        >{{ item }}</button>
      </template>
      <button class="ghost icon-only" type="button" :disabled="!canNext" aria-label="下一页" @click="go(page + 1)"><AppIcon name="next" :size="15" /></button>
      <label v-if="showJump" class="app-pagination-jump">
        <span>跳至</span>
        <input v-model="jumpValue" type="number" inputmode="numeric" min="1" :max="pageCount" :disabled="loading" aria-label="跳转页码" @keydown.enter.prevent="jump" @blur="jump" />
        <span>页</span>
      </label>
    </div>
  </nav>
</template>
