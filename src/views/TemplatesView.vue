<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

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
  { id: 'prompt', label: '提示词模板' },
  { id: 'watermark', label: '水印配置' }
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

const blankDraft = () => {
  const map = {
    comment: { name: '', tone: '', length: '60-80字', structure: '', taboo: '', sample: '', status: '启用' },
    image: { name: '', ratio: '4:5', brightness: '+10%', watermark: '', border: '', crop: '', quality: '高清', status: '启用' },
    prompt: { name: '', model: '', scene: 'feedback', systemPrompt: '', userPrompt: '', temperature: 0.7, maxTokens: 220, status: '启用' },
    watermark: { name: '', value: '', position: '右下角', opacity: '80%', font: '', color: '#0018A8', status: '启用' }
  }
  return map[activeType.value]
}

const cloneSelected = () => JSON.parse(JSON.stringify(selected.value || blankDraft()))

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
  mode.value = 'new'
  draft.value = blankDraft()
  if (isMobileFlow.value) mobileStage.value = 'detail'
}

const startEdit = () => {
  mode.value = 'edit'
  resetDraft()
}

const save = () => {
  const saved = mode.value === 'new'
    ? props.state.addTemplate(activeType.value, draft.value)
    : props.state.updateTemplate(activeType.value, selectedIndex.value, draft.value)
  if (mode.value === 'new') selectedIndex.value = list.value.indexOf(saved)
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
      <button class="secondary" @click="startEdit">编辑当前模板</button>
      <button class="primary" @click="startNew">新增{{ activeLabel }}</button>
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
        :key="`${activeType}-${item.name}`"
        class="master-row"
        :class="{ active: selectedIndex === index && mode !== 'new' }"
        @click="selectTemplate(index)"
      >
        <strong>{{ item.name }}</strong>
        <span v-if="activeType === 'comment'">{{ item.tone }} · {{ item.length }}</span>
        <span v-if="activeType === 'image'">{{ item.ratio }} · {{ item.brightness }} · {{ item.quality }}</span>
        <span v-if="activeType === 'prompt'">{{ item.scene }} · {{ item.model }}</span>
        <span v-if="activeType === 'watermark'">{{ item.position }} · {{ item.opacity }}</span>
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

      <div v-if="activeType === 'comment'" class="form-grid">
        <label>模板名称<input v-model="draft.name" /></label>
        <label>状态<select v-model="draft.status"><option>启用</option><option>停用</option></select></label>
        <label>语气风格<input v-model="draft.tone" /></label>
        <label>字数范围<input v-model="draft.length" /></label>
        <label class="wide">结构规则<textarea v-model="draft.structure" rows="3" /></label>
        <label class="wide">禁用表达<textarea v-model="draft.taboo" rows="3" /></label>
        <label class="wide">示例句<textarea v-model="draft.sample" rows="4" /></label>
      </div>

      <div v-if="activeType === 'image'" class="form-grid">
        <label>模板名称<input v-model="draft.name" /></label>
        <label>状态<select v-model="draft.status"><option>启用</option><option>停用</option></select></label>
        <label>图片比例<input v-model="draft.ratio" /></label>
        <label>亮度调整<input v-model="draft.brightness" /></label>
        <label>水印规则<input v-model="draft.watermark" /></label>
        <label>边框样式<input v-model="draft.border" /></label>
        <label>裁切规则<input v-model="draft.crop" /></label>
        <label>输出质量<input v-model="draft.quality" /></label>
      </div>

      <div v-if="activeType === 'prompt'" class="form-grid">
        <label>模板名称<input v-model="draft.name" /></label>
        <label>状态<select v-model="draft.status"><option>启用</option><option>停用</option></select></label>
        <label>使用场景<select v-model="draft.scene"><option>feedback</option><option>image</option><option>homework</option></select></label>
        <label>上下文模型<input v-model="draft.model" /></label>
        <label>Temperature<input v-model.number="draft.temperature" type="number" step="0.1" /></label>
        <label>Max Tokens<input v-model.number="draft.maxTokens" type="number" /></label>
        <label class="wide">System Prompt<textarea v-model="draft.systemPrompt" rows="5" /></label>
        <label class="wide">User Prompt<textarea v-model="draft.userPrompt" rows="5" /></label>
      </div>

      <div v-if="activeType === 'watermark'" class="form-grid">
        <label>配置名称<input v-model="draft.name" /></label>
        <label>状态<select v-model="draft.status"><option>启用</option><option>停用</option><option>可选</option></select></label>
        <label class="wide">水印内容<input v-model="draft.value" /></label>
        <label>位置<input v-model="draft.position" /></label>
        <label>透明度<input v-model="draft.opacity" /></label>
        <label>字体<input v-model="draft.font" /></label>
        <label>颜色<input v-model="draft.color" /></label>
      </div>
    </section>
  </section>
</template>
