<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const phoneOptions = computed(() => props.state.teachers.map((teacher) => teacher.phone))
const roleOptions = ['老师', '管理员']
</script>

<template>
  <main class="login-shell">
    <section class="login-panel">
      <div class="brand login-brand">
        <span class="brand-mark">课</span>
        <div>
          <strong>课后交付系统</strong>
        </div>
      </div>

      <div class="login-grid">
        <article class="login-card">
          <span>老师入口</span>
          <strong>林老师</strong>
          <button class="primary" @click="state.loginAs(1)">以老师登录</button>
        </article>
        <article class="login-card">
          <span>管理员入口</span>
          <strong>王教务</strong>
          <button class="primary" @click="state.loginAs(3)">以管理员登录</button>
        </article>
      </div>

      <div class="manual-login">
        <label>
          手机号
          <AdaptiveSelect v-model="state.loginForm.phone" :options="phoneOptions" />
        </label>
        <label>
          角色
          <AdaptiveSelect v-model="state.loginForm.role" :options="roleOptions" />
        </label>
        <button class="secondary" @click="state.loginWithForm">登录</button>
      </div>


    </section>
  </main>
</template>
