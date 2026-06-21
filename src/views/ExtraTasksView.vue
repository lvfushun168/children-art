<script setup>
import { computed, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const selectedId = ref(props.state.extraTaskArchives[0]?.id || null)
const mode = ref('detail')
const selected = computed(() => props.state.extraTaskArchives.find((task) => task.id === selectedId.value) || props.state.extraTaskArchives[0])

const lessonOptions = computed(() =>
  props.state.tasks.map((task) => {
    const klass = props.state.classes.find((item) => item.id === task.classId)
    return { id: task.id, label: `${task.date} ${task.time} · ${klass?.name || '班级'} · ${task.teacher}` }
  })
)

const blankDraft = () => ({
  title: '',
  taskType: '非课堂任务',
  owner: props.state.currentUser?.name || '',
  relatedLessonId: '',
  content: '',
  dueDate: '',
  status: '待归档',
  note: '一期仅归档查询，不计入绩效工资。'
})

const draft = ref(blankDraft())
const resetDraft = () => {
  draft.value = mode.value === 'new' ? blankDraft() : JSON.parse(JSON.stringify(selected.value || blankDraft()))
  if (!draft.value.relatedLessonId) draft.value.relatedLessonId = ''
}

watch(selected, () => {
  if (mode.value !== 'new') resetDraft()
}, { immediate: true })

const selectTask = (task) => {
  selectedId.value = task.id
  mode.value = 'detail'
  resetDraft()
}

const startNew = () => {
  mode.value = 'new'
  draft.value = blankDraft()
}

const startEdit = () => {
  mode.value = 'edit'
  resetDraft()
}

const save = () => {
  const saved = mode.value === 'new'
    ? props.state.addExtraTask(draft.value)
    : props.state.updateExtraTask(selected.value.id, draft.value)
  selectedId.value = saved.id
  mode.value = 'detail'
  resetDraft()
}
</script>

<template>
  <PageHead eyebrow="任务归档" title="课外任务归档">
    <div class="button-pair">
      <button class="secondary" @click="startEdit">编辑当前任务</button>
      <button class="primary" @click="startNew">新增课外任务</button>
    </div>
  </PageHead>

  <section class="extra-task-layout">
    <aside class="panel master-list">
      <div class="section-head">
        <div>
          <span>任务列表</span>
          <strong>{{ state.extraTaskArchives.length }} 条记录</strong>
        </div>
      </div>
      <button
        v-for="task in state.extraTaskArchives"
        :key="task.id"
        class="master-row"
        :class="{ active: selected?.id === task.id && mode !== 'new' }"
        @click="selectTask(task)"
      >
        <strong>{{ task.title }}</strong>
        <span>{{ task.taskType }} · {{ task.status }}</span>
        <small>{{ task.relatedLesson }}</small>
      </button>
    </aside>

    <section class="panel">
      <div class="section-head">
        <div>
          <span>{{ mode === 'new' ? '新增' : mode === 'edit' ? '编辑' : '详情' }}</span>
          <strong>{{ mode === 'new' ? '新增课外任务' : selected?.title }}</strong>
        </div>
        <div class="button-pair">
          <button v-if="mode !== 'detail'" class="ghost" @click="mode = 'detail'; resetDraft()">取消</button>
          <button v-if="mode !== 'detail'" class="primary" @click="save">保存归档</button>
        </div>
      </div>

      <div class="form-grid">
        <label>任务标题<input v-model="draft.title" /></label>
        <label>
          任务类型
          <select v-model="draft.taskType">
            <option>非课堂任务</option>
            <option>招生宣传</option>
            <option>作品整理</option>
            <option>教研准备</option>
            <option>其他</option>
          </select>
        </label>
        <label>
          负责人
          <select v-model="draft.owner">
            <option v-for="teacher in state.teachers" :key="teacher.id">{{ teacher.name }}</option>
          </select>
        </label>
        <label>
          关联课次
          <select v-model="draft.relatedLessonId">
            <option value="">无归属课次</option>
            <option v-for="lesson in lessonOptions" :key="lesson.id" :value="lesson.id">{{ lesson.label }}</option>
          </select>
        </label>
        <label>预计完成<input v-model="draft.dueDate" /></label>
        <label>
          状态
          <select v-model="draft.status">
            <option>待归档</option>
            <option>已归档</option>
            <option>异常</option>
          </select>
        </label>
        <label class="wide">任务内容<textarea v-model="draft.content" rows="5" /></label>
        <label class="wide">归档备注<textarea v-model="draft.note" rows="4" /></label>
      </div>
    </section>

    <aside class="panel">
      <div class="section-head">
        <div>
          <span>一期边界</span>
          <strong>只归档，不计绩效</strong>
        </div>
      </div>
      <div class="notice-box">
        <strong>ExtraTaskArchive</strong>
        <small>用于记录非课堂/课外任务，可关联某节课，也可以无归属课次。</small>
      </div>
      <div class="link-preview" v-if="selected">
        <strong>{{ selected.title }}</strong>
        <span>{{ selected.taskType }} · {{ selected.owner }} · {{ selected.status }}</span>
        <small>{{ selected.relatedLesson }}</small>
        <p>{{ selected.content }}</p>
        <em>{{ selected.note }}</em>
      </div>
    </aside>
  </section>
</template>
