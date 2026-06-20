<script setup>
import { computed, proxyRefs, ref } from 'vue'
import SidebarNav from './components/layout/SidebarNav.vue'
import { navItems } from './data/mockData'
import { useDeliveryWorkflow } from './composables/useDeliveryWorkflow'
import DataCardsView from './views/DataCardsView.vue'
import TasksView from './views/TasksView.vue'
import TemplatesView from './views/TemplatesView.vue'

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
    meta: `作品 ${archive.works} 张 · 课评 ${archive.comments} 条`,
    body: '已沉淀到系统作品库，可按学生、班级、课程继续追溯。',
    footer: '查看课次档案'
  }))
)

const channelCards = computed(() =>
  state.channels.map((channel) => ({
    id: channel.id,
    title: channel.name,
    subtitle: `${channel.type} · ${channel.status}`,
    meta: channel.target,
    body: channel.risk,
    footer: channel.status === '待授权' ? '去授权' : '测试连接'
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

      <DataCardsView
        v-if="activeNav === 'channels'"
        eyebrow="系统集成"
        title="分发通道"
        action-label="新增连接"
        :items="channelCards"
      />
    </section>
  </main>
</template>
