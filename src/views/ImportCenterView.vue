<script setup>
import { computed, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: { type: Object, required: true },
  initialType: { type: String, default: '综合课表' }
})

const mode = ref('home')
const dataType = ref(props.initialType)
const source = ref('小麦 Excel 导出')
const fileName = ref('')
const fieldMapping = ref({
  name: '学生姓名',
  className: '班级名称',
  teacher: '任课老师',
  time: '上课时间',
  course: '课程主题'
})

watch(() => props.initialType, (value) => { dataType.value = value })

const rows = computed(() => {
  if (dataType.value === '学生名单') return props.state.importPreviewRows.filter((row) => row.type === 'student')
  if (dataType.value === '班级课表') return props.state.importPreviewRows.filter((row) => row.type === 'class' || row.type === 'lesson')
  return props.state.importPreviewRows
})
const validRows = computed(() => rows.value.filter((row) => row.status === '可导入'))
const warningRows = computed(() => rows.value.filter((row) => row.status !== '可导入'))
const latestBatch = computed(() => props.state.importBatches[0])
const columns = computed(() => {
  if (dataType.value === '学生名单') return ['学生姓名', '班级名称', '家长称呼', '手机号']
  if (dataType.value === '班级课表') return ['班级名称', '任课老师', '上课时间', '课程主题']
  return ['学生姓名', '班级名称', '任课老师', '上课时间', '课程主题']
})

const startImport = () => {
  fileName.value = ''
  mode.value = 'upload'
}

const handleFile = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  fileName.value = file.name
  mode.value = 'mapping'
}

const loadDemo = () => {
  fileName.value = dataType.value === '学生名单' ? '小麦学员名单-20260621.xlsx' : '小麦班级课表-20260621.xlsx'
  mode.value = 'mapping'
}

const confirmImport = () => {
  props.state.applyImportRows()
  mode.value = 'done'
}

const mappingKey = (column) => {
  if (column.includes('班级')) return 'className'
  if (column.includes('老师')) return 'teacher'
  if (column.includes('时间')) return 'time'
  if (column.includes('课程')) return 'course'
  return 'name'
}
</script>

<template>
  <PageHead eyebrow="基础数据" title="数据导入">
    <button v-if="mode === 'home'" class="primary" @click="startImport">开始一次导入</button>
    <button v-else class="ghost" @click="mode = 'home'">退出本次导入</button>
  </PageHead>

  <template v-if="mode === 'home'">
    <section class="import-home-hero panel">
      <div>
        <span>最近一次导入</span>
        <h2>{{ latestBatch.source }}</h2>
        <p>{{ latestBatch.time }} · 已写入 {{ latestBatch.success }} 条数据</p>
      </div>
      <div v-if="latestBatch.failed" class="import-attention">
        <strong>{{ latestBatch.failed }} 条需要确认</strong>
        <span>不会影响已经成功写入的数据</span>
        <button class="secondary" @click="dataType = '综合课表'; mode = 'preview'">继续处理</button>
      </div>
      <div v-else class="import-complete">✓ 已全部完成</div>
    </section>

    <section class="import-start-card panel">
      <div>
        <span>导入新的数据</span>
        <strong>从小麦或整理好的表格更新系统资料</strong>
        <small>一个文件可以同时识别学生、班级、课程和课次，无需分别进入多个页面。</small>
      </div>
      <button class="primary" @click="startImport">选择文件</button>
    </section>

    <details class="import-history panel">
      <summary>查看历史导入记录 <span>{{ state.importBatches.length }} 个批次</span></summary>
      <article v-for="batch in state.importBatches" :key="batch.id" class="import-history-row">
        <div><strong>{{ batch.source }}</strong><small>{{ batch.time }}</small></div>
        <span>成功 {{ batch.success }} · 需处理 {{ batch.failed }}</span>
        <small>{{ batch.note }}</small>
      </article>
    </details>
  </template>

  <section v-else class="import-workspace panel">
    <nav class="import-steps">
      <span :class="{ active: mode === 'upload' }">1 选择数据</span>
      <span :class="{ active: mode === 'mapping' }">2 确认识别</span>
      <span :class="{ active: mode === 'preview' }">3 检查并导入</span>
    </nav>

    <section v-if="mode === 'upload'" class="import-focus-step">
      <div class="import-step-copy">
        <span>第一步</span>
        <h2>这次要导入什么？</h2>
        <p>如果文件里同时包含学生和课表，选择“综合课表”即可。</p>
      </div>
      <div class="import-type-picker">
        <button v-for="type in ['综合课表', '学生名单', '班级课表']" :key="type" :class="{ selected: dataType === type }" @click="dataType = type">
          <strong>{{ type }}</strong>
          <small>{{ type === '综合课表' ? '同时更新学生、班级和课次' : type === '学生名单' ? '新增或更新学生及所属班级' : '新增或更新班级安排和上课时间' }}</small>
        </button>
      </div>
      <label>数据来源<select v-model="source"><option>小麦 Excel 导出</option><option>小麦课表整理表</option><option>手工维护表格</option></select></label>
      <label class="upload-zone">
        <strong>把 Excel 文件放到这里</strong>
        <small>选择后先预览，不会直接修改现有资料</small>
        <input type="file" accept=".xlsx,.xls,.csv" @change="handleFile" />
      </label>
      <button class="secondary demo-import" @click="loadDemo">使用示例文件继续</button>
    </section>

    <section v-if="mode === 'mapping'" class="import-focus-step">
      <div class="import-step-copy">
        <span>第二步</span>
        <h2>系统已经识别了主要字段</h2>
        <p>通常无需调整；只有表头名称特殊时才需要重新选择。</p>
      </div>
      <div class="file-pill"><strong>{{ fileName }}</strong><small>{{ dataType }} · {{ source }}</small></div>
      <div class="mapping-grid">
        <label v-for="column in columns" :key="column">系统字段：{{ column }}
          <select v-model="fieldMapping[mappingKey(column)]"><option>{{ column }}</option><option>学生姓名</option><option>班级名称</option><option>任课老师</option><option>上课时间</option><option>课程主题</option></select>
        </label>
      </div>
      <footer class="modal-actions"><button class="ghost" @click="mode = 'upload'">重新选择</button><button class="primary" @click="mode = 'preview'">查看导入结果</button></footer>
    </section>

    <section v-if="mode === 'preview'" class="import-focus-step">
      <div class="import-step-copy">
        <span>最后一步</span>
        <h2>{{ warningRows.length ? `有 ${warningRows.length} 条数据需要留意` : '数据已经可以导入' }}</h2>
        <p>有问题的数据会被跳过，不会覆盖现有的正确资料。</p>
      </div>
      <div class="import-summary"><article><span>本次识别</span><strong>{{ rows.length }}</strong></article><article><span>可以导入</span><strong>{{ validRows.length }}</strong></article><article><span>暂不导入</span><strong>{{ warningRows.length }}</strong></article></div>
      <div class="preview-table">
        <div class="preview-row head"><strong>名称</strong><strong>关联信息</strong><strong>结果</strong><strong>说明</strong></div>
        <div v-for="row in rows" :key="row.id" class="preview-row" :class="row.status"><span>{{ row.name }}</span><span>{{ row.className || row.teacher || row.course || '待识别' }}</span><span>{{ row.status }}</span><span>{{ row.issue || '可以写入' }}</span></div>
      </div>
      <footer class="modal-actions"><button class="ghost" @click="mode = 'mapping'">返回检查</button><button class="primary" @click="confirmImport">导入 {{ validRows.length }} 条可用数据</button></footer>
    </section>

    <section v-if="mode === 'done'" class="import-done">
      <span>✓</span><h2>导入完成</h2><p>{{ validRows.length }} 条资料已经更新，{{ warningRows.length }} 条问题数据已保留，稍后可以继续处理。</p><button class="primary" @click="mode = 'home'">返回数据导入</button>
    </section>
  </section>
</template>
