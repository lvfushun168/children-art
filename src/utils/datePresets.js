import {
  addDaysValue,
  endOfMonthValue,
  endOfWeekValue,
  parseDateValue,
  startOfMonthValue,
  startOfWeekValue,
  toDateValue
} from './scheduleCalendar.js'

export const todayValue = () => toDateValue(new Date())

// 日期范围选择器的快捷项，值都是 yyyy-MM-dd 字符串，周一为一周起点。
export const rangePresetDefinitions = (today = todayValue()) => [
  { key: 'today', label: '今天', start: today, end: today },
  { key: 'thisWeek', label: '本周', start: startOfWeekValue(today), end: endOfWeekValue(today) },
  { key: 'thisMonth', label: '本月', start: startOfMonthValue(today), end: endOfMonthValue(today) },
  { key: 'last7', label: '近 7 天', start: addDaysValue(today, -6), end: today },
  { key: 'last30', label: '近 30 天', start: addDaysValue(today, -29), end: today }
]

export const rangePresetDates = (today) => rangePresetDefinitions(today).map((item) => ({
  label: item.label,
  value: () => [parseDateValue(item.start), parseDateValue(item.end)]
}))

export const singlePresetDates = () => [
  { label: '今天', value: () => parseDateValue(todayValue()) },
  { label: '明天', value: () => parseDateValue(addDaysValue(todayValue(), 1)) }
]

export const normalizeTimeValue = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return ''
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export const timeToMinutes = (value) => {
  const normalized = normalizeTimeValue(value)
  if (!normalized) return null
  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

// 加上分钟数后仍落在当天，超过 23:59 时停在 23:59。
export const addMinutesToTime = (value, minutes) => {
  const start = timeToMinutes(value)
  if (start === null) return ''
  const total = Math.min(23 * 60 + 59, start + Number(minutes || 0))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
