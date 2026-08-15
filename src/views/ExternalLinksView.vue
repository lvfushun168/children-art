<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import PaginationBar from '../components/common/PaginationBar.vue'
import { sameId } from '../services/mappers'

const props = defineProps({
  state: { type: Object, required: true },
  groupLabel: { type: String, default: '' }
})
defineEmits(['backToGroup'])

const selectedId = ref(null)
const detailRecord = ref(null)
const mode = ref('detail')
const queryInput = ref('')
const courseInput = ref('all')
const statusInput = ref('all')
const isMobileFlow = ref(false)
const mobileShowingDetail = ref(false)
let cleanupMobileMedia = () => {}

const pageState = computed(() => props.state.directoryPages?.externalLinks || { items: [], page: 1, pageSize: 20, total: 0 })
const links = computed(() => pageState.value.items || [])
const selected = computed(() => detailRecord.value || links.value.find((link) => sameId(link.id, selectedId.value)) || null)
const drawerOpen = computed(() => mode.value === 'new' || Boolean(selected.value && (!isMobileFlow.value || mobileShowingDetail.value)))
const courseOptions = computed(() => [
  { label: '全部课程', value: 'all' },
  ...(props.state.courses || []).map((course) => ({ label: course.title, value: course.id }))
])
const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'ENABLED' },
  { label: '停用', value: 'DISABLED' }
]

const blankDraft = () => ({ title: '', url: '', platform: '通用链接', note: '', courseIds: [], status: '启用' })
const draft = ref(blankDraft())
const resetDraft = () => {
  draft.value = mode.value === 'new' ? blankDraft() : JSON.parse(JSON.stringify(selected.value || blankDraft()))
}

const loadDirectory = async (page = 1) => {
  detailRecord.value = null
  selectedId.value = null
  mode.value = 'detail'
  await props.state.loadDirectoryPage?.('externalLinks', {
    page,
    pageSize: 20,
    query: queryInput.value.trim() || undefined,
    status: statusInput.value === 'all' ? undefined : statusInput.value,
    courseId: courseInput.value === 'all' ? undefined : courseInput.value
  })
}
const resetFilters = () => {
  queryInput.value = ''
  statusInput.value = 'all'
  courseInput.value = 'all'
  return loadDirectory(1)
}

watch(selected, () => {
  if (mode.value !== 'new') resetDraft()
}, { immediate: true })

const selectLink = async (link) => {
  selectedId.value = link.id
  detailRecord.value = null
  mode.value = 'detail'
  draft.value = JSON.parse(JSON.stringify(link))
  if (isMobileFlow.value) mobileShowingDetail.value = true
  await props.state.loadMasterData?.('courses', { archiveState: 'ACTIVE', force: false })
  try {
    const detail = await props.state.loadDirectoryDetail?.('externalLinks', link)
    if (sameId(selectedId.value, link.id)) {
      detailRecord.value = detail || link
      draft.value = JSON.parse(JSON.stringify(detail || link))
    }
  } catch {
    detailRecord.value = link
  }
}

const startNew = async () => {
  mode.value = 'new'
  selectedId.value = null
  detailRecord.value = null
  await props.state.loadMasterData?.('courses', { archiveState: 'ACTIVE', force: false })
  draft.value = blankDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startEdit = () => {
  if (!selected.value) return
  mode.value = 'edit'
  resetDraft()
}

const toggleCourse = (courseId) => {
  draft.value.courseIds = sameId(draft.value.courseIds?.[0], courseId) ? [] : [courseId]
}
const courseNames = (courseIds = []) =>
  courseIds.map((id) => props.state.courses.find((course) => sameId(course.id, id))?.title).filter(Boolean).join('、') || '未绑定课程'

const save = async () => {
  const wasNew = mode.value === 'new'
  const saved = wasNew
    ? await props.state.addExternalLink(draft.value)
    : await props.state.updateExternalLink(selected.value.id, draft.value)
  if (!saved) return
  if (wasNew) {
    mobileShowingDetail.value = false
    await loadDirectory(1)
    resetDraft()
    return
  }
  mode.value = 'detail'
  if (isMobileFlow.value) mobileShowingDetail.value = true
  await loadDirectory(wasNew ? 1 : pageState.value.page)
  selectedId.value = saved.id
  detailRecord.value = await props.state.loadDirectoryDetail?.('externalLinks', saved).catch(() => saved)
  resetDraft()
}

const returnToList = () => {
  mode.value = 'detail'
  selectedId.value = null
  detailRecord.value = null
  resetDraft()
  mobileShowingDetail.value = false
}

const cancelEdit = () => {
  const wasNew = mode.value === 'new'
  mode.value = 'detail'
  resetDraft()
  if (wasNew) {
    selectedId.value = null
    detailRecord.value = null
    mobileShowingDetail.value = false
  }
}

onMounted(() => {
  void loadDirectory(1)
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
  <button v-if="groupLabel && (!isMobileFlow || !mobileShowingDetail)" class="module-back-link" type="button" @click="$emit('backToGroup')">← 返回{{ groupLabel }}</button>
  <button v-if="isMobileFlow && mobileShowingDetail" class="module-back-link" type="button" @click="returnToList">← 返回列表</button>

  <PageHead title="外部在线课程信息">
    <div class="button-pair">
      <button class="primary" @click="startNew">新增外部课程</button>
    </div>
  </PageHead>

  <section class="directory-page" :class="{ 'mobile-detail-open': isMobileFlow && mobileShowingDetail }">
    <form class="directory-toolbar panel" @submit.prevent="loadDirectory(1)">
      <label class="directory-search"><span>关键词</span><input v-model="queryInput" placeholder="标题、URL" /></label>
      <label><span>课程</span><AdaptiveSelect v-model="courseInput" :options="courseOptions" /></label>
      <label><span>状态</span><AdaptiveSelect v-model="statusInput" :options="statusOptions" /></label>
      <div class="button-pair directory-toolbar-actions">
        <button class="secondary" type="submit">查询</button>
        <button class="ghost" type="button" @click="resetFilters">重置</button>
      </div>
    </form>

    <section v-show="!isMobileFlow || !mobileShowingDetail" class="panel directory-list-panel">
      <div class="section-head"><div><span>链接库</span><strong>{{ pageState.total }} 条链接</strong></div><small v-if="state.directoryLoading?.externalLinks">正在加载…</small></div>
      <div v-if="state.directoryErrors?.externalLinks" class="notice-box error-box"><small>{{ state.directoryErrors.externalLinks }}</small><button class="ghost" type="button" @click="loadDirectory(pageState.page)">重试</button></div>
      <div v-else-if="!links.length && !state.directoryLoading?.externalLinks" class="notice-box"><small>暂无符合条件的外部课程链接。</small></div>
      <div v-else class="directory-table-wrap">
        <table class="directory-table">
          <thead><tr><th>标题</th><th>关联课程</th><th>URL</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="link in links" :key="link.id" class="directory-table-row" :class="{ active: sameId(selected?.id, link.id) }" @click="selectLink(link)">
              <td><strong>{{ link.title }}</strong></td><td>{{ link.courseTitle || courseNames(link.courseIds) }}</td><td class="directory-url">{{ link.url }}</td><td><span class="status-tag">{{ link.status }}</span></td><td><button class="ghost" type="button" @click.stop="selectLink(link)">查看详情</button></td>
            </tr>
          </tbody>
        </table>
        <div class="directory-mobile-cards">
          <button v-for="link in links" :key="link.id" class="directory-card" type="button" @click="selectLink(link)"><strong>{{ link.title }}</strong><span>{{ link.courseTitle || courseNames(link.courseIds) }}</span><small>{{ link.url }}</small><em>{{ link.status }}</em></button>
        </div>
        <PaginationBar :page="pageState.page" :page-size="pageState.pageSize" :total="pageState.total" :loading="state.directoryLoading?.externalLinks" @change="loadDirectory" />
      </div>
    </section>

    <div v-if="drawerOpen" class="directory-drawer-backdrop" @click.self="returnToList">
      <section class="panel directory-drawer">
        <div class="section-head"><div><span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span><strong>{{ mode === 'new' ? '新增外部课程' : selected?.title }}</strong></div><div class="button-pair"><button v-if="mode === 'detail'" class="ghost" type="button" @click="returnToList">关闭</button><button v-if="mode === 'detail'" class="secondary" @click="startEdit">编辑</button><button v-if="mode !== 'detail'" class="ghost" type="button" @click="cancelEdit">取消</button><button v-if="mode !== 'detail'" class="primary" @click="save">保存链接</button></div></div>
        <div class="form-grid"><label>标题<input v-model="draft.title" /></label><label>状态<AdaptiveSelect v-model="draft.status" :options="['启用', '停用']" /></label><label>平台<AdaptiveSelect v-model="draft.platform" :options="['创客匠人', '通用链接', '网盘资料', '其他平台']" disabled /></label><label class="wide">链接地址<input v-model="draft.url" /></label><label class="wide">备注<textarea v-model="draft.note" rows="4" /></label></div>
        <div class="member-picker"><strong>适用课程主题</strong><label v-for="course in state.courses" :key="course.id" class="inline-check"><input type="checkbox" :checked="draft.courseIds?.some((id) => sameId(id, course.id))" @change="toggleCourse(course.id)" /><span>{{ course.title }} · {{ course.age }}</span></label><small v-if="!state.courses.length">打开详情后才加载课程引用数据。</small></div>
      </section>
    </div>
  </section>
</template>
