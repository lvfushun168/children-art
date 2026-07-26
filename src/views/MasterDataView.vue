<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  entity: {
    type: String,
    required: true
  },
  groupLabel: {
    type: String,
    default: ''
  }
})
defineEmits(['open-import', 'backToGroup'])

const selectedId = ref(null)
const mode = ref('detail')
const isMobileFlow = ref(false)
const mobileShowingDetail = ref(false)
let cleanupMobileMedia = () => {}

const config = computed(() => {
  const map = {
    students: { title: '学生管理', action: '新增学生', empty: '暂无学生' },
    classes: { title: '班级管理', action: '新增班级', empty: '暂无班级' },
    courses: { title: '课程资料', action: '新增课程', empty: '暂无课程' }
  }
  return map[props.entity]
})

const records = computed(() => {
  if (props.entity === 'students') return props.state.students
  if (props.entity === 'classes') return props.state.classes
  return props.state.courses
})

const selected = computed(() => records.value.find((item) => item.id === selectedId.value) || records.value[0] || null)

const blankDraft = () => {
  if (props.entity === 'students') {
    return {
      name: '',
      nickname: '',
      age: 6,
      parent: '',
      phone: '',
      classId: props.state.classes[0]?.id,
      status: '在读',
      note: ''
    }
  }
  if (props.entity === 'classes') {
    return {
      name: '',
      time: '每周五 18:30',
      teacherId: props.state.teachers[0]?.id,
      courseId: props.state.courses[0]?.id,
      group: '',
      status: '筹备中',
      studentIds: []
    }
  }
  return {
    title: '',
    age: '5-7岁',
    goal: '',
    materials: '',
    reference: '',
    defaultFocus: '色彩',
    commentTemplate: props.state.templates.comment[0]?.name,
    imageTemplate: props.state.templates.image[0]?.name,
    onlineLinks: []
  }
}

const cloneRecord = (record) => JSON.parse(JSON.stringify(record || blankDraft()))
const draft = ref(blankDraft())

const resetDraft = () => {
  draft.value = mode.value === 'new' ? blankDraft() : cloneRecord(selected.value)
}

watch(
  () => props.entity,
  () => {
    selectedId.value = records.value[0]?.id || null
    mode.value = 'detail'
    mobileShowingDetail.value = false
    resetDraft()
  },
  { immediate: true }
)

watch(selected, () => {
  if (mode.value !== 'new') resetDraft()
})

const selectRecord = (record) => {
  selectedId.value = record.id
  mode.value = 'detail'
  draft.value = cloneRecord(record)
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startNew = () => {
  mode.value = 'new'
  draft.value = blankDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startEdit = () => {
  mode.value = 'edit'
  draft.value = cloneRecord(selected.value)
}

const save = () => {
  if (props.entity === 'students') {
    const saved = mode.value === 'new' ? props.state.addStudent(draft.value) : props.state.updateStudent(selected.value.id, draft.value)
    selectedId.value = saved.id
  }
  if (props.entity === 'classes') {
    const saved = mode.value === 'new' ? props.state.addClass(draft.value) : props.state.updateClass(selected.value.id, draft.value)
    selectedId.value = saved.id
  }
  if (props.entity === 'courses') {
    const saved = mode.value === 'new' ? props.state.addCourse(draft.value) : props.state.updateCourse(selected.value.id, draft.value)
    selectedId.value = saved.id
  }
  mode.value = 'detail'
  if (isMobileFlow.value) mobileShowingDetail.value = true
  resetDraft()
}

const returnToList = () => {
  mode.value = 'detail'
  resetDraft()
  mobileShowingDetail.value = false
}

const toggleStudentInClass = (studentId) => {
  const ids = draft.value.studentIds || []
  draft.value.studentIds = ids.includes(studentId) ? ids.filter((id) => id !== studentId) : [...ids, studentId]
}

const toggleCourseLink = (title) => {
  const links = draft.value.onlineLinks || []
  draft.value.onlineLinks = links.includes(title) ? links.filter((item) => item !== title) : [...links, title]
}

const className = (classId) => props.state.classes.find((item) => item.id === classId)?.name || '未分班'
const courseTitle = (courseId) => props.state.courses.find((item) => item.id === courseId)?.title || '待配置'
const teacherName = (teacherId) => props.state.teachers.find((item) => item.id === teacherId)?.name || '待配置'

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

  <PageHead :eyebrow="config.eyebrow" :title="config.title">
    <div class="button-pair">
      <button v-if="state.isAdmin" class="secondary" @click="$emit('open-import')">导入数据</button>
      <button class="primary" @click="startNew">{{ config.action }}</button>
    </div>
  </PageHead>

  <section class="master-layout" :class="{ 'mobile-detail-open': isMobileFlow && mobileShowingDetail }">
    <aside v-show="!isMobileFlow || !mobileShowingDetail" class="master-list panel">
      <div class="section-head">
        <div>
          <span>数据列表</span>
          <strong>{{ records.length }} 条记录</strong>
        </div>
      </div>
      <button
        v-for="record in records"
        :key="record.id"
        class="master-row"
        :class="{ active: selected?.id === record.id && mode !== 'new' }"
        @click="selectRecord(record)"
      >
        <strong>{{ record.name || record.title }}</strong>
        <span v-if="entity === 'students'">{{ className(record.classId) }} · {{ record.status }}</span>
        <span v-if="entity === 'classes'">{{ record.time }} · {{ record.status }}</span>
        <span v-if="entity === 'courses'">{{ record.age }} · {{ record.defaultFocus }}</span>
      </button>
      <div v-if="!records.length" class="notice-box">
        <small>{{ config.empty }}</small>
      </div>
    </aside>

    <section v-show="!isMobileFlow || mobileShowingDetail" class="master-detail panel">
      <div class="section-head">
        <div>
          <span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span>
          <strong>{{ mode === 'new' ? config.action : selected?.name || selected?.title }}</strong>
        </div>
        <div class="button-pair">
          <button v-if="mode === 'detail'" class="secondary" @click="startEdit">编辑</button>
          <button v-if="mode !== 'detail'" class="ghost" @click="mode = 'detail'; resetDraft()">取消</button>
          <button v-if="mode !== 'detail'" class="primary" @click="save">保存</button>
        </div>
      </div>

      <template v-if="entity === 'students'">
        <div class="form-grid">
          <label>姓名<input v-model="draft.name" /></label>
          <label>小名<input v-model="draft.nickname" /></label>
          <label>年龄<input v-model="draft.age" type="number" /></label>
          <label>
            所属班级
            <AdaptiveSelect v-model="draft.classId" :options="state.classes.map((klass) => ({ label: klass.name, value: klass.id }))" />
          </label>
          <label>家长称呼<input v-model="draft.parent" /></label>
          <label>家长电话<input v-model="draft.phone" /></label>
          <label>
            状态
            <AdaptiveSelect v-model="draft.status" :options="['在读', '停课', '请假', '退费']" />
          </label>
          <label class="wide">备注<textarea v-model="draft.note" rows="5" /></label>
        </div>
      </template>

      <template v-if="entity === 'classes'">
        <div class="form-grid">
          <label>班级名<input v-model="draft.name" /></label>
          <label>上课时间<input v-model="draft.time" /></label>
          <label>
            任课老师
            <AdaptiveSelect v-model="draft.teacherId" :options="state.teachers.map((teacher) => ({ label: teacher.name, value: teacher.id }))" />
          </label>
          <label>
            默认课程
            <AdaptiveSelect v-model="draft.courseId" :options="state.courses.map((course) => ({ label: course.title, value: course.id }))" />
          </label>
          <label>
            状态
            <AdaptiveSelect v-model="draft.status" :options="['筹备中', '开班中', '停课', '结课']" />
          </label>
          <label class="wide">家长群<input v-model="draft.group" /></label>
        </div>
        <div class="member-picker">
          <strong>学生名单</strong>
          <label v-for="student in state.students" :key="student.id" class="inline-check">
            <input type="checkbox" :checked="draft.studentIds?.includes(student.id)" @change="toggleStudentInClass(student.id)" />
            <span>{{ student.name }} · {{ student.status }} · {{ className(student.classId) }}</span>
          </label>
        </div>
      </template>

      <template v-if="entity === 'courses'">
        <div class="form-grid">
          <label>课程主题<input v-model="draft.title" /></label>
          <label>适用年龄<input v-model="draft.age" /></label>
          <label>默认关注点<input v-model="draft.defaultFocus" /></label>
          <label>材料<input v-model="draft.materials" /></label>
          <label>
            课评模板
            <AdaptiveSelect v-model="draft.commentTemplate" :options="state.templates.comment.map((template) => template.name)" />
          </label>
          <label>
            图片模板
            <AdaptiveSelect v-model="draft.imageTemplate" :options="state.templates.image.map((template) => template.name)" />
          </label>
          <label class="wide">教学目标<textarea v-model="draft.goal" rows="3" /></label>
          <label class="wide">AI 参考材料和特殊话术<textarea v-model="draft.reference" rows="5" /></label>
        </div>
        <div class="member-picker">
          <strong>可附带外部课程链接</strong>
          <label v-for="link in state.externalLinks" :key="link.id" class="inline-check">
            <input type="checkbox" :checked="draft.onlineLinks?.includes(link.title)" @change="toggleCourseLink(link.title)" />
            <span>{{ link.title }} · {{ link.note }}</span>
          </label>
        </div>
      </template>
    </section>

  </section>
</template>
