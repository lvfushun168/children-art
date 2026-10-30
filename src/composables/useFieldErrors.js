import { nextTick, reactive } from 'vue'

// 规则按字段名给出，返回错误文案（通过则返回空）：
//   validate(form, { name: (value) => !value.trim() && '请填写校区名称' })
// 空文案、false、undefined 都视为通过。
export const collectFieldErrors = (form, rules) => {
  const errors = {}
  for (const [field, rule] of Object.entries(rules)) {
    const message = rule(form?.[field], form)
    if (message) errors[field] = String(message)
  }
  return errors
}

export const useFieldErrors = () => {
  const errors = reactive({})

  const clear = (field) => {
    if (field === undefined) Object.keys(errors).forEach((key) => delete errors[key])
    else delete errors[field]
  }

  // 校验失败时填入错误并把焦点移到第一个出错的控件上；返回是否通过。
  const validate = async (form, rules, container) => {
    clear()
    Object.assign(errors, collectFieldErrors(form, rules))
    if (!Object.keys(errors).length) return true
    await nextTick()
    const root = container?.value || container || document
    const invalid = root.querySelector?.('[data-invalid="true"] input, [data-invalid="true"] textarea, [data-invalid="true"] [role="combobox"]')
    invalid?.focus()
    return false
  }

  return { errors, clear, validate }
}
