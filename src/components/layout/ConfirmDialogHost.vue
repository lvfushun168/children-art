<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { confirmState, settleConfirm } from '../../services/confirmDialog.js'

const dialogRef = ref(null)
const cancelRef = ref(null)
const confirmRef = ref(null)
const inputRef = ref(null)
let previouslyFocused = null

const onKeydown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    settleConfirm(false)
    return
  }
  // 焦点只在对话框内循环，避免 Tab 跑到被遮住的页面上。
  if (event.key === 'Tab') {
    const buttons = [inputRef.value, cancelRef.value, confirmRef.value].filter(Boolean)
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement)
    const next = event.shiftKey ? index - 1 : index + 1
    event.preventDefault()
    buttons[(next + buttons.length) % buttons.length].focus()
  }
}

watch(() => confirmState.open, async (open) => {
  if (open) {
    previouslyFocused = document.activeElement
    window.addEventListener('keydown', onKeydown, true)
    await nextTick()
    // 带输入框时聚焦输入框；危险操作默认聚焦“取消”，普通确认默认聚焦“确定”。
    ;(confirmState.input ? inputRef.value : confirmState.tone === 'danger' ? cancelRef.value : confirmRef.value)?.focus()
  } else {
    window.removeEventListener('keydown', onKeydown, true)
    previouslyFocused?.focus?.()
    previouslyFocused = null
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  if (confirmState.open) settleConfirm(false)
})
</script>

<template>
  <Transition name="confirm-fade">
    <div v-if="confirmState.open" class="confirm-backdrop" @mousedown.self="settleConfirm(false)">
      <div
        ref="dialogRef"
        class="confirm-dialog"
        :class="{ 'is-danger': confirmState.tone === 'danger' }"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
              >
        <span class="confirm-icon" aria-hidden="true">
          <AppIcon :name="confirmState.tone === 'danger' ? 'warning' : 'help'" :size="22" />
        </span>
        <div class="confirm-copy">
          <h2 id="confirm-dialog-title">{{ confirmState.title }}</h2>
          <p v-if="confirmState.message" id="confirm-dialog-message">{{ confirmState.message }}</p>
          <label v-if="confirmState.input" class="confirm-input">
            <span v-if="confirmState.input.label">{{ confirmState.input.label }}</span>
            <textarea ref="inputRef" v-model="confirmState.inputValue" rows="3" :placeholder="confirmState.input.placeholder"></textarea>
          </label>
        </div>
        <div class="confirm-actions">
          <button ref="cancelRef" type="button" class="ghost" @click="settleConfirm(false)">{{ confirmState.cancelText }}</button>
          <button ref="confirmRef" type="button" :class="confirmState.tone === 'danger' ? 'danger' : 'primary'" @click="settleConfirm(true)">{{ confirmState.confirmText }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>
