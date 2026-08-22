<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SidebarNav from '../components/layout/SidebarNav.vue'
import TodoCenterDrawer from '../components/layout/TodoCenterDrawer.vue'
import UserMenu from '../components/layout/UserMenu.vue'
import { navGroups } from '../data/navigation'
import ArchiveQueryView from './ArchiveQueryView.vue'
import AccountManagementView from './AccountManagementView.vue'
import ImportCenterView from './ImportCenterView.vue'
import ExtraTasksView from './ExtraTasksView.vue'
import MasterDataView from './MasterDataView.vue'
import ModuleHubView from './ModuleHubView.vue'
import PermissionResourcesView from './PermissionResourcesView.vue'
import ProductionCenterView from './ProductionCenterView.vue'
import RoleManagementView from './RoleManagementView.vue'
import ScheduleView from './ScheduleView.vue'
import SupervisionBoardView from './SupervisionBoardView.vue'
import SystemSettingsView from './SystemSettingsView.vue'
import TasksView from './TasksView.vue'
import TemplatesView from './TemplatesView.vue'
import {
  HOME_ROUTE_PATH,
  NAV_ROUTE_PATHS,
  groupPathFor,
  navPathFor,
  taskRouteLocation
} from '../routerPaths.js'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const route = useRoute()
const router = useRouter()
const state = props.state
const showTodoCenter = ref(false)
const productionHandoff = ref(null)
const isMobileApp = ref(false)
const routeTaskKey = ref('')
const themeOptions = [
  { id: 'studio', label: '深海奶白' },
  { id: 'day', label: '清爽日间' },
  { id: 'night', label: '翡翠夜间' }
]
const savedTheme = typeof window !== 'undefined' ? window.localStorage.getItem('children-art-theme') : ''
const activeTheme = ref(themeOptions.some((theme) => theme.id === savedTheme) ? savedTheme : 'studio')
let cleanupMobileMedia = () => {}

const routeMode = computed(() => String(route.meta.viewMode || 'home'))
const activeNav = computed(() => String(route.meta.navId || ''))
const activeGroupId = computed(() => String(route.meta.groupId || 'afterClass'))
const activeImportType = computed(() => String(route.query.type || '综合课表'))
const workspaceLaunch = computed(() => {
  if (route.name !== 'workspace-task') return null
  const lessonId = String(route.params.lessonId || '')
  if (!lessonId) return null
  return {
    source: route.query.source === 'schedule' ? 'schedule' : 'today',
    lessonId,
    token: `route:${lessonId}`
  }
})

const filteredNavGroups = computed(() =>
  navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !(state.visibleNavItems || []).includes(item.id))
    }))
    .filter((group) => group.items.length)
)
const visibleNavIds = computed(() => filteredNavGroups.value.flatMap((group) => group.items.map((item) => item.id)))
const activeGroup = computed(() =>
  filteredNavGroups.value.find((group) => group.id === activeGroupId.value) || filteredNavGroups.value[0]
)
const navIdsWithLocalBack = new Set(['schedule', 'tasks', 'supervision', 'production', 'archives', 'teachers', 'students', 'classes', 'courses', 'externalLinks', 'extraTasks', 'templates', 'accountManagement', 'roleManagement', 'permissionResources', 'settings'])
const showActivePage = computed(() => Boolean(activeNav.value && (!isMobileApp.value || routeMode.value === 'page')))
const showModuleBack = computed(() => Boolean(showActivePage.value && !navIdsWithLocalBack.has(activeNav.value)))
const mobileGroupEntries = computed(() =>
  filteredNavGroups.value.map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    mark: group.mark || group.label.slice(0, 1)
  }))
)

const listValue = (value) => Array.isArray(value) ? value : Array.isArray(value?.value) ? value.value : []
const inboxLessons = computed(() => listValue(state.visibleInboxLessons))
const pendingCount = computed(() => inboxLessons.value.filter((task) => task.status !== '已完成').length)
const wheatPendingCount = computed(() => listValue(state.wheatTraces).filter((trace) => !['已人工处理', '无需处理'].includes(trace.status)).length)
const wecomPendingCount = computed(() => listValue(state.wecomSendTasks).filter((task) => ['待老师确认发送', '发送失败'].includes(task.status)).length)
const cloudIssueCount = computed(() => listValue(state.cloudArchiveTodos).filter((job) => job.statusCode === 'FAILED' || job.status === '同步失败').length)
const reviewPendingCount = computed(() => state.canQualityReview
  ? listValue(state.pendingReviewQueue).filter((review) => ['待评分', '已退回'].includes(review.status)).length
  : 0)
const todoCount = computed(() => pendingCount.value + wecomPendingCount.value + wheatPendingCount.value + cloudIssueCount.value + reviewPendingCount.value)

const openGroup = (groupId) => {
  productionHandoff.value = null
  showTodoCenter.value = false
  void router.push(groupPathFor(groupId))
}

const openNav = (target, { query = {}, preserveHandoff = false } = {}) => {
  if (!preserveHandoff) productionHandoff.value = null
  showTodoCenter.value = false
  void router.push({ path: navPathFor(target), query })
}

const returnToGroup = () => {
  productionHandoff.value = null
  void router.push(groupPathFor(activeGroup.value?.id || activeGroupId.value))
}

const returnToMobileGroups = () => {
  productionHandoff.value = null
  void router.push(HOME_ROUTE_PATH)
}

const openImportCenter = (type = '综合课表') => {
  productionHandoff.value = null
  showTodoCenter.value = false
  void router.push({ path: NAV_ROUTE_PATHS.imports, query: { type } })
}

const handleNavigate = (target) => {
  if (target === 'wheat') {
    showTodoCenter.value = true
    return
  }
  openNav(target)
}

const openProductionCenter = (payload) => {
  productionHandoff.value = payload
  openNav('production', { preserveHandoff: true })
}

const launchTaskWorkspace = (task, source = 'today') => {
  if (!task?.id) return
  void router.push(taskRouteLocation(task.id, source))
}

const selectTodoTask = (task) => launchTaskWorkspace(task, 'today')
const openScheduleTask = (task) => launchTaskWorkspace(task, 'schedule')
const exitTaskWorkspace = (source) => {
  void router.push(source === 'schedule' ? NAV_ROUTE_PATHS.schedule : NAV_ROUTE_PATHS.tasks)
}

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
}

const ensureTaskFromRoute = async () => {
  if (route.name !== 'workspace-task' || !state.isLoggedIn) return
  const lessonId = String(route.params.lessonId || '')
  if (!lessonId || routeTaskKey.value === lessonId) return
  routeTaskKey.value = lessonId
  try {
    const selected = await state.selectTaskById?.(lessonId)
    if (!selected && String(state.activeTaskId || '') !== lessonId) {
      await router.replace(NAV_ROUTE_PATHS.tasks)
    }
  } catch {
    if (String(state.activeTaskId || '') !== lessonId) await router.replace(NAV_ROUTE_PATHS.tasks)
  }
}

onMounted(() => {
  applyTheme(activeTheme.value)
  const media = window.matchMedia('(max-width: 680px)')
  const syncMobile = () => {
    isMobileApp.value = media.matches
    if (media.matches) showTodoCenter.value = false
  }
  syncMobile()
  media.addEventListener('change', syncMobile)
  cleanupMobileMedia = () => media.removeEventListener('change', syncMobile)
})

onBeforeUnmount(() => cleanupMobileMedia())

watch(activeTheme, (theme) => {
  applyTheme(theme)
  if (typeof window !== 'undefined') window.localStorage.setItem('children-art-theme', theme)
  if (state.isLoggedIn && state.remoteReady) void state.savePreferences?.(theme)
}, { immediate: true })

watch(visibleNavIds, (ids) => {
  if (!ids.length) return
  if (activeNav.value && !ids.includes(activeNav.value)) {
    void router.replace(groupPathFor(activeGroupId.value))
    return
  }
  if (!filteredNavGroups.value.some((group) => group.id === activeGroupId.value)) {
    void router.replace(groupPathFor(filteredNavGroups.value[0].id))
  }
}, { immediate: true })

watch([activeNav, () => state.isLoggedIn], ([nav, loggedIn]) => {
  if (!loggedIn || !nav) return
  // 今日课次页只依赖 shell 中的今日课次。班级/学生/课程等主数据在真正打开课次时再取。
  if (nav === 'tasks') return
  void state.ensurePageData?.(nav).catch(() => {
    // 页面自己的空态和错误提示负责展示加载失败，不阻断其他模块。
  })
}, { immediate: true })

watch([() => route.name, () => route.params.lessonId, () => state.isLoggedIn], () => {
  if (route.name === 'workspace-task') void ensureTaskFromRoute()
  else routeTaskKey.value = ''
}, { immediate: true })
</script>

<template>
  <main class="app-shell" :class="{ 'app-shell-mobile': isMobileApp }">
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
        v-if="isMobileApp && routeMode === 'home'"
        title="课后交付系统"
        eyebrow="选择要进入的工作模块"
        :items="mobileGroupEntries"
        @open="openGroup"
      />

      <template v-else-if="isMobileApp && routeMode === 'group'">
        <button class="module-back-link" type="button" @click="returnToMobileGroups">← 返回上一级</button>
        <ModuleHubView v-if="activeGroup" :group="activeGroup" @open="openNav" />
      </template>

      <ModuleHubView
        v-else-if="!isMobileApp && (routeMode === 'home' || routeMode === 'group') && activeGroup"
        :group="activeGroup"
        @open="openNav"
      />

      <button v-if="showModuleBack" class="module-back-link" type="button" @click="returnToGroup">← 返回{{ activeGroup?.label || '上一级' }}</button>

      <TasksView v-if="showActivePage && activeNav === 'tasks'" :state="state" :workspace-launch="workspaceLaunch" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @back-to-source="exitTaskWorkspace" @open-task="launchTaskWorkspace" @navigate="handleNavigate" />

      <ScheduleView v-if="showActivePage && activeNav === 'schedule'" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @open-task="openScheduleTask" />

      <SupervisionBoardView v-if="showActivePage && activeNav === 'supervision' && state.canQualityRead" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <ProductionCenterView
        v-if="showActivePage && activeNav === 'production'"
        :state="state"
        :group-label="activeGroup?.label"
        :handoff="productionHandoff"
        @back-to-group="returnToGroup"
        @handoff-consumed="productionHandoff = null"
      />

      <MasterDataView v-if="showActivePage && activeNav === 'students'" :state="state" entity="students" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @open-import="openImportCenter('学生名单')" />

      <MasterDataView v-if="showActivePage && activeNav === 'teachers'" :state="state" entity="teachers" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <MasterDataView v-if="showActivePage && activeNav === 'classes'" :state="state" entity="classes" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @open-import="openImportCenter('综合课表')" />

      <MasterDataView v-if="showActivePage && activeNav === 'courses'" :state="state" entity="courses" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <ImportCenterView v-if="showActivePage && activeNav === 'imports'" :state="state" :initial-type="activeImportType" @open-schedule="openNav('schedule')" />

      <MasterDataView v-if="showActivePage && activeNav === 'externalLinks'" :state="state" entity="externalLinks" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <TemplatesView v-if="showActivePage && activeNav === 'templates'" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <AccountManagementView v-if="showActivePage && activeNav === 'accountManagement' && state.canManageIdentityUsers" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <RoleManagementView v-if="showActivePage && activeNav === 'roleManagement' && state.canManageIdentityRoles" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <PermissionResourcesView v-if="showActivePage && activeNav === 'permissionResources' && state.canManageIdentityRoles" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <ArchiveQueryView v-if="showActivePage && activeNav === 'archives'" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" @create-portfolio="openProductionCenter" />

      <ExtraTasksView v-if="showActivePage && activeNav === 'extraTasks'" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />

      <SystemSettingsView v-if="showActivePage && activeNav === 'settings' && state.isAdmin" :state="state" :group-label="activeGroup?.label" @back-to-group="returnToGroup" />
    </section>
  </main>
</template>
