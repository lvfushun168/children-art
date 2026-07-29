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
const studentDetailTab = ref('profile')
const communicationView = ref('list')
const communicationEditingId = ref(null)
const communicationMethodFilter = ref('全部方式')
const communicationFollowFilter = ref('全部记录')
let cleanupMobileMedia = () => {}

const studentProfileSections = [
  {
    title: '家庭画像',
    fields: [
      { key: 'residentialCommunity', label: '现住小区', hint: '教育消费力 & 距离' },
      { key: 'schoolName', label: '就读学校', hint: '教育消费力' },
      { key: 'trainingBrandInterest', label: '培训班品牌-兴趣', hint: '教育消费力 & 时间' }
    ]
  },
  {
    title: '母亲信息',
    fields: [
      { key: 'motherOccupation', label: '母职业职务', hint: '教育消费力 & 决策影响' },
      { key: 'motherSocialCircleEducation', label: '朋友圈-类别-学历', hint: '决策影响' },
      { key: 'motherCompanionTime', label: '陪伴时间 & 情况', hint: '决策影响' }
    ]
  },
  {
    title: '父亲信息',
    fields: [
      { key: 'fatherOccupation', label: '父职业职务', hint: '教育消费力 & 决策影响' },
      { key: 'fatherSocialCircleEducation', label: '朋友圈-类别-学历', hint: '决策影响' },
      { key: 'fatherCompanionTime', label: '陪伴时间 & 情况', hint: '决策影响' }
    ]
  },
  {
    title: '带养与决策',
    fields: [
      { key: 'caregivingMode', label: '代养模式', hint: '决策人和带养人关系' },
      { key: 'siblingRank', label: '家里孩子数量-排行', hint: '决策影响-家庭结构' },
      { key: 'primaryCaregiver', label: '带养人', hint: '直接或间接获取决策人信息' },
      { key: 'householdMembers', label: '现居一起的家庭成员', hint: '长辈、保姆、兄弟姐妹、父母全职自带' },
      { key: 'purchaseDecisionPower', label: '购买决策权', hint: '谁主要决策？谁能阻碍决策？' },
      { key: 'decisionInterviewTime', label: '决策人可面谈时间', hint: '判断面咨或签单时间，是否属于A类' }
    ]
  }
]

const studentProfileBlank = () =>
  Object.fromEntries(studentProfileSections.flatMap((section) => section.fields.map((field) => [field.key, ''])))

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
      note: '',
      ...studentProfileBlank()
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
const blankCommunicationDraft = () => ({
  studentId: selected.value?.id || null,
  contactPerson: selected.value?.parent || '',
  contactRole: '家长',
  contactMethod: '微信',
  content: '',
  followUpAction: '',
  recordedBy: props.state.currentUser?.name || '',
  recordedAt: props.state.nowText()
})
const communicationDraft = ref(blankCommunicationDraft())

const selectedCommunicationRecords = computed(() => {
  if (props.entity !== 'students' || !selected.value) return []
  return props.state.communicationRecordsFor(selected.value.id)
})
const communicationMethodOptions = computed(() => [
  '全部方式',
  ...new Set(selectedCommunicationRecords.value.map((record) => record.contactMethod).filter(Boolean))
])
const visibleCommunicationRecords = computed(() =>
  selectedCommunicationRecords.value
    .filter((record) => communicationMethodFilter.value === '全部方式' || record.contactMethod === communicationMethodFilter.value)
    .filter((record) => {
      if (communicationFollowFilter.value === '待跟进') return Boolean(record.followUpAction)
      if (communicationFollowFilter.value === '无跟进') return !record.followUpAction
      return true
    })
)
const communicationSummary = computed(() => ({
  total: selectedCommunicationRecords.value.length,
  pending: selectedCommunicationRecords.value.filter((record) => record.followUpAction).length
}))

const resetDraft = () => {
  draft.value = mode.value === 'new' ? blankDraft() : cloneRecord(selected.value)
}

const resetCommunicationDraft = () => {
  communicationEditingId.value = null
  communicationView.value = 'list'
  communicationDraft.value = blankCommunicationDraft()
}

watch(
  () => props.entity,
  () => {
    selectedId.value = records.value[0]?.id || null
    mode.value = 'detail'
    studentDetailTab.value = 'profile'
    mobileShowingDetail.value = false
    resetDraft()
    resetCommunicationDraft()
  },
  { immediate: true }
)

watch(selected, () => {
  if (mode.value !== 'new') resetDraft()
  resetCommunicationDraft()
})

const selectRecord = (record) => {
  selectedId.value = record.id
  mode.value = 'detail'
  studentDetailTab.value = 'profile'
  draft.value = cloneRecord(record)
  resetCommunicationDraft()
  if (isMobileFlow.value) mobileShowingDetail.value = true
}

const startNew = () => {
  mode.value = 'new'
  studentDetailTab.value = 'profile'
  draft.value = blankDraft()
  resetCommunicationDraft()
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

const saveCommunicationRecord = () => {
  if (!selected.value) return
  if (!communicationDraft.value.content.trim()) {
    props.state.notify('请填写沟通内容摘要')
    return
  }
  const payload = {
    ...communicationDraft.value,
    studentId: selected.value.id,
    recordedBy: communicationDraft.value.recordedBy || props.state.currentUser?.name || '当前用户'
  }
  if (communicationEditingId.value) props.state.updateCommunicationRecord(communicationEditingId.value, payload)
  else props.state.addCommunicationRecord(payload)
  resetCommunicationDraft()
}

const startNewCommunicationRecord = () => {
  communicationEditingId.value = null
  communicationDraft.value = blankCommunicationDraft()
  communicationView.value = 'form'
}

const editCommunicationRecord = (record) => {
  communicationEditingId.value = record.id
  communicationDraft.value = cloneRecord(record)
  communicationView.value = 'form'
}

const returnToCommunicationList = () => {
  communicationEditingId.value = null
  communicationDraft.value = blankCommunicationDraft()
  communicationView.value = 'list'
}

const deleteCommunicationRecord = (record) => {
  props.state.deleteCommunicationRecord(record.id)
  if (communicationEditingId.value === record.id) resetCommunicationDraft()
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
          <button v-if="mode === 'detail' && (entity !== 'students' || studentDetailTab === 'profile')" class="secondary" @click="startEdit">编辑</button>
          <button v-if="mode !== 'detail'" class="ghost" @click="mode = 'detail'; resetDraft()">取消</button>
          <button v-if="mode !== 'detail'" class="primary" @click="save">保存</button>
        </div>
      </div>

      <template v-if="entity === 'students'">
        <div v-if="mode !== 'new'" class="student-detail-tabs">
          <button :class="{ active: studentDetailTab === 'profile' }" type="button" @click="studentDetailTab = 'profile'">档案信息</button>
          <button :class="{ active: studentDetailTab === 'communication' }" type="button" @click="studentDetailTab = 'communication'; communicationView = 'list'">
            沟通记录
            <small>{{ communicationSummary.total }}</small>
          </button>
        </div>

        <template v-if="studentDetailTab === 'profile' || mode === 'new'">
          <section class="master-form-section">
            <strong>基础信息</strong>
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
              <label class="wide">备注<textarea v-model="draft.note" rows="4" /></label>
            </div>
          </section>

          <section v-for="section in studentProfileSections" :key="section.title" class="master-form-section">
            <strong>{{ section.title }}</strong>
            <div class="form-grid">
              <label v-for="field in section.fields" :key="field.key">
                {{ field.label }}
                <input v-model="draft[field.key]" :placeholder="field.hint" />
              </label>
            </div>
          </section>
        </template>

        <section v-else class="student-communication-panel">
          <template v-if="communicationView === 'list'">
            <div class="communication-list-head">
              <div class="communication-summary">
                <article>
                  <span>累计沟通</span>
                  <strong>{{ communicationSummary.total }}</strong>
                </article>
                <article>
                  <span>待跟进</span>
                  <strong>{{ communicationSummary.pending }}</strong>
                </article>
              </div>
              <button class="primary" type="button" @click="startNewCommunicationRecord">新增记录</button>
            </div>

            <div class="communication-toolbar">
              <label>
                沟通方式
                <AdaptiveSelect v-model="communicationMethodFilter" :options="communicationMethodOptions" />
              </label>
              <label>
                跟进状态
                <AdaptiveSelect v-model="communicationFollowFilter" :options="['全部记录', '待跟进', '无跟进']" />
              </label>
            </div>

            <div class="communication-timeline">
              <article v-for="record in visibleCommunicationRecords" :key="record.id" class="communication-record">
                <div class="communication-record-mark" />
                <div class="communication-record-body">
                  <header>
                    <div>
                      <strong>{{ record.contactPerson }}</strong>
                      <span>{{ record.contactRole }} · {{ record.contactMethod }} · {{ record.recordedAt }}</span>
                    </div>
                    <div class="button-pair">
                      <button class="ghost" type="button" @click="editCommunicationRecord(record)">编辑</button>
                      <button class="danger-text" type="button" @click="deleteCommunicationRecord(record)">删除</button>
                    </div>
                  </header>
                  <p>{{ record.content }}</p>
                  <em v-if="record.followUpAction">跟进：{{ record.followUpAction }}</em>
                  <small>记录人：{{ record.recordedBy }}{{ record.updatedAt ? ` · 更新于 ${record.updatedAt}` : '' }}</small>
                </div>
              </article>
              <div v-if="!visibleCommunicationRecords.length" class="notice-box">
                <small>暂无符合条件的沟通记录</small>
              </div>
            </div>
          </template>

          <section v-else class="communication-form-page">
            <div class="communication-form-head">
              <button class="module-back-link" type="button" @click="returnToCommunicationList">← 返回沟通记录</button>
              <div>
                <span>{{ communicationEditingId ? '编辑记录' : '新增记录' }}</span>
                <strong>{{ selected?.name }} · 沟通记录</strong>
              </div>
            </div>

            <div class="master-form-section communication-editor">
              <div class="form-grid">
                <label>沟通时间<input v-model="communicationDraft.recordedAt" /></label>
                <label>记录人<input v-model="communicationDraft.recordedBy" /></label>
                <label>沟通对象<input v-model="communicationDraft.contactPerson" /></label>
                <label>对象角色<input v-model="communicationDraft.contactRole" /></label>
                <label>
                  沟通方式
                  <AdaptiveSelect v-model="communicationDraft.contactMethod" :options="['微信', '电话', '到店沟通', '企业微信', '家长会', '其他']" />
                </label>
                <label class="wide">内容摘要<textarea v-model="communicationDraft.content" rows="5" placeholder="记录家长反馈、孩子状态、续课关注点或特殊情况" /></label>
                <label class="wide">跟进事项<textarea v-model="communicationDraft.followUpAction" rows="4" placeholder="没有待跟进事项可留空" /></label>
              </div>
              <div class="button-pair">
                <button class="ghost" type="button" @click="returnToCommunicationList">取消</button>
                <button class="primary" type="button" @click="saveCommunicationRecord">{{ communicationEditingId ? '保存记录' : '新增记录' }}</button>
              </div>
            </div>
          </section>
        </section>
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
