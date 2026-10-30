<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const AUTO_SEARCH_MIN_OPTIONS = 8
const MENU_ESTIMATED_HEIGHT = 300
const TYPEAHEAD_RESET_MS = 700

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
  },
  // 'auto'：选项不少于 8 个时出现搜索框；也可以直接传 true / false。
  searchable: {
    type: [Boolean, String],
    default: 'auto'
  },
  searchPlaceholder: {
    type: String,
    default: '搜索'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const uid = useId()
const listId = `${uid}-list`
const optionId = (index) => `${uid}-option-${index}`

const open = ref(false)
const dropUp = ref(false)
const search = ref('')
const activeIndex = ref(-1)
const rootRef = ref(null)
const triggerRef = ref(null)
const searchRef = ref(null)
const listRef = ref(null)

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

const isSearchable = computed(() =>
  props.searchable === true || (props.searchable === 'auto' && normalizedOptions.value.length >= AUTO_SEARCH_MIN_OPTIONS)
)

const visibleOptions = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  if (!isSearchable.value || !keyword) return normalizedOptions.value
  return normalizedOptions.value.filter((option) =>
    `${option.label} ${option.description}`.toLocaleLowerCase().includes(keyword)
  )
})

const isSelected = (option) =>
  option.value === props.modelValue || String(option.value) === String(props.modelValue)

const selectedOption = computed(() => normalizedOptions.value.find(isSelected))
const displayLabel = computed(() => selectedOption.value?.label || props.placeholder)
const activeId = computed(() => (activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined))

const enabledIndexes = () =>
  visibleOptions.value.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0)

const setActive = (index) => {
  activeIndex.value = index
}

const moveActive = (step) => {
  const indexes = enabledIndexes()
  if (!indexes.length) return
  const position = indexes.indexOf(activeIndex.value)
  const next = position < 0
    ? (step > 0 ? 0 : indexes.length - 1)
    : (position + step + indexes.length) % indexes.length
  setActive(indexes[next])
}

const focusAfterOpen = async () => {
  await nextTick()
  if (isSearchable.value) searchRef.value?.focus()
  else triggerRef.value?.focus()
}

const openMenu = () => {
  if (props.disabled || open.value) return
  search.value = ''
  const rect = triggerRef.value?.getBoundingClientRect()
  if (rect) {
    const below = window.innerHeight - rect.bottom
    dropUp.value = below < MENU_ESTIMATED_HEIGHT && rect.top > below
  }
  open.value = true
  const selectedIndex = visibleOptions.value.findIndex(isSelected)
  setActive(selectedIndex >= 0 ? selectedIndex : (enabledIndexes()[0] ?? -1))
  void focusAfterOpen()
}

const closeMenu = ({ refocus = false } = {}) => {
  if (!open.value) return
  open.value = false
  activeIndex.value = -1
  if (refocus) triggerRef.value?.focus()
}

const choose = (option) => {
  if (!option || option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  closeMenu({ refocus: true })
}

const toggle = () => {
  if (open.value) closeMenu()
  else openMenu()
}

let typeahead = ''
let typeaheadTimer = null
const handleTypeahead = (character) => {
  clearTimeout(typeaheadTimer)
  typeahead += character.toLocaleLowerCase()
  typeaheadTimer = setTimeout(() => { typeahead = '' }, TYPEAHEAD_RESET_MS)
  if (!open.value) openMenu()
  const index = visibleOptions.value.findIndex((option) =>
    !option.disabled && option.label.toLocaleLowerCase().startsWith(typeahead))
  if (index >= 0) setActive(index)
}

const onKeydown = (event) => {
  if (props.disabled) return
  const fromSearch = event.target === searchRef.value
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (open.value) moveActive(1)
      else openMenu()
      break
    case 'ArrowUp':
      event.preventDefault()
      if (open.value) moveActive(-1)
      else openMenu()
      break
    case 'Home':
    case 'End': {
      if (!open.value || fromSearch) break
      event.preventDefault()
      const indexes = enabledIndexes()
      if (indexes.length) setActive(event.key === 'Home' ? indexes[0] : indexes[indexes.length - 1])
      break
    }
    case 'Enter':
      if (!open.value) break
      event.preventDefault()
      choose(visibleOptions.value[activeIndex.value])
      break
    case ' ':
      if (!open.value || fromSearch) break
      event.preventDefault()
      choose(visibleOptions.value[activeIndex.value])
      break
    case 'Escape':
      if (!open.value) break
      // 只关闭下拉，不让 Esc 继续关掉外层的抽屉或弹窗。
      event.preventDefault()
      event.stopPropagation()
      closeMenu({ refocus: true })
      break
    case 'Tab':
      closeMenu()
      break
    default:
      if (!isSearchable.value && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        handleTypeahead(event.key)
      }
  }
}

const closeFromOutside = (event) => {
  if (!open.value || rootRef.value?.contains(event.target)) return
  closeMenu()
}

watch(search, () => {
  const indexes = enabledIndexes()
  setActive(indexes[0] ?? -1)
})

watch(activeIndex, async (index) => {
  if (!open.value || index < 0) return
  await nextTick()
  document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' })
})

onMounted(() => document.addEventListener('pointerdown', closeFromOutside))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeFromOutside)
  clearTimeout(typeaheadTimer)
})
</script>

<template>
  <div ref="rootRef" class="adaptive-select" :class="{ open, disabled, 'drop-up': dropUp }" @keydown="onKeydown">
    <button
      ref="triggerRef"
      type="button"
      class="adaptive-select-trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      :aria-activedescendant="open && !isSearchable ? activeId : undefined"
      :disabled="disabled"
      @click="toggle"
    >
      <span :class="{ 'is-placeholder': !selectedOption }">{{ displayLabel }}</span>
      <b aria-hidden="true">⌄</b>
    </button>

    <div v-if="open" class="adaptive-select-menu">
      <input
        v-if="isSearchable"
        ref="searchRef"
        v-model="search"
        class="adaptive-select-search"
        type="search"
        role="searchbox"
        autocomplete="off"
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
        :aria-controls="listId"
        :aria-activedescendant="activeId"
      />
      <div :id="listId" ref="listRef" class="adaptive-select-list" role="listbox">
        <button
          v-for="(option, index) in visibleOptions"
          :id="optionId(index)"
          :key="`${option.value}-${option.label}`"
          type="button"
          role="option"
          tabindex="-1"
          :aria-selected="isSelected(option)"
          :aria-disabled="option.disabled || undefined"
          :disabled="option.disabled"
          :class="{ selected: isSelected(option), active: index === activeIndex }"
          @mousedown.prevent
          @mousemove="!option.disabled && setActive(index)"
          @click="choose(option)"
        >
          <span>
            <strong>{{ option.label }}</strong>
            <small v-if="option.description">{{ option.description }}</small>
          </span>
        </button>
        <div v-if="!visibleOptions.length" class="adaptive-select-empty">没有匹配项</div>
      </div>
    </div>
  </div>
</template>
