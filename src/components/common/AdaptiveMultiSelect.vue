<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  options: {
    type: Array,
    required: true
  },
  placeholder: {
    type: String,
    default: '请选择'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const selectRef = ref(null)

const normalizedOptions = computed(() =>
  props.options.map((option) => {
    if (option && typeof option === 'object') {
      const value = Object.prototype.hasOwnProperty.call(option, 'value') ? option.value : option.id
      return {
        value,
        label: option.label ?? option.name ?? String(value ?? ''),
        description: option.description ?? option.desc ?? option.meta ?? '',
        disabled: Boolean(option.disabled)
      }
    }
    return { value: option, label: String(option), description: '', disabled: false }
  })
)

const hasValue = (value) => props.modelValue.some((item) => item === value || String(item) === String(value))
const selectedOptions = computed(() => normalizedOptions.value.filter((option) => hasValue(option.value)))
const displayLabel = computed(() =>
  selectedOptions.value.length ? `已选 ${selectedOptions.value.length} 项` : props.placeholder
)

const toggle = (option) => {
  if (option.disabled) return
  const next = hasValue(option.value)
    ? props.modelValue.filter((item) => !(item === option.value || String(item) === String(option.value)))
    : [...props.modelValue, option.value]
  emit('update:modelValue', next)
  emit('change', next)
}

const closeFromOutside = (event) => {
  if (!open.value || selectRef.value?.contains(event.target)) return
  open.value = false
}

const closeFromKeyboard = (event) => {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', closeFromOutside)
  document.addEventListener('keydown', closeFromKeyboard)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeFromOutside)
  document.removeEventListener('keydown', closeFromKeyboard)
})
</script>

<template>
  <div ref="selectRef" class="adaptive-select adaptive-multi-select" :class="{ open, disabled }">
    <button
      type="button"
      class="adaptive-select-trigger"
      :disabled="disabled"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span>{{ displayLabel }}</span>
      <b>⌄</b>
    </button>

    <div v-if="open" class="adaptive-select-menu" role="listbox" aria-multiselectable="true">
      <button
        v-for="option in normalizedOptions"
        :key="`${option.value}-${option.label}`"
        type="button"
        :disabled="option.disabled"
        :class="{ selected: hasValue(option.value) }"
        @click="toggle(option)"
      >
        <span>
          <strong>{{ option.label }}</strong>
          <small v-if="option.description">{{ option.description }}</small>
        </span>
        <i>{{ hasValue(option.value) ? '✓' : '+' }}</i>
      </button>
    </div>
  </div>
</template>
