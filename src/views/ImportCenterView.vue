<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: { type: Object, required: true },
  initialType: { type: String, default: '综合课表' }
})

const mode = ref('home')
const dataType = ref(props.initialType)
const dataSource = '小麦 Excel 导出'
const fileName = ref('')
const selectedFile = ref(null)
const importError = ref('')
const operation = ref('preview')
const showMapping = ref(false)
const teacherSelections = ref({})
const fieldMapping = ref({
  name: '学生姓名',
  classNames: '所在班级',
  phone: '手机号',
  age: '年龄',
  externalId: '学号',
  note: '备注',
  className: '班级名称',
  teacherName: '任课老师',
  courseTitle: '课程主题',
  classroom: '教室',
  capacity: '人数/容量',
  memberName: '学生姓名',
  memberPhone: '手机号'
})

watch(() => props.initialType, (value) => { dataType.value = value })
watch(dataType, () => {
  if (selectedFile.value && mode.value === 'select' && !isBusy.value) {
    props.state.stageImportFile(selectedFile.value, dataSource, dataType.value)
  }
})

onMounted(() => {
  void props.state.loadMasterData?.('teachers', { archiveState: 'ACTIVE', force: false })
  void props.state.loadTeacherSourceMappings?.({ sourceType: 'WHEAT_EXCEL' })
})

const isBusy = computed(() => mode.value === 'processing')
const rows = computed(() => {
  if (dataType.value === '学生名单') return props.state.importPreviewRows.filter((row) => row.type === 'student')
  if (dataType.value === '班级课表') return props.state.importPreviewRows.filter((row) => row.type === 'class' || row.type === 'lesson')
  return props.state.importPreviewRows
})
const validRows = computed(() => rows.value.filter((row) => row.status === '可导入'))
const warningRows = computed(() => rows.value.filter((row) => row.status !== '可导入'))
const latestBatch = computed(() => props.state.importBatches[0] || {
  source: '暂无导入记录',
  time: '',
  success: 0,
  failed: 0,
  note: '',
  statusLabel: ''
})
const columns = computed(() => {
  if (dataType.value === '学生名单') return ['学生姓名', '所在班级', '手机号', '年龄', '学号', '备注']
  if (dataType.value === '班级课表') return ['班级名称', '任课老师', '课程主题', '学生姓名', '手机号', '教室', '人数/容量']
  return []
})
const mappingFields = computed(() => {
  if (dataType.value === '学生名单') {
    return [
      { key: 'name', label: '学生姓名', required: true },
      { key: 'classNames', label: '所在班级' },
      { key: 'phone', label: '家长手机号' },
      { key: 'age', label: '年龄' },
      { key: 'externalId', label: '学员编号' },
      { key: 'note', label: '备注' }
    ]
  }
  if (dataType.value === '班级课表') {
    return [
      { key: 'className', label: '班级名称', required: true },
      { key: 'teacherName', label: '任课老师' },
      { key: 'courseTitle', label: '课程主题' },
      { key: 'memberName', label: '学生姓名' },
      { key: 'memberPhone', label: '手机号' },
      { key: 'classroom', label: '教室' },
      { key: 'capacity', label: '人数/容量' }
    ]
  }
  return []
})
const mappingOptions = computed(() => [...new Set(['', ...columns.value, '学员姓名', '学生姓名', '姓名', '所在班级', '班级', '手机号', '手机号码', '年龄', '学号', '备注', '任课老师', '课程主题', '学生姓名', '教室', '人数/容量'])])
const processingTitle = computed(() => operation.value === 'confirm' ? '正在确认导入' : '正在上传并生成预览')
const processingDetail = computed(() => operation.value === 'confirm'
  ? '可导入的数据正在写入基础数据，异常数据不会被写入。'
  : '系统正在读取文件、识别字段并检查重复项，预览完成前不会写入正式数据。')

const relationText = (row) => {
  if (row.type === 'student') return [row.className, row.parent, row.phone].filter(Boolean).join(' · ') || '未填写关联信息'
  return row.className || row.teacher || row.course || '待识别'
}

const teacherMatchLabels = {
  MATCHED: '已匹配',
  UNMATCHED: '老师未匹配',
  AMBIGUOUS: '同名老师冲突',
  ARCHIVED: '老师已归档'
}
const isTeacherRow = (row) => row.type !== 'student' && Boolean(row.teacher)
const teacherMatchLabel = (row) => teacherMatchLabels[row.teacherMatchStatus] || (isTeacherRow(row) ? '待检查' : '')
const teacherOptions = (row) => {
  const candidates = (Array.isArray(row.teacherCandidates) ? row.teacherCandidates : []).filter((teacher) => !teacher.archived)
  const available = candidates.length
    ? candidates
    : (props.state.teachers || []).filter((teacher) => !teacher.archived && teacher.status === '启用')
  return available.map((teacher) => ({
    label: `${teacher.name || teacher.displayName || '未命名老师'}${teacher.userId ? ' · 已绑定账号' : ' · 未绑定账号'}`,
    value: teacher.id
  }))
}
const selectedTeacherId = (row) => teacherSelections.value[row.id] || (row.teacherMatchStatus === 'MATCHED' ? row.teacherId : null)
const saveTeacherMapping = async (row) => {
  const teacherId = selectedTeacherId(row)
  if (!row.teacher || !teacherId) {
    props.state.notify('请先选择要关联的系统老师')
    return
  }
  await props.state.loadTeacherSourceMappings?.()
  const normalized = String(row.teacher).replace(/\s+/g, '').toLowerCase()
  const current = (props.state.teacherSourceMappings || []).find((mapping) =>
    String(mapping.sourceType || 'WHEAT_EXCEL') === 'WHEAT_EXCEL' &&
    String(mapping.sourceName || '').replace(/\s+/g, '').toLowerCase() === normalized
  )
  const saved = await props.state.saveTeacherSourceMapping?.({
    sourceType: 'WHEAT_EXCEL',
    sourceName: row.teacher,
    teacherId,
    version: current?.version || 0
  })
  if (saved) await readPreview()
}

const resetSelection = () => {
  fileName.value = ''
  selectedFile.value = null
  importError.value = ''
  showMapping.value = false
  teacherSelections.value = {}
  operation.value = 'preview'
}

const startImport = () => {
  resetSelection()
  mode.value = 'select'
}

const exitImport = () => {
  if (isBusy.value) return
  resetSelection()
  mode.value = 'home'
}

const errorMessageFromState = () => props.state.toast || '文件读取失败，请检查文件格式后重试。'

const readPreview = async () => {
  if (!selectedFile.value || isBusy.value) return false
  importError.value = ''
  operation.value = 'preview'
  mode.value = 'processing'
  const result = await props.state.previewImport(showMapping.value ? fieldMapping.value : {})
  if (!result) {
    importError.value = errorMessageFromState()
    mode.value = 'select'
    return false
  }
  showMapping.value = false
  mode.value = 'preview'
  return true
}

const handleFile = async (event) => {
  const file = event.target.files?.[0]
  if (!file || isBusy.value) return
  selectedFile.value = file
  fileName.value = file.name
  importError.value = ''
  showMapping.value = false
  props.state.stageImportFile(file, dataSource, dataType.value)
  await readPreview()
}

const retryPreview = async () => readPreview()

const confirmImport = async () => {
  if (isBusy.value || !validRows.value.length) return
  importError.value = ''
  operation.value = 'confirm'
  mode.value = 'processing'
  const result = await props.state.applyImportRows()
  if (!result) {
    importError.value = errorMessageFromState()
    mode.value = 'preview'
    return
  }
  mode.value = 'done'
}
</script>

<template>
  <PageHead eyebrow="基础数据" title="数据导入">
    <button v-if="mode === 'home'" class="primary" type="button" @click="startImport">选择文件</button>
    <button v-else class="ghost" type="button" :disabled="isBusy" @click="exitImport">退出本次导入</button>
  </PageHead>

  <template v-if="mode === 'home'">
    <section class="import-home-hero panel">
      <div>
        <span>最近一次导入</span>
        <h2>{{ latestBatch.source }}</h2>
        <p v-if="latestBatch.statusCode === 'IMPORTED'">{{ latestBatch.time }} · 已写入 {{ latestBatch.importedRows }} 条数据</p>
        <p v-else-if="latestBatch.statusCode === 'PREVIEW_READY'">{{ latestBatch.time }} · 已生成预览，待确认写入 {{ latestBatch.readyRows }} 条</p>
        <p v-else>{{ latestBatch.time }} · {{ latestBatch.statusLabel || latestBatch.note || '尚无导入记录' }}</p>
      </div>
      <div v-if="latestBatch.failed" class="import-attention">
        <strong>{{ latestBatch.failed }} 条数据需要留意</strong>
      </div>
      <div v-else-if="latestBatch.statusCode === 'IMPORTED'" class="import-complete">✓ 已全部完成</div>
    </section>

    <section class="import-start-card panel">
      <div>
        <span>导入新的数据</span>
        <strong>选择 Excel 后系统会自动读取并生成预览</strong>
      </div>
      <button class="primary" type="button" @click="startImport">选择文件</button>
    </section>

    <details class="import-history panel">
      <summary>查看历史导入记录 <span>{{ state.importBatches.length }} 个批次</span></summary>
      <article v-for="batch in state.importBatches" :key="batch.id" class="import-history-row">
        <div><strong>{{ batch.source }}</strong><small>{{ batch.time }}</small></div>
        <span>{{ batch.statusLabel || batch.note }}</span>
        <small>已写入 {{ batch.importedRows }} · 可导入 {{ batch.readyRows }} · 需处理 {{ batch.failed }}</small>
      </article>
    </details>
  </template>

  <section v-else class="import-workspace panel">
    <section v-if="mode === 'select'" class="import-focus-step">
      <div class="import-step-copy">
        <span>数据导入</span>
        <h2>选择文件，系统会自动生成预览</h2>
      </div>

      <div class="import-type-picker">
        <button v-for="type in ['综合课表', '学生名单', '班级课表']" :key="type" type="button" :class="{ selected: dataType === type }" @click="dataType = type">
          <strong>{{ type }}</strong>
        </button>
      </div>


      <label class="upload-zone" :class="{ disabled: isBusy }">
        <strong>选择 Excel 文件</strong>
        <span>支持 .xls、.xlsx；选中文件后自动开始读取</span>
        <input type="file" accept=".xlsx,.xls" :disabled="isBusy" @click="$event.target.value = ''" @change="handleFile" />
      </label>

      <div v-if="fileName" class="file-pill">
        <strong>{{ fileName }}</strong>
        <small>{{ dataType }} · {{ dataSource }}</small>
      </div>

      <div v-if="importError" class="import-error" role="alert">
        <strong>读取失败</strong>
        <span>{{ importError }}</span>
        <div class="import-error-actions">
          <button class="secondary" type="button" @click="retryPreview">重试读取</button>
          <button v-if="mappingFields.length" class="ghost" type="button" @click="showMapping = true">调整字段映射</button>
        </div>
      </div>

      <details v-if="showMapping && mappingFields.length" class="import-mapping-fallback" open>
        <summary>字段映射</summary>
        <div class="mapping-grid">
          <label v-for="field in mappingFields" :key="field.key">
            {{ field.label }}<em v-if="field.required">必填</em>
            <AdaptiveSelect v-model="fieldMapping[field.key]" :options="[{ label: '自动识别', value: '' }, ...mappingOptions.filter((option) => option)]" />
          </label>
        </div>
        <button class="primary" type="button" @click="retryPreview">按此映射重新读取</button>
      </details>
    </section>

    <section v-else-if="mode === 'processing'" class="import-processing import-focus-step" aria-live="polite">
      <div class="import-processing-icon"><span></span></div>
      <span>请稍候</span>
      <h2>{{ processingTitle }}</h2>
      <p>{{ processingDetail }}</p>
      <div class="import-processing-file">{{ fileName }}</div>
    </section>

    <section v-else-if="mode === 'preview'" class="import-focus-step">
      <div class="import-step-copy">
        <span>预览结果</span>
        <h2>{{ warningRows.length ? `有 ${warningRows.length} 条数据需要留意` : '数据已经可以导入' }}</h2>
        <p>{{ fileName }} · 当前仍处于预览阶段，尚未写入正式数据。</p>
      </div>
      <div class="import-summary">
        <article><span>本次识别</span><strong>{{ rows.length }}</strong></article>
        <article><span>可以导入</span><strong>{{ validRows.length }}</strong></article>
        <article><span>暂不导入</span><strong>{{ warningRows.length }}</strong></article>
      </div>
      <div class="notice-box">
        <strong>异常行不会写入，正常行仍可导入。</strong>
        <small>老师未匹配、同名冲突或已归档的班级/课次行需要先选择系统老师并保存映射，再重新检查当前批次。</small>
      </div>
      <div class="preview-table">
        <div class="preview-row head"><strong>名称</strong><strong>关联信息</strong><strong>结果</strong><strong>说明</strong></div>
        <div v-for="row in rows" :key="row.id" class="preview-row" :class="row.status">
          <span>{{ row.name }}</span>
          <span>
            {{ relationText(row) }}
            <small v-if="isTeacherRow(row)" class="teacher-match-line">老师：{{ row.teacher }} · {{ teacherMatchLabel(row) }}</small>
            <template v-if="isTeacherRow(row) && row.teacherMatchStatus !== 'MATCHED'">
              <AdaptiveSelect v-model="teacherSelections[row.id]" :options="[{ label: '选择系统老师', value: null }, ...teacherOptions(row)]" />
              <button class="ghost" type="button" :disabled="!selectedTeacherId(row)" @click="saveTeacherMapping(row)">选择并保存映射</button>
            </template>
          </span>
          <span>{{ row.status }}</span>
          <span>{{ row.issue || '可以写入' }}</span>
        </div>
        <div v-if="!rows.length" class="import-empty-preview">没有识别到可展示的数据，请返回重试或检查文件内容。</div>
      </div>
      <div v-if="importError" class="import-error" role="alert"><strong>确认失败</strong><span>{{ importError }}</span></div>
      <footer class="modal-actions">
        <button class="ghost" type="button" @click="startImport">重新选择</button>
        <button class="primary" type="button" :disabled="!validRows.length" @click="confirmImport">确认导入 {{ validRows.length }} 条</button>
      </footer>
    </section>

    <section v-else class="import-done">
      <span>✓</span>
      <h2>导入完成</h2>
      <p>{{ validRows.length }} 条资料已经写入，{{ warningRows.length }} 条问题数据已保留。</p>
      <button class="primary" type="button" @click="mode = 'home'">返回数据导入</button>
    </section>
  </section>
</template>
