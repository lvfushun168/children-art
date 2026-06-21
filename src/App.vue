<script setup>
import { computed, proxyRefs, ref } from 'vue'
import SidebarNav from './components/layout/SidebarNav.vue'
import { navItems } from './data/mockData'
import { useDeliveryWorkflow } from './composables/useDeliveryWorkflow'
import DataCardsView from './views/DataCardsView.vue'
import TasksView from './views/TasksView.vue'
import TemplatesView from './views/TemplatesView.vue'
import WheatTraceView from './views/WheatTraceView.vue'

const activeNav = ref('tasks')
const state = proxyRefs(useDeliveryWorkflow())

const pendingCount = computed(() => state.tasks.filter((task) => task.status !== '已完成').length)

const studentCards = computed(() =>
  state.students.map((student) => ({
    id: student.id,
    title: `${student.name} · ${student.age}岁`,
    subtitle: `${student.parent} · ${student.phone}`,
    meta: `${state.classes.find((item) => item.id === student.classId)?.name || '未分班'} · ${student.status}`,
    body: student.note,
    footer: `历史作品 ${student.works} 件`
  }))
)

const classCards = computed(() =>
  state.classes.map((klass) => ({
    id: klass.id,
    title: klass.name,
    subtitle: `${klass.time} · ${klass.teacher}`,
    meta: klass.group,
    body: `默认课程：${state.courses.find((item) => item.id === klass.courseId)?.title || '待配置'}`,
    footer: `${klass.studentIds.length} 名学生`
  }))
)

const courseCards = computed(() =>
  state.courses.map((course) => ({
    id: course.id,
    title: course.title,
    subtitle: `${course.age} · ${course.materials}`,
    meta: course.goal,
    body: `默认模板：${course.commentTemplate} / ${course.imageTemplate}`,
    footer: `闪光点：${course.defaultFocus}`
  }))
)

const archiveCards = computed(() =>
  state.archives.map((archive) => ({
    id: archive.id,
    className: 'archive',
    title: `${archive.date} · ${archive.className}`,
    subtitle: `${archive.course} · ${archive.teacher}`,
    meta: `作品 ${archive.works} 张 · 课评 ${archive.comments} 条 · 高光 ${archive.highlights} 件`,
    body: `已归档作品、课评、范画、课后任务和家长展示配置，小麦状态：${archive.wheatStatus}`,
    footer: '查看课次档案'
  }))
)

const settingCards = computed(() =>
  state.settings.map((item) => ({
    id: item.id,
    title: item.name,
    subtitle: item.status,
    meta: item.value,
    body: item.name === 'AI 接口' ? '用于课评生成和作品美化，失败时不阻断老师手动交付。' : '一期保留基础配置能力，后台以电脑端为主。',
    footer: '查看配置'
  }))
)
</script>

<template>
  <main class="app-shell">
    <SidebarNav
      v-model:active-nav="activeNav"
      :nav-items="navItems"
      :pending-count="pendingCount"
      :school="state.school"
    />

    <section class="content">
      <TasksView v-if="activeNav === 'tasks'" :state="state" @navigate="activeNav = $event" />

      <DataCardsView
        v-if="activeNav === 'students'"
        eyebrow="基础资料"
        title="学生管理"
        action-label="新增学生"
        :items="studentCards"
      />

      <DataCardsView
        v-if="activeNav === 'classes'"
        eyebrow="基础资料"
        title="班级管理"
        action-label="新增班级"
        :items="classCards"
      />

      <DataCardsView
        v-if="activeNav === 'courses'"
        eyebrow="教研资料"
        title="课程管理"
        action-label="新增课程"
        :items="courseCards"
      />

      <TemplatesView v-if="activeNav === 'templates'" :templates="state.templates" />

      <DataCardsView
        v-if="activeNav === 'archives'"
        eyebrow="资产沉淀"
        title="作品档案"
        action-label="导出成长档案"
        :items="archiveCards"
      />

      <WheatTraceView
        v-if="activeNav === 'wheat'"
        :traces="state.wheatTraces"
        :import-batches="state.importBatches"
        @mark-trace="state.markTrace"
      />

      <DataCardsView
        v-if="activeNav === 'settings'"
        eyebrow="后台配置"
        title="系统配置"
        action-label="更新配置"
        :items="settingCards"
      />
    </section>
  </main>
</template>
