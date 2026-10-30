<script setup>
import AppIcon from './AppIcon.vue'
import EmptyState from './EmptyState.vue'
import SkeletonList from './SkeletonList.vue'

// 列表区域的加载中 / 出错 / 为空三态，统一样式和重试入口。
// 默认插槽放真正的内容；empty 插槽可以替换空态里的操作按钮。
defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  empty: { type: Boolean, default: false },
  rows: { type: Number, default: 5 },
  skeletonVariant: { type: String, default: undefined },
  emptyIcon: { type: String, default: 'file' },
  emptyTitle: { type: String, default: '暂无数据' },
  emptyDescription: { type: String, default: '' },
  retryLabel: { type: String, default: '重试' }
})

const emit = defineEmits(['retry'])
</script>

<template>
  <SkeletonList v-if="loading" :rows="rows" :variant="skeletonVariant" />
  <div v-else-if="error" class="async-state-error" role="alert">
    <strong>{{ error }}</strong>
    <button class="ghost" type="button" @click="emit('retry')"><AppIcon name="retry" :size="15" />{{ retryLabel }}</button>
  </div>
  <EmptyState v-else-if="empty" :icon="emptyIcon" :title="emptyTitle" :description="emptyDescription">
    <slot name="empty" />
  </EmptyState>
  <slot v-else />
</template>
