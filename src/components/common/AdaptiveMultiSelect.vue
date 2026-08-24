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
  },
  searchable: {
    type: Boolean,
    default: false
  },
  searchPlaceholder: {
    type: String,
    default: '搜索选项'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const selectRef = ref(null)
const searchValue = ref('')

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
const visibleOptions = computed(() => {
  const keyword = searchValue.value.trim().toLocaleLowerCase()
  if (!props.searchable || !keyword) return normalizedOptions.value
  return normalizedOptions.value.filter((option) =>
    `${option.label} ${option.description}`.toLocaleLowerCase().includes(keyword)
  )
})
const displayLabel = computed(() =>
  selectedOptions.value.length ? `已选 ${selectedOptions.value.length} 项` : props.placeholder
)

const closeMenu = () => {
  open.value = false
  searchValue.value = ''
}

const toggleOpen = () => {
  if (open.value) {
    closeMenu()
    return
  }
  open.value = true
}

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
  closeMenu()
}

const closeFromKeyboard = (event) => {
  if (event.key === 'Escape') closeMenu()
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
      @click="toggleOpen"
    >
      <span>{{ displayLabel }}</span>
      <b>⌄</b>
    </button>

    <div v-if="open" class="adaptive-select-menu" role="listbox" aria-multiselectable="true">
      <input
        v-if="searchable"
        v-model="searchValue"
        class="adaptive-select-search"
        type="search"
        :placeholder="searchPlaceholder"
        aria-label="搜索选项"
        @click.stop
      />
      <button
        v-for="option in visibleOptions"
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
      <span v-if="searchable && !visibleOptions.length" class="adaptive-select-empty">暂无匹配选项</span>
    </div>
  </div>
</template>
