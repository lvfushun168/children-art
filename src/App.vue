<script setup>
import { computed, onBeforeUnmount, onMounted, proxyRefs, ref, watch } from 'vue'
import SidebarNav from './components/layout/SidebarNav.vue'
import TodoCenterDrawer from './components/layout/TodoCenterDrawer.vue'
import UserMenu from './components/layout/UserMenu.vue'
import { navGroups } from './data/mockData'
import { useDeliveryWorkflow } from './composables/useDeliveryWorkflow'
import ArchiveQueryView from './views/ArchiveQueryView.vue'
import ArtworkLibraryView from './views/ArtworkLibraryView.vue'
import ExternalLinksView from './views/ExternalLinksView.vue'
import ImportCenterView from './views/ImportCenterView.vue'
import ExtraTasksView from './views/ExtraTasksView.vue'
import LoginView from './views/LoginView.vue'
import MasterDataView from './views/MasterDataView.vue'
import ModuleHubView from './views/ModuleHubView.vue'
import ParentSharePage from './views/ParentSharePage.vue'
import ProductionCenterView from './views/ProductionCenterView.vue'
import SupervisionBoardView from './views/SupervisionBoardView.vue'
import SystemSettingsView from './views/SystemSettingsView.vue'
import TasksView from './views/TasksView.vue'
import TemplatesView from './views/TemplatesView.vue'

const activeNav = ref('tasks')
const activeGroupId = ref('afterClass')
const activeImportType = ref('综合课表')
const showTodoCenter = ref(false)
const openWorkspaceSignal = ref(0)
const isMobileApp = ref(false)
const mobileLevel = ref('groups')
const state = proxyRefs(useDeliveryWorkflow())
const themeOptions = [
  { id: 'studio', label: '深海奶白' },
  { id: 'day', label: '清爽日间' },
  { id: 'night', label: '翡翠夜间' }
]
const savedTheme = typeof window !== 'undefined' ? window.localStorage.getItem('children-art-theme') : ''
const activeTheme = ref(themeOptions.some((theme) => theme.id === savedTheme) ? savedTheme : 'studio')
let cleanupMobileMedia = () => {}

const filteredNavGroups = computed(() =>
  navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !state.visibleNavItems.includes(item.id))
    }))
    .filter((group) => group.items.length)
)
const visibleNavIds = computed(() => filteredNavGroups.value.flatMap((group) => group.items.map((item) => item.id)))
const activeGroup = computed(() =>
  filteredNavGroups.value.find((group) => group.id === activeGroupId.value) || filteredNavGroups.value[0]
)
const navIdsWithLocalBack = new Set(['tasks', 'supervision', 'production', 'archives', 'students', 'classes', 'externalLinks', 'extraTasks', 'templates', 'settings'])
const showActivePage = computed(() => Boolean(activeNav.value && (!isMobileApp.value || mobileLevel.value === 'page')))
const showModuleBack = computed(() => Boolean(showActivePage.value && !navIdsWithLocalBack.has(activeNav.value)))
const mobileGroupEntries = computed(() =>
  filteredNavGroups.value.map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    mark: group.mark || group.label.slice(0, 1)
  }))
)
const groupForNav = (navId) => filteredNavGroups.value.find((group) => group.items.some((item) => item.id === navId))
const openGroup = (groupId) => {
  activeGroupId.value = groupId
  activeNav.value = ''
  if (isMobileApp.value) mobileLevel.value = 'group'
  showTodoCenter.value = false
}
const openNav = (target) => {
  const group = groupForNav(target)
  if (group) activeGroupId.value = group.id
  activeNav.value = target
  if (isMobileApp.value) mobileLevel.value = 'page'
}
const returnToGroup = () => {
  activeNav.value = ''
  if (isMobileApp.value) mobileLevel.value = 'group'
}
const returnToMobileGroups = () => {
  activeNav.value = ''
  mobileLevel.value = 'groups'
}
const visibleTodayTasks = computed(() => {
  const matched = state.visibleTasks.filter((task) => task.dateValue === state.latestLessonDate)
  return matched.length ? matched : state.visibleTasks
})
const pendingCount = computed(() => visibleTodayTasks.value.filter((task) => task.status !== '已完成').length)
const wheatPendingCount = computed(() => state.wheatTraces.filter((trace) => !['已人工处理', '无需处理'].includes(trace.status)).length)
const importIssueCount = computed(() => state.importPreviewRows.filter((row) => row.status !== '可导入').length)
const cloudIssueCount = computed(() => state.visibleTasks.filter((task) => task.cloudArchiveStatus === '同步失败').length)
const reviewPendingCount = computed(() => state.isAdmin ? state.pendingQualityReviews.length : 0)
const todoCount = computed(() => pendingCount.value + wheatPendingCount.value + importIssueCount.value + cloudIssueCount.value + reviewPendingCount.value)
const routeHash = ref(window.location.hash)
const updateRouteHash = () => { routeHash.value = window.location.hash }
const openImportCenter = (type = '综合课表') => {
  activeImportType.value = type
  openNav('imports')
  showTodoCenter.value = false
}
const handleNavigate = (target) => {
  if (target === 'wheat') {
    showTodoCenter.value = true
    return
  }
  openNav(target)
}
const productionHandoff = ref(null)
const openProductionCenter = (payload) => {
  productionHandoff.value = payload
  openNav('production')
}
const selectTodoTask = (task) => {
  state.selectTask(task)
  openNav('tasks')
  openWorkspaceSignal.value += 1
}

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
}

onMounted(() => {
  applyTheme(activeTheme.value)
  const media = window.matchMedia('(max-width: 680px)')
  const syncMobile = () => {
    isMobileApp.value = media.matches
    if (media.matches) {
      activeNav.value = ''
      mobileLevel.value = 'groups'
      showTodoCenter.value = false
    }
  }
  syncMobile()
  media.addEventListener('change', syncMobile)
  cleanupMobileMedia = () => media.removeEventListener('change', syncMobile)
  window.addEventListener('hashchange', updateRouteHash)
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', updateRouteHash)
  cleanupMobileMedia()
})

watch(activeTheme, (theme) => {
  applyTheme(theme)
  if (typeof window !== 'undefined') window.localStorage.setItem('children-art-theme', theme)
}, { immediate: true })

watch(visibleNavIds, (ids) => {
  if (!ids.length) return
  if (activeNav.value && !ids.includes(activeNav.value)) activeNav.value = ''
  if (!filteredNavGroups.value.some((group) => group.id === activeGroupId.value)) {
    activeGroupId.value = filteredNavGroups.value[0].id
  }
}, { immediate: true })

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

  <main v-else class="app-shell" :class="{ 'app-shell-mobile': isMobileApp }">
    <SidebarNav
      v-if="!isMobileApp"
      :active-group-id="activeGroupId"
      :nav-groups="filteredNavGroups"
      :pending-count="pendingCount"
      :todo-count="todoCount"
      :wheat-pending-count="wheatPendingCount"
      :school="state.school"
      @select-group="openGroup"
      @open-todo-center="showTodoCenter = true"
    />

    <TodoCenterDrawer
      :state="state"
      :open="showTodoCenter"
      @close="showTodoCenter = false"
      @select-task="selectTodoTask"
      @open-imports="openImportCenter('综合课表')"
      @open-supervision="openNav('supervision')"
    />

    <section class="content" :class="{ 'mobile-app-content': isMobileApp }">
      <UserMenu
        :current-user="state.currentUser"
        :permission-summary="state.permissionSummary"
        :theme-options="themeOptions"
        :active-theme="activeTheme"
        @update-theme="activeTheme = $event"
        @logout="state.logout"
      />

      <ModuleHubView
        v-if="isMobileApp && mobileLevel === 'groups'"
        title="课后交付系统"
        eyebrow="选择要进入的工作模块"
        :items="mobileGroupEntries"
        @open="openGroup"
      />

      <template v-else-if="isMobileApp && mobileLevel === 'group'">
        <button class="module-back-link" type="button" @click="returnToMobileGroups">← 返回上一级</button>
        <ModuleHubView v-if="activeGroup" :group="activeGroup" @open="openNav" />
      </template>

      <ModuleHubView v-else-if="!isMobileApp && !activeNav && activeGroup" :group="activeGroup" @open="openNav" />

      <button v-if="showModuleBack" class="module-back-link" type="button" @click="returnToGroup">← 返回{{ activeGroup?.label || '上一级' }}</button>

      <TasksView v-if="showActivePage && activeNav === 'tasks'" :state="state" :open-workspace-signal="openWorkspaceSignal" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @navigate="handleNavigate" />

      <SupervisionBoardView v-if="showActivePage && activeNav === 'supervision' && state.isAdmin" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <ProductionCenterView
        v-if="showActivePage && activeNav === 'production'"
        :state="state"
        :group-label="activeGroup?.label"
        :handoff="productionHandoff"
        @back-to-group="returnToGroup"
        @handoff-consumed="productionHandoff = null"
      />

      <MasterDataView v-if="showActivePage && activeNav === 'students'" :state="state" entity="students" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @open-import="openImportCenter('学生名单')" />

      <MasterDataView v-if="showActivePage && activeNav === 'classes'" :state="state" entity="classes" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @open-import="openImportCenter('综合课表')" />

      <ArtworkLibraryView v-if="showActivePage && activeNav === 'courses'" :state="state" />

      <ImportCenterView v-if="showActivePage && activeNav === 'imports'" :state="state" :initial-type="activeImportType" />

      <ExternalLinksView v-if="showActivePage && activeNav === 'externalLinks'" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <TemplatesView v-if="showActivePage && activeNav === 'templates'" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <ArchiveQueryView v-if="showActivePage && activeNav === 'archives'" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @create-portfolio="openProductionCenter" />

      <ExtraTasksView v-if="showActivePage && activeNav === 'extraTasks'" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <SystemSettingsView v-if="showActivePage && activeNav === 'settings' && state.isAdmin" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />
    </section>
  </main>
</template>
