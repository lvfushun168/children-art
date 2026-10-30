import '../services/backLayers.js'
import { createRouter, createWebHistory } from 'vue-router'
import WorkspaceShell from '../views/WorkspaceShell.vue'
import { navGroups } from '../data/navigation.js'
import {
  GROUP_ROUTE_PATHS,
  HOME_ROUTE_PATH,
  NAV_GROUP_IDS,
  NAV_ROUTE_PATHS
} from '../routerPaths.js'

const workspaceRoute = (path, name, meta) => ({
  path,
  name,
  component: WorkspaceShell,
  meta
})

const navRoutes = Object.entries(NAV_ROUTE_PATHS)
  .filter(([navId]) => navId !== 'tasks')
  .map(([navId, path]) => workspaceRoute(path, `workspace-${navId}`, {
    viewMode: 'page',
    navId,
    groupId: NAV_GROUP_IDS[navId]
  }))

const routes = [
  workspaceRoute('/', 'workspace-root', { viewMode: 'home', groupId: 'afterClass' }),
  { path: '/workspace', redirect: HOME_ROUTE_PATH },
  workspaceRoute(HOME_ROUTE_PATH, 'workspace-home', { viewMode: 'home', groupId: 'afterClass' }),
  ...Object.entries(GROUP_ROUTE_PATHS).map(([groupId, path]) => workspaceRoute(path, `workspace-group-${groupId}`, {
    viewMode: 'group',
    groupId
  })),
  workspaceRoute(NAV_ROUTE_PATHS.tasks, 'workspace-tasks', {
    viewMode: 'page',
    navId: 'tasks',
    groupId: 'afterClass'
  }),
  workspaceRoute(`${NAV_ROUTE_PATHS.tasks}/:lessonId`, 'workspace-task', {
    viewMode: 'page',
    navId: 'tasks',
    groupId: 'afterClass',
    taskWorkspace: true
  }),
  ...navRoutes,
  { path: '/:pathMatch(.*)*', redirect: HOME_ROUTE_PATH }
]

const APP_TITLE = '课后交付系统'
const navLabels = new Map(navGroups.flatMap((group) => group.items.map((item) => [item.id, item.label])))
const groupLabels = new Map(navGroups.map((group) => [group.id, group.label]))

// 标签页标题随页面变化，多开几个标签页时也能一眼分清。
const titleFor = (route) => {
  if (route.meta?.taskWorkspace) return '课次处理'
  const label = navLabels.get(route.meta?.navId) || (route.meta?.viewMode === 'group' ? groupLabels.get(route.meta?.groupId) : '')
  return label ? `${label} · ${APP_TITLE}` : APP_TITLE
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // 关闭抽屉等页面内层级也会触发同地址的导航，此时不能把页面滚回顶部。
  scrollBehavior: (to, from) => (to.fullPath === from.fullPath ? false : { top: 0 })
})

router.afterEach((to) => {
  if (typeof document !== 'undefined') document.title = titleFor(to)
})

export default router
