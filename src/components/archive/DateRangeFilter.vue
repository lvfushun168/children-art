<script setup>
import { ref } from 'vue'

const props = defineProps({
  start: {
    type: String,
    default: ''
  },
  end: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:start', 'update:end', 'change'])
const startInput = ref(null)
const endInput = ref(null)

const emitRange = (start, end) => {
  emit('update:start', start)
  emit('update:end', end)
  emit('change', { start, end })
}

const updateStart = (value) => {
  emitRange(value, value && props.end && value > props.end ? value : props.end)
}

const updateEnd = (value) => {
  emitRange(value && props.start && value < props.start ? value : props.start, value)
}

const openPicker = (input) => {
  input?.focus()
  if (typeof input?.showPicker !== 'function') return
  try {
    input.showPicker()
  } catch {
    // The focused native date input remains usable when showPicker is unavailable.
  }
}

const clearRange = () => emitRange('', '')
</script>

<template>
  <section class="archive-date-range" aria-label="日期范围">
    <span>日期范围</span>
    <div class="archive-date-fields">
      <label class="archive-date-field" @click.prevent="openPicker(startInput)">
        开始日期
        <input
          ref="startInput"
          :value="start"
          type="date"
          @click.stop="openPicker(startInput)"
          @input="updateStart($event.target.value)"
        />
      </label>
      <label class="archive-date-field" @click.prevent="openPicker(endInput)">
        结束日期
        <input
          ref="endInput"
          :value="end"
          type="date"
          @click.stop="openPicker(endInput)"
          @input="updateEnd($event.target.value)"
        />
      </label>
    </div>
    <button v-if="start || end" type="button" class="ghost archive-date-clear" @click="clearRange">清空</button>
  </section>
</template>
