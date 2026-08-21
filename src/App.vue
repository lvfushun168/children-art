<script setup>
import { computed, onBeforeUnmount, onMounted, proxyRefs, ref } from 'vue'
import LoginView from './views/LoginView.vue'
import ParentSharePage from './views/ParentSharePage.vue'
import { useDeliveryWorkflow } from './composables/useDeliveryWorkflow'

const state = proxyRefs(useDeliveryWorkflow())
const routeHash = ref(typeof window !== 'undefined' ? window.location.hash : '')
const updateRouteHash = () => { routeHash.value = window.location.hash }

onMounted(() => window.addEventListener('hashchange', updateRouteHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', updateRouteHash))

const shareRoute = computed(() => {
  const studentMatch = routeHash.value.match(/^#\/share\/student\/([^/?#]+)\/([^/?#]+)(?:\?token=([^&]+))?/)
  if (studentMatch) return { type: 'student', lessonId: studentMatch[1], studentId: studentMatch[2], token: studentMatch[3] || '' }
  const lessonMatch = routeHash.value.match(/^#\/share\/lesson\/([^/?#]+)(?:\?token=([^&]+))?/)
  if (lessonMatch) return { type: 'lesson', lessonId: lessonMatch[1], token: lessonMatch[2] || '' }
  return null
})
</script>

<template>
  <ParentSharePage v-if="shareRoute" :state="state" :route="shareRoute" />

  <LoginView v-else-if="!state.isLoggedIn" :state="state" />

  <RouterView v-else v-slot="{ Component }">
    <component :is="Component" :state="state" />
  </RouterView>
</template>
