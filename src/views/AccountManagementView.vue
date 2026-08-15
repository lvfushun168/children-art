<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import AdaptiveMultiSelect from '../components/common/AdaptiveMultiSelect.vue'
import AdaptiveSelect from '../components/common/AdaptiveSelect.vue'
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

const pageSize = 20
const queryInput = ref('')
const statusInput = ref('')
const drawer = ref('')
const selectedUser = ref(null)
const userForm = ref(null)
const passwordForm = ref({ password: '' })
const selectedRoleIds = ref([])
const selectedCampusIds = ref([])
const membershipLoading = ref(false)

const roleOptions = computed(() => (props.state.identityRoles || [])
  .filter((role) => role.status === 'ENABLED' || selectedUser.value?.roles?.some((item) => sameId(item.id, role.id)))
  .map((role) => ({ value: role.id, label: role.name, description: role.description || role.roleKey })))

const campusOptions = computed(() => (props.state.campuses || [])
  .filter((campus) => campus.status !== 'DISABLED')
  .map((campus) => ({ value: campus.id, label: campus.name, description: campus.code })))

const currentCampusName = computed(() => props.state.school?.campus || props.state.campuses?.[0]?.name || '当前校区')
const totalPages = computed(() => Math.max(1, Math.ceil(Number(props.state.identityUserPage?.total || 0) / pageSize)))
const isEditing = computed(() => Boolean(userForm.value?.id))
const canAssignRoles = computed(() => Boolean(props.state.canManageIdentityRoles))
const canManageMemberships = computed(() => Boolean(props.state.canManageIdentityMemberships))

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

const loadUsers = async (page = 1) => {
  await props.state.loadIdentityUsers({
    page,
    pageSize,
    query: queryInput.value.trim(),
    status: statusInput.value
  })
}

const loadPage = async () => {
  await Promise.all([
    props.state.loadIdentityRoles(),
    loadUsers(1)
  ])
}

const applyFilters = () => loadUsers(1)

const roleNamesFor = (user) => user.roles?.map((role) => role.name).filter(Boolean).join('、') || '未绑定角色'
const campusNamesFor = (user) => user.campuses?.map((campus) => campus.name).filter(Boolean).join('、') || '未配置校区'
const permissionCountFor = (user) => new Set((user.roles || []).flatMap((role) => role.permissions || [])).size
const roleDescriptionFor = (user) => {
  const roles = user.roles || []
  const descriptions = roles.map((role) => role.description).filter(Boolean)
  return descriptions[0] || (permissionCountFor(user) ? '由角色计算有效功能权限' : '暂无功能权限')
}

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
      campusIds: props.state.campuses?.[0]?.id ? [props.state.campuses[0].id] : []
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
  selectedCampusIds.value = user.campuses?.map((campus) => campus.id) || []
  drawer.value = 'memberships'
  membershipLoading.value = true
  const memberships = await props.state.loadIdentityMemberships(user.id)
  if (memberships) selectedCampusIds.value = memberships.map((membership) => membership.campusId)
  membershipLoading.value = false
}

const openPasswordDrawer = (user) => {
  selectedUser.value = user
  passwordForm.value = { password: '' }
  drawer.value = 'password'
}

const closeDrawer = () => {
  drawer.value = ''
  selectedUser.value = null
  userForm.value = null
  membershipLoading.value = false
}

const saveUser = async () => {
  if (!userForm.value?.displayName?.trim() || !userForm.value?.phone?.trim()) {
    props.state.notify('请填写姓名和手机号')
    return
  }
  if (!isEditing.value && !userForm.value.password) {
    props.state.notify('请设置初始密码')
    return
  }
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
  if (!selectedUser.value || !selectedCampusIds.value.length) {
    props.state.notify('账号至少需要绑定一个启用校区')
    return
  }
  const success = await props.state.replaceIdentityUserMemberships(
    selectedUser.value.id,
    selectedUser.value.version,
    selectedCampusIds.value
  )
  if (success) closeDrawer()
}

const resetPassword = async () => {
  if (!selectedUser.value || String(passwordForm.value.password || '').length < 6) {
    props.state.notify('密码至少需要 6 位')
    return
  }
  const success = await props.state.resetIdentityPassword(selectedUser.value.id, passwordForm.value.password)
  if (success) closeDrawer()
}

onMounted(loadPage)
</script>

<template>
  <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">
    ← 返回{{ groupLabel }}
  </button>

  <PageHead eyebrow="权限中心" title="账号管理">
    <button class="primary" type="button" @click="openUserForm()">新增账号</button>
  </PageHead>

  <section class="identity-page">
    <section class="panel identity-toolbar">
      <form class="identity-filter-form" @submit.prevent="applyFilters">
        <input v-model="queryInput" placeholder="搜索姓名、手机号或账号" aria-label="搜索账号" />
        <AdaptiveSelect v-model="statusInput" placeholder="全部状态" :options="[{ value: '', label: '全部状态' }, ...identityStatusOptions]" />
        <button class="secondary" type="submit">查询</button>
      </form>
      <small>当前按{{ currentCampusName }}查询账号，数据范围以校区归属为准。</small>
    </section>

    <section class="panel identity-list-panel">
      <div class="section-head">
        <div>
          <span>账号列表</span>
          <strong>{{ state.identityUserPage.total || 0 }} 个账号</strong>
        </div>
        <small>账号功能权限由角色计算</small>
      </div>

      <div v-if="state.identityLoading.users" class="identity-empty">正在加载账号...</div>
      <div v-else-if="state.identityErrors.users" class="identity-empty identity-error">
        <strong>{{ state.identityErrors.users }}</strong>
        <button class="ghost" type="button" @click="loadUsers(state.identityUserPage.page)">重试</button>
      </div>
      <div v-else-if="!state.identityUsers.length" class="identity-empty">
        <strong>暂无账号</strong>
        <span>可以先创建一个老师或管理员账号。</span>
      </div>

      <div v-else class="identity-user-list">
        <article v-for="user in state.identityUsers" :key="user.id" class="identity-user-card">
          <header class="identity-user-card-head">
            <div class="identity-avatar">{{ user.displayName.slice(0, 1) }}</div>
            <div>
              <strong>{{ user.displayName }}</strong>
              <small>{{ user.username || user.phone }}</small>
            </div>
            <span class="identity-status" :class="identityStatusClass(user.status)">{{ identityStatusLabel(user.status) }}</span>
          </header>

          <div class="identity-user-summary">
            <div>
              <span>角色</span>
              <strong>{{ roleNamesFor(user) }}</strong>
            </div>
            <div>
              <span>可访问校区</span>
              <strong>{{ campusNamesFor(user) }}</strong>
            </div>
            <div>
              <span>有效功能权限</span>
              <strong>{{ permissionCountFor(user) }} 项</strong>
              <small>{{ roleDescriptionFor(user) }}</small>
            </div>
          </div>

          <footer class="identity-card-actions">
            <button class="ghost" type="button" @click="openUserForm(user)">编辑资料</button>
            <button v-if="canAssignRoles" class="ghost" type="button" @click="openRoleDrawer(user)">配置角色</button>
            <button v-if="canManageMemberships" class="ghost" type="button" @click="openMembershipDrawer(user)">数据范围</button>
            <button class="ghost" type="button" @click="openPasswordDrawer(user)">重置密码</button>
          </footer>
        </article>
      </div>

      <div v-if="state.identityUserPage.total > pageSize" class="identity-pagination">
        <button class="ghost" type="button" :disabled="state.identityUserPage.page <= 1" @click="loadUsers(state.identityUserPage.page - 1)">上一页</button>
        <span>第 {{ state.identityUserPage.page }} / {{ totalPages }} 页</span>
        <button class="ghost" type="button" :disabled="state.identityUserPage.page >= totalPages" @click="loadUsers(state.identityUserPage.page + 1)">下一页</button>
      </div>
    </section>
  </section>

  <div v-if="drawer" class="drawer-backdrop" @click.self="closeDrawer">
    <aside class="library-drawer identity-drawer">
      <div class="drawer-head">
        <div>
          <span>账号管理</span>
          <strong>
            {{ drawer === 'user' ? (isEditing ? '编辑账号' : '新增账号') : drawer === 'roles' ? '配置角色' : drawer === 'memberships' ? '数据范围' : '重置密码' }}
          </strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭" @click="closeDrawer">×</button>
      </div>

      <form v-if="drawer === 'user'" class="identity-form" @submit.prevent="saveUser">
        <label><span>姓名</span><input v-model="userForm.displayName" required /></label>
        <label><span>手机号</span><input v-model="userForm.phone" required /></label>
        <label><span>登录账号（可选）</span><input v-model="userForm.username" placeholder="默认使用手机号登录" :disabled="isEditing" /></label>
        <label v-if="!isEditing"><span>初始密码</span><input v-model="userForm.password" type="password" minlength="6" required /></label>
        <label v-if="isEditing"><span>账号状态</span><AdaptiveSelect v-model="userForm.status" :options="identityStatusOptions" /></label>
        <label><span>角色</span><AdaptiveMultiSelect v-model="userForm.roleIds" :options="roleOptions" placeholder="请选择角色" :disabled="!canAssignRoles" /></label>
        <label><span>可访问校区</span><AdaptiveMultiSelect v-model="userForm.campusIds" :options="campusOptions" placeholder="请选择校区" /></label>
        <p class="identity-drawer-note">一期数据权限以机构/校区为边界，班级关系请在班级资料中维护。</p>
        <div class="drawer-actions">
          <button class="ghost" type="button" @click="closeDrawer">取消</button>
          <button class="primary" type="submit" :disabled="Boolean(state.processingAction)">保存</button>
        </div>
      </form>

      <form v-else-if="drawer === 'roles'" class="identity-form" @submit.prevent="saveRoles">
        <div class="identity-drawer-target"><strong>{{ selectedUser?.displayName }}</strong><span>{{ selectedUser?.phone }}</span></div>
        <p class="identity-drawer-note">只通过角色授予功能权限，不提供账号级直接授权。</p>
        <label><span>绑定角色</span><AdaptiveMultiSelect v-model="selectedRoleIds" :options="roleOptions" placeholder="请选择角色" /></label>
        <div class="drawer-actions">
          <button class="ghost" type="button" @click="closeDrawer">取消</button>
          <button class="primary" type="submit" :disabled="Boolean(state.processingAction)">保存角色</button>
        </div>
      </form>

      <form v-else-if="drawer === 'memberships'" class="identity-form" @submit.prevent="saveMemberships">
        <div class="identity-drawer-target"><strong>{{ selectedUser?.displayName }}</strong><span>可访问校区</span></div>
        <p class="identity-drawer-note">一期只配置校区数据范围；班级归属由基础信息维护，不在这里配置。</p>
        <div v-if="membershipLoading" class="identity-empty">正在读取数据范围...</div>
        <div v-else class="identity-check-grid">
          <label v-for="campus in campusOptions" :key="campus.value" class="identity-check">
            <input v-model="selectedCampusIds" type="checkbox" :value="campus.value" />
            <span>{{ campus.label }}</span>
          </label>
        </div>
        <div class="drawer-actions">
          <button class="ghost" type="button" @click="closeDrawer">取消</button>
          <button class="primary" type="submit" :disabled="Boolean(state.processingAction) || membershipLoading">保存范围</button>
        </div>
      </form>

      <form v-else class="identity-form" @submit.prevent="resetPassword">
        <div class="identity-drawer-target"><strong>{{ selectedUser?.displayName }}</strong><span>{{ selectedUser?.phone }}</span></div>
        <label><span>新密码</span><input v-model="passwordForm.password" type="password" minlength="6" required /></label>
        <p class="identity-drawer-note">重置后账号需要使用新密码登录。</p>
        <div class="drawer-actions">
          <button class="ghost" type="button" @click="closeDrawer">取消</button>
          <button class="primary" type="submit" :disabled="Boolean(state.processingAction)">确认重置</button>
        </div>
      </form>
    </aside>
  </div>
</template>
