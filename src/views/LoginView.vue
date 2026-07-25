<script setup>
defineProps({
  state: {
    type: Object,
    required: true
  }
})
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
          <select v-model="state.loginForm.phone">
            <option v-for="teacher in state.teachers" :key="teacher.id">{{ teacher.phone }}</option>
          </select>
        </label>
        <label>
          角色
          <select v-model="state.loginForm.role">
            <option>老师</option>
            <option>管理员</option>
          </select>
        </label>
        <button class="secondary" @click="state.loginWithForm">登录</button>
      </div>


    </section>
  </main>
</template>
