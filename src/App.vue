<script setup>
import { computed, onBeforeUnmount, onMounted, proxyRefs, ref } from 'vue'
import SidebarNav from './components/layout/SidebarNav.vue'
import TodoCenterDrawer from './components/layout/TodoCenterDrawer.vue'
import UserMenu from './components/layout/UserMenu.vue'
import { navItems } from './data/mockData'
import { useDeliveryWorkflow } from './composables/useDeliveryWorkflow'
import ArchiveQueryView from './views/ArchiveQueryView.vue'
import ArtworkLibraryView from './views/ArtworkLibraryView.vue'
import ExternalLinksView from './views/ExternalLinksView.vue'
import ImportCenterView from './views/ImportCenterView.vue'
import ExtraTasksView from './views/ExtraTasksView.vue'
import LoginView from './views/LoginView.vue'
import MasterDataView from './views/MasterDataView.vue'
import ParentSharePage from './views/ParentSharePage.vue'
import SystemSettingsView from './views/SystemSettingsView.vue'
import TasksView from './views/TasksView.vue'
import TemplatesView from './views/TemplatesView.vue'

const activeNav = ref('tasks')
const activeImportType = ref('综合课表')
const showTodoCenter = ref(false)
const openWorkspaceSignal = ref(0)
const state = proxyRefs(useDeliveryWorkflow())

const filteredNavItems = computed(() => navItems.filter((item) => !state.visibleNavItems.includes(item.id)))
const pendingCount = computed(() => state.visibleTasks.filter((task) => task.status !== '已完成').length)
const wheatPendingCount = computed(() => state.wheatTraces.filter((trace) => !['已人工处理', '无需处理'].includes(trace.status)).length)
const importIssueCount = computed(() => state.importPreviewRows.filter((row) => row.status !== '可导入').length)
const cloudIssueCount = computed(() => state.visibleTasks.filter((task) => task.cloudArchiveStatus === '同步失败').length)
const todoCount = computed(() => pendingCount.value + wheatPendingCount.value + importIssueCount.value + cloudIssueCount.value)
const routeHash = ref(window.location.hash)
const updateRouteHash = () => { routeHash.value = window.location.hash }
const openImportCenter = (type = '综合课表') => {
  activeImportType.value = type
  activeNav.value = 'imports'
  showTodoCenter.value = false
}
const handleNavigate = (target) => {
  if (target === 'wheat') {
    showTodoCenter.value = true
    return
  }
  activeNav.value = target
}
const selectTodoTask = (task) => {
  state.selectTask(task)
  activeNav.value = 'tasks'
  openWorkspaceSignal.value += 1
}

onMounted(() => window.addEventListener('hashchange', updateRouteHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', updateRouteHash))

const shareRoute = computed(() => {
  const studentMatch = routeHash.value.match(/^#\/share\/student\/(\d+)\/(\d+)(?:\?token=([^&]+))?/)
  if (studentMatch) return { type: 'student', lessonId: Number(studentMatch[1]), studentId: Number(studentMatch[2]), token: studentMatch[3] || '' }
  const lessonMatch = routeHash.value.match(/^#\/share\/lesson\/(\d+)(?:\?token=([^&]+))?/)
  if (lessonMatch) return { type: 'lesson', lessonId: Number(lessonMatch[1]), token: lessonMatch[2] || '' }
  return null
})

</script>

<template>
  <ParentSharePage v-if="shareRoute" :state="state" :route="shareRoute" />

  <LoginView v-else-if="!state.isLoggedIn" :state="state" />

  <main v-else class="app-shell">
    <SidebarNav
      v-model:active-nav="activeNav"
      :nav-items="filteredNavItems"
      :pending-count="pendingCount"
      :todo-count="todoCount"
      :wheat-pending-count="wheatPendingCount"
      :school="state.school"
      @open-todo-center="showTodoCenter = true"
    />

    <TodoCenterDrawer
      :state="state"
      :open="showTodoCenter"
      @close="showTodoCenter = false"
      @select-task="selectTodoTask"
      @open-imports="openImportCenter('综合课表')"
    />

    <section class="content">
      <UserMenu
        :current-user="state.currentUser"
        :permission-summary="state.permissionSummary"
        :teachers="state.teachers"
        @switch-user="state.loginAs"
        @logout="state.logout"
      />

      <TasksView v-if="activeNav === 'tasks'" :state="state" :open-workspace-signal="openWorkspaceSignal" @navigate="handleNavigate" />

      <MasterDataView v-if="activeNav === 'students'" :state="state" entity="students" @open-import="openImportCenter('学生名单')" />

      <MasterDataView v-if="activeNav === 'classes'" :state="state" entity="classes" @open-import="openImportCenter('综合课表')" />

      <ArtworkLibraryView v-if="activeNav === 'courses'" :state="state" />

      <ImportCenterView v-if="activeNav === 'imports'" :state="state" :initial-type="activeImportType" />

      <ExternalLinksView v-if="activeNav === 'externalLinks'" :state="state" />

      <TemplatesView v-if="activeNav === 'templates'" :state="state" />

      <ArchiveQueryView v-if="activeNav === 'archives'" :state="state" />

      <ExtraTasksView v-if="activeNav === 'extraTasks'" :state="state" />

      <SystemSettingsView v-if="activeNav === 'settings' && state.isAdmin" :state="state" />
    </section>
  </main>
</template>
