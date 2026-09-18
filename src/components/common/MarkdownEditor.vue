<script setup>
import { computed, nextTick, ref } from 'vue'
import MarkdownContent from './MarkdownContent.vue'
import { markdownToPlainText } from '../../services/markdown.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  imageUploading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'upload-image'])
const textarea = ref(null)
const imageInput = ref(null)
const plainTextLength = computed(() => Array.from(markdownToPlainText(props.modelValue)).length)

const updateValue = (value) => emit('update:modelValue', value)

const insertText = (value, selectionStart = value.length, selectionEnd = selectionStart) => {
  const input = textarea.value
  if (!input) {
    updateValue(`${props.modelValue}${value}`)
    return
  }
  const start = input.selectionStart ?? props.modelValue.length
  const end = input.selectionEnd ?? start
  const nextValue = `${props.modelValue.slice(0, start)}${value}${props.modelValue.slice(end)}`
  updateValue(nextValue)
  nextTick(() => {
    input.focus()
    input.setSelectionRange(start + selectionStart, start + selectionEnd)
  })
}

const insertPair = (left, right, fallback) => {
  const input = textarea.value
  const selected = input && input.selectionStart !== input.selectionEnd
    ? props.modelValue.slice(input.selectionStart, input.selectionEnd)
    : fallback
  insertText(`${left}${selected}${right}`, left.length, left.length + selected.length)
}

const insertLink = () => insertText('[链接文字](https://)', 1, 5)

const handlePaste = (event) => {
  const html = event.clipboardData?.getData('text/html') || ''
  const plainText = event.clipboardData?.getData('text/plain') || ''
  if (!html.trim() || html.trim() === plainText.trim()) return
  event.preventDefault()
  insertText(html)
}

const handleImageChange = (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  emit('upload-image', file, (markdown) => {
    if (markdown) insertText(markdown)
  })
}

const focus = () => textarea.value?.focus()

defineExpose({ focus, insertText })
</script>

<template>
  <div class="markdown-editor">
    <div class="markdown-editor-toolbar" role="toolbar" aria-label="任务内容格式工具">
      <button type="button" class="ghost" title="粗体" @click="insertPair('**', '**', '粗体')"><strong>B</strong></button>
      <button type="button" class="ghost" title="斜体" @click="insertPair('*', '*', '斜体')"><em>I</em></button>
      <button type="button" class="ghost" title="二级标题" @click="insertText('## ')">H2</button>
      <button type="button" class="ghost" title="项目列表" @click="insertText('- ')">列表</button>
      <button type="button" class="ghost" title="引用" @click="insertText('> ')">引用</button>
      <button type="button" class="ghost" title="链接" @click="insertLink">链接</button>
      <button type="button" class="ghost" :disabled="imageUploading" @click="imageInput?.click()">
        {{ imageUploading ? '上传中…' : '插入图片' }}
      </button>
      <input ref="imageInput" class="visually-hidden" type="file" accept="image/*" @change="handleImageChange" />
    </div>
    <div class="markdown-editor-panels">
      <textarea
        ref="textarea"
        :value="modelValue"
        rows="12"
        :placeholder="placeholder"
        aria-label="任务内容 Markdown 源码"
        @input="updateValue($event.target.value)"
        @paste="handlePaste"
      />
      <div class="markdown-editor-preview-panel">
        <span class="markdown-editor-preview-label">渲染预览</span>
        <MarkdownContent :content="modelValue" private-media />
      </div>
    </div>
    <div class="markdown-editor-footer">
      <span>字数：{{ plainTextLength }}</span>
    </div>
  </div>
</template>
