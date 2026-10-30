import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPageItems, countPages } from '../src/utils/pagination.js'

test('countPages never returns less than one page', () => {
  assert.equal(countPages(0, 20), 1)
  assert.equal(countPages(41, 20), 3)
  assert.equal(countPages(40, 20), 2)
  assert.equal(countPages(10, 0), 1)
})

test('buildPageItems lists every page when the count is small', () => {
  assert.deepEqual(buildPageItems(1, 1), [1])
  assert.deepEqual(buildPageItems(3, 7), [1, 2, 3, 4, 5, 6, 7])
})

test('buildPageItems collapses distant pages into gaps', () => {
  assert.deepEqual(buildPageItems(1, 20), [1, 2, null, 20])
  assert.deepEqual(buildPageItems(10, 20), [1, null, 9, 10, 11, null, 20])
  assert.deepEqual(buildPageItems(20, 20), [1, null, 19, 20])
})

test('buildPageItems does not hide a single page behind a gap', () => {
  assert.deepEqual(buildPageItems(4, 20), [1, 2, 3, 4, 5, null, 20])
  assert.deepEqual(buildPageItems(17, 20), [1, null, 16, 17, 18, 19, 20])
})

test('buildPageItems clamps an out-of-range current page', () => {
  assert.deepEqual(buildPageItems(99, 20), [1, null, 19, 20])
  assert.deepEqual(buildPageItems(0, 20), [1, 2, null, 20])
})
