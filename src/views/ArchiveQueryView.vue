<script setup>
import { computed, ref } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const selectedId = ref(props.state.filteredArchiveRecords[0]?.id || null)
const selected = computed(() => props.state.filteredArchiveRecords.find((record) => record.id === selectedId.value) || props.state.filteredArchiveRecords[0])

const selectFirstIfMissing = () => {
  if (!props.state.filteredArchiveRecords.some((record) => record.id === selectedId.value)) {
    selectedId.value = props.state.filteredArchiveRecords[0]?.id || null
  }
}
</script>

<template>
  <PageHead eyebrow="资产沉淀" title="作品档案查询">
    <button class="primary">导出查询结果</button>
  </PageHead>

  <section class="archive-query-layout">
    <aside class="archive-filters panel">
      <div class="section-head">
        <div>
          <span>查询条件</span>
          <strong>{{ state.filteredArchiveRecords.length }} 条记录</strong>
        </div>
      </div>
      <label>
        学生
        <select v-model="state.archiveFilter.studentId" @change="selectFirstIfMissing">
          <option value="all">全部学生</option>
          <option v-for="student in state.students" :key="student.id" :value="student.id">{{ student.name }}</option>
        </select>
      </label>
      <label>
        班级
        <select v-model="state.archiveFilter.classId" @change="selectFirstIfMissing">
          <option value="all">全部班级</option>
          <option v-for="klass in state.classes" :key="klass.id" :value="klass.id">{{ klass.name }}</option>
        </select>
      </label>
      <label>
        老师
        <select v-model="state.archiveFilter.teacher" @change="selectFirstIfMissing">
          <option value="all">全部老师</option>
          <option v-for="teacher in state.teachers.filter((item) => item.role === '老师')" :key="teacher.id" :value="teacher.name">
            {{ teacher.name }}
          </option>
        </select>
      </label>
      <label>
        日期
        <select v-model="state.archiveFilter.date" @change="selectFirstIfMissing">
          <option value="all">全部日期</option>
          <option v-for="date in state.archiveDates" :key="date">{{ date }}</option>
        </select>
      </label>
      <div class="notice-box">
        <strong>查询维度</strong>
        <small>支持按学生、班级、日期、老师查询作品、课评、高光和课后任务。</small>
      </div>
    </aside>

    <section class="archive-results panel">
      <div class="section-head">
        <div>
          <span>归档记录</span>
          <strong>{{ state.filteredArchiveRecords.length }} 条</strong>
        </div>
      </div>
      <button
        v-for="record in state.filteredArchiveRecords"
        :key="record.id"
        class="archive-row"
        :class="{ active: selected?.id === record.id }"
        @click="selectedId = record.id"
      >
        <img :src="record.artwork" :alt="record.studentName" />
        <span>
          <strong>{{ record.studentName }} · {{ record.course }}</strong>
          <small>{{ record.date }} {{ record.time }} · {{ record.className }} · {{ record.teacher }}</small>
          <em v-if="record.highlight">高光作品</em>
        </span>
      </button>
      <div v-if="!state.filteredArchiveRecords.length" class="notice-box">
        <small>没有符合条件的归档记录。</small>
      </div>
    </section>

    <aside class="archive-detail panel" v-if="selected">
      <div class="section-head">
        <div>
          <span>学生归档详情</span>
          <strong>{{ selected.studentName }} · {{ selected.course }}</strong>
        </div>
      </div>
      <img class="archive-main-image" :src="selected.artwork" :alt="selected.studentName" />
      <div class="archive-meta">
        <span>{{ selected.date }} {{ selected.time }}</span>
        <span>{{ selected.className }}</span>
        <span>{{ selected.teacher }}</span>
        <span>{{ selected.lessonType }}</span>
      </div>
      <article class="archive-block">
        <span>课评</span>
        <p>{{ selected.feedback }}</p>
      </article>
      <article class="archive-block">
        <span>课后任务</span>
        <p>{{ selected.homework }}</p>
      </article>
      <article v-if="selected.highlight" class="archive-block highlight">
        <span>高光说明</span>
        <p>{{ selected.highlightNote }}</p>
      </article>
      <article class="archive-block">
        <span>家长展示页</span>
        <p>{{ selected.shareUrl }}</p>
      </article>
    </aside>
  </section>
</template>
