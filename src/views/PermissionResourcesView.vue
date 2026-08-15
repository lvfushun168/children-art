<script setup>
import { computed, onMounted, ref } from 'vue'
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
    ← 返回{{ groupLabel }}
  </button>

  <PageHead eyebrow="权限中心" title="权限资源" />

  <section class="identity-page">
    <section class="panel identity-intro-panel">
      <div>
        <span>系统资源目录</span>
        <strong>菜单、按钮和操作权限</strong>
      </div>
      <small>资源由后端维护并按模块提供，角色管理只负责分配这些已登记的功能权限。</small>
    </section>

    <section class="panel identity-list-panel">
      <div class="section-head identity-resource-head">
        <div>
          <span>权限资源目录</span>
          <strong>{{ state.identityPermissions.length }} 项资源</strong>
        </div>
        <input v-model="query" class="identity-resource-search" placeholder="搜索权限名称或权限键" aria-label="搜索权限资源" />
      </div>

      <div v-if="state.identityLoading.permissions" class="identity-empty">正在加载权限资源...</div>
      <div v-else-if="state.identityErrors.permissions" class="identity-empty identity-error">
        <strong>{{ state.identityErrors.permissions }}</strong>
        <button class="ghost" type="button" @click="loadResources">重试</button>
      </div>
      <div v-else-if="!permissionGroups.length" class="identity-empty">
        <strong>没有匹配的权限资源</strong>
        <span>尝试更换搜索关键词。</span>
      </div>

      <div v-else class="identity-resource-groups">
        <section v-for="group in permissionGroups" :key="group.module" class="identity-resource-group">
          <button class="identity-resource-group-toggle" type="button" @click="toggleModule(group.module)">
            <span>
              <strong>{{ identityModuleLabel(group.module) }}</strong>
              <small>{{ group.module }}</small>
            </span>
            <b>{{ group.permissions.length }} 项 · {{ openedModules[group.module] ? '收起' : '展开' }}</b>
          </button>
          <div v-if="openedModules[group.module]" class="identity-resource-table">
            <article v-for="permission in group.permissions" :key="permission.permissionKey">
              <div>
                <strong>{{ permission.description || permission.permissionKey }}</strong>
                <small>{{ permission.permissionKey }}</small>
              </div>
              <span class="identity-status" :class="identityStatusClass(permission.status)">{{ identityStatusLabel(permission.status) }}</span>
            </article>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
