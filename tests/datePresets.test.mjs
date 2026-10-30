import assert from 'node:assert/strict'
import test from 'node:test'

import { addMinutesToTime, normalizeTimeValue, rangePresetDefinitions, timeToMinutes } from '../src/utils/datePresets.js'

test('range presets are anchored on a Monday-based week', () => {
  const presets = Object.fromEntries(rangePresetDefinitions('2026-10-30').map((item) => [item.key, item]))
  assert.deepEqual([presets.today.start, presets.today.end], ['2026-10-30', '2026-10-30'])
  assert.deepEqual([presets.thisWeek.start, presets.thisWeek.end], ['2026-10-26', '2026-11-01'])
  assert.deepEqual([presets.thisMonth.start, presets.thisMonth.end], ['2026-10-01', '2026-10-31'])
  assert.deepEqual([presets.last7.start, presets.last7.end], ['2026-10-24', '2026-10-30'])
  assert.deepEqual([presets.last30.start, presets.last30.end], ['2026-10-01', '2026-10-30'])
})

test('normalizeTimeValue accepts HH:mm and rejects out-of-range values', () => {
  assert.equal(normalizeTimeValue('8:05'), '08:05')
  assert.equal(normalizeTimeValue('18:30:00'), '18:30')
  assert.equal(normalizeTimeValue('24:00'), '')
  assert.equal(normalizeTimeValue('09:60'), '')
  assert.equal(normalizeTimeValue(''), '')
})

test('addMinutesToTime moves a time forward and stops at the end of the day', () => {
  assert.equal(addMinutesToTime('18:30', 60), '19:30')
  assert.equal(addMinutesToTime('09:05', 90), '10:35')
  assert.equal(addMinutesToTime('23:30', 120), '23:59')
  assert.equal(addMinutesToTime('', 60), '')
  assert.equal(timeToMinutes('01:30'), 90)
  assert.equal(timeToMinutes('nope'), null)
})
