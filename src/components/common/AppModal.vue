<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useBackLayer } from '../../composables/useBackLayer'
import AppIcon from './AppIcon.vue'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
const FIRST_FIELD = 'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([disabled])'

const props = defineProps({
  // 条件渲染的弹窗可以不传，组件挂载即视为打开
  open: { type: Boolean, default: true },
  title: { type: String, required: true },
  // 标题上方的小字
  eyebrow: { type: String, default: '' },
  size: { type: String, default: 'md', validator: (value) => ['sm', 'md', 'lg'].includes(value) },
  closeDisabled: { type: Boolean, default: false },
  // 点遮罩是否关闭；有未保存内容的弹窗建议关掉
  dismissOnBackdrop: { type: Boolean, default: true },
  backdropClass: { type: [String, Array, Object], default: '' },
  modalClass: { type: [String, Array, Object], default: '' }
})

const emit = defineEmits(['close'])

const titleId = useId()
const modalRef = ref(null)
let returnFocusTo = null

const requestClose = () => {
  if (!props.closeDisabled) emit('close')
}

useBackLayer(() => props.open, requestClose)

const trapTab = (event) => {
  const nodes = [...(modalRef.value?.querySelectorAll(FOCUSABLE) || [])].filter((node) => node.offsetParent !== null)
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const restoreFocus = () => {
  const target = returnFocusTo
  returnFocusTo = null
  if (target && document.contains(target)) target.focus({ preventScroll: true })
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    returnFocusTo = document.activeElement
    await nextTick()
    const field = modalRef.value?.querySelector(FIRST_FIELD)
    ;(field || modalRef.value)?.focus({ preventScroll: true })
  } else {
    restoreFocus()
  }
}, { immediate: true, flush: 'post' })

onBeforeUnmount(restoreFocus)
</script>

<template>
  <div v-if="open" class="modal-backdrop" :class="backdropClass" @click.self="dismissOnBackdrop && requestClose()">
    <section
      ref="modalRef"
      class="app-modal"
      :class="[`app-modal-${size}`, modalClass]"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      :aria-labelledby="titleId"
      @keydown.tab="trapTab"
    >
      <header class="app-modal-head">
        <div>
          <span v-if="eyebrow">{{ eyebrow }}</span>
          <strong :id="titleId">{{ title }}</strong>
        </div>
        <button class="ghost icon-only" type="button" aria-label="关闭" title="关闭" :disabled="closeDisabled" @click="requestClose">
          <AppIcon name="close" :size="16" />
        </button>
      </header>
      <slot />
      <footer v-if="$slots.actions" class="app-modal-actions">
        <slot name="actions" />
      </footer>
    </section>
  </div>
</template>
