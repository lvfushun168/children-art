<script setup>
import { computed, ref } from 'vue'
import AdaptiveSelect from '../components/common/AdaptiveSelect.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const state = props.state
const errorMessage = ref('')
const showPassword = ref(false)
const selectedCampusId = ref('')

const canContinue = computed(() => Boolean(
  String(state.loginForm.phone || '').trim()
  && state.loginForm.password
  && !state.remoteLoading
))
const campusOptions = computed(() => (state.availableCampuses || []).map((campus) => ({
  value: campus.id,
  label: campus.name,
  description: campus.code
})))
const canSelectCampus = computed(() => Boolean(selectedCampusId.value && !state.remoteLoading && !state.campusSwitching))

const submitLogin = async () => {
  errorMessage.value = ''
  if (state.pendingCampusSelection) {
    if (!canSelectCampus.value) {
      errorMessage.value = '请选择要进入的校区'
      return
    }
    if (!(await state.confirmLoginCampus(selectedCampusId.value))) {
      errorMessage.value = '校区进入失败，请重试'
    }
    return
  }
  if (!canContinue.value) {
    errorMessage.value = '请输入手机号和密码'
    return
  }
  const success = await state.loginWithForm()
  if (!success) {
    errorMessage.value = '登录失败，请检查账号密码或稍后重试'
    return
  }
  if (state.pendingCampusSelection) {
    selectedCampusId.value = state.activeCampusId || campusOptions.value[0]?.value || ''
  }
}
</script>

<template>
  <main class="login-shell">
    <section class="login-panel">
      <header class="login-header">
        <div class="brand login-brand">
          <span class="brand-mark">课</span>
          <div>
            <strong>课后交付系统</strong>
            <small>梦地美术</small>
          </div>
        </div>
      </header>

      <form class="login-form" @submit.prevent="submitLogin">
        <div class="login-form-head">
          <span>欢迎回来</span>
          <h1>{{ state.pendingCampusSelection ? '选择进入校区' : '登录工作台' }}</h1>
          <p>{{ state.pendingCampusSelection ? '该账号已关联多个校区，请选择本次要进入的工作范围。' : '请输入手机号和密码登录，系统将根据账号已分配的角色权限进入工作台。' }}</p>
        </div>

        <template v-if="!state.pendingCampusSelection">
          <label>
            手机号或账号
            <input
              v-model="state.loginForm.phone"
              type="text"
              autocomplete="username"
              placeholder="请输入手机号或账号"
            />
          </label>

          <label>
            密码
            <span class="login-password-field">
              <input
                v-model="state.loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="请输入密码"
              />
              <button
                class="login-password-toggle"
                type="button"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? '隐藏' : '显示' }}
              </button>
            </span>
          </label>
        </template>

        <label v-else class="login-campus-field">
          进入校区
          <AdaptiveSelect v-model="selectedCampusId" :options="campusOptions" placeholder="请选择校区" />
        </label>

        <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

        <button class="primary login-submit" type="submit" :disabled="state.pendingCampusSelection ? !canSelectCampus : !canContinue">
          {{ state.remoteLoading || state.campusSwitching ? (state.pendingCampusSelection ? '进入中...' : '登录中...') : (state.pendingCampusSelection ? '进入工作台' : '登录') }}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  </main>
</template>
