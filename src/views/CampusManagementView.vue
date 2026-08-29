<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import AdaptiveSelect from '../components/common/AdaptiveSelect.vue'
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
  { value: '', label: '全部状态' },
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '停用' }
]
const editorStatusOptions = statusOptions.slice(1)
const query = ref('')
const status = ref('')
const editorOpen = ref(false)
const campusForm = ref(null)

const canEdit = computed(() => Boolean(props.state.canEditMasterData))
const isEditing = computed(() => Boolean(campusForm.value?.id))
const filteredCampuses = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase()
  return (props.state.campuses || []).filter((campus) => {
    const matchesKeyword = !keyword || [campus.name, campus.code, campus.address, campus.contactPhone]
      .some((value) => String(value || '').toLocaleLowerCase().includes(keyword))
    const matchesStatus = !status.value || campus.status === status.value
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
}

const saveCampus = async () => {
  if (!campusForm.value?.name?.trim()) {
    props.state.notify('请填写校区名称')
    return
  }
  if (!isEditing.value && !campusForm.value.code?.trim()) {
    props.state.notify('请填写校区编码')
    return
  }
  const current = isEditing.value
    ? props.state.campuses.find((campus) => sameId(campus.id, campusForm.value.id))
    : null
  if (current?.status === 'ENABLED' && campusForm.value.status === 'DISABLED'
    && typeof window !== 'undefined'
    && !window.confirm('确定停用该校区吗？')) return

  const result = isEditing.value
    ? await props.state.updateCampus(campusForm.value.id, campusForm.value)
    : await props.state.createCampus(campusForm.value)
  if (result) closeEditor()
}

onMounted(loadCampuses)
</script>

<template>
  <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">
    ← 返回{{ groupLabel }}
  </button>

  <PageHead eyebrow="运营配置" title="校区管理">
    <button class="primary" type="button" :disabled="!canEdit" @click="openEditor()">新增校区</button>
  </PageHead>

  <section class="identity-page campus-management-page">
    <section class="panel identity-toolbar">
      <form class="identity-filter-form" @submit.prevent>
        <input v-model="query" placeholder="搜索校区名称、编码或联系方式" aria-label="搜索校区" />
        <AdaptiveSelect v-model="status" :options="statusOptions" />
        <button class="secondary" type="button" @click="query = ''; status = ''">重置</button>
      </form>
    </section>

    <section class="panel identity-list-panel">
      <div class="section-head identity-list-head">
        <div>
          <span>机构校区</span>
          <strong>{{ filteredCampuses.length }} / {{ state.campuses.length }} 个</strong>
        </div>
      </div>

      <div v-if="state.campusLoading" class="identity-empty">正在加载校区...</div>
      <div v-else-if="state.campusError" class="identity-empty identity-error">
        <strong>{{ state.campusError }}</strong>
        <button class="ghost" type="button" @click="loadCampuses">重试</button>
      </div>
      <div v-else-if="!filteredCampuses.length" class="identity-empty">
        <strong>{{ state.campuses.length ? '没有符合条件的校区' : '暂无校区' }}</strong>
        <span v-if="state.campuses.length">请调整关键词或状态筛选。</span>
      </div>

      <div v-else class="directory-table-wrap">
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
              <td><span class="identity-status" :class="identityStatusClass(campus.status)">{{ identityStatusLabel(campus.status) }}</span></td>
              <td>
                <button class="ghost" type="button" :disabled="!canEdit" @click="openEditor(campus)">编辑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </section>
  </section>

  <div v-if="editorOpen" class="drawer-backdrop" @click.self="closeEditor">
    <aside class="library-drawer identity-drawer campus-editor-drawer">
      <div class="drawer-head">
        <div>
          <span>机构校区</span>
          <strong>{{ isEditing ? '编辑校区' : '新增校区' }}</strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭" @click="closeEditor">×</button>
      </div>

      <form class="identity-form" @submit.prevent="saveCampus">
        <label>
          <span>校区编码</span>
          <input v-model="campusForm.code" required :disabled="isEditing" placeholder="例如：university-town" />
        </label>
        <label><span>校区名称</span><input v-model="campusForm.name" required placeholder="例如：大学城校区" /></label>
        <label><span>地址</span><input v-model="campusForm.address" placeholder="选填" /></label>
        <label><span>联系电话</span><input v-model="campusForm.contactPhone" placeholder="选填" /></label>
        <label v-if="isEditing"><span>状态</span><AdaptiveSelect v-model="campusForm.status" :options="editorStatusOptions" /></label>
        <div class="drawer-actions">
          <button class="ghost" type="button" @click="closeEditor">取消</button>
          <button class="primary" type="submit" :disabled="Boolean(state.processingAction)">
            {{ isEditing ? '保存修改' : '创建校区' }}
          </button>
        </div>
      </form>
    </aside>
  </div>
</template>
