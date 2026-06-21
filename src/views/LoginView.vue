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
          <small>登录后按角色加载可见课次和功能权限</small>
        </div>
      </div>

      <div class="login-grid">
        <article class="login-card">
          <span>老师入口</span>
          <strong>林老师</strong>
          <small>只能查看周二创想班、线描提高班等授权班级课次。</small>
          <button class="primary" @click="state.loginAs(1)">以老师登录</button>
        </article>
        <article class="login-card">
          <span>管理员入口</span>
          <strong>王教务</strong>
          <small>可查看全部课次、基础数据、账号角色和系统配置。</small>
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
        <button class="secondary" @click="state.loginWithForm">模拟登录</button>
      </div>

      <div class="notice-box">
        <strong>开发约束</strong>
        <small>登录后服务端必须返回用户角色、授权班级、可访问菜单和 token；前端列表筛选不能替代后端权限校验。</small>
      </div>
    </section>
  </main>
</template>
