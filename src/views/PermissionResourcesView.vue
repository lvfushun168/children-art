<script setup>
import SkeletonList from '../components/common/SkeletonList.vue'
import EmptyState from '../components/common/EmptyState.vue'
import { computed, onMounted, ref } from 'vue'
import AppIcon from '../components/common/AppIcon.vue'
import AppStatusTag from '../components/common/AppStatusTag.vue'
import PageHead from '../components/layout/PageHead.vue'
import { identityModuleLabel, identityStatusClass, identityStatusLabel } from '../data/identity'

const props = defineProps({
  state: {
    type: Object,
    required: true
  },
  groupLabel: {
    type: String,
    default: ''
  }
})

defineEmits(['backToGroup'])

const query = ref('')
const openedModules = ref({})

const permissionGroups = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  const groups = new Map()
  for (const permission of props.state.identityPermissions || []) {
    const match = !normalizedQuery || [permission.permissionKey, permission.description, permission.module]
      .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
    if (!match) continue
    const key = permission.module || 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(permission)
  }
  return [...groups.entries()]
    .map(([module, permissions]) => ({ module, permissions: permissions.sort((a, b) => a.permissionKey.localeCompare(b.permissionKey)) }))
    .sort((a, b) => identityModuleLabel(a.module).localeCompare(identityModuleLabel(b.module), 'zh-CN'))
})

const toggleModule = (module) => {
  openedModules.value = { ...openedModules.value, [module]: !openedModules.value[module] }
}

const loadResources = () => props.state.loadIdentityPermissions()

onMounted(loadResources)
</script>

<template>
  <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">
    <AppIcon name="back" :size="16" />返回{{ groupLabel }}
  </button>

  <PageHead title="权限资源" />

  <section class="identity-page">

    <section class="panel identity-list-panel">
      <div class="section-head identity-resource-head">
        <div>
          <strong>{{ state.identityPermissions.length }} 项资源</strong>
        </div>
        <input v-model="query" class="identity-resource-search" placeholder="搜索权限名称或权限键" aria-label="搜索权限资源" />
      </div>

      <SkeletonList v-if="state.identityLoading.permissions" :rows="6" />
      <div v-else-if="state.identityErrors.permissions" class="identity-empty identity-error">
        <strong>{{ state.identityErrors.permissions }}</strong>
        <button class="ghost" type="button" @click="loadResources"><AppIcon name="retry" :size="15" />重试</button>
      </div>
      <div v-else-if="!permissionGroups.length">
        <EmptyState icon="permission" title="没有匹配的权限资源" description="换个关键词再试试。" />
      </div>

      <div v-else class="identity-resource-groups">
        <section v-for="group in permissionGroups" :key="group.module" class="identity-resource-group">
          <button class="identity-resource-group-toggle" type="button" @click="toggleModule(group.module)">
            <span>
              <strong>{{ identityModuleLabel(group.module) }}</strong>
              <small>{{ group.module }}</small>
            </span>
            <b>{{ group.permissions.length }} 项 · {{ openedModules[group.module] ? '收起' : '展开' }}<AppIcon :name="openedModules[group.module] ? 'collapse' : 'expand'" :size="14" /></b>
          </button>
          <div v-if="openedModules[group.module]" class="identity-resource-table">
            <article v-for="permission in group.permissions" :key="permission.permissionKey">
              <div>
                <strong>{{ permission.description || permission.permissionKey || '未命名权限' }}</strong>
                <small v-if="permission.permissionKey">{{ permission.permissionKey }}</small>
              </div>
              <AppStatusTag class="identity-status" :class="identityStatusClass(permission.status)" :status="identityStatusLabel(permission.status)" />
            </article>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
