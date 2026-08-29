import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GROUP_ROUTE_PATHS,
  HOME_ROUTE_PATH,
  NAV_ROUTE_PATHS,
  groupPathFor,
  navPathFor,
  taskRouteLocation
} from '../src/routerPaths.js'

test('keeps every visible workspace navigation item on a stable route', () => {
  assert.equal(HOME_ROUTE_PATH, '/workspace/artist/library')
  assert.equal(groupPathFor('basic'), GROUP_ROUTE_PATHS.basic)
  assert.equal(navPathFor('students'), '/workspace/basic/students')
  assert.equal(navPathFor('campuses'), '/workspace/operations/campuses')
  assert.equal(navPathFor('accountManagement'), '/workspace/operations/account-management')
  assert.equal(navPathFor('missing'), HOME_ROUTE_PATH)
})

test('encodes task workspace identity and source in the route', () => {
  assert.deepEqual(taskRouteLocation(42), {
    name: 'workspace-task',
    params: { lessonId: '42' },
    query: {}
  })
  assert.deepEqual(taskRouteLocation('lesson-7', 'schedule'), {
    name: 'workspace-task',
    params: { lessonId: 'lesson-7' },
    query: { source: 'schedule' }
  })
})
