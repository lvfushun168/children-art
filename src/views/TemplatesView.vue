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
const emit = defineEmits(['backToGroup'])

const types = [
  { id: 'comment', label: '课评生成模板' },
  { id: 'image', label: '图片模板' }
]

const activeType = ref('comment')
const selectedId = ref(null)
const isDrawerOpen = ref(false)
const mode = ref('detail')
const draft = ref({})
const draftBaseline = ref('')
const queryInput = ref('')
const statusInput = ref('all')
const isMobileFlow = ref(false)
const mobileStage = ref('types')
const saving = ref(false)
let cleanupMobileMedia = () => {}

const list = computed(() => props.state.templates?.[activeType.value] || [])
const selected = computed(() => list.value.find((item) => String(item.id) === String(selectedId.value)) || null)
const selectedIndex = computed(() => list.value.findIndex((item) => String(item.id) === String(selectedId.value)))
const activeLabel = computed(() => types.find((type) => type.id === activeType.value)?.label || '模板')
const canWriteTemplates = computed(() => Boolean(
  props.state.currentUser?.permissions?.includes('template.manage')
))
const formReadonly = computed(() => mode.value === 'detail' || saving.value || !canWriteTemplates.value)
const isDirty = computed(() => mode.value !== 'detail' && draftBaseline.value !== JSON.stringify(draft.value || {}))
const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'ENABLED' },
  { label: '停用', value: 'DISABLED' }
]

const uiStatus = (value) => ['DISABLED', '停用'].includes(String(value || '').toUpperCase()) ? '停用' : '启用'
const apiStatus = (value) => uiStatus(value) === '停用' ? 'DISABLED' : 'ENABLED'
const clone = (value) => JSON.parse(JSON.stringify(value || {}))
const templateCount = (type) => props.state.templates?.[type]?.length || 0

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
    comment: {
      name: '',
      templateKey: '',
      templateVersion: 1,
      version: 0,
      tone: '',
      length: '60-80字',
      structure: '',
      taboo: '',
      sample: '',
      model: '',
      systemPrompt: '',
      userPrompt: '',
      temperature: 0.7,
      maxTokens: 220,
      status: '启用'
    },
    image: {
      name: '',
      templateKey: '',
      templateVersion: 1,
      version: 0,
      ratio: '4:5',
      fit: 'contain',
      background: '#ffffff',
      brightness: 1,
      contrast: 1,
      borderEnabled: true,
      borderWidth: 24,
      borderColor: '#f3e5d8',
      watermarkEnabled: false,
      watermarkText: '{{campusName}}',
      watermarkPosition: 'bottomRight',
      watermarkOpacity: 0.8,
      watermarkFontSize: 28,
      watermarkPadding: 24,
      watermarkColor: '#ffffff',
      outputFormat: 'image/jpeg',
      quality: 0.9,
      status: '启用'
    }
  }
  return clone(map[activeType.value])
}

const draftFor = (item) => {
  if (activeType.value === 'image') return imageDraftFor(item || blankDraft())
  const value = clone(item || blankDraft())
  value.status = uiStatus(value.status)
  return value
}

const setDraft = (value) => {
  draft.value = clone(value)
  draftBaseline.value = JSON.stringify(draft.value)
}

const resetDraft = () => {
  setDraft(mode.value === 'new' ? blankDraft() : draftFor(selected.value))
}

const confirmDiscardChanges = (action = '离开当前编辑') => {
  if (!isDirty.value) return true
  return window.confirm(`当前模板有未保存修改，确定${action}吗？`)
}

const filteredList = computed(() => {
  const query = queryInput.value.trim().toLowerCase()
  return list.value.filter((item) => {
    const statusMatched = statusInput.value === 'all' || apiStatus(item.status) === statusInput.value
    if (!statusMatched) return false
    if (!query) return true
    const haystack = [item.name, item.templateKey, item.model, item.renderer, item.summary, item.tone, item.length]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
})

const summaryFor = (item) => {
  if (activeType.value === 'image') return item.summary || `${item.ratio || '默认比例'} · ${item.watermark || '无水印'}`
  return `${item.tone || '未设置语气'} · ${item.length || '未设置字数'}`
}

const secondarySummaryFor = (item) => {
  if (activeType.value === 'image') return item.renderer === 'AI_ASYNC' ? 'AI 异步处理' : '前端画布处理'
  return item.model || '默认模型'
}

const syncSelection = () => {
  if (isDrawerOpen.value) return
  const current = list.value.find((item) => String(item.id) === String(selectedId.value)) || list.value[0] || null
  selectedId.value = current?.id || null
  mode.value = 'detail'
  setDraft(current ? draftFor(current) : blankDraft())
}

watch(
  () => `${activeType.value}|${list.value.map((item) => String(item.id)).join(',')}`,
  syncSelection,
  { immediate: true }
)

const selectType = (type) => {
  if (type === activeType.value) {
    if (isMobileFlow.value) mobileStage.value = 'list'
    return
  }
  if (!confirmDiscardChanges('切换模板类型')) return
  isDrawerOpen.value = false
  mode.value = 'detail'
  selectedId.value = null
  activeType.value = type
  if (isMobileFlow.value) mobileStage.value = 'list'
}

const selectTemplate = (item) => {
  if (!item || !confirmDiscardChanges('切换模板')) return
  selectedId.value = item.id
  mode.value = canWriteTemplates.value ? 'edit' : 'detail'
  setDraft(draftFor(item))
  isDrawerOpen.value = true
  if (isMobileFlow.value) mobileStage.value = 'detail'
}

const startNew = () => {
  if (!canWriteTemplates.value) {
    props.state.notify?.('当前账号没有模板管理权限')
    return
  }
  if (!confirmDiscardChanges('放弃当前编辑并新建模板')) return
  selectedId.value = null
  mode.value = 'new'
  setDraft(blankDraft())
  isDrawerOpen.value = true
  if (isMobileFlow.value) mobileStage.value = 'detail'
}

const startEdit = () => {
  if (!selected.value || !canWriteTemplates.value) return
  mode.value = 'edit'
  setDraft(draftFor(selected.value))
}

const closeDrawer = () => {
  if (!confirmDiscardChanges('放弃当前编辑并关闭抽屉')) return false
  isDrawerOpen.value = false
  mode.value = 'detail'
  resetDraft()
  if (isMobileFlow.value) mobileStage.value = 'list'
  return true
}

const save = async () => {
  if (formReadonly.value || saving.value) return
  if (mode.value === 'edit' && selectedIndex.value < 0) return
  saving.value = true
  try {
    const saved = mode.value === 'new'
      ? await props.state.addTemplate(activeType.value, draft.value)
      : await props.state.updateTemplate(activeType.value, selectedIndex.value, draft.value)
    if (!saved) return
    selectedId.value = saved.id
    mode.value = 'detail'
    isDrawerOpen.value = true
    setDraft(draftFor(saved))
    if (isMobileFlow.value) mobileStage.value = 'detail'
  } finally {
    saving.value = false
  }
}

const resetFilters = () => {
  queryInput.value = ''
  statusInput.value = 'all'
}

const returnToTypes = () => {
  if (!closeDrawer()) return
  mobileStage.value = 'types'
}

const returnToList = () => {
  closeDrawer()
}

const backToGroup = () => {
  if (!confirmDiscardChanges('放弃当前编辑并返回上一级')) return
  emit('backToGroup')
}

onMounted(() => {
  const media = window.matchMedia('(max-width: 680px)')
  const syncMobile = () => {
    isMobileFlow.value = media.matches
    if (media.matches && !isDrawerOpen.value) mobileStage.value = 'types'
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
    @click="backToGroup"
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

  <PageHead title="模板配置">
    <div class="button-pair">
      <button class="primary" :disabled="!canWriteTemplates" @click="startNew">新增{{ activeLabel }}</button>
    </div>
  </PageHead>

  <section class="template-config-layout" :class="`mobile-template-stage-${mobileStage}`">
    <aside v-show="!isMobileFlow || mobileStage === 'types'" class="panel template-type-list">
      <button
        v-for="type in types"
        :key="type.id"
        type="button"
        :class="{ active: activeType === type.id }"
        @click="selectType(type.id)"
      >
        <strong>{{ type.label }}</strong>
        <small>{{ templateCount(type.id) }} 项</small>
      </button>
    </aside>

    <section v-show="!isMobileFlow || mobileStage === 'list'" class="template-config-content directory-page">
      <form class="directory-toolbar panel" @submit.prevent>
        <label class="directory-search">
          <span>关键词</span>
          <input v-model="queryInput" placeholder="模板名称、模板标识或模型" />
        </label>
        <label>
          <span>状态</span>
          <AdaptiveSelect v-model="statusInput" :options="statusOptions" />
        </label>
        <div class="button-pair directory-toolbar-actions">
          <button class="ghost" type="button" @click="resetFilters">重置</button>
          <button class="primary" type="button" :disabled="!canWriteTemplates" @click="startNew">新增{{ activeLabel }}</button>
        </div>
      </form>

      <section class="master-list panel directory-list-panel">
        <div class="section-head">
          <div>
            <span>{{ activeLabel }}</span>
            <strong>{{ filteredList.length }} / {{ list.length }} 项</strong>
          </div>
          <small v-if="!canWriteTemplates">当前为只读模式</small>
        </div>

        <p v-if="!canWriteTemplates" class="template-readonly-hint">当前账号没有模板管理权限，模板可查看但不能新增、编辑或启停。</p>

        <div v-if="!filteredList.length" class="notice-box">
          <small>{{ list.length ? '没有符合条件的模板。' : `暂无${activeLabel}。` }}</small>
        </div>

        <div v-else class="directory-table-wrap">
          <table class="directory-table template-directory-table">
            <thead>
              <tr>
                <th>模板名称</th>
                <th>模板标识</th>
                <th>主要配置</th>
                <th>版本</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredList"
                :key="`${activeType}-${item.id || item.name}`"
                class="directory-table-row"
                :class="{ active: String(selectedId) === String(item.id) && isDrawerOpen }"
                @click="selectTemplate(item)"
              >
                <td>
                  <strong>{{ item.name }}</strong>
                  <small v-if="activeType === 'comment'">{{ item.model || '默认模型' }}</small>
                  <small v-else>{{ item.renderer === 'AI_ASYNC' ? 'AI 异步处理' : '前端画布处理' }}</small>
                </td>
                <td class="template-key-cell">{{ item.templateKey || '—' }}</td>
                <td>
                  <span>{{ summaryFor(item) }}</span>
                  <small>{{ secondarySummaryFor(item) }}</small>
                </td>
                <td>v{{ item.templateVersion || 1 }}</td>
                <td><span class="template-status-tag" :class="{ disabled: uiStatus(item.status) === '停用' }">{{ uiStatus(item.status) }}</span></td>
                <td><button class="ghost" type="button" @click.stop="selectTemplate(item)">{{ canWriteTemplates ? '编辑' : '查看详情' }}</button></td>
              </tr>
            </tbody>
          </table>

          <div class="directory-mobile-cards">
            <button
              v-for="item in filteredList"
              :key="`mobile-${activeType}-${item.id || item.name}`"
              type="button"
              class="directory-card"
              :class="{ active: String(selectedId) === String(item.id) && isDrawerOpen }"
              @click="selectTemplate(item)"
            >
              <strong>{{ item.name }}</strong>
              <span>{{ summaryFor(item) }} · {{ secondarySummaryFor(item) }}</span>
              <small>{{ item.templateKey || '保存后生成模板标识' }} · v{{ item.templateVersion || 1 }}</small>
              <em>{{ uiStatus(item.status) }}</em>
            </button>
          </div>
        </div>
      </section>
    </section>

    <div v-if="isDrawerOpen" class="directory-drawer-backdrop" @click.self="closeDrawer">
      <section class="panel directory-drawer template-config-drawer" role="dialog" aria-modal="true">
        <div class="section-head">
          <div>
            <span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span>
            <strong>{{ mode === 'new' ? `新增${activeLabel}` : selected?.name || activeLabel }}</strong>
            <small v-if="mode !== 'new'" class="template-drawer-meta">{{ selected?.templateKey || '未生成标识' }} · v{{ selected?.templateVersion || 1 }}</small>
          </div>
          <div class="button-pair">
            <button class="ghost" type="button" @click="closeDrawer">关闭</button>
            <button v-if="mode === 'detail' && canWriteTemplates" class="secondary" type="button" @click="startEdit">编辑</button>
            <button v-if="mode !== 'detail'" class="primary" type="button" :disabled="formReadonly || (mode === 'edit' && !isDirty)" @click="save">{{ saving ? '保存中…' : '保存模板' }}</button>
          </div>
        </div>

        <p v-if="!canWriteTemplates" class="template-readonly-hint">当前账号没有模板管理权限，模板可查看但不能修改。</p>

        <form class="template-drawer-form" @submit.prevent="save">
          <fieldset :disabled="formReadonly">
            <template v-if="activeType === 'comment'">
              <section class="master-form-section">
                <strong>基本信息</strong>
                <div class="form-grid">
                  <label>模板名称<input v-model="draft.name" /></label>
                  <label>状态<AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" /></label>
                  <label>语气风格<input v-model="draft.tone" /></label>
                  <label>字数范围<input v-model="draft.length" /></label>
                  <label class="wide">模板标识<input :value="draft.templateKey || '保存时自动生成'" disabled /></label>
                </div>
              </section>

              <details class="template-form-details" open>
                <summary>课评内容规则</summary>
                <div class="form-grid">
                  <label class="wide">结构规则<textarea v-model="draft.structure" rows="4" /></label>
                  <label class="wide">禁用表达<textarea v-model="draft.taboo" rows="3" /></label>
                  <label class="wide">示例句<textarea v-model="draft.sample" rows="3" /></label>
                </div>
              </details>

              <details class="template-form-details">
                <summary>AI 生成配置 <small>{{ draft.model || '默认模型' }}</small></summary>
                <div class="form-grid">
                  <label>上下文模型<input v-model="draft.model" /></label>
                  <label>Temperature<input v-model.number="draft.temperature" type="number" min="0" max="2" step="0.1" /></label>
                  <label>Max Tokens<input v-model.number="draft.maxTokens" type="number" min="1" max="100000" /></label>
                  <label class="wide">System Prompt<textarea v-model="draft.systemPrompt" rows="6" /></label>
                  <label class="wide">User Prompt<textarea v-model="draft.userPrompt" rows="6" /></label>
                </div>
              </details>
            </template>

            <template v-else>
              <section class="master-form-section">
                <strong>基本信息</strong>
                <div class="form-grid">
                  <label>模板名称<input v-model="draft.name" /></label>
                  <label>状态<AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" /></label>
                  <label class="wide">模板标识<input :value="draft.templateKey || '保存时自动生成'" disabled /></label>
                </div>
              </section>

              <details class="template-form-details" open>
                <summary>图片处理配置</summary>
                <div class="form-grid">
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
              </details>
            </template>
          </fieldset>
        </form>
      </section>
    </div>
  </section>
</template>
