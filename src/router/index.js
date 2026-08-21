import { createRouter, createWebHistory } from 'vue-router'
import WorkspaceShell from '../views/WorkspaceShell.vue'
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

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

export default router
