<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import { sameId } from '../services/mappers'

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

const selectedId = ref(props.state.externalLinks[0]?.id || null)
const mode = ref('detail')
const isMobileFlow = ref(false)
const mobileShowingDetail = ref(false)
let cleanupMobileMedia = () => {}

const selected = computed(() => props.state.externalLinks.find((link) => sameId(link.id, selectedId.value)) || props.state.externalLinks[0])

const blankDraft = () => ({
  title: '',
  url: '',
  platform: '通用链接',
  note: '',
  courseIds: [],
  status: '启用'
})

const draft = ref(blankDraft())
const resetDraft = () => {
  draft.value = mode.value === 'new' ? blankDraft() : JSON.parse(JSON.stringify(selected.value || blankDraft()))
}

watch(selected, () => {
  if (mode.value !== 'new') resetDraft()
}, { immediate: true })

const selectLink = (link) => {
  selectedId.value = link.id
  mode.value = 'detail'
  draft.value = JSON.parse(JSON.stringify(link))
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startNew = () => {
  mode.value = 'new'
  draft.value = blankDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startEdit = () => {
  mode.value = 'edit'
  resetDraft()
}

const toggleCourse = (courseId) => {
  draft.value.courseIds = sameId(draft.value.courseIds?.[0], courseId) ? [] : [courseId]
}

const courseNames = (courseIds = []) =>
  courseIds.map((id) => props.state.courses.find((course) => sameId(course.id, id))?.title).filter(Boolean).join('、') || '未绑定课程'

const save = async () => {
  const saved = mode.value === 'new'
    ? await props.state.addExternalLink(draft.value)
    : await props.state.updateExternalLink(selected.value.id, draft.value)
  if (!saved) return
  selectedId.value = saved.id
  mode.value = 'detail'
  if (isMobileFlow.value) mobileShowingDetail.value = true
  resetDraft()
}

const returnToList = () => {
  mode.value = 'detail'
  resetDraft()
  mobileShowingDetail.value = false
}

onMounted(() => {
  const media = window.matchMedia('(max-width: 680px)')
  const syncMobile = () => {
    isMobileFlow.value = media.matches
    if (media.matches) mobileShowingDetail.value = false
  }
  syncMobile()
  media.addEventListener('change', syncMobile)
  cleanupMobileMedia = () => media.removeEventListener('change', syncMobile)
})

onBeforeUnmount(() => cleanupMobileMedia())
</script>

<template>
  <button
    v-if="groupLabel && (!isMobileFlow || !mobileShowingDetail)"
    class="module-back-link"
    type="button"
    @click="$emit('backToGroup')"
  >
    ← 返回{{ groupLabel }}
  </button>

  <button
    v-if="isMobileFlow && mobileShowingDetail"
    class="module-back-link"
    type="button"
    @click="returnToList"
  >
    ← 返回列表
  </button>

  <PageHead title="外部在线课程信息">
    <div class="button-pair">
      <button class="secondary" @click="startEdit">编辑当前链接</button>
      <button class="primary" @click="startNew">新增外部课程</button>
    </div>
  </PageHead>

  <section class="external-link-layout" :class="{ 'mobile-detail-open': isMobileFlow && mobileShowingDetail }">
    <aside v-show="!isMobileFlow || !mobileShowingDetail" class="panel master-list">
      <div class="section-head">
        <div>
          <span>链接库</span>
          <strong>{{ state.externalLinks.length }} 条链接</strong>
        </div>
      </div>
      <button
        v-for="link in state.externalLinks"
        :key="link.id"
        class="master-row"
        :class="{ active: sameId(selected?.id, link.id) && mode !== 'new' }"
        @click="selectLink(link)"
      >
        <strong>{{ link.title }}</strong>
        <span>{{ link.platform }} · {{ link.status }}</span>
        <small>{{ courseNames(link.courseIds) }}</small>
      </button>
    </aside>

    <section v-show="!isMobileFlow || mobileShowingDetail" class="panel">
      <div class="section-head">
        <div>
          <span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span>
          <strong>{{ mode === 'new' ? '新增外部课程' : selected?.title }}</strong>
        </div>
        <div class="button-pair">
          <button v-if="mode !== 'detail'" class="ghost" @click="mode = 'detail'; resetDraft()">取消</button>
          <button v-if="mode !== 'detail'" class="primary" @click="save">保存链接</button>
        </div>
      </div>

      <div class="form-grid">
        <label>标题<input v-model="draft.title" /></label>
        <label>状态<AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" /></label>
        <label>
          平台
          <AdaptiveSelect v-model="draft.platform" :options="['创客匠人', '通用链接', '网盘资料', '其他平台']" disabled />
        </label>
        <label class="wide">链接地址<input v-model="draft.url" /></label>
        <label class="wide">备注<textarea v-model="draft.note" rows="4" /></label>
      </div>

      <div class="member-picker">
        <strong>适用课程主题</strong>
        <label v-for="course in state.courses" :key="course.id" class="inline-check">
          <input type="checkbox" :checked="draft.courseIds?.some((id) => sameId(id, course.id))" @change="toggleCourse(course.id)" />
          <span>{{ course.title }} · {{ course.age }}</span>
        </label>
      </div>
    </section>
  </section>
</template>
