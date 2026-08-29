<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const state = props.state
const errorMessage = ref('')
const showPassword = ref(false)

const canContinue = computed(() => Boolean(
  String(state.loginForm.phone || '').trim()
  && state.loginForm.password
  && !state.remoteLoading
))

const submitLogin = async () => {
  errorMessage.value = ''
  if (!canContinue.value) {
    errorMessage.value = '请输入手机号和密码'
    return
  }
  if (!(await state.loginWithForm())) {
    errorMessage.value = '登录失败，请检查账号密码或稍后重试'
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
          <h1>登录工作台</h1>
          <p>请输入手机号和密码登录，系统将根据账号已分配的角色权限进入工作台。</p>
        </div>

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

        <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

        <button class="primary login-submit" type="submit" :disabled="!canContinue">
          {{ state.remoteLoading ? '登录中...' : '登录' }}
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  </main>
</template>
