<script setup>
import AsyncState from '../components/common/AsyncState.vue'
import AppDrawer from '../components/common/AppDrawer.vue'
import FormField from '../components/common/FormField.vue'
import { confirmAction } from '../services/confirmDialog'
import { computed, onMounted, ref } from 'vue'
import { useFieldErrors } from '../composables/useFieldErrors'
import AppIcon from '../components/common/AppIcon.vue'
import AppStatusTag from '../components/common/AppStatusTag.vue'
import PageHead from '../components/layout/PageHead.vue'
import AdaptiveSelect from '../components/common/AdaptiveSelect.vue'
import FilterBar from '../components/common/FilterBar.vue'
import FilterField from '../components/common/FilterField.vue'
import { identityStatusClass, identityStatusLabel } from '../data/identity'
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

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '停用' }
]
const editorStatusOptions = statusOptions.slice(1)
const query = ref('')
const status = ref('all')
const editorOpen = ref(false)
const campusForm = ref(null)

const canEdit = computed(() => Boolean(props.state.canEditMasterData))
const isEditing = computed(() => Boolean(campusForm.value?.id))
const filteredCampuses = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase()
  return (props.state.campuses || []).filter((campus) => {
    const matchesKeyword = !keyword || [campus.name, campus.code, campus.address, campus.contactPhone]
      .some((value) => String(value || '').toLocaleLowerCase().includes(keyword))
    const matchesStatus = status.value === 'all' || campus.status === status.value
    return matchesKeyword && matchesStatus
  })
})

const blankCampus = () => ({
  id: null,
  code: '',
  name: '',
  address: '',
  contactPhone: '',
  status: 'ENABLED',
  version: 0
})

const loadCampuses = () => props.state.loadCampuses()

const openEditor = (campus = null) => {
  if (!canEdit.value) return
  campusForm.value = campus ? { ...campus } : blankCampus()
  editorOpen.value = true
}

const closeEditor = () => {
  editorOpen.value = false
  campusForm.value = null
  clearFieldError()
}

const editorFormRef = ref(null)
const { errors: fieldErrors, clear: clearFieldError, validate: validateForm } = useFieldErrors()

const saveCampus = async () => {
  const valid = await validateForm(campusForm.value, {
    name: (value) => !value?.trim() && '请填写校区名称',
    code: (value) => !isEditing.value && !value?.trim() && '请填写校区编码'
  }, editorFormRef)
  if (!valid) return
  const current = isEditing.value
    ? props.state.campuses.find((campus) => sameId(campus.id, campusForm.value.id))
    : null
  if (current?.status === 'ENABLED' && campusForm.value.status === 'DISABLED'
    && !(await confirmAction({ title: '停用校区', message: '确定停用该校区吗？停用后该校区将不能再被选用。', confirmText: '确认停用', tone: 'danger' }))) return

  const result = isEditing.value
    ? await props.state.updateCampus(campusForm.value.id, campusForm.value)
    : await props.state.createCampus(campusForm.value)
  if (result) closeEditor()
}

onMounted(loadCampuses)

</script>

<template>
  <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">
    <AppIcon name="back" :size="16" />返回{{ groupLabel }}
  </button>

  <PageHead title="校区管理">
    <button class="primary" type="button" :disabled="!canEdit" @click="openEditor()"><AppIcon name="add" :size="15" />新增校区</button>
  </PageHead>

  <section class="identity-page campus-management-page">
    <FilterBar @reset="query = ''; status = 'all'">
      <FilterField label="关键词" kind="search">
        <input v-model="query" placeholder="校区名称、编码或联系方式" />
      </FilterField>
      <FilterField label="状态">
        <AdaptiveSelect v-model="status" :options="statusOptions" />
      </FilterField>
    </FilterBar>

    <section class="panel identity-list-panel">
      <div class="section-head identity-list-head">
        <div>
          <span>机构校区</span>
          <strong>{{ filteredCampuses.length }} / {{ state.campuses.length }} 个</strong>
        </div>
      </div>

      <AsyncState
        :loading="state.campusLoading"
        skeleton-variant="table"
        :error="state.campusError"
        :empty="!filteredCampuses.length"
        empty-icon="campus"
        :empty-title="state.campuses.length ? '没有匹配的校区' : '还没有校区'"
        :empty-description="state.campuses.length ? '换个关键词或状态再试试。' : '点击右上角“新增校区”添加第一个校区。'"
        @retry="loadCampuses"
      >
        <div class="directory-table-wrap">
          <table class="directory-table campus-management-table">
            <thead>
              <tr>
                <th>校区</th>
                <th>地址</th>
                <th>联系电话</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="campus in filteredCampuses" :key="campus.id">
                <td>
                  <strong>{{ campus.name }}</strong>
                  <small>{{ campus.code }}</small>
                </td>
                <td>{{ campus.address || '—' }}</td>
                <td>{{ campus.contactPhone || '—' }}</td>
                <td><AppStatusTag class="identity-status" :class="identityStatusClass(campus.status)" :status="identityStatusLabel(campus.status)" /></td>
                <td>
                  <button class="ghost icon-only" type="button" :disabled="!canEdit" title="编辑" aria-label="编辑" @click="openEditor(campus)"><AppIcon name="edit" :size="15" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AsyncState>
    </section>
  </section>

  <AppDrawer :open="editorOpen" :title="isEditing ? '编辑校区' : '新增校区'" drawer-class="identity-drawer campus-editor-drawer" @close="closeEditor">
    <form ref="editorFormRef" class="identity-form" novalidate @submit.prevent="saveCampus">
      <FormField label="校区编码" required :error="fieldErrors.code">
        <input v-model="campusForm.code" :disabled="isEditing" placeholder="例如：university-town" @input="clearFieldError('code')" />
      </FormField>
      <FormField label="校区名称" required :error="fieldErrors.name">
        <input v-model="campusForm.name" placeholder="例如：大学城校区" @input="clearFieldError('name')" />
      </FormField>
      <FormField label="地址"><input v-model="campusForm.address" /></FormField>
      <FormField label="联系电话"><input v-model="campusForm.contactPhone" /></FormField>
      <FormField v-if="isEditing" label="状态"><AdaptiveSelect v-model="campusForm.status" :options="editorStatusOptions" /></FormField>
      <div class="drawer-actions">
        <button class="ghost icon-only" type="button" @click="closeEditor" aria-label="取消" title="取消"><AppIcon name="close" :size="15" /></button>
        <button class="primary" type="submit" :class="{ 'is-loading': state.processingAction }" :disabled="Boolean(state.processingAction)">
          <span v-if="state.processingAction" class="btn-spinner" aria-hidden="true"></span>
          <AppIcon v-else name="save" :size="15" />
          {{ state.processingAction ? '保存中…' : isEditing ? '保存修改' : '创建校区' }}
        </button>
      </div>
    </form>
  </AppDrawer>
</template>
