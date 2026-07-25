<script setup>
import { computed, reactive, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const archiveTabs = [
  { id: 'studentWorks', label: '学生作品档案', hint: '学生成长线', desc: '按学生查看历史作品、课评、高光、作品集和后续 PDF 导出。' },
  { id: 'lessons', label: '课堂资料档案', hint: '课次聚合视图', desc: '按一节课查看备课资料、课堂素材和学生作品概览。' },
  { id: 'teacherEffects', label: '老师课效档案', hint: '老师课效长图', desc: '按老师沉淀课效长图和月度教学资料归档。' }
]

const activeTab = ref('home')
const selectedId = ref(props.state.filteredArchiveRecords[0]?.id || null)
const selectedRecordIds = ref([])
const selectedLessonId = ref(props.state.lessonArchiveRecords[0]?.id || null)
const selectedEffectId = ref(props.state.teacherEffectArchiveRecords[0]?.id || null)
const showCollectionModal = ref(false)
const showWorkDrawer = ref(false)
const showLessonDrawer = ref(false)
const showEffectDrawer = ref(false)
const createdCollection = ref(null)
const lessonFilter = reactive({ classId: 'all', teacher: 'all', date: 'all' })
const effectFilter = reactive({ teacher: 'all', classId: 'all', date: 'all' })
const collectionDraft = reactive({
  type: '学生成长作品集',
  title: '',
  target: '',
  intro: '',
  summary: '',
  teacherMessage: '',
  note: '',
  showDate: true,
  showCourse: true,
  showComment: false,
  showHighlight: true,
  showWatermark: true
})

const selected = computed(() => props.state.filteredArchiveRecords.find((record) => record.id === selectedId.value) || props.state.filteredArchiveRecords[0])
const selectedRecords = computed(() => selectedRecordIds.value.map((id) => props.state.archiveRecords.find((record) => record.id === id)).filter(Boolean))
const selectedCollections = computed(() => (selected.value ? props.state.archiveCollectionsForRecord(selected.value.id) : []))
const selectedFilterStudent = computed(() =>
  props.state.archiveFilter.studentId === 'all' ? null : props.state.students.find((student) => student.id === Number(props.state.archiveFilter.studentId))
)
const visibleSelectedCount = computed(() => props.state.filteredArchiveRecords.filter((record) => selectedRecordIds.value.includes(record.id)).length)
const allVisibleSelected = computed(() => props.state.filteredArchiveRecords.length > 0 && visibleSelectedCount.value === props.state.filteredArchiveRecords.length)
const canCreateStudentGrowth = computed(() =>
  Boolean(selectedFilterStudent.value && selectedRecords.value.length && selectedRecords.value.every((record) => record.studentId === selectedFilterStudent.value.id))
)
const canPublishCollection = computed(() => Boolean(canCreateStudentGrowth.value && collectionDraft.title && collectionDraft.target))

const filteredLessonArchives = computed(() =>
  props.state.lessonArchiveRecords.filter((lesson) => {
    const classOk = lessonFilter.classId === 'all' || lesson.classId === Number(lessonFilter.classId)
    const teacherOk = lessonFilter.teacher === 'all' || lesson.teacher === lessonFilter.teacher
    const dateOk = lessonFilter.date === 'all' || lesson.date === lessonFilter.date
    return classOk && teacherOk && dateOk
  })
)
const selectedLesson = computed(() => filteredLessonArchives.value.find((lesson) => lesson.id === selectedLessonId.value) || filteredLessonArchives.value[0])
const selectedLessonAssets = computed(() => selectedLesson.value?.materials || [])
const selectedLessonWorks = computed(() => selectedLesson.value?.studentWorks || [])

const filteredTeacherEffects = computed(() =>
  props.state.teacherEffectArchiveRecords.filter((effect) => {
    const classOk = effectFilter.classId === 'all' || effect.sourceLesson.classId === Number(effectFilter.classId)
    const teacherOk = effectFilter.teacher === 'all' || effect.teacher === effectFilter.teacher
    const dateOk = effectFilter.date === 'all' || effect.date === effectFilter.date
    return classOk && teacherOk && dateOk
  })
)
const selectedEffect = computed(() => filteredTeacherEffects.value.find((effect) => effect.id === selectedEffectId.value) || filteredTeacherEffects.value[0])

const archiveStats = computed(() => ({
  works: props.state.archiveRecords.length,
  lessons: props.state.lessonArchiveRecords.length,
  effects: props.state.teacherEffectArchiveRecords.length
}))
const activeArchive = computed(() => archiveTabs.find((tab) => tab.id === activeTab.value))

const archiveCountFor = (id) => {
  if (id === 'studentWorks') return `${archiveStats.value.works} 条学生作品`
  if (id === 'lessons') return `${archiveStats.value.lessons} 节课堂档案`
  return `${archiveStats.value.effects} 张课效长图`
}

watch(filteredLessonArchives, (records) => {
  if (!records.some((record) => record.id === selectedLessonId.value)) selectedLessonId.value = records[0]?.id || null
}, { immediate: true })

watch(filteredTeacherEffects, (records) => {
  if (!records.some((record) => record.id === selectedEffectId.value)) selectedEffectId.value = records[0]?.id || null
}, { immediate: true })

const selectFirstIfMissing = () => {
  if (!props.state.filteredArchiveRecords.some((record) => record.id === selectedId.value)) {
    selectedId.value = props.state.filteredArchiveRecords[0]?.id || null
  }
  const visibleIds = props.state.filteredArchiveRecords.map((record) => record.id)
  selectedRecordIds.value = selectedRecordIds.value.filter((id) => visibleIds.includes(id))
}

const toggleRecord = (record) => {
  selectedId.value = record.id
  selectedRecordIds.value = selectedRecordIds.value.includes(record.id)
    ? selectedRecordIds.value.filter((id) => id !== record.id)
    : [...selectedRecordIds.value, record.id]
}

const toggleAllVisible = () => {
  const visibleIds = props.state.filteredArchiveRecords.map((record) => record.id)
  if (allVisibleSelected.value) {
    selectedRecordIds.value = selectedRecordIds.value.filter((id) => !visibleIds.includes(id))
    return
  }
  selectedRecordIds.value = [...new Set([...selectedRecordIds.value, ...visibleIds])]
}

const openWorkDrawer = (record) => {
  selectedId.value = record.id
  showWorkDrawer.value = true
}

const openLessonDrawer = (lesson) => {
  selectedLessonId.value = lesson.id
  showLessonDrawer.value = true
}

const openEffectDrawer = (effect) => {
  selectedEffectId.value = effect.id
  showEffectDrawer.value = true
}

const openCollectionModal = () => {
  if (!canCreateStudentGrowth.value) return
  const first = selectedRecords.value[0]
  collectionDraft.type = '学生成长作品集'
  collectionDraft.title = `${first.studentName} · 高光成长作品集`
  collectionDraft.target = `${first.studentName}家长`
  collectionDraft.intro = `这是${first.studentName}这段时间在美术课上的高光作品记录。`
  collectionDraft.summary = ''
  collectionDraft.teacherMessage = '继续保持这份观察和表达的热情，期待下个阶段看到更多属于自己的画面。'
  collectionDraft.note = '适合学期末私发给家长，展示孩子阶段成长。'
  collectionDraft.showDate = true
  collectionDraft.showCourse = true
  collectionDraft.showComment = false
  collectionDraft.showHighlight = true
  collectionDraft.showWatermark = true
  createdCollection.value = null
  showCollectionModal.value = true
}

const generateCollectionCopy = () => {
  if (!selectedRecords.value.length) return
  const first = selectedRecords.value[0]
  const courses = [...new Set(selectedRecords.value.map((record) => record.course))]
  const highlights = selectedRecords.value.map((record) => record.highlightNote).filter(Boolean)
  collectionDraft.intro = `${first.studentName}这段时间完成了 ${selectedRecords.value.length} 件值得记录的作品，老师把其中最能体现成长变化的部分整理成这份作品集。`
  collectionDraft.summary = `从${courses.join('、')}等主题中可以看到，${first.studentName}在画面组织、色彩表达和细节完整度上都有持续积累。${highlights[0] || '作品中保留了清晰的课堂目标和个人表达。'}`
  collectionDraft.teacherMessage = '谢谢家长一直配合课堂后的观察和鼓励，接下来我们会继续关注画面层次、表达完整度和孩子自己的创作想法。'
}

const publishCollection = () => {
  if (!canPublishCollection.value) return
  createdCollection.value = props.state.createArchiveCollection({
    ...collectionDraft,
    recordIds: selectedRecordIds.value
  })
}

const assetMeta = (asset) => {
  if (asset.fileName) return `${asset.fileName}${asset.fileExt ? ` · ${asset.fileExt.toUpperCase()}` : ''}`
  return asset.visible ? '家长展示页可见' : '仅内部归档'
}
</script>

<template>
  <PageHead title="档案中心" />

  <section v-if="activeTab === 'home'" class="archive-home panel">
    <button
      v-for="tab in archiveTabs"
      :key="tab.id"
      class="archive-entry-card"
      @click="activeTab = tab.id"
    >
      <span>
        <strong>{{ tab.label }}</strong>
        <small>{{ tab.hint }}</small>
      </span>
      <p>{{ tab.desc }}</p>
      <em>{{ archiveCountFor(tab.id) }}</em>
    </button>
  </section>

  <section v-else class="archive-subpage-head panel">
    <button class="ghost" @click="activeTab = 'home'">返回档案中心</button>
    <div>
      <span>{{ activeArchive?.hint }}</span>
      <strong>{{ activeArchive?.label }}</strong>
    </div>
  </section>

  <section v-if="activeTab === 'studentWorks'" class="archive-workspace-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>学生作品档案</span>
          <strong>{{ state.filteredArchiveRecords.length }} 条记录</strong>
        </div>
      </div>
      <label>
        学生
        <select v-model="state.archiveFilter.studentId" @change="selectFirstIfMissing">
          <option value="all">全部学生</option>
          <option v-for="student in state.students" :key="student.id" :value="student.id">{{ student.name }}</option>
        </select>
      </label>
      <label>
        班级
        <select v-model="state.archiveFilter.classId" @change="selectFirstIfMissing">
          <option value="all">全部班级</option>
          <option v-for="klass in state.classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
        </select>
      </label>
      <label>
        老师
        <select v-model="state.archiveFilter.teacher" @change="selectFirstIfMissing">
          <option value="all">全部老师</option>
          <option v-for="teacher in state.teachers.filter((item) => item.role === '老师')" :key="teacher.id" :value="teacher.name">
            {{ teacher.name }}
          </option>
        </select>
      </label>
      <label>
        日期
        <select v-model="state.archiveFilter.date" @change="selectFirstIfMissing">
          <option value="all">全部日期</option>
          <option v-for="date in state.archiveDates" :key="date">{{ date }}</option>
        </select>
      </label>
      <label class="archive-check">
        <input v-model="state.archiveFilter.highlightOnly" type="checkbox" @change="selectFirstIfMissing" />
        <span>只看高光作品</span>
      </label>
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>归档记录</span>
          <strong>{{ state.filteredArchiveRecords.length }} 条</strong>
        </div>
        <button class="ghost" :disabled="!state.filteredArchiveRecords.length" @click="toggleAllVisible">
          {{ allVisibleSelected ? '取消全选' : '全选当前结果' }}
        </button>
      </div>
      <div v-if="selectedRecordIds.length" class="archive-selection-bar">
        <strong>已选 {{ selectedRecordIds.length }} 件作品</strong>
        <span>{{ selectedFilterStudent ? `可生成${selectedFilterStudent.name}的阶段成长作品集` : '先在左侧选择具体学生，再生成面向该家长的成长集' }}</span>
        <button v-if="canCreateStudentGrowth" class="primary" @click="openCollectionModal">生成{{ selectedFilterStudent.name }}的成长集</button>
      </div>
      <article
        v-for="record in state.filteredArchiveRecords"
        :key="record.id"
        class="archive-row"
        :class="{ active: selected?.id === record.id, picked: selectedRecordIds.includes(record.id) }"
        @click="openWorkDrawer(record)"
      >
        <label class="archive-pick" @click.stop>
          <input type="checkbox" :checked="selectedRecordIds.includes(record.id)" @change="toggleRecord(record)" />
        </label>
        <img :src="record.artwork" :alt="record.studentName" />
        <span>
          <strong>{{ record.studentName }} · {{ record.course }}</strong>
          <small>{{ record.date }} {{ record.time }} · {{ record.className }} · {{ record.teacher }}</small>
          <em v-if="record.highlight">高光作品</em>
          <em v-if="record.collectionIds?.length" class="collection-tag">已入选作品集</em>
        </span>
      </article>
      <div v-if="!state.filteredArchiveRecords.length" class="notice-box">
        <small>没有符合条件的归档记录。</small>
      </div>
    </section>

  </section>

  <section v-if="activeTab === 'lessons'" class="archive-workspace-layout lesson-archive-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>课堂资料档案</span>
          <strong>{{ filteredLessonArchives.length }} 节课</strong>
        </div>
      </div>
      <label>
        班级
        <select v-model="lessonFilter.classId">
          <option value="all">全部班级</option>
          <option v-for="klass in state.classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
        </select>
      </label>
      <label>
        老师
        <select v-model="lessonFilter.teacher">
          <option value="all">全部老师</option>
          <option v-for="teacher in state.teachers.filter((item) => item.role === '老师')" :key="teacher.id" :value="teacher.name">
            {{ teacher.name }}
          </option>
        </select>
      </label>
      <label>
        日期
        <select v-model="lessonFilter.date">
          <option value="all">全部日期</option>
          <option v-for="date in state.archiveCenterDates" :key="date">{{ date }}</option>
        </select>
      </label>
      <div class="archive-explain">
        <strong>课次聚合视图</strong>
        <small>这里能查看一节课的备课资料、课堂素材和学生作品概览。</small>
      </div>
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>课堂记录</span>
          <strong>{{ filteredLessonArchives.length }} 节</strong>
        </div>
      </div>
      <button
        v-for="lesson in filteredLessonArchives"
        :key="lesson.id"
        class="lesson-archive-row"
        :class="{ active: selectedLesson?.id === lesson.id }"
        @click="openLessonDrawer(lesson)"
      >
        <span>
          <strong>{{ lesson.date }} {{ lesson.time }} · {{ lesson.course }}</strong>
          <small>{{ lesson.className }}（{{ lesson.classType }}） · {{ lesson.teacher }} · {{ lesson.lessonType }}</small>
        </span>
        <div>
          <em>{{ lesson.materials.length }} 份资料</em>
          <small>{{ lesson.worksCount }} 件作品 · {{ lesson.highlights }} 个高光</small>
        </div>
      </button>
      <div v-if="!filteredLessonArchives.length" class="notice-box">
        <small>没有符合条件的课堂档案。</small>
      </div>
    </section>

  </section>

  <section v-if="activeTab === 'teacherEffects'" class="archive-workspace-layout teacher-effect-layout">
    <section class="archive-filter-bar panel">
      <div class="section-head">
        <div>
          <span>老师课效档案</span>
          <strong>{{ filteredTeacherEffects.length }} 张长图</strong>
        </div>
      </div>
      <label>
        老师
        <select v-model="effectFilter.teacher">
          <option value="all">全部老师</option>
          <option v-for="teacher in state.teachers.filter((item) => item.role === '老师')" :key="teacher.id" :value="teacher.name">
            {{ teacher.name }}
          </option>
        </select>
      </label>
      <label>
        班级
        <select v-model="effectFilter.classId">
          <option value="all">全部班级</option>
          <option v-for="klass in state.classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
        </select>
      </label>
      <label>
        日期
        <select v-model="effectFilter.date">
          <option value="all">全部日期</option>
          <option v-for="date in state.archiveCenterDates" :key="date">{{ date }}</option>
        </select>
      </label>
      <div class="archive-explain">
        <strong>老师维度归档</strong>
        <small>这里只承载课效长图和老师教学资料归档结果，不并入学生作品档案。</small>
      </div>
    </section>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>课效长图</span>
          <strong>{{ filteredTeacherEffects.length }} 条</strong>
        </div>
      </div>
      <button
        v-for="effect in filteredTeacherEffects"
        :key="effect.id"
        class="lesson-archive-row"
        :class="{ active: selectedEffect?.id === effect.id }"
        @click="openEffectDrawer(effect)"
      >
        <span>
          <strong>{{ effect.title }}</strong>
          <small>{{ effect.teacher }} · {{ effect.className }}（{{ effect.classType }}）</small>
        </span>
        <div>
          <em>{{ effect.status }}</em>
          <small>{{ effect.imageCount }} 张来源图</small>
        </div>
      </button>
      <div v-if="!filteredTeacherEffects.length" class="notice-box">
        <small>暂无符合条件的老师课效档案。</small>
      </div>
    </section>

  </section>

  <div v-if="showWorkDrawer && selected" class="archive-drawer-backdrop" @click.self="showWorkDrawer = false">
    <aside class="archive-drawer" role="dialog" aria-modal="true" aria-label="作品归档详情">
      <header class="archive-drawer-head">
        <div>
          <span>作品归档详情</span>
          <strong>{{ selected.studentName }} · {{ selected.course }}</strong>
        </div>
        <button class="ghost" @click="showWorkDrawer = false">关闭</button>
      </header>
      <img class="archive-main-image" :src="selected.artwork" :alt="selected.studentName" />
      <section class="archive-detail-group">
        <span>作品信息</span>
        <div class="archive-meta">
          <span>{{ selected.date }} {{ selected.time }}</span>
          <span>{{ selected.className }}</span>
          <span>{{ selected.teacher }}</span>
          <span>{{ selected.lessonType }}</span>
        </div>
      </section>
      <section class="archive-detail-group">
        <span>本次交付内容</span>
        <article class="archive-block">
          <strong>课评</strong>
          <p>{{ selected.feedback }}</p>
        </article>
        <article class="archive-block">
          <strong>课后任务</strong>
          <p>{{ selected.homework }}</p>
        </article>
        <article class="archive-block">
          <strong>家长展示页</strong>
          <p>{{ selected.shareUrl }}</p>
        </article>
      </section>
      <section class="archive-detail-group">
        <span>高光与复用</span>
        <article v-if="selected.highlight" class="archive-block highlight">
          <strong>高光说明</strong>
          <p>{{ selected.highlightNote }}</p>
        </article>
        <article v-else class="archive-block">
          <strong>高光状态</strong>
          <p>当前作品未标记为高光。</p>
        </article>
        <div v-if="selectedCollections.length" class="archive-collection-uses">
          <div v-for="collection in selectedCollections" :key="collection.id" class="archive-link-row">
            <strong>{{ collection.title }}</strong>
            <small>{{ collection.createdAt }} · {{ collection.target }}</small>
            <button class="ghost" @click="state.copyArchiveCollectionLink(collection)">复制链接</button>
          </div>
        </div>
      </section>
    </aside>
  </div>

  <div v-if="showLessonDrawer && selectedLesson" class="archive-drawer-backdrop" @click.self="showLessonDrawer = false">
    <aside class="archive-drawer lesson-archive-detail" role="dialog" aria-modal="true" aria-label="课堂完整档案">
      <header class="archive-drawer-head">
        <div>
          <span>课堂完整档案</span>
          <strong>{{ selectedLesson.className }} · {{ selectedLesson.course }}</strong>
        </div>
        <button class="ghost" @click="showLessonDrawer = false">关闭</button>
      </header>

      <section class="archive-overview-grid">
        <article><span>学生作品</span><strong>{{ selectedLesson.worksCount }}/{{ selectedLesson.studentWorks.length }}</strong></article>
        <article><span>资料文件</span><strong>{{ selectedLessonAssets.length }}</strong></article>
        <article><span>高光作品</span><strong>{{ selectedLesson.highlights }}</strong></article>
        <article><span>班级类型</span><strong>{{ selectedLesson.classType }}</strong></article>
      </section>

      <section class="archive-detail-group">
        <span>课次信息</span>
        <div class="archive-meta">
          <span>{{ selectedLesson.date }} {{ selectedLesson.time || '未记录时间' }}</span>
          <span>{{ selectedLesson.teacher }}</span>
          <span>{{ selectedLesson.className }}（{{ selectedLesson.classType }}）</span>
          <span>{{ selectedLesson.lessonType }}</span>
        </div>
      </section>

      <section class="archive-detail-group">
        <span>备课与课堂资料</span>
        <div v-if="selectedLessonAssets.length" class="lesson-asset-grid">
          <article v-for="asset in selectedLessonAssets" :key="asset.id">
            <img v-if="asset.image" :src="asset.image" :alt="asset.title" />
            <div v-else class="file-tile">{{ asset.fileExt || 'FILE' }}</div>
            <span>{{ asset.type }} · {{ asset.archiveRole }}</span>
            <strong>{{ asset.title }}</strong>
            <small>{{ assetMeta(asset) }}</small>
          </article>
        </div>
        <div v-else class="notice-box">
          <small>这节课暂无课堂资料记录。</small>
        </div>
      </section>

      <section class="archive-detail-group">
        <span>学生作品概览</span>
        <div class="lesson-work-grid">
          <article v-for="work in selectedLessonWorks" :key="work.id || work.studentId" :class="{ missing: !work.imageMatched }">
            <img v-if="work.artwork" :src="work.artwork" :alt="work.studentName" />
            <div v-else class="file-tile">缺图</div>
            <strong>{{ work.studentName }}</strong>
            <small>{{ work.course || selectedLesson.course }}</small>
            <em v-if="work.highlight">高光</em>
          </article>
        </div>
      </section>
    </aside>
  </div>

  <div v-if="showEffectDrawer && selectedEffect" class="archive-drawer-backdrop" @click.self="showEffectDrawer = false">
    <aside class="archive-drawer" role="dialog" aria-modal="true" aria-label="课效长图详情">
      <header class="archive-drawer-head">
        <div>
          <span>课效长图详情</span>
          <strong>{{ selectedEffect.teacher }} · {{ selectedEffect.course }}</strong>
        </div>
        <button class="ghost" @click="showEffectDrawer = false">关闭</button>
      </header>
      <section class="teacher-effect-preview">
        <div>
          <strong>{{ selectedEffect.title }}</strong>
          <small>{{ selectedEffect.detail }}</small>
        </div>
        <img v-if="selectedEffect.cover" :src="selectedEffect.cover" :alt="selectedEffect.title" />
        <div v-else class="file-tile">长图</div>
      </section>
      <section class="archive-detail-group">
        <span>归档信息</span>
        <div class="archive-meta">
          <span>{{ selectedEffect.date }} {{ selectedEffect.time || '' }}</span>
          <span>{{ selectedEffect.className }}（{{ selectedEffect.classType }}）</span>
          <span>{{ selectedEffect.teacher }}</span>
          <span>{{ selectedEffect.status }}</span>
        </div>
      </section>
      <section class="archive-detail-group">
        <span>百度网盘路径</span>
        <article class="archive-block">
          <p>{{ selectedEffect.cloudPath }}</p>
        </article>
      </section>
    </aside>
  </div>

  <div v-if="showCollectionModal" class="modal-backdrop">
    <section class="import-modal lesson-modal">
      <div class="modal-head">
        <div>
          <span>作品集发布</span>
          <strong>{{ createdCollection ? '链接已生成' : `已选 ${selectedRecords.length} 件作品` }}</strong>
        </div>
        <button class="ghost" @click="showCollectionModal = false">关闭</button>
      </div>
      <template v-if="!createdCollection">
        <section class="collection-context">
          <span>作品集对象</span>
          <strong>{{ selectedFilterStudent?.name }} · {{ selectedRecords.length }} 件作品</strong>
          <small>{{ selectedRecords[0]?.className }} · {{ collectionDraft.target }}</small>
        </section>
        <div class="form-grid">
          <label>发送对象<input v-model="collectionDraft.target" /></label>
          <label class="wide">标题<input v-model="collectionDraft.title" /></label>
          <label class="wide">开场说明<textarea v-model="collectionDraft.intro" rows="3" /></label>
          <label class="wide">成长总结<textarea v-model="collectionDraft.summary" rows="4" placeholder="可以手填，也可以先用 AI 生成后再微调。" /></label>
          <label class="wide">老师寄语<textarea v-model="collectionDraft.teacherMessage" rows="3" /></label>
        </div>
        <div class="collection-copy-actions">
          <button class="ghost" @click="generateCollectionCopy">AI 生成说明</button>
          <small>根据已选作品、高光说明、课程主题生成一版可编辑文案。</small>
        </div>
        <section class="collection-settings">
          <span>展示设置</span>
          <label><input v-model="collectionDraft.showDate" type="checkbox" /> 展示课程日期</label>
          <label><input v-model="collectionDraft.showCourse" type="checkbox" /> 展示课程主题</label>
          <label><input v-model="collectionDraft.showHighlight" type="checkbox" /> 展示高光说明</label>
          <label><input v-model="collectionDraft.showComment" type="checkbox" /> 展示原课评</label>
          <label><input v-model="collectionDraft.showWatermark" type="checkbox" /> 展示机构水印</label>
        </section>
        <section class="collection-preview-list">
          <article v-for="record in selectedRecords" :key="record.id">
            <img :src="record.artwork" :alt="record.studentName" />
            <div>
              <strong>{{ record.studentName }} · {{ record.course }}</strong>
              <small>{{ record.date }} · {{ record.className }}</small>
              <p>{{ record.highlightNote || record.feedback }}</p>
            </div>
          </article>
        </section>
        <div class="modal-actions">
          <button class="ghost" @click="showCollectionModal = false">取消</button>
          <button class="primary" :disabled="!canPublishCollection" @click="publishCollection">预览通过，发布链接</button>
        </div>
      </template>
      <template v-else>
        <div class="archive-published-link">
          <strong>{{ createdCollection.title }}</strong>
          <p>{{ createdCollection.link }}</p>
          <small>{{ createdCollection.note }}</small>
        </div>
        <div class="modal-actions">
          <button class="ghost" @click="state.copyArchiveCollectionLink(createdCollection)">复制链接</button>
          <button class="primary" @click="showCollectionModal = false">完成</button>
        </div>
      </template>
    </section>
  </div>
</template>
