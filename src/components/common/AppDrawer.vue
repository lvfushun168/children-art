<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useBackLayer } from '../../composables/useBackLayer'
import DrawerHead from './DrawerHead.vue'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
const FIRST_FIELD = 'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([disabled])'

const props = defineProps({
  // 条件渲染的抽屉可以不传，组件挂载即视为打开
  open: { type: Boolean, default: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  // 保存中等不允许关闭的时候置为 true：关闭按钮、遮罩、Esc 和返回手势都会被拦住
  closeDisabled: { type: Boolean, default: false },
  backdropClass: { type: [String, Array, Object], default: '' },
  drawerClass: { type: [String, Array, Object], default: '' }
})

const emit = defineEmits(['close'])

const titleId = useId()
const drawerRef = ref(null)
let returnFocusTo = null

const requestClose = () => {
  if (!props.closeDisabled) emit('close')
}

// Esc 和系统返回统一走返回层，不需要各页面再单独监听键盘。
useBackLayer(() => props.open, requestClose)

const trapTab = (event) => {
  const nodes = [...(drawerRef.value?.querySelectorAll(FOCUSABLE) || [])].filter((node) => node.offsetParent !== null)
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
    const field = drawerRef.value?.querySelector(FIRST_FIELD)
    ;(field || drawerRef.value)?.focus({ preventScroll: true })
  } else {
    restoreFocus()
  }
}, { immediate: true, flush: 'post' })

onBeforeUnmount(restoreFocus)
</script>

<template>
  <div v-if="open" class="drawer-backdrop" :class="backdropClass" @click.self="requestClose">
    <aside
      ref="drawerRef"
      class="library-drawer"
      :class="drawerClass"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      :aria-labelledby="titleId"
      @keydown.tab="trapTab"
    >
      <DrawerHead :title="title" :subtitle="subtitle" :title-id="titleId" :close-disabled="closeDisabled" @close="requestClose">
        <slot name="head-actions" />
      </DrawerHead>
      <slot />
    </aside>
  </div>
</template>
