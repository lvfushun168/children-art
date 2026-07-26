<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean],
    default: ''
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
        disabled: Boolean(option.disabled)
      }
    }
    return { value: option, label: String(option), disabled: false }
  })
)

const selectedOption = computed(() =>
  normalizedOptions.value.find((option) => option.value === props.modelValue) ||
  normalizedOptions.value.find((option) => String(option.value) === String(props.modelValue))
)

const displayLabel = computed(() => selectedOption.value?.label || props.placeholder)

const choose = (option) => {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  open.value = false
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
  <div ref="selectRef" class="adaptive-select" :class="{ open, disabled }">
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

    <div v-if="open" class="adaptive-select-menu" role="listbox">
      <button
        v-for="option in normalizedOptions"
        :key="`${option.value}-${option.label}`"
        type="button"
        :disabled="option.disabled"
        :class="{ selected: option.value === modelValue || String(option.value) === String(modelValue) }"
        @click="choose(option)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
