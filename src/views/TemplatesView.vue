<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import { normalizeImageTemplate } from '../services/imageTemplateRenderer'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  groupLabel: {
    type: String,
    default: ''
  }
})
defineEmits(['backToGroup'])

const types = [
  { id: 'comment', label: '课评模板' },
  { id: 'image', label: '图片模板' },
  { id: 'prompt', label: '提示词模板' }
]

const activeType = ref('comment')
const selectedIndex = ref(0)
const mode = ref('detail')
const draft = ref({})
const isMobileFlow = ref(false)
const mobileStage = ref('types')
let cleanupMobileMedia = () => {}

const list = computed(() => props.state.templates[activeType.value] || [])
const selected = computed(() => list.value[selectedIndex.value] || list.value[0] || null)
const activeLabel = computed(() => types.find((type) => type.id === activeType.value)?.label)
const canWriteTemplates = computed(() => Boolean(
  props.state.currentUser?.permissions?.includes('template.manage')
))

const uiStatus = (value) => ['DISABLED', '停用'].includes(String(value || '').toUpperCase()) ? '停用' : '启用'
const imageDraftFor = (item = {}) => {
  const config = normalizeImageTemplate(item)
  return {
    id: item.id,
    templateKey: item.templateKey || '',
    templateVersion: Number(item.templateVersion || 1),
    version: Number(item.version || 0),
    name: item.name || '',
    status: uiStatus(item.status),
    ratio: config.canvas.aspectRatio === 'original' ? '原比例' : config.canvas.aspectRatio,
    fit: config.canvas.fit,
    background: config.canvas.background,
    brightness: config.adjustments.brightness,
    contrast: config.adjustments.contrast,
    borderEnabled: config.border.enabled,
    borderWidth: config.border.width,
    borderColor: config.border.color,
    watermarkEnabled: config.watermark.enabled,
    watermarkText: config.watermark.text,
    watermarkPosition: config.watermark.position,
    watermarkOpacity: config.watermark.opacity,
    watermarkFontSize: config.watermark.fontSize,
    watermarkPadding: config.watermark.padding,
    watermarkColor: config.watermark.color,
    outputFormat: config.output.format,
    quality: config.output.quality
  }
}

const blankDraft = () => {
  const map = {
    comment: { name: '', tone: '', length: '60-80字', structure: '', taboo: '', sample: '', status: '启用' },
    image: { name: '', templateKey: '', templateVersion: 1, version: 0, ratio: '4:5', fit: 'contain', background: '#ffffff', brightness: 1, contrast: 1, borderEnabled: true, borderWidth: 24, borderColor: '#f3e5d8', watermarkEnabled: false, watermarkText: '{{campusName}}', watermarkPosition: 'bottomRight', watermarkOpacity: 0.8, watermarkFontSize: 28, watermarkPadding: 24, watermarkColor: '#ffffff', outputFormat: 'image/jpeg', quality: 0.9, status: '启用' },
    prompt: { name: '', model: '', scene: 'feedback', systemPrompt: '', userPrompt: '', temperature: 0.7, maxTokens: 220, status: '启用' }
  }
  return map[activeType.value]
}

const cloneSelected = () => activeType.value === 'image'
  ? imageDraftFor(selected.value || blankDraft())
  : JSON.parse(JSON.stringify(selected.value || blankDraft()))

const resetDraft = () => {
  draft.value = mode.value === 'new' ? blankDraft() : cloneSelected()
}

watch([activeType, selectedIndex], () => {
  mode.value = 'detail'
  resetDraft()
}, { immediate: true })

const selectType = (type) => {
  activeType.value = type
  selectedIndex.value = 0
  if (isMobileFlow.value) mobileStage.value = 'list'
}

const selectTemplate = (index) => {
  selectedIndex.value = index
  mode.value = 'detail'
  resetDraft()
  if (isMobileFlow.value) mobileStage.value = 'detail'
}

const startNew = () => {
  if (!canWriteTemplates.value) {
    props.state.notify('模板暂不可新增')
    return
  }
  mode.value = 'new'
  draft.value = blankDraft()
  if (isMobileFlow.value) mobileStage.value = 'detail'
}

const startEdit = () => {
  if (!canWriteTemplates.value) {
    props.state.notify('模板暂不可编辑')
    return
  }
  mode.value = 'edit'
  resetDraft()
}

const save = async () => {
  if (!canWriteTemplates.value) {
    props.state.notify('模板暂不可保存')
    return
  }
  const saved = mode.value === 'new'
    ? props.state.addTemplate(activeType.value, draft.value)
    : props.state.updateTemplate(activeType.value, selectedIndex.value, draft.value)
  const resolved = saved && typeof saved.then === 'function' ? await saved : saved
  if (!resolved) return
  const savedIndex = list.value.findIndex((item) => String(item.id) === String(resolved.id))
  if (savedIndex >= 0) selectedIndex.value = savedIndex
  mode.value = 'detail'
  if (isMobileFlow.value) mobileStage.value = 'detail'
  resetDraft()
}

const returnToTypes = () => {
  mode.value = 'detail'
  resetDraft()
  mobileStage.value = 'types'
}

const returnToList = () => {
  mode.value = 'detail'
  resetDraft()
  mobileStage.value = 'list'
}

onMounted(() => {
  const media = window.matchMedia('(max-width: 680px)')
  const syncMobile = () => {
    isMobileFlow.value = media.matches
    if (media.matches) mobileStage.value = 'types'
  }
  syncMobile()
  media.addEventListener('change', syncMobile)
  cleanupMobileMedia = () => media.removeEventListener('change', syncMobile)
})

onBeforeUnmount(() => cleanupMobileMedia())
</script>

<template>
  <button
    v-if="groupLabel && (!isMobileFlow || mobileStage === 'types')"
    class="module-back-link"
    type="button"
    @click="$emit('backToGroup')"
  >
    ← 返回{{ groupLabel }}
  </button>

  <button
    v-if="isMobileFlow && mobileStage === 'list'"
    class="module-back-link"
    type="button"
    @click="returnToTypes"
  >
    ← 返回模板类型
  </button>

  <button
    v-if="isMobileFlow && mobileStage === 'detail'"
    class="module-back-link"
    type="button"
    @click="returnToList"
  >
    ← 返回模板列表
  </button>

  <PageHead  title="模板配置">
    <div v-if="!isMobileFlow || mobileStage !== 'types'" class="button-pair">
      <button class="secondary" :disabled="!canWriteTemplates" @click="startEdit">编辑当前模板</button>
      <button class="primary" :disabled="!canWriteTemplates" @click="startNew">新增{{ activeLabel }}</button>
    </div>
  </PageHead>
  <section class="template-workbench" :class="`mobile-template-stage-${mobileStage}`">
    <aside v-show="!isMobileFlow || mobileStage === 'types'" class="panel template-type-list">
      <button
        v-for="type in types"
        :key="type.id"
        :class="{ active: activeType === type.id }"
        @click="selectType(type.id)"
      >
        <strong>{{ type.label }}</strong>
        <small>{{ state.templates[type.id].length }} 项</small>
      </button>
    </aside>

    <aside v-show="!isMobileFlow || mobileStage === 'list'" class="panel template-list">
      <div class="section-head">
        <div>
          <span>{{ activeLabel }}</span>
          <strong>{{ list.length }} 项</strong>
        </div>
      </div>
      <button
        v-for="(item, index) in list"
        :key="`${activeType}-${item.id || item.name}`"
        class="master-row"
        :class="{ active: selectedIndex === index && mode !== 'new' }"
        @click="selectTemplate(index)"
      >
        <strong>{{ item.name }}</strong>
        <span v-if="activeType === 'comment'">{{ item.tone }} · {{ item.length }}</span>
        <span v-if="activeType === 'image'">{{ item.summary || `${item.ratio || '默认比例'} · ${item.watermark || '无水印'}` }}</span>
        <span v-if="activeType === 'prompt'">{{ item.scene }} · {{ item.model }}</span>
      </button>
    </aside>

    <section v-show="!isMobileFlow || mobileStage === 'detail'" class="panel template-editor">
      <div class="section-head">
        <div>
          <span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span>
          <strong>{{ mode === 'new' ? `新增${activeLabel}` : selected?.name }}</strong>
        </div>
        <div class="button-pair">
          <button v-if="mode !== 'detail'" class="ghost" @click="mode = 'detail'; resetDraft()">取消</button>
          <button v-if="mode !== 'detail'" class="primary" @click="save">保存模板</button>
        </div>
      </div>

      <p v-if="!canWriteTemplates" class="template-readonly-hint">当前账号没有模板管理权限，模板可查看但不能修改。</p>

      <fieldset :disabled="!canWriteTemplates">
      <div v-if="activeType === 'comment'" class="form-grid">
        <label>模板名称<input v-model="draft.name" /></label>
        <label>状态<AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" /></label>
        <label>语气风格<input v-model="draft.tone" /></label>
        <label>字数范围<input v-model="draft.length" /></label>
        <label class="wide">结构规则<textarea v-model="draft.structure" rows="3" /></label>
        <label class="wide">禁用表达<textarea v-model="draft.taboo" rows="3" /></label>
        <label class="wide">示例句<textarea v-model="draft.sample" rows="4" /></label>
      </div>

      <div v-if="activeType === 'image'" class="form-grid">
        <label>模板名称<input v-model="draft.name" /></label>
        <label>状态<AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" /></label>
        <label>图片比例<AdaptiveSelect v-model="draft.ratio" :options="['原比例', '1:1', '4:5', '3:4', '16:9']" /></label>
        <label>图片适配<AdaptiveSelect v-model="draft.fit" :options="[{ value: 'contain', label: '完整显示（不裁切）' }, { value: 'cover', label: '铺满画布（居中裁切）' }]" /></label>
        <label>画布背景<input v-model="draft.background" type="color" /></label>
        <label>输出格式<AdaptiveSelect v-model="draft.outputFormat" :options="['image/jpeg', 'image/png']" /></label>
        <label class="template-range-field">亮度 <output>{{ Number(draft.brightness || 1).toFixed(2) }}</output><input v-model.number="draft.brightness" type="range" min="0.5" max="1.5" step="0.01" /></label>
        <label class="template-range-field">对比度 <output>{{ Number(draft.contrast || 1).toFixed(2) }}</output><input v-model.number="draft.contrast" type="range" min="0.5" max="1.5" step="0.01" /></label>
        <label class="inline-check"><input v-model="draft.borderEnabled" type="checkbox" /><span>启用边框</span></label>
        <label>边框宽度（设计像素）<input v-model.number="draft.borderWidth" type="number" min="0" max="200" step="1" /></label>
        <label>边框颜色<input v-model="draft.borderColor" type="color" /></label>
        <label class="inline-check"><input v-model="draft.watermarkEnabled" type="checkbox" /><span>启用水印</span></label>
        <label class="wide">水印内容<input v-model="draft.watermarkText" placeholder="支持 {{campusName}}、{{studentName}}" /></label>
        <label>水印位置<AdaptiveSelect v-model="draft.watermarkPosition" :options="[{ value: 'topLeft', label: '左上角' }, { value: 'topRight', label: '右上角' }, { value: 'bottomLeft', label: '左下角' }, { value: 'bottomRight', label: '右下角' }, { value: 'center', label: '居中' }]" /></label>
        <label>水印颜色<input v-model="draft.watermarkColor" type="color" /></label>
        <label class="template-range-field">水印透明度 <output>{{ Math.round(Number(draft.watermarkOpacity || 0.8) * 100) }}%</output><input v-model.number="draft.watermarkOpacity" type="range" min="0" max="1" step="0.05" /></label>
        <label>水印字号<input v-model.number="draft.watermarkFontSize" type="number" min="8" max="160" step="1" /></label>
        <label>输出质量 <output>{{ Math.round(Number(draft.quality || 0.9) * 100) }}%</output><input v-model.number="draft.quality" type="range" min="0.5" max="1" step="0.05" /></label>
      </div>

      <div v-if="activeType === 'prompt'" class="form-grid">
        <label>模板名称<input v-model="draft.name" /></label>
        <label>状态<AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" /></label>
        <label>使用场景<AdaptiveSelect v-model="draft.scene" :options="['feedback', 'image', 'homework']" /></label>
        <label>上下文模型<input v-model="draft.model" /></label>
        <label>Temperature<input v-model.number="draft.temperature" type="number" step="0.1" /></label>
        <label>Max Tokens<input v-model.number="draft.maxTokens" type="number" /></label>
        <label class="wide">System Prompt<textarea v-model="draft.systemPrompt" rows="5" /></label>
        <label class="wide">User Prompt<textarea v-model="draft.userPrompt" rows="5" /></label>
      </div>

      </fieldset>
    </section>
  </section>
</template>
