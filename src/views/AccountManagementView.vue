<script setup>
import AsyncState from '../components/common/AsyncState.vue'
import AppDrawer from '../components/common/AppDrawer.vue'
import FormField from '../components/common/FormField.vue'
import { computed, onMounted, ref } from 'vue'
import { useFieldErrors } from '../composables/useFieldErrors'
import AppIcon from '../components/common/AppIcon.vue'
import AppStatusTag from '../components/common/AppStatusTag.vue'
import PageHead from '../components/layout/PageHead.vue'
import AdaptiveMultiSelect from '../components/common/AdaptiveMultiSelect.vue'
import AdaptiveSelect from '../components/common/AdaptiveSelect.vue'
import FilterBar from '../components/common/FilterBar.vue'
import FilterField from '../components/common/FilterField.vue'
import PaginationBar from '../components/common/PaginationBar.vue'
import { useAutoFilter } from '../composables/useAutoFilter'
import { identityStatusLabel, identityStatusOptions, identityStatusClass } from '../data/identity'
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

const queryInput = ref('')
const statusInput = ref('all')
const drawer = ref('')
const selectedUser = ref(null)
const userForm = ref(null)
const passwordForm = ref({ password: '' })
const selectedRoleIds = ref([])
const selectedCampusId = ref('')
const membershipLoading = ref(false)

const roleOptions = computed(() => (props.state.identityRoles || [])
  .filter((role) => role.status === 'ENABLED' || selectedUser.value?.roles?.some((item) => sameId(item.id, role.id)))
  .map((role) => ({ value: role.id, label: role.name, description: role.description || role.roleKey })))

const campusOptions = computed(() => (props.state.campuses || [])
  .filter((campus) => campus.status === 'ENABLED')
  .map((campus) => ({ value: campus.id, label: campus.name, description: campus.code })))

const isEditing = computed(() => Boolean(userForm.value?.id))
const canAssignRoles = computed(() => Boolean(props.state.canManageIdentityRoles))
const canManageMemberships = computed(() => Boolean(props.state.canManageIdentityMemberships))
const isCurrentUser = computed(() => sameId(selectedUser.value?.id, props.state.currentUser?.id))
const selectedUserCampusName = computed(() => {
  const campusId = userForm.value?.campusIds?.[0]
  return props.state.campuses?.find((campus) => sameId(campus.id, campusId))?.name || '未配置校区'
})

const blankUser = () => ({
  id: null,
  username: '',
  displayName: '',
  phone: '',
  password: '',
  status: 'ENABLED',
  version: 0,
  roleIds: [],
  campusIds: []
})

const loadUsers = async (page = 1, pageSize = props.state.identityUserPage?.pageSize || 20) => {
  await props.state.loadIdentityUsers({
    page,
    pageSize,
    query: queryInput.value.trim(),
    status: statusInput.value === 'all' ? '' : statusInput.value
  })
}

const loadPage = async () => {
  await Promise.all([
    props.state.loadCampuses(),
    props.state.loadIdentityRoles(),
    loadUsers(1)
  ])
}

const applyFilters = () => loadUsers(1)
const { flush: applyFiltersNow } = useAutoFilter(applyFilters, { immediate: [statusInput], debounced: [queryInput] })
const resetFilters = () => {
  queryInput.value = ''
  statusInput.value = 'all'
  return applyFiltersNow()
}

const roleNamesFor = (user) => user.roles?.map((role) => role.name).filter(Boolean).join('、') || '未绑定角色'
const campusNamesFor = (user) => user.campuses?.map((campus) => campus.name).filter(Boolean).join('、') || '未配置校区'
const permissionCountFor = (user) => new Set((user.roles || []).flatMap((role) => role.permissions || [])).size

const openUserForm = (user = null) => {
  if (user) {
    userForm.value = {
      id: user.id,
      username: user.username || '',
      displayName: user.displayName || '',
      phone: user.phone || '',
      password: '',
      status: user.status || 'ENABLED',
      version: user.version || 0,
      roleIds: user.roles?.map((role) => role.id) || [],
      campusIds: user.campuses?.map((campus) => campus.id) || []
    }
  } else {
    const teacherRole = props.state.identityRoles?.find((role) => role.roleKey === 'teacher' && role.status === 'ENABLED')
    userForm.value = {
      ...blankUser(),
      roleIds: teacherRole ? [teacherRole.id] : [],
      campusIds: []
    }
  }
  drawer.value = 'user'
}

const openRoleDrawer = (user) => {
  selectedUser.value = user
  selectedRoleIds.value = user.roles?.map((role) => role.id) || []
  drawer.value = 'roles'
}

const openMembershipDrawer = async (user) => {
  selectedUser.value = user
  selectedCampusId.value = user.campuses?.[0]?.id || ''
  drawer.value = 'memberships'
  membershipLoading.value = true
  const memberships = await props.state.loadIdentityMemberships(user.id)
  if (memberships) selectedCampusId.value = memberships[0]?.campusId || ''
  membershipLoading.value = false
}

const openPasswordDrawer = (user) => {
  selectedUser.value = user
  passwordForm.value = { password: '' }
  drawer.value = 'password'
}

const drawerFormRef = ref(null)
const { errors: fieldErrors, clear: clearFieldError, validate: validateForm } = useFieldErrors()
const drawerTitle = computed(() => {
  if (drawer.value === 'user') return isEditing.value ? '编辑账号' : '新增账号'
  if (drawer.value === 'roles') return '配置角色'
  if (drawer.value === 'memberships') return '数据范围'
  return '重置密码'
})

const closeDrawer = () => {
  clearFieldError()
  drawer.value = ''
  selectedUser.value = null
  userForm.value = null
  membershipLoading.value = false
}

const saveUser = async () => {
  const valid = await validateForm(userForm.value, {
    displayName: (value) => !value?.trim() && '请填写姓名',
    phone: (value) => !value?.trim() && '请填写手机号',
    password: (value) => !isEditing.value && String(value || '').length < 6 && '请设置至少 6 位的初始密码',
    campusIds: (value) => !isEditing.value && value?.length !== 1 && '请选择所属校区'
  }, drawerFormRef)
  if (!valid) return
  const result = isEditing.value
    ? await props.state.updateIdentityUser(userForm.value.id, userForm.value)
    : await props.state.createIdentityUser(userForm.value)
  if (result) closeDrawer()
}

const saveRoles = async () => {
  if (!selectedUser.value || !selectedRoleIds.value.length) {
    props.state.notify('账号至少需要绑定一个角色')
    return
  }
  const success = await props.state.replaceIdentityUserRoles(
    selectedUser.value.id,
    selectedUser.value.version,
    selectedRoleIds.value
  )
  if (success) closeDrawer()
}

const saveMemberships = async () => {
  if (!selectedUser.value || !selectedCampusId.value) {
    props.state.notify('请选择一个启用校区')
    return
  }
  const success = await props.state.replaceIdentityUserMemberships(
    selectedUser.value.id,
    selectedUser.value.version,
    [selectedCampusId.value]
  )
  if (success) closeDrawer()
}

const resetPassword = async () => {
  const valid = await validateForm(passwordForm.value, {
    password: (value) => String(value || '').length < 6 && '密码至少需要 6 位'
  }, drawerFormRef)
  if (!selectedUser.value || !valid) return
  const success = await props.state.resetIdentityPassword(selectedUser.value.id, passwordForm.value.password)
  if (success) closeDrawer()
}

onMounted(loadPage)

</script>

<template>
  <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">
    <AppIcon name="back" :size="16" />返回{{ groupLabel }}
  </button>

  <PageHead title="账号管理" />

  <section class="identity-page">
    <FilterBar @submit="applyFiltersNow" @reset="resetFilters">
      <FilterField label="关键词" kind="search">
        <input v-model="queryInput" placeholder="姓名、手机号或账号" />
      </FilterField>
      <FilterField label="状态">
        <AdaptiveSelect v-model="statusInput" :options="[{ value: 'all', label: '全部状态' }, ...identityStatusOptions]" />
      </FilterField>
    </FilterBar>

    <section class="panel identity-list-panel">
      <div class="section-head identity-list-head">
        <div>
          <span>账号列表</span>
          <strong>{{ state.identityUserPage.total || 0 }} 个账号</strong>
        </div>
        <div class="identity-list-head-actions">
          <button class="primary" type="button" @click="openUserForm()"><AppIcon name="add" :size="15" />新增账号</button>
        </div>
      </div>

      <AsyncState
        :loading="state.identityLoading.users"
        :error="state.identityErrors.users"
        :empty="!state.identityUsers.length"
        empty-icon="account"
        empty-title="没有找到账号"
        empty-description="可以换个关键词或状态筛选，或新增一个账号。"
        @retry="loadUsers(state.identityUserPage.page)"
      >
      <div class="identity-user-list">
        <article v-for="user in state.identityUsers" :key="user.id" class="identity-user-card">
          <header class="identity-user-card-head">
            <div class="identity-avatar">{{ user.displayName.slice(0, 1) }}</div>
            <div>
              <strong>{{ user.displayName }}</strong>
              <small>{{ user.username || user.phone }}</small>
            </div>
            <AppStatusTag class="identity-status" :class="identityStatusClass(user.status)" :status="identityStatusLabel(user.status)" />
          </header>

          <div class="identity-user-summary">
            <div>
              <span>角色</span>
              <strong>{{ roleNamesFor(user) }}</strong>
            </div>
            <div>
              <span>所属校区</span>
              <strong>{{ campusNamesFor(user) }}</strong>
            </div>
            <div>
              <span>有效功能权限</span>
              <strong>{{ permissionCountFor(user) }} 项</strong>
            </div>
          </div>

          <footer class="identity-card-actions">
            <button class="ghost" type="button" @click="openUserForm(user)"><AppIcon name="edit" :size="15" />编辑资料</button>
            <button v-if="canAssignRoles" class="ghost" type="button" @click="openRoleDrawer(user)"><AppIcon name="role" :size="15" />配置角色</button>
            <button v-if="canManageMemberships" class="ghost" type="button" @click="openMembershipDrawer(user)"><AppIcon name="settings" :size="15" />数据范围</button>
            <button class="ghost" type="button" @click="openPasswordDrawer(user)"><AppIcon name="password" :size="15" />重置密码</button>
          </footer>
        </article>
      </div>
      </AsyncState>

      <PaginationBar :page="state.identityUserPage.page" :page-size="state.identityUserPage.pageSize" :total="state.identityUserPage.total" :loading="state.identityLoading.users" @change="loadUsers" @size-change="(size) => loadUsers(1, size)" />
    </section>
  </section>

  <AppDrawer :open="Boolean(drawer)" :title="drawerTitle" drawer-class="identity-drawer" @close="closeDrawer">
    <form v-if="drawer === 'user'" ref="drawerFormRef" class="identity-form" novalidate @submit.prevent="saveUser">
      <FormField label="姓名" required :error="fieldErrors.displayName"><input v-model="userForm.displayName" @input="clearFieldError('displayName')" /></FormField>
      <FormField label="手机号" required :error="fieldErrors.phone"><input v-model="userForm.phone" inputmode="tel" @input="clearFieldError('phone')" /></FormField>
      <FormField label="登录账号"><input v-model="userForm.username" placeholder="默认使用手机号登录" :disabled="isEditing" /></FormField>
      <FormField v-if="!isEditing" label="初始密码" required :error="fieldErrors.password" hint="至少 6 位"><input v-model="userForm.password" type="password" autocomplete="new-password" @input="clearFieldError('password')" /></FormField>
      <FormField v-if="isEditing" label="账号状态"><AdaptiveSelect v-model="userForm.status" :options="identityStatusOptions" /></FormField>
      <FormField label="角色"><AdaptiveMultiSelect v-model="userForm.roleIds" :options="roleOptions" placeholder="请选择角色" :disabled="!canAssignRoles" /></FormField>
      <FormField v-if="!isEditing" label="所属校区" required :error="fieldErrors.campusIds">
        <AdaptiveSelect :model-value="userForm.campusIds[0] || ''" :options="campusOptions" placeholder="请选择校区" @update:model-value="userForm.campusIds = $event ? [$event] : []; clearFieldError('campusIds')" />
      </FormField>
      <div v-else class="identity-readonly-field">
        <span>所属校区</span>
        <strong>{{ selectedUserCampusName }}</strong>
      </div>
      <div class="drawer-actions">
        <button class="ghost icon-only" type="button" @click="closeDrawer" aria-label="取消" title="取消"><AppIcon name="close" :size="15" /></button>
        <button class="primary" type="submit" :class="{ 'is-loading': state.processingAction }" :disabled="Boolean(state.processingAction)"><span v-if="state.processingAction" class="btn-spinner" aria-hidden="true"></span><AppIcon v-else name="save" :size="15" />{{ state.processingAction ? '保存中…' : '保存' }}</button>
      </div>
    </form>

    <form v-else-if="drawer === 'roles'" class="identity-form" @submit.prevent="saveRoles">
      <div class="identity-drawer-target"><strong>{{ selectedUser?.displayName }}</strong><span>{{ selectedUser?.phone }}</span></div>
      <FormField label="绑定角色"><AdaptiveMultiSelect v-model="selectedRoleIds" :options="roleOptions" placeholder="请选择角色" /></FormField>
      <div class="drawer-actions">
        <button class="ghost icon-only" type="button" @click="closeDrawer" aria-label="取消" title="取消"><AppIcon name="close" :size="15" /></button>
        <button class="primary" type="submit" :class="{ 'is-loading': state.processingAction }" :disabled="Boolean(state.processingAction)"><span v-if="state.processingAction" class="btn-spinner" aria-hidden="true"></span><AppIcon v-else name="save" :size="15" />{{ state.processingAction ? '保存中…' : '保存角色' }}</button>
      </div>
    </form>

    <form v-else-if="drawer === 'memberships'" class="identity-form" @submit.prevent="saveMemberships">
      <div class="identity-drawer-target"><strong>{{ selectedUser?.displayName }}</strong><span>所属校区</span></div>
      <AsyncState :loading="membershipLoading" :rows="3" :error="state.identityErrors.memberships" @retry="openMembershipDrawer(selectedUser)">
        <div class="identity-check-grid">
          <AdaptiveSelect v-model="selectedCampusId" :options="campusOptions" placeholder="请选择校区" :disabled="isCurrentUser" />
        </div>
      </AsyncState>
      <div class="drawer-actions">
        <button class="ghost icon-only" type="button" @click="closeDrawer" aria-label="取消" title="取消"><AppIcon name="close" :size="15" /></button>
        <button class="primary" type="submit" :disabled="Boolean(state.processingAction) || membershipLoading || isCurrentUser"><AppIcon name="save" :size="15" />保存范围</button>
      </div>
    </form>

    <form v-else ref="drawerFormRef" class="identity-form" novalidate @submit.prevent="resetPassword">
      <div class="identity-drawer-target"><strong>{{ selectedUser?.displayName }}</strong><span>{{ selectedUser?.phone }}</span></div>
      <FormField label="新密码" required :error="fieldErrors.password" hint="至少 6 位"><input v-model="passwordForm.password" type="password" autocomplete="new-password" @input="clearFieldError('password')" /></FormField>
      <div class="drawer-actions">
        <button class="ghost icon-only" type="button" @click="closeDrawer" aria-label="取消" title="取消"><AppIcon name="close" :size="15" /></button>
        <button class="primary" type="submit" :class="{ 'is-loading': state.processingAction }" :disabled="Boolean(state.processingAction)"><span v-if="state.processingAction" class="btn-spinner" aria-hidden="true"></span><AppIcon v-else name="check" :size="15" />{{ state.processingAction ? '处理中…' : '确认重置' }}</button>
      </div>
    </form>
  </AppDrawer>
</template>
