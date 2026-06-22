<script setup>
import { computed, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  entity: {
    type: String,
    required: true
  }
})
defineEmits(['open-import'])

const selectedId = ref(null)
const mode = ref('detail')

const config = computed(() => {
  const map = {
    students: { eyebrow: '基础资料', title: '学生管理', action: '新增学生', empty: '暂无学生' },
    classes: { eyebrow: '基础资料', title: '班级管理', action: '新增班级', empty: '暂无班级' },
    courses: { eyebrow: '教研资料', title: '课程资料', action: '新增课程', empty: '暂无课程' }
  }
  return map[props.entity]
})

const records = computed(() => {
  if (props.entity === 'students') return props.state.students
  if (props.entity === 'classes') return props.state.classes
  return props.state.courses
})

const selected = computed(() => records.value.find((item) => item.id === selectedId.value) || records.value[0] || null)
const selectedStudentHistory = computed(() => (props.entity === 'students' && selected.value ? props.state.studentHistoryFor(selected.value.id) : []))

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
}

const startNew = () => {
  mode.value = 'new'
  draft.value = blankDraft()
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
  resetDraft()
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

</script>

<template>
  <PageHead :eyebrow="config.eyebrow" :title="config.title">
    <div class="button-pair">
      <button v-if="state.isAdmin" class="secondary" @click="$emit('open-import')">导入数据</button>
      <button class="primary" @click="startNew">{{ config.action }}</button>
    </div>
  </PageHead>

  <section class="master-layout">
    <aside class="master-list panel">
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

    <section class="master-detail panel">
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
            <select v-model.number="draft.classId">
              <option v-for="klass in state.classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
            </select>
          </label>
          <label>家长称呼<input v-model="draft.parent" /></label>
          <label>家长电话<input v-model="draft.phone" /></label>
          <label>
            状态
            <select v-model="draft.status">
              <option>在读</option>
              <option>停课</option>
              <option>请假</option>
              <option>退费</option>
            </select>
          </label>
          <label class="wide">备注<textarea v-model="draft.note" rows="5" /></label>
        </div>
        <div class="detail-metrics" v-if="selected && mode !== 'new'">
          <article><span>历史作品</span><strong>{{ selected.works }}</strong></article>
          <article><span>高光作品</span><strong>{{ selected.highlights }}</strong></article>
          <article><span>当前班级</span><strong>{{ className(selected.classId) }}</strong></article>
        </div>
        <div v-if="selected && mode !== 'new'" class="student-history">
          <div class="section-head">
            <div>
              <span>学生历史记录</span>
              <strong>{{ selectedStudentHistory.length }} 条课后归档</strong>
            </div>
          </div>
          <article v-for="record in selectedStudentHistory" :key="record.id" class="history-card">
            <img :src="record.artwork" :alt="record.course" />
            <div>
              <strong>{{ record.date }} · {{ record.course }}</strong>
              <small>{{ record.className }} · {{ record.teacher }} · {{ record.lessonType }}</small>
              <p>{{ record.feedback }}</p>
              <em v-if="record.highlight">高光：{{ record.highlightNote }}</em>
              <span>课后任务：{{ record.homework }}</span>
            </div>
          </article>
          <div v-if="!selectedStudentHistory.length" class="notice-box">
            <small>暂无历史作品、课评、高光或任务记录。</small>
          </div>
        </div>
      </template>

      <template v-if="entity === 'classes'">
        <div class="form-grid">
          <label>班级名<input v-model="draft.name" /></label>
          <label>上课时间<input v-model="draft.time" /></label>
          <label>
            任课老师
            <select v-model.number="draft.teacherId">
              <option v-for="teacher in state.teachers" :key="teacher.id" :value="teacher.id">{{ teacher.name }}</option>
            </select>
          </label>
          <label>
            默认课程
            <select v-model.number="draft.courseId">
              <option v-for="course in state.courses" :key="course.id" :value="course.id">{{ course.title }}</option>
            </select>
          </label>
          <label>
            状态
            <select v-model="draft.status">
              <option>筹备中</option>
              <option>开班中</option>
              <option>停课</option>
              <option>结课</option>
            </select>
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
            <select v-model="draft.commentTemplate">
              <option v-for="template in state.templates.comment" :key="template.name">{{ template.name }}</option>
            </select>
          </label>
          <label>
            图片模板
            <select v-model="draft.imageTemplate">
              <option v-for="template in state.templates.image" :key="template.name">{{ template.name }}</option>
            </select>
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
