<script setup>
import { computed } from 'vue'

const props = defineProps({
  project: {
    type: Object,
    required: true
  },
  page: {
    type: Object,
    required: true
  },
  pageNo: {
    type: Number,
    default: 1
  },
  layout: {
    type: Object,
    required: true
  },
  pageSize: {
    type: Object,
    required: true
  },
  resolveSlot: {
    type: Function,
    required: true
  },
  selectedSlotKey: {
    type: String,
    default: ''
  },
  editable: {
    type: Boolean,
    default: false
  },
  watermark: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['selectSlot', 'dropRecord'])

const pageStyle = computed(() => ({
  aspectRatio: `${props.pageSize.widthMm} / ${props.pageSize.heightMm}`
}))

const renderSlots = computed(() =>
  props.layout.slots.map((slot) => ({ slot, resolved: props.resolveSlot(props.project, props.page, slot) }))
)

const slotStyle = (slot) => ({
  left: `${slot.area[0]}%`,
  top: `${slot.area[1]}%`,
  width: `${slot.area[2]}%`,
  height: `${slot.area[3]}%`,
  textAlign: slot.align || 'left'
})

const imageStyle = (crop) => ({
  objectPosition: `${crop.x}% ${crop.y}%`,
  transform: `scale(${crop.scale})`
})

const onDrop = (slot, event) => {
  const recordId = Number(event.dataTransfer?.getData('text/portfolio-record'))
  if (!recordId) return
  emit('dropRecord', { slot, recordId })
}
</script>

<template>
  <div
    class="pf-page"
    :class="[`pf-theme-${project.book.theme}`, { 'pf-page-editable': editable, 'pf-page-blank': page.kind === 'blank' }]"
    :style="pageStyle"
  >
    <component
      v-for="entry in renderSlots"
      :key="entry.slot.key"
      :is="editable ? 'button' : 'div'"
      class="pf-slot"
      :class="[
        `pf-slot-${entry.slot.type}`,
        entry.slot.role ? `pf-role-${entry.slot.role}` : '',
        entry.slot.style ? `pf-style-${entry.slot.style}` : '',
        { selected: editable && selectedSlotKey === entry.slot.key }
      ]"
      :style="slotStyle(entry.slot)"
      :type="editable ? 'button' : undefined"
      @click="editable && emit('selectSlot', entry.slot)"
      @dragover.prevent
      @drop.prevent="editable && onDrop(entry.slot, $event)"
    >
      <template v-if="entry.slot.type === 'image'">
        <img v-if="!entry.resolved.empty" :src="entry.resolved.imageUrl" :style="imageStyle(entry.resolved.crop)" alt="" />
        <span v-else class="pf-empty-slot">空图位</span>
      </template>
      <template v-else>
        <span v-if="!entry.resolved.empty" class="pf-text">{{ entry.resolved.text }}</span>
        <span v-else class="pf-empty-slot text">待填文字</span>
      </template>
    </component>

    <span v-if="watermark && page.kind === 'work'" class="pf-watermark">{{ watermark }}</span>
    <span v-if="page.kind !== 'cover'" class="pf-folio">{{ pageNo }}</span>
  </div>
</template>
