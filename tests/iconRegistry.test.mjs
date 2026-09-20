import assert from 'node:assert/strict'
import test from 'node:test'

import { CircleHelp } from 'lucide-vue-next'
import {
  iconCategories,
  iconNames,
  iconRegistry,
  resolveIcon
} from '../src/components/common/iconRegistry.js'

test('resolves every registered semantic icon name', () => {
  assert.ok(iconNames.length > 0)

  for (const name of iconNames) {
    assert.ok(['function', 'object'].includes(typeof resolveIcon(name)), `图标未解析：${name}`)
  }
})

test('keeps navigation, action, and status categories registered', () => {
  const categoryNames = Object.values(iconCategories).flat()
  assert.equal(new Set(categoryNames).size, categoryNames.length, '图标语义名称不能跨分类重复')

  for (const [category, names] of Object.entries(iconCategories)) {
    assert.ok(names.length > 0, `图标分类为空：${category}`)
    for (const name of names) {
      assert.ok(iconNames.includes(name), `图标未进入注册表：${name}`)
    }
  }
})

test('resolves future phase semantic names', () => {
  for (const name of ['finance', 'task-system', 'academic']) {
    assert.notEqual(resolveIcon(name), CircleHelp, `未来模块图标未注册：${name}`)
  }
})

test('falls back to CircleHelp for unknown names', () => {
  assert.equal(resolveIcon('not-registered'), CircleHelp)
  assert.equal(resolveIcon(''), CircleHelp)
  assert.equal(resolveIcon(null), CircleHelp)
})

test('does not expose direct Lucide component names as semantic keys', () => {
  for (const name of ['CalendarDays', 'Archive', 'UserRound', 'HelpCircle']) {
    assert.equal(iconRegistry[name], undefined)
  }
})
