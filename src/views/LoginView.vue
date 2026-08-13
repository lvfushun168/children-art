<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const state = props.state
const step = ref('credentials')
const selectedRole = ref('')
const errorMessage = ref('')
const showPassword = ref(false)

const roleOptions = computed(() => state.loginRoleOptions || [])
const canContinue = computed(() => Boolean(String(state.loginForm.phone || '').trim() && state.loginForm.password))

const submitCredentials = async () => {
  errorMessage.value = ''
  if (!canContinue.value) {
    errorMessage.value = '请输入手机号和密码'
    return
  }
  if (!(await state.verifyLogin())) {
    errorMessage.value = '手机号或密码不正确，请检查后重试'
    return
  }
  selectedRole.value = roleOptions.value[0]?.value || ''
  step.value = 'role'
}

const selectRole = (role) => {
  selectedRole.value = role
  state.loginForm.role = role
  errorMessage.value = ''
}

const submitRole = async () => {
  errorMessage.value = ''
  if (!selectedRole.value) {
    errorMessage.value = '请选择登录身份'
    return
  }
  if (!(await state.loginWithRole(selectedRole.value))) {
    errorMessage.value = '该身份暂不可用，请返回重新验证'
  }
}

const backToCredentials = () => {
  step.value = 'credentials'
  selectedRole.value = ''
  errorMessage.value = ''
  state.clearLoginVerification()
}
</script>

<template>
  <main class="login-shell">
    <section class="login-panel" :class="`login-panel-${step}`">
      <header class="login-header">
        <div class="brand login-brand">
          <span class="brand-mark">课</span>
          <div>
            <strong>课后交付系统</strong>
            <small>梦地美术 · 大学城校区</small>
          </div>
        </div>
      </header>

      <Transition name="login-screen" mode="out-in">
        <form v-if="step === 'credentials'" key="credentials" class="login-form" @submit.prevent="submitCredentials">
          <div class="login-form-head">
            <span>欢迎回来</span>
            <h1>登录工作台</h1>
            <p>请输入手机号和密码登录。</p>
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
            登录
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <section v-else key="role" class="login-role-step">
          <div class="login-form-head">
            <span>登录成功</span>
            <h1>请选择角色</h1>
            <p>请选择您希望进入的工作台。</p>
          </div>

          <div class="login-verified-account">
            <span>当前账号</span>
            <strong>{{ state.loginAccount?.name }} · {{ state.loginAccount?.username || state.loginAccount?.phone }}</strong>
          </div>

          <div v-if="roleOptions.length" class="login-role-grid">
            <button
              v-for="role in roleOptions"
              :key="role.value"
              type="button"
              class="login-role-card"
              :class="{ selected: selectedRole === role.value }"
              @click="selectRole(role.value)"
            >
              <span class="login-role-mark">{{ role.label.slice(0, 1) }}</span>
              <span class="login-role-copy">
                <strong>{{ role.label }}</strong>
                <small>{{ role.description }}</small>
                <em>{{ role.scope }}</em>
              </span>
              <span class="login-role-check" aria-hidden="true">{{ selectedRole === role.value ? '✓' : '' }}</span>
            </button>
          </div>

          <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

          <div class="login-form-actions">
            <button class="ghost" type="button" @click="backToCredentials">返回登录</button>
            <button class="primary login-submit" type="button" :disabled="!selectedRole" @click="submitRole">
              进入工作台
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </Transition>
    </section>
  </main>
</template>
