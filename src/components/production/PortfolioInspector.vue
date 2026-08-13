<script setup>
import { computed } from 'vue'
import { sameId } from '../../services/mappers'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  project: {
    type: Object,
    required: true
  },
  page: {
    type: Object,
    default: null
  },
  pageIndex: {
    type: Number,
    default: 0
  },
  activeSlot: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['clearSelection', 'focusPage'])

const roleLabels = {
  title: '标题',
  subtitle: '副标题',
  body: '正文',
  meta: '课次信息',
  caption: '图注',
  stat: '统计',
  cover: '主图'
}

const resolved = computed(() =>
  props.activeSlot && props.page ? props.state.resolveSlot(props.project, props.page, props.activeSlot) : null
)
const projectField = computed(() => (props.activeSlot && props.page ? props.state.projectFieldForSlot(props.page, props.activeSlot) : ''))
const capacity = computed(() => (props.activeSlot ? props.state.portfolioSlotCapacity(props.activeSlot) : 0))
const textLength = computed(() => String(resolved.value?.text || '').length)
const crop = computed(() => resolved.value?.crop || { scale: 1, x: 50, y: 50 })
const poolRecords = computed(() => props.state.orderedProjectRecords(props.project))
const issues = computed(() => props.state.portfolioIssuesFor(props.project))
const errorCount = computed(() => issues.value.filter((issue) => issue.level === 'error').length)
const currentRecordId = computed(() => resolved.value?.record?.id || null)

const slotText = computed({
  get: () => (projectField.value ? props.project[projectField.value] || '' : resolved.value?.text || ''),
  set: (value) => props.state.setSlotText(props.project, props.page, props.activeSlot, value)
})

const setCrop = (patch) => props.state.setSlotCrop(props.project, props.page, props.activeSlot, patch)
const chooseRecord = (recordId) => props.state.assignRecordToSlot(props.project, props.page, props.activeSlot, recordId)
</script>

<template>
  <aside class="pf-inspector panel">
    <template v-if="activeSlot && page">
      <header class="pf-inspector-head">
        <div>
          <span>第 {{ pageIndex + 1 }} 页 · {{ roleLabels[activeSlot.role] || (activeSlot.type === 'image' ? '图片位' : '文字位') }}</span>
          <strong>{{ activeSlot.type === 'image' ? '替换图片' : '修改文字' }}</strong>
        </div>
        <button class="ghost" @click="emit('clearSelection')">取消选中</button>
      </header>

      <section v-if="activeSlot.type === 'image'" class="pf-inspector-group">
        <div class="mini-head">
          <span>当前图片</span>
          <strong>{{ resolved.record ? resolved.record.studentName : '空图位' }}</strong>
        </div>
        <p v-if="resolved.record" class="pf-inspector-note">
          {{ resolved.record.title || resolved.record.course }} · {{ resolved.record.date }}
        </p>
        <p v-else class="pf-inspector-note missing">从下方素材池选一件作品放进来。</p>

        <div class="pf-record-picker">
          <button
            v-for="record in poolRecords"
            :key="record.id"
            class="pf-record-chip"
            :class="{ selected: sameId(record.id, currentRecordId) }"
            @click="chooseRecord(record.id)"
          >
            <img :src="record.artwork" :alt="record.studentName" />
            <small>{{ record.date }}</small>
          </button>
        </div>

        <div class="pf-crop-controls">
          <label>
            缩放 <em>{{ crop.scale.toFixed(2) }}×</em>
            <input type="range" min="1" max="2" step="0.05" :value="crop.scale" @input="setCrop({ scale: Number($event.target.value) })" />
          </label>
          <label>
            水平焦点 <em>{{ crop.x }}%</em>
            <input type="range" min="0" max="100" step="1" :value="crop.x" @input="setCrop({ x: Number($event.target.value) })" />
          </label>
          <label>
            垂直焦点 <em>{{ crop.y }}%</em>
            <input type="range" min="0" max="100" step="1" :value="crop.y" @input="setCrop({ y: Number($event.target.value) })" />
          </label>
        </div>
        <div class="button-pair">
          <button class="ghost" @click="setCrop({ scale: 1, x: 50, y: 50 })">复位裁切</button>
          <button class="ghost danger-action" :disabled="!resolved.record" @click="state.clearSlotRecord(project, page, activeSlot)">移出这张</button>
        </div>
      </section>

      <section v-else class="pf-inspector-group">
        <div class="mini-head">
          <span>{{ projectField ? '作品册文字' : '本页文字' }}</span>
          <strong :class="{ 'missing-text': textLength > capacity }">{{ textLength }}/{{ capacity }} 字</strong>
        </div>
        <textarea v-model="slotText" rows="8" placeholder="输入文字内容" />
        <small v-if="textLength > capacity" class="missing-text">文字偏长，导出前建议压缩一点。</small>
        <button
          v-if="!projectField"
          class="ghost"
          :disabled="!resolved.edited"
          @click="state.resetSlotText(project, page, activeSlot)"
        >
          恢复档案文字
        </button>
      </section>
    </template>

    <template v-else>
      <header class="pf-inspector-head">
        <div>
          <span>A4 横向作品册</span>
          <strong>{{ project.pages.length }} 页 · {{ state.portfolioTemplateFor(project).name }}</strong>
        </div>
      </header>

      <section class="pf-inspector-group">
        <div class="mini-head">
          <span>导出前检查</span>
          <strong :class="errorCount ? 'missing-text' : 'ok-text'">{{ errorCount ? `${errorCount} 项需处理` : '可以导出' }}</strong>
        </div>
        <article
          v-for="issue in issues"
          :key="issue.key"
          class="pf-issue-row"
          :class="issue.level"
        >
          <div>
            <strong>{{ issue.title }}</strong>
            <small>{{ issue.detail }}</small>
          </div>
          <button v-if="issue.pageNos.length" class="ghost" @click="emit('focusPage', issue.pageNos[0] - 1)">
            去第 {{ issue.pageNos[0] }} 页
          </button>
        </article>
        <p v-if="!issues.length" class="pf-inspector-note">没有发现缺图、缺文字或孔位遮挡问题。</p>
      </section>

      <section class="pf-inspector-group">
        <div class="mini-head"><span>作品册设置</span></div>
        <div class="pf-choice-row">
          <button
            v-for="theme in state.bookThemes"
            :key="theme.id"
            :class="{ selected: project.book.theme === theme.id }"
            @click="project.book.theme = theme.id"
          >
            {{ theme.label }}
          </button>
        </div>
        <div class="mini-head"><span>作品页正文</span></div>
        <div class="pf-choice-row">
          <button
            v-for="source in state.bodySources"
            :key="source.id"
            :class="{ selected: project.book.bodySource === source.id }"
            @click="project.book.bodySource = source.id"
          >
            {{ source.label }}
          </button>
        </div>
        <div class="switch-row">
          <label><input v-model="project.book.showDate" type="checkbox" /> 显示课程日期</label>
          <label><input v-model="project.book.showCourse" type="checkbox" /> 显示课程主题</label>
          <label><input v-model="project.book.showWatermark" type="checkbox" /> 显示机构水印</label>
        </div>
        <button class="secondary" @click="state.autoPaginate(project)">按当前作品重新生成页卡</button>
      </section>
    </template>
  </aside>
</template>
