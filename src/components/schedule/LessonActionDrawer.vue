<script setup>
import { computed } from 'vue'

const props = defineProps({
  lesson: { type: Object, default: null },
  canEdit: { type: Boolean, default: false },
  busy: { type: Boolean, default: false }
})

defineEmits(['close', 'enter', 'edit', 'delete'])

const isCompleted = computed(() => ['已完成', 'COMPLETED'].includes(props.lesson?.status))
const statusClass = computed(() => ({
  已完成: 'is-done',
  处理中: 'is-processing',
  异常: 'is-warning'
}[props.lesson?.status] || 'is-pending'))
const lessonName = computed(() => props.lesson?.className || '未配置班级')
const lessonTime = computed(() => {
  const start = props.lesson?.time || props.lesson?.startTime || ''
  const end = props.lesson?.endTime || ''
  return end ? `${start}-${end}` : start || '时间待定'
})
const lessonSource = computed(() => ({
  WHEAT_CALENDAR: '小麦课表',
  WHEAT_COPY: '小麦复制',
  WHEAT_EXCEL: '小麦 Excel',
  CLASS_SCHEDULE: '固定排课',
  MANUAL: '手动补录'
}[props.lesson?.sourceType] || props.lesson?.sourceType || '未标记来源'))
</script>

<template>
  <div v-if="lesson" class="drawer-backdrop lesson-action-drawer-backdrop" @click.self="$emit('close')">
    <aside class="library-drawer lesson-action-drawer" role="dialog" aria-modal="true" aria-label="课次操作">
      <div class="drawer-head">
        <div>
          <span>课次详情</span>
          <strong>{{ lessonName }}</strong>
        </div>
        <button class="ghost" type="button" :disabled="busy" @click="$emit('close')">关闭</button>
      </div>

      <div class="lesson-action-content">
        <div class="lesson-action-summary">
          <strong>{{ lessonTime }}</strong>
          <span class="schedule-status-tag" :class="statusClass">{{ lesson.status || '待处理' }}</span>
          <small>{{ lesson.date || lesson.dateValue || '日期待定' }} · {{ lessonSource }}</small>
        </div>

        <dl class="lesson-action-details">
          <div><dt>任课老师</dt><dd>{{ lesson.teacher || lesson.teacherName || '未配置老师' }}</dd></div>
          <div><dt>课程</dt><dd>{{ lesson.courseTitle || lesson.course || '未配置课程类别' }}</dd></div>
          <div><dt>课题</dt><dd>{{ lesson.topic || '未填写' }}</dd></div>
          <div><dt>课次类型</dt><dd>{{ lesson.lessonType || '其他' }}</dd></div>
          <div><dt>来源</dt><dd>{{ lessonSource }}</dd></div>
        </dl>

        <div class="lesson-action-buttons">
          <button class="primary lesson-action-button" type="button" :disabled="busy" @click="$emit('enter')">
            <strong>进入课后处理</strong>
            <small>打开本节课的交付工作台</small>
          </button>
          <button class="secondary lesson-action-button" type="button" :disabled="busy || !canEdit || isCompleted" @click="$emit('edit')">
            <strong>编辑课次</strong>
            <small>修改日期、时间、老师、课程和课题</small>
          </button>
          <button class="secondary lesson-action-button" type="button" :disabled="busy || !canEdit || isCompleted" @click="$emit('delete')">
            <strong>删除课次</strong>
            <small>仅限没有课后处理数据的未完成课次</small>
          </button>
        </div>

        <p v-if="isCompleted" class="lesson-action-hint">已完成课次不可删除，如需调整请进入课后处理查看归档状态。</p>
        <p v-else-if="!canEdit" class="lesson-action-hint">当前账号没有编辑课次的权限。</p>
        <p class="lesson-action-hint">班级和学生关系不在本表单中修改；如果创建时选错，请删除后重新创建。</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.lesson-action-drawer {
  grid-template-rows: auto minmax(0, 1fr);
}

.lesson-action-content {
  display: grid;
  align-content: start;
  gap: 16px;
  overflow: auto;
}

.lesson-action-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px 10px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border-soft));
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary-soft) 42%, var(--color-surface));
}

.lesson-action-summary strong {
  color: var(--color-heading);
  font-size: 18px;
}

.lesson-action-summary .schedule-status-tag {
  justify-self: end;
}

.lesson-action-summary small {
  grid-column: 1 / -1;
  color: var(--color-muted);
  font-size: 12px;
}

.lesson-action-details {
  display: grid;
  gap: 1px;
  margin: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  overflow: hidden;
}

.lesson-action-details > div {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-surface);
}

.lesson-action-details > div + div {
  border-top: 1px solid var(--color-border-soft);
}

.lesson-action-details dt {
  color: var(--color-muted);
  font-size: 12px;
}

.lesson-action-details dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--color-heading);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lesson-action-buttons {
  display: grid;
  gap: 9px;
}

.lesson-action-button {
  display: grid;
  gap: 3px;
  justify-items: center;
  min-height: 54px;
  padding: 10px 13px;
  text-align: center;
}

.lesson-action-button strong {
  font-size: 14px;
}

.lesson-action-button small {
  color: inherit;
  font-size: 11px;
  opacity: .78;
}

.lesson-action-hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.6;
}

</style>
