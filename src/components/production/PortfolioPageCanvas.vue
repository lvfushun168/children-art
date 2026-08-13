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

const safeAreaStyle = computed(() => {
  const area = props.pageSize.punchSafeArea || { x: 88.55, y: 0, w: 11.45, h: 16.2 }
  return {
    left: `${area.x}%`,
    top: `${area.y}%`,
    width: `${area.w}%`,
    height: `${area.h}%`
  }
})

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
  const recordId = event.dataTransfer?.getData('text/portfolio-record')
  if (!recordId) return
  emit('dropRecord', { slot, recordId })
}
</script>

<template>
  <div
    class="pf-page"
    :class="[`pf-theme-${project.book.theme}`, `pf-page-type-${page.pageType}`, { 'pf-page-editable': editable }]"
    :style="pageStyle"
  >
    <div class="pf-brand-lock">
      <span class="pf-brand-mark">梦</span>
      <div>
        <strong>Dream Chaser</strong>
        <small>One painting after another</small>
      </div>
    </div>
    <div class="pf-punch-safe" :style="safeAreaStyle">
      <span></span>
    </div>

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

    <span v-if="watermark" class="pf-watermark">{{ watermark }}</span>
    <span class="pf-side-label">DREAM<br />CHASER</span>
    <span class="pf-year-mark">20<br />26</span>
    <span class="pf-folio">{{ pageNo }}</span>
  </div>
</template>
