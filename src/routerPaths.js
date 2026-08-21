export const HOME_ROUTE_PATH = '/workspace/artist/library'

export const GROUP_ROUTE_PATHS = Object.freeze({
  afterClass: '/workspace/after-class',
  basic: '/workspace/basic',
  materials: '/workspace/materials',
  operations: '/workspace/operations'
})

export const NAV_ROUTE_PATHS = Object.freeze({
  schedule: '/workspace/after-class/schedule',
  tasks: '/workspace/after-class/tasks',
  supervision: '/workspace/after-class/supervision',
  production: '/workspace/after-class/production',
  teachers: '/workspace/basic/teachers',
  students: '/workspace/basic/students',
  classes: '/workspace/basic/classes',
  externalLinks: '/workspace/basic/external-links',
  courses: '/workspace/materials/courses',
  archives: '/workspace/materials/archives',
  extraTasks: '/workspace/materials/extra-tasks',
  imports: '/workspace/operations/imports',
  templates: '/workspace/operations/templates',
  accountManagement: '/workspace/operations/account-management',
  roleManagement: '/workspace/operations/role-management',
  permissionResources: '/workspace/operations/permission-resources',
  settings: '/workspace/operations/settings'
})

export const NAV_GROUP_IDS = Object.freeze({
  schedule: 'afterClass',
  tasks: 'afterClass',
  supervision: 'afterClass',
  production: 'afterClass',
  teachers: 'basic',
  students: 'basic',
  classes: 'basic',
  externalLinks: 'basic',
  courses: 'materials',
  archives: 'materials',
  extraTasks: 'materials',
  imports: 'operations',
  templates: 'operations',
  accountManagement: 'operations',
  roleManagement: 'operations',
  permissionResources: 'operations',
  settings: 'operations'
})

export const groupPathFor = (groupId) => GROUP_ROUTE_PATHS[groupId] || GROUP_ROUTE_PATHS.afterClass
export const navPathFor = (navId) => NAV_ROUTE_PATHS[navId] || HOME_ROUTE_PATH

export const taskRouteLocation = (lessonId, source = 'today') => ({
  name: 'workspace-task',
  params: { lessonId: String(lessonId) },
  query: source === 'schedule' ? { source: 'schedule' } : {}
})
