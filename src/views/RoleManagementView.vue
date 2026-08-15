<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import AdaptiveSelect from '../components/common/AdaptiveSelect.vue'
import { identityModuleLabel, identityStatusClass, identityStatusLabel, identityStatusOptions } from '../data/identity'
import { sameId } from '../services/mappers'

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

const editorOpen = ref(false)
const permissionDrawerOpen = ref(false)
const roleForm = ref(null)
const selectedRole = ref(null)
const selectedPermissionKeys = ref([])
const openedModules = ref({})

const blankRole = () => ({
  id: null,
  roleKey: '',
  name: '',
  description: '',
  status: 'ENABLED',
  system: false,
  version: 0
})

const permissionGroups = computed(() => {
  const groups = new Map()
  for (const permission of props.state.identityPermissions || []) {
    const key = permission.module || 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(permission)
  }
  return [...groups.entries()]
    .map(([module, permissions]) => ({ module, permissions: permissions.sort((a, b) => a.permissionKey.localeCompare(b.permissionKey)) }))
    .sort((a, b) => identityModuleLabel(a.module).localeCompare(identityModuleLabel(b.module), 'zh-CN'))
})

const enabledPermissionsFor = (group) => group.permissions.filter((permission) => permission.status === 'ENABLED')
const selectedCountFor = (group) => group.permissions.filter((permission) => selectedPermissionKeys.value.includes(permission.permissionKey)).length
const allSelectedFor = (group) => {
  const enabled = enabledPermissionsFor(group)
  return enabled.length > 0 && enabled.every((permission) => selectedPermissionKeys.value.includes(permission.permissionKey))
}
const userCountFor = (role) => (props.state.identityUsers || []).filter((user) => user.roles?.some((item) => sameId(item.id, role.id))).length
const permissionCountFor = (role) => role.permissions?.length || 0

const loadData = async () => {
  await Promise.all([
    props.state.loadIdentityRoles(),
    props.state.loadIdentityPermissions(),
    props.state.loadIdentityUsers({ page: 1, pageSize: 200 })
  ])
}

const openRoleEditor = (role = null) => {
  roleForm.value = role ? { ...role } : blankRole()
  editorOpen.value = true
}

const closeRoleEditor = () => {
  editorOpen.value = false
  roleForm.value = null
}

const saveRole = async () => {
  if (!roleForm.value?.roleKey?.trim() || !roleForm.value?.name?.trim()) {
    props.state.notify('请填写角色键和角色名称')
    return
  }
  const result = roleForm.value.id
    ? await props.state.updateIdentityRole(roleForm.value.id, roleForm.value)
    : await props.state.createIdentityRole(roleForm.value)
  if (result) closeRoleEditor()
}

const openPermissionDrawer = (role) => {
  selectedRole.value = role
  selectedPermissionKeys.value = [...(role.permissions || [])]
  openedModules.value = {}
  permissionDrawerOpen.value = true
}

const closePermissionDrawer = () => {
  permissionDrawerOpen.value = false
  selectedRole.value = null
  selectedPermissionKeys.value = []
}

const toggleModule = (module) => {
  openedModules.value = { ...openedModules.value, [module]: !openedModules.value[module] }
}

const toggleGroup = (group) => {
  const keys = enabledPermissionsFor(group).map((permission) => permission.permissionKey)
  const selected = new Set(selectedPermissionKeys.value)
  if (allSelectedFor(group)) keys.forEach((key) => selected.delete(key))
  else keys.forEach((key) => selected.add(key))
  selectedPermissionKeys.value = [...selected]
}

const savePermissions = async () => {
  if (!selectedRole.value) return
  const idsByKey = new Map((props.state.identityPermissions || []).map((permission) => [permission.permissionKey, permission.id]))
  const permissionIds = selectedPermissionKeys.value.map((key) => idsByKey.get(key)).filter((id) => id !== null && id !== undefined).map(String)
  if (permissionIds.length !== selectedPermissionKeys.value.length) {
    props.state.notify('权限资源已变化，请刷新后重试')
    await props.state.loadIdentityPermissions({ force: true })
    return
  }
  const result = await props.state.replaceIdentityRolePermissions(selectedRole.value.id, selectedRole.value.version, permissionIds)
  if (result) closePermissionDrawer()
}

onMounted(loadData)
</script>

<template>
  <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">
    ← 返回{{ groupLabel }}
  </button>

  <PageHead eyebrow="权限中心" title="角色管理">
    <button class="primary" type="button" @click="openRoleEditor()">新增角色</button>
  </PageHead>

  <section class="identity-page">
    <section class="panel identity-intro-panel">
      <div>
        <span>标准 RBAC</span>
        <strong>账号绑定角色，角色授予功能权限</strong>
      </div>
      <small>数据范围按账号的机构/校区归属执行，不在角色权限中展开班级关系。</small>
    </section>

    <section class="panel identity-list-panel">
      <div class="section-head">
        <div>
          <span>角色列表</span>
          <strong>{{ state.identityRoles.length }} 个角色</strong>
        </div>
        <small>系统角色不可删除</small>
      </div>

      <div v-if="state.identityLoading.roles" class="identity-empty">正在加载角色...</div>
      <div v-else-if="state.identityErrors.roles" class="identity-empty identity-error">
        <strong>{{ state.identityErrors.roles }}</strong>
        <button class="ghost" type="button" @click="loadData">重试</button>
      </div>
      <div v-else-if="!state.identityRoles.length" class="identity-empty">
        <strong>暂无角色</strong>
        <span>可以创建一个自定义角色。</span>
      </div>

      <div v-else class="identity-role-list">
        <article v-for="role in state.identityRoles" :key="role.id" class="identity-role-card">
          <header>
            <div>
              <strong>{{ role.name }}</strong>
              <small>{{ role.roleKey }}</small>
            </div>
            <div class="identity-card-badges">
              <span v-if="role.system" class="identity-badge">系统角色</span>
              <span class="identity-status" :class="identityStatusClass(role.status)">{{ identityStatusLabel(role.status) }}</span>
            </div>
          </header>
          <p>{{ role.description || '暂无角色说明' }}</p>
          <div class="identity-role-metrics">
            <span><b>{{ userCountFor(role) }}</b> 个当前校区账号</span>
            <span><b>{{ permissionCountFor(role) }}</b> 项功能权限</span>
          </div>
          <footer class="identity-card-actions">
            <button class="ghost" type="button" @click="openRoleEditor(role)">编辑角色</button>
            <button class="secondary" type="button" @click="openPermissionDrawer(role)">配置权限</button>
          </footer>
        </article>
      </div>
    </section>
  </section>

  <div v-if="editorOpen" class="drawer-backdrop" @click.self="closeRoleEditor">
    <aside class="library-drawer identity-drawer">
      <div class="drawer-head">
        <div>
          <span>角色管理</span>
          <strong>{{ roleForm?.id ? '编辑角色' : '新增角色' }}</strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭" @click="closeRoleEditor">×</button>
      </div>
      <form class="identity-form" @submit.prevent="saveRole">
        <label><span>角色名称</span><input v-model="roleForm.name" required /></label>
        <label><span>角色键</span><input v-model="roleForm.roleKey" required :disabled="roleForm.id || roleForm.system" pattern="[a-z][a-z0-9_.-]{1,99}" placeholder="例如：academic_admin" /></label>
        <label><span>角色说明</span><textarea v-model="roleForm.description" rows="4" placeholder="说明这个角色可以做什么" /></label>
        <label v-if="roleForm.id"><span>状态</span><AdaptiveSelect v-model="roleForm.status" :options="identityStatusOptions" /></label>
        <p v-if="roleForm.system" class="identity-drawer-note">系统角色由系统保护，角色键不可修改，也不能删除。</p>
        <div class="drawer-actions">
          <button class="ghost" type="button" @click="closeRoleEditor">取消</button>
          <button class="primary" type="submit" :disabled="Boolean(state.processingAction)">保存角色</button>
        </div>
      </form>
    </aside>
  </div>

  <div v-if="permissionDrawerOpen" class="drawer-backdrop" @click.self="closePermissionDrawer">
    <aside class="library-drawer identity-drawer identity-permission-drawer">
      <div class="drawer-head">
        <div>
          <span>功能权限</span>
          <strong>{{ selectedRole?.name }} · 配置权限</strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭" @click="closePermissionDrawer">×</button>
      </div>
      <p class="identity-drawer-note">这里用于变更角色的功能权限。点击模块名称展开权限明细，勾选后点击“保存权限”生效；班级、老师、学生等数据范围不属于一期角色权限。</p>
      <div v-if="state.identityLoading.permissions" class="identity-empty">正在加载权限资源...</div>
      <div v-else-if="state.identityErrors.permissions" class="identity-empty identity-error">{{ state.identityErrors.permissions }}</div>
      <div v-else class="identity-permission-groups">
        <section v-for="group in permissionGroups" :key="group.module" class="identity-permission-group">
          <header>
            <button class="identity-permission-group-toggle" type="button" @click="toggleModule(group.module)">
              <span>{{ identityModuleLabel(group.module) }}</span>
              <small>{{ selectedCountFor(group) }} / {{ enabledPermissionsFor(group).length }}</small>
              <b>{{ openedModules[group.module] ? '−' : '+' }}</b>
            </button>
            <button class="ghost identity-permission-select-all" type="button" @click="toggleGroup(group)">
              {{ allSelectedFor(group) ? '取消全选' : '全选' }}
            </button>
          </header>
          <div v-if="openedModules[group.module]" class="identity-permission-list">
            <label v-for="permission in group.permissions" :key="permission.permissionKey" class="identity-permission-check" :class="{ disabled: permission.status !== 'ENABLED' }">
              <input v-model="selectedPermissionKeys" type="checkbox" :value="permission.permissionKey" :disabled="permission.status !== 'ENABLED'" />
              <span>
                <strong>{{ permission.description || permission.permissionKey }}</strong>
                <small>{{ permission.permissionKey }}</small>
              </span>
            </label>
          </div>
        </section>
      </div>
      <div class="drawer-actions">
        <span>已选 {{ selectedPermissionKeys.length }} 项</span>
        <button class="primary" type="button" :disabled="Boolean(state.processingAction)" @click="savePermissions">保存权限</button>
      </div>
    </aside>
  </div>
</template>
