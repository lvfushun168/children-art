<script setup>
import { computed, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const selectedId = ref(props.state.externalLinks[0]?.id || null)
const mode = ref('detail')

const selected = computed(() => props.state.externalLinks.find((link) => link.id === selectedId.value) || props.state.externalLinks[0])

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
}

const startNew = () => {
  mode.value = 'new'
  draft.value = blankDraft()
}

const startEdit = () => {
  mode.value = 'edit'
  resetDraft()
}

const toggleCourse = (courseId) => {
  const ids = draft.value.courseIds || []
  draft.value.courseIds = ids.includes(courseId) ? ids.filter((id) => id !== courseId) : [...ids, courseId]
}

const courseNames = (courseIds = []) =>
  courseIds.map((id) => props.state.courses.find((course) => course.id === id)?.title).filter(Boolean).join('、') || '未绑定课程'

const save = () => {
  const saved = mode.value === 'new'
    ? props.state.addExternalLink(draft.value)
    : props.state.updateExternalLink(selected.value.id, draft.value)
  selectedId.value = saved.id
  mode.value = 'detail'
  resetDraft()
}
</script>

<template>
  <PageHead eyebrow="课后任务资源" title="外部在线课程链接">
    <div class="button-pair">
      <button class="secondary" @click="startEdit">编辑当前链接</button>
      <button class="primary" @click="startNew">新增外部课程</button>
    </div>
  </PageHead>

  <section class="external-link-layout">
    <aside class="panel master-list">
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
        :class="{ active: selected?.id === link.id && mode !== 'new' }"
        @click="selectLink(link)"
      >
        <strong>{{ link.title }}</strong>
        <span>{{ link.platform }} · {{ link.status }}</span>
        <small>{{ courseNames(link.courseIds) }}</small>
      </button>
    </aside>

    <section class="panel">
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
        <label>
          状态
          <select v-model="draft.status">
            <option>启用</option>
            <option>停用</option>
          </select>
        </label>
        <label>
          平台
          <select v-model="draft.platform">
            <option>创客匠人</option>
            <option>通用链接</option>
            <option>网盘资料</option>
            <option>其他平台</option>
          </select>
        </label>
        <label class="wide">链接地址<input v-model="draft.url" /></label>
        <label class="wide">备注<textarea v-model="draft.note" rows="4" /></label>
      </div>

      <div class="member-picker">
        <strong>适用课程主题</strong>
        <label v-for="course in state.courses" :key="course.id" class="inline-check">
          <input type="checkbox" :checked="draft.courseIds?.includes(course.id)" @change="toggleCourse(course.id)" />
          <span>{{ course.title }} · {{ course.age }}</span>
        </label>
      </div>
    </section>

    <aside class="panel">
      <div class="section-head">
        <div>
          <span>引用预览</span>
          <strong>{{ selected?.title || '未选择' }}</strong>
        </div>
      </div>
      <div class="notice-box">
        <strong>数据对象</strong>
        <small>ExternalCourseLink 独立维护，课后任务只引用链接，不同步第三方账号、订单或学习进度。</small>
      </div>
      <div class="link-preview" v-if="selected">
        <strong>{{ selected.title }}</strong>
        <span>{{ selected.platform }} · {{ selected.status }}</span>
        <small>{{ selected.url }}</small>
        <p>{{ selected.note }}</p>
        <em>{{ courseNames(selected.courseIds) }}</em>
      </div>
    </aside>
  </section>
</template>
