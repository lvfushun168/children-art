<script setup>
import RequiredMark from './RequiredMark.vue'

// 统一的表单项：标签、必填标记、提示语和字段级错误。
// 校验用 useFieldErrors；有错误时提示替换 hint，并给输入控件打上红框。
defineProps({
  label: { type: String, required: true },
  required: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  error: { type: String, default: '' }
})
</script>

<template>
  <label class="form-field" :class="{ 'has-error': error }" :data-invalid="error ? 'true' : undefined">
    <span class="form-field-label">{{ label }}<RequiredMark v-if="required" /></span>
    <slot />
    <small v-if="error" class="form-field-error" role="alert">{{ error }}</small>
    <small v-else-if="hint" class="form-field-hint">{{ hint }}</small>
  </label>
</template>
