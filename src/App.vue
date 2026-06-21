<script setup>
import { computed, proxyRefs, ref } from 'vue'
import SidebarNav from './components/layout/SidebarNav.vue'
import UserMenu from './components/layout/UserMenu.vue'
import { navItems } from './data/mockData'
import { useDeliveryWorkflow } from './composables/useDeliveryWorkflow'
import ArchiveQueryView from './views/ArchiveQueryView.vue'
import LoginView from './views/LoginView.vue'
import MasterDataView from './views/MasterDataView.vue'
import SystemSettingsView from './views/SystemSettingsView.vue'
import TasksView from './views/TasksView.vue'
import TemplatesView from './views/TemplatesView.vue'
import WheatTraceView from './views/WheatTraceView.vue'

const activeNav = ref('tasks')
const state = proxyRefs(useDeliveryWorkflow())

const filteredNavItems = computed(() => navItems.filter((item) => !state.visibleNavItems.includes(item.id)))
const pendingCount = computed(() => state.visibleTasks.filter((task) => task.status !== '已完成').length)

</script>

<template>
  <LoginView v-if="!state.isLoggedIn" :state="state" />

  <main v-else class="app-shell">
    <SidebarNav
      v-model:active-nav="activeNav"
      :nav-items="filteredNavItems"
      :pending-count="pendingCount"
      :school="state.school"
    />

    <section class="content">
      <UserMenu
        :current-user="state.currentUser"
        :permission-summary="state.permissionSummary"
        :teachers="state.teachers"
        @switch-user="state.loginAs"
        @logout="state.logout"
      />

      <TasksView v-if="activeNav === 'tasks'" :state="state" @navigate="activeNav = $event" />

      <MasterDataView v-if="activeNav === 'students'" :state="state" entity="students" />

      <MasterDataView v-if="activeNav === 'classes'" :state="state" entity="classes" />

      <MasterDataView v-if="activeNav === 'courses'" :state="state" entity="courses" />

      <TemplatesView v-if="activeNav === 'templates'" :templates="state.templates" />

      <ArchiveQueryView v-if="activeNav === 'archives'" :state="state" />

      <WheatTraceView
        v-if="activeNav === 'wheat'"
        :traces="state.wheatTraces"
        :import-batches="state.importBatches"
        @mark-trace="state.markTrace"
      />

      <SystemSettingsView v-if="activeNav === 'settings' && state.isAdmin" :state="state" />
    </section>
  </main>
</template>
