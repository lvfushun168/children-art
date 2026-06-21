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

const selectedId = ref(null)
const mode = ref('detail')
const showImportDialog = ref(false)
const importStep = ref('upload')
const importFileName = ref('')
const importSource = ref('小麦 Excel 导出')
const fieldMapping = ref({
  name: '学生姓名',
  nickname: '小名',
  className: '班级名称',
  parent: '家长称呼',
  phone: '手机号',
  teacher: '任课老师',
  time: '上课时间',
  course: '课程主题'
})

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

const filteredImportRows = computed(() => {
  if (props.entity === 'students') return props.state.importPreviewRows.filter((row) => row.type === 'student')
  if (props.entity === 'classes') return props.state.importPreviewRows.filter((row) => row.type === 'class' || row.type === 'lesson')
  return props.state.importPreviewRows.filter((row) => row.type === 'class' || row.type === 'lesson')
})

const importColumns = computed(() => {
  if (props.entity === 'students') return ['学生姓名', '小名', '班级名称', '家长称呼', '手机号']
  if (props.entity === 'classes') return ['班级名称', '任课老师', '上课时间', '默认课程', '状态']
  return ['课程主题', '适用年龄', '教学目标', '材料', '参考话术']
})

const openImportDialog = () => {
  showImportDialog.value = true
  importStep.value = 'upload'
  importFileName.value = ''
}

const handleImportFile = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  importFileName.value = file.name
  importStep.value = 'mapping'
}

const loadDemoImportFile = () => {
  importFileName.value = props.entity === 'students' ? '小麦学员名单-20260621.xlsx' : '小麦班级课表-20260621.xlsx'
  importStep.value = 'mapping'
}

const previewImport = () => {
  importStep.value = 'preview'
  props.state.notify(`已解析 ${importFileName.value || 'Excel 文件'}，请确认导入预览`)
}

const confirmImport = () => {
  props.state.applyImportRows()
  showImportDialog.value = false
  importStep.value = 'upload'
}
</script>

<template>
  <PageHead :eyebrow="config.eyebrow" :title="config.title">
    <div class="button-pair">
      <button class="secondary" @click="openImportDialog">导入 Excel</button>
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

    <aside class="import-panel panel">
      <div class="section-head">
        <div>
          <span>最近导入结果</span>
          <strong>{{ state.importStats.ok }}/{{ state.importStats.total }} 可导入</strong>
        </div>
      </div>
      <div class="paste-box">
        <strong>导入入口</strong>
        <small>点击页面右上角“导入 Excel”，选择小麦导出的 .xlsx / .xls 文件后再进入字段映射和预览。</small>
      </div>
      <div v-for="row in filteredImportRows" :key="row.id" class="import-row" :class="row.status">
        <strong>{{ row.name }}</strong>
        <span>{{ row.className || row.teacher || row.course || '待识别' }}</span>
        <small>{{ row.status }}{{ row.issue ? ` · ${row.issue}` : '' }}</small>
      </div>
      <div class="notice-box">
        <strong>验收覆盖</strong>
        <small>导入必须经过文件选择、字段映射、预览校验、异常处理和最终确认。</small>
      </div>
    </aside>
  </section>

  <div v-if="showImportDialog" class="modal-backdrop">
    <section class="import-modal">
      <header class="modal-head">
        <div>
          <span>Excel 导入</span>
          <strong>{{ config.title }}</strong>
        </div>
        <button class="ghost" @click="showImportDialog = false">关闭</button>
      </header>

      <nav class="import-steps">
        <span :class="{ active: importStep === 'upload' }">1 选择文件</span>
        <span :class="{ active: importStep === 'mapping' }">2 字段映射</span>
        <span :class="{ active: importStep === 'preview' }">3 预览确认</span>
      </nav>

      <section v-if="importStep === 'upload'" class="modal-section">
        <label>
          数据来源
          <select v-model="importSource">
            <option>小麦 Excel 导出</option>
            <option>小麦课表整理表</option>
            <option>手工维护表格</option>
          </select>
        </label>
        <label class="upload-zone">
          <strong>选择 Excel 文件</strong>
          <small>支持 .xlsx / .xls / .csv；选择后只进入预览，不会直接新增数据。</small>
          <input type="file" accept=".xlsx,.xls,.csv" @change="handleImportFile" />
        </label>
        <button class="secondary" @click="loadDemoImportFile">原型演示：加载示例 Excel</button>
        <div class="notice-box">
          <strong>开发要求</strong>
          <small>后端需保存导入批次、原始文件名、来源、解析结果、成功/失败数量和异常明细。</small>
        </div>
      </section>

      <section v-if="importStep === 'mapping'" class="modal-section">
        <div class="file-pill">
          <strong>{{ importFileName }}</strong>
          <small>{{ importSource }} · 待映射字段</small>
        </div>
        <div class="mapping-grid">
          <label v-for="column in importColumns" :key="column">
            {{ column }}
            <select v-model="fieldMapping[column.includes('班级') ? 'className' : column.includes('老师') ? 'teacher' : column.includes('时间') ? 'time' : column.includes('课程') ? 'course' : column.includes('电话') || column.includes('手机号') ? 'phone' : column.includes('家长') ? 'parent' : column.includes('小名') ? 'nickname' : 'name']">
              <option>{{ column }}</option>
              <option>学生姓名</option>
              <option>小名</option>
              <option>班级名称</option>
              <option>家长称呼</option>
              <option>手机号</option>
              <option>任课老师</option>
              <option>上课时间</option>
              <option>课程主题</option>
            </select>
          </label>
        </div>
        <footer class="modal-actions">
          <button class="ghost" @click="importStep = 'upload'">重新选择</button>
          <button class="primary" @click="previewImport">解析并预览</button>
        </footer>
      </section>

      <section v-if="importStep === 'preview'" class="modal-section">
        <div class="import-summary">
          <article>
            <span>文件</span>
            <strong>{{ importFileName }}</strong>
          </article>
          <article>
            <span>可导入</span>
            <strong>{{ filteredImportRows.filter((row) => row.status === '可导入').length }}</strong>
          </article>
          <article>
            <span>需处理</span>
            <strong>{{ filteredImportRows.filter((row) => row.status !== '可导入').length }}</strong>
          </article>
        </div>
        <div class="preview-table">
          <div class="preview-row head">
            <strong>名称</strong>
            <strong>识别字段</strong>
            <strong>状态</strong>
            <strong>异常</strong>
          </div>
          <div v-for="row in filteredImportRows" :key="row.id" class="preview-row" :class="row.status">
            <span>{{ row.name }}</span>
            <span>{{ row.className || row.teacher || row.course || '待识别' }}</span>
            <span>{{ row.status }}</span>
            <span>{{ row.issue || '无' }}</span>
          </div>
        </div>
        <div class="notice-box">
          <strong>异常处理规则</strong>
          <small>缺少班级、重复课次、字段无法识别的数据不得直接入库，需要老师/教务补录或跳过。</small>
        </div>
        <footer class="modal-actions">
          <button class="ghost" @click="importStep = 'mapping'">返回映射</button>
          <button class="primary" @click="confirmImport">确认导入可用数据</button>
        </footer>
      </section>
    </section>
  </div>
</template>
