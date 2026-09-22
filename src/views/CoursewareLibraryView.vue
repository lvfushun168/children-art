<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import AppIcon from '../components/common/AppIcon.vue'
import AdaptiveSelect from '../components/common/AdaptiveSelect.vue'
import CoursewareFolderTreeNode from '../components/courseware/CoursewareFolderTreeNode.vue'
import CoursewarePreviewDialog from '../components/courseware/CoursewarePreviewDialog.vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: { type: Object, required: true },
  groupLabel: { type: String, default: '素材档案' }
})
const emit = defineEmits(['back-to-group'])
const uploadInput = ref(null)
const expandedFolders = ref(new Set())
const previewOpen = ref(false)
const previewTarget = ref(null)
const previewError = ref('')
const actionDialog = ref(null)
const actionDialogInput = ref(null)
const actionDialogBusy = ref(false)
const actionDialogError = ref('')

const currentFolderId = computed(() => props.state.coursewareCurrentFolderId)
const currentFolder = computed(() => {
  const id = currentFolderId.value
  if (id === null || id === undefined) return null
  return Object.values(props.state.coursewareFolderChildren || {})
    .flat()
    .find((folder) => String(folder.id) === String(id)) || null
})
const rootFolders = computed(() => props.state.coursewareFolderChildren?.root || [])
const currentFolders = computed(() => props.state.coursewareFolders || [])
const flatFolders = computed(() => Object.values(props.state.coursewareFolderChildren || {}).flat())
const fileIconName = (item) => ({ IMAGE: 'image', VIDEO: 'video' }[String(item?.previewMode || '').toUpperCase()] || 'file')
const breadcrumbs = computed(() => {
  const result = []
  let folder = currentFolder.value
  const visited = new Set()
  while (folder && !visited.has(String(folder.id))) {
    visited.add(String(folder.id))
    result.unshift(folder)
    folder = flatFolders.value.find((item) => String(item.id) === String(folder.parentId)) || null
  }
  return result
})

const childrenFor = (folder) => props.state.coursewareFolderChildren?.[String(folder.id)] || []
const isExpanded = (folder) => expandedFolders.value.has(String(folder.id))
const isLoadingFolder = (folder) => Boolean(props.state.coursewareLoading?.folders && !childrenFor(folder).length)

const isFolderDescendant = (folder, ancestorId) => {
  const visited = new Set()
  let parentId = folder?.parentId
  while (parentId !== null && parentId !== undefined && !visited.has(String(parentId))) {
    if (String(parentId) === String(ancestorId)) return true
    visited.add(String(parentId))
    parentId = flatFolders.value.find((item) => String(item.id) === String(parentId))?.parentId
  }
  return false
}

const moveFolderOptions = computed(() => {
  const dialog = actionDialog.value
  if (!dialog || !dialog.kind.startsWith('move-')) return []
  const movingFolderId = dialog.kind === 'move-folder' ? dialog.target?.id : null
  return [
    { label: '根目录', value: '' },
    ...flatFolders.value
      .filter((folder) => !movingFolderId
        || (String(folder.id) !== String(movingFolderId) && !isFolderDescendant(folder, movingFolderId)))
      .map((folder) => ({ label: folder.name, value: String(folder.id) }))
  ]
})

const isNameDialog = computed(() => ['create-folder', 'rename-folder', 'rename-item'].includes(actionDialog.value?.kind))
const isMoveDialog = computed(() => ['move-folder', 'move-item'].includes(actionDialog.value?.kind))
const actionDialogTitle = computed(() => ({
  'create-folder': '新建目录',
  'rename-folder': '重命名目录',
  'rename-item': '重命名课件',
  'move-folder': '移动目录',
  'move-item': '移动课件',
  'delete-folder': '删除目录',
  'delete-item': '删除课件'
}[actionDialog.value?.kind] || '课件库'))
const actionDialogSubmitLabel = computed(() => {
  if (actionDialogBusy.value) return isMoveDialog.value ? '保存中…' : '处理中…'
  if (actionDialog.value?.kind?.startsWith('delete-')) return '确认删除'
  return '保存'
})

const openActionDialog = (kind, target = null, value = '') => {
  actionDialogError.value = ''
  actionDialogBusy.value = false
  actionDialog.value = { kind, target, value }
  if (isNameDialog.value) void nextTick(() => actionDialogInput.value?.focus())
}

const closeActionDialog = () => {
  if (actionDialogBusy.value) return
  actionDialog.value = null
  actionDialogError.value = ''
}

const ensureFolderChildren = async (folder) => {
  const key = String(folder.id)
  if (isExpanded(folder)) {
    expandedFolders.value.delete(key)
    expandedFolders.value = new Set(expandedFolders.value)
    return
  }
  await props.state.loadCoursewareFolders?.(folder.id)
  expandedFolders.value.add(key)
  expandedFolders.value = new Set(expandedFolders.value)
}

const selectFolder = async (folder) => {
  await props.state.openCoursewareFolder?.(folder?.id ?? null)
}

const goRoot = () => props.state.openCoursewareFolder?.(null)
const openUpload = () => uploadInput.value?.click()
const handleUpload = async (event) => {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  for (const file of files) await props.state.uploadCourseware?.(file, currentFolderId.value, file.name)
}

const openFolderNameDialog = (folder = null) => {
  openActionDialog(folder ? 'rename-folder' : 'create-folder', folder, folder?.name || '')
}
const deleteFolder = (folder) => {
  openActionDialog('delete-folder', folder)
}
const moveFolder = (folder) => {
  openActionDialog('move-folder', folder, folder.parentId ? String(folder.parentId) : '')
}
const renameItem = (item) => {
  openActionDialog('rename-item', item, item.title || '')
}
const deleteItem = (item) => {
  openActionDialog('delete-item', item)
}
const moveItem = (item) => {
  openActionDialog('move-item', item, item.folderId ? String(item.folderId) : '')
}
const submitActionDialog = async () => {
  const dialog = actionDialog.value
  if (!dialog || actionDialogBusy.value) return

  if (isNameDialog.value) {
    const value = String(dialog.value || '').trim()
    if (!value) {
      actionDialogError.value = '名称不能为空'
      void nextTick(() => actionDialogInput.value?.focus())
      return
    }
    actionDialogBusy.value = true
    const result = dialog.kind === 'create-folder'
      ? await props.state.createCoursewareFolder?.(value, currentFolderId.value)
      : dialog.kind === 'rename-folder'
        ? await props.state.updateCoursewareFolder?.(dialog.target, { name: value })
        : await props.state.updateCourseware?.(dialog.target, { title: value })
    actionDialogBusy.value = false
    if (result !== null && result !== false) closeActionDialog()
    return
  }

  if (isMoveDialog.value) {
    actionDialogBusy.value = true
    const targetId = dialog.value ? String(dialog.value) : null
    const result = dialog.kind === 'move-folder'
      ? await props.state.updateCoursewareFolder?.(dialog.target, { parentId: targetId, moveToRoot: targetId === null })
      : await props.state.updateCourseware?.(dialog.target, { folderId: targetId, moveToRoot: targetId === null })
    actionDialogBusy.value = false
    if (result !== null && result !== false) closeActionDialog()
    return
  }

  actionDialogBusy.value = true
  const result = dialog.kind === 'delete-folder'
    ? await props.state.removeCoursewareFolder?.(dialog.target)
    : await props.state.removeCourseware?.(dialog.target)
  actionDialogBusy.value = false
  if (result === true) closeActionDialog()
}
const previewItem = async (item) => {
  previewTarget.value = item
  previewError.value = ''
  previewOpen.value = true
  const value = await props.state.previewCourseware?.(item)
  if (!value) previewError.value = '课件预览准备失败，请检查服务后重试'
}
const closePreview = () => {
  previewOpen.value = false
  previewTarget.value = null
  previewError.value = ''
  props.state.coursewarePreview = null
}
const retryPreview = async () => {
  if (!previewTarget.value) return
  previewError.value = ''
  const value = await props.state.previewCourseware?.(previewTarget.value)
  if (!value) previewError.value = '课件预览准备失败，请检查服务后重试'
}

onMounted(async () => {
  try {
    await props.state.openCoursewareFolder?.(null)
  } catch {
    // 页面错误已由状态层展示。
  }
})
</script>

<template>
  <section class="courseware-page">
    <button class="module-back-link" type="button" @click="emit('back-to-group')"><AppIcon name="back" :size="16" />返回{{ groupLabel }}</button>
    <PageHead eyebrow="素材档案" title="课件库" />

    <div v-if="state.coursewareError" class="courseware-error">
      <span>{{ state.coursewareError }}</span>
      <button class="ghost" type="button" @click="state.refreshCoursewareLocation?.(currentFolderId)"><AppIcon name="retry" :size="15" />重试</button>
    </div>

    <div class="courseware-layout">
      <aside class="courseware-sidebar">
        <div class="sidebar-title">
          <strong>目录</strong>
          <button v-if="state.canManageCourseware" class="ghost courseware-compact-button" type="button" @click="openFolderNameDialog()"><AppIcon name="add" :size="14" />新建目录</button>
        </div>
        <button class="root-folder" :class="{ selected: currentFolderId === null }" type="button" @click="goRoot"><AppIcon name="courseware" :size="16" /><span>全部课件</span></button>
        <ul class="courseware-tree">
          <CoursewareFolderTreeNode
            v-for="folder in rootFolders"
            :key="folder.id"
            :folder="folder"
            :active-id="currentFolderId"
            :children="childrenFor(folder)"
            :expanded="isExpanded(folder)"
            :loading="isLoadingFolder(folder)"
            :can-manage="state.canManageCourseware"
            :resolve-children="childrenFor"
            :resolve-loading="isLoadingFolder"
            :resolve-expanded="isExpanded"
            @select="selectFolder"
            @toggle="ensureFolderChildren"
            @rename="openFolderNameDialog"
            @delete="deleteFolder"
            @move="moveFolder"
          />
        </ul>
      </aside>

      <main class="courseware-content">
        <div class="courseware-toolbar">
          <div class="breadcrumbs">
            <button type="button" @click="goRoot">全部课件</button>
            <template v-for="folder in breadcrumbs" :key="folder.id">
              <span>/</span><button type="button" @click="selectFolder(folder)">{{ folder.name }}</button>
            </template>
          </div>
          <div class="courseware-content-actions">
            <button v-if="state.canManageCourseware" class="primary" type="button" @click="openUpload"><AppIcon name="upload" :size="15" />上传课件</button>
            <input ref="uploadInput" class="visually-hidden" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pps,.ppsx" @change="handleUpload" />
          </div>
        </div>

        <div v-if="currentFolders.length" class="folder-grid">
          <article v-for="folder in currentFolders" :key="folder.id" class="folder-card" @dblclick="selectFolder(folder)">
            <button class="folder-open" type="button" @click="selectFolder(folder)"><span class="folder-card-icon"><AppIcon name="courseware" :size="19" /></span><strong>{{ folder.name }}</strong></button>
            <small>{{ Number(folder.childCount || 0) }} 个子目录 · {{ Number(folder.itemCount || 0) }} 个课件</small>
            <div v-if="state.canManageCourseware" class="card-actions">
              <button type="button" @click="openFolderNameDialog(folder)"><AppIcon name="edit" :size="13" />重命名</button>
              <button type="button" @click="moveFolder(folder)"><AppIcon name="move" :size="13" />移动</button>
              <button type="button" @click="deleteFolder(folder)"><AppIcon name="delete" :size="13" />删除</button>
            </div>
          </article>
        </div>

        <div v-if="state.coursewareLoading?.items" class="loading-note">正在加载课件…</div>
        <div v-else-if="state.coursewareItems?.length" class="courseware-list">
          <article v-for="item in state.coursewareItems" :key="item.id" class="courseware-card">
            <div class="file-icon" :data-mode="item.previewMode">
              <AppIcon :name="fileIconName(item)" :size="22" />
              <small>{{ item.extension?.toUpperCase() || 'FILE' }}</small>
            </div>
            <div class="file-main">
              <strong :title="item.title">{{ item.title }}</strong>
              <small>{{ item.originalFilename }} · {{ item.previewMode || '可预览' }} · {{ Math.ceil(Number(item.sizeBytes || 0) / 1024 / 1024 * 10) / 10 }} MB</small>
            </div>
            <button class="preview-button" type="button" @click="previewItem(item)"><AppIcon name="view" :size="16" />预览</button>
            <div v-if="state.canManageCourseware" class="card-actions">
              <button type="button" @click="renameItem(item)"><AppIcon name="edit" :size="13" />重命名</button>
              <button type="button" @click="moveItem(item)"><AppIcon name="move" :size="13" />移动</button>
              <button type="button" @click="deleteItem(item)"><AppIcon name="delete" :size="13" />删除</button>
            </div>
          </article>
        </div>
        <div v-else-if="!state.coursewareLoading?.items" class="courseware-empty">
          <strong>这个目录还没有课件</strong>
        </div>
      </main>
    </div>

    <div v-if="actionDialog" class="courseware-dialog-backdrop" @click.self="closeActionDialog">
      <section class="courseware-action-dialog" role="dialog" aria-modal="true" :aria-label="actionDialogTitle" @keydown.esc="closeActionDialog">
        <header class="courseware-dialog-head">
          <div>
            <span>课件库</span>
            <strong>{{ actionDialogTitle }}</strong>
          </div>
          <button class="courseware-dialog-close" type="button" aria-label="关闭" :disabled="actionDialogBusy" @click="closeActionDialog"><AppIcon name="close" :size="17" /></button>
        </header>

        <form v-if="isNameDialog" class="courseware-dialog-form" @submit.prevent="submitActionDialog">
          <label>
            <span>{{ actionDialog.kind === 'rename-item' ? '课件名称' : '目录名称' }}</span>
            <input ref="actionDialogInput" v-model="actionDialog.value" maxlength="255" autocomplete="off" :placeholder="actionDialog.kind === 'rename-item' ? '请输入课件名称' : '请输入目录名称'" />
          </label>
          <p v-if="actionDialogError" class="courseware-dialog-error" role="alert">{{ actionDialogError }}</p>
          <footer class="courseware-dialog-actions">
            <button class="ghost" type="button" :disabled="actionDialogBusy" @click="closeActionDialog"><AppIcon name="close" :size="15" />取消</button>
            <button class="primary" type="submit" :disabled="actionDialogBusy"><AppIcon name="save" :size="15" />{{ actionDialogSubmitLabel }}</button>
          </footer>
        </form>

        <form v-else-if="isMoveDialog" class="courseware-dialog-form" @submit.prevent="submitActionDialog">
          <label>
            <span>目标目录</span>
            <AdaptiveSelect v-model="actionDialog.value" :options="moveFolderOptions" />
          </label>
          <p v-if="actionDialogError" class="courseware-dialog-error" role="alert">{{ actionDialogError }}</p>
          <footer class="courseware-dialog-actions">
            <button class="ghost" type="button" :disabled="actionDialogBusy" @click="closeActionDialog"><AppIcon name="close" :size="15" />取消</button>
            <button class="primary" type="submit" :disabled="actionDialogBusy"><AppIcon name="save" :size="15" />{{ actionDialogSubmitLabel }}</button>
          </footer>
        </form>

        <div v-else class="courseware-dialog-confirm">
          <p>确定删除“{{ actionDialog.target?.name || actionDialog.target?.title }}”吗？</p>
          <footer class="courseware-dialog-actions">
            <button class="ghost" type="button" :disabled="actionDialogBusy" @click="closeActionDialog"><AppIcon name="close" :size="15" />取消</button>
            <button class="courseware-danger-button" type="button" :disabled="actionDialogBusy" @click="submitActionDialog"><AppIcon name="delete" :size="15" />{{ actionDialogSubmitLabel }}</button>
          </footer>
        </div>
      </section>
    </div>

    <CoursewarePreviewDialog
      v-if="previewOpen"
      :preview="state.coursewarePreview"
      :loading="state.processingAction === '正在准备课件预览...'"
      :error="previewError"
      @close="closePreview"
      @retry="retryPreview"
    />
  </section>
</template>

<style scoped>
.courseware-page { display: grid; gap: 16px; min-width: 0; }
.courseware-error { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid color-mix(in srgb, var(--color-danger) 24%, transparent); border-radius: 10px; background: var(--color-status-danger-bg); color: var(--color-status-danger-text); padding: 10px 12px; }
.courseware-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 18px; min-height: 560px; }
.courseware-sidebar, .courseware-content { border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); box-shadow: var(--shadow-panel); }
.courseware-sidebar { padding: 14px 10px; }
.sidebar-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 8px 12px; }
.courseware-compact-button { min-height: 30px; padding: 0 8px; font-size: 12px; }
.loading-note { color: var(--color-muted); }
.root-folder { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; border-radius: 9px; background: transparent; color: inherit; cursor: pointer; padding: 9px 10px; text-align: left; }
.root-folder.selected { background: var(--color-primary-soft); color: var(--color-primary); }
.courseware-tree { margin: 4px 0 0; padding: 0; }
.courseware-content { min-width: 0; padding: 18px; }
.courseware-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.breadcrumbs { display: flex; align-items: center; gap: 7px; min-width: 0; overflow: auto; white-space: nowrap; }
.breadcrumbs button { border: 0; background: transparent; color: var(--color-primary); cursor: pointer; padding: 2px; }
.courseware-content-actions { display: flex; flex: 0 0 auto; align-items: center; }
.folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; margin-bottom: 18px; }
.folder-card { border: 1px solid var(--color-border-soft); border-radius: 12px; background: var(--color-surface-subtle); padding: 12px; }
.folder-open { display: flex; align-items: center; gap: 8px; width: 100%; overflow: hidden; border: 0; background: transparent; color: inherit; cursor: pointer; padding: 0; text-align: left; }
.folder-card-icon { display: inline-flex; color: var(--color-status-warning-text); }
.folder-open strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-card > small, .file-main small { display: block; margin-top: 7px; color: var(--color-muted); font-size: 12px; }
.card-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.card-actions button { display: inline-flex; align-items: center; gap: 3px; border: 0; background: transparent; color: var(--color-muted); cursor: pointer; padding: 0; font-size: 12px; }
.card-actions button:hover { color: var(--color-primary); }
.courseware-list { display: grid; gap: 9px; }
.courseware-card { display: flex; align-items: center; gap: 12px; min-width: 0; border: 1px solid var(--color-border-soft); border-radius: 12px; background: var(--color-surface-subtle); padding: 12px; }
.file-icon { display: grid; flex: 0 0 48px; place-items: center; gap: 2px; height: 48px; border-radius: 10px; background: var(--color-primary-soft); color: var(--color-primary); font-size: 10px; font-weight: 700; }
.file-icon small { font-size: 9px; line-height: 1; }
.file-icon[data-mode="VIDEO"] { background: var(--color-status-warning-bg); color: var(--color-status-warning-text); }
.file-icon[data-mode="OFFICE"] { background: var(--color-status-success-bg); color: var(--color-status-success-text); }
.file-main { min-width: 0; flex: 1; }
.file-main strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-button { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; border: 0; border-radius: 7px; background: var(--color-primary-soft); color: var(--color-primary); cursor: pointer; padding: 0 11px; min-height: 38px; }
.courseware-empty { display: grid; place-items: center; gap: 10px; min-height: 300px; color: var(--color-muted); text-align: center; }
.courseware-empty strong { color: inherit; font-size: 16px; }
.courseware-dialog-backdrop { position: fixed; inset: 0; z-index: 45; display: grid; place-items: center; padding: 20px; background: color-mix(in srgb, var(--color-heading) 42%, transparent); backdrop-filter: blur(2px); }
.courseware-action-dialog { display: grid; gap: 18px; width: min(430px, 100%); padding: 20px; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); box-shadow: var(--shadow-modal); }
.courseware-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.courseware-dialog-head > div { display: grid; gap: 4px; }
.courseware-dialog-head span { color: var(--color-muted); font-size: 12px; }
.courseware-dialog-head strong { color: var(--color-heading); font-size: 20px; }
.courseware-dialog-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--color-muted); }
.courseware-dialog-close:hover { background: var(--color-primary-soft); color: var(--color-primary); }
.courseware-dialog-form, .courseware-dialog-confirm { display: grid; gap: 16px; }
.courseware-dialog-form label { display: grid; gap: 7px; color: var(--color-heading); font-size: 13px; font-weight: 700; }
.courseware-dialog-error { margin: -4px 0 0; color: var(--color-danger); font-size: 13px; }
.courseware-dialog-confirm p { margin: 0; color: var(--color-text); line-height: 1.6; }
.courseware-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.courseware-danger-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 12px; border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent); border-radius: 7px; background: var(--color-danger-soft); color: var(--color-danger); font-weight: 800; }
.courseware-danger-button:hover { background: color-mix(in srgb, var(--color-danger-soft) 82%, var(--color-danger)); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 820px) { .courseware-layout { grid-template-columns: 1fr; } .courseware-sidebar { min-height: auto; } }
@media (max-width: 560px) { .courseware-card { flex-wrap: wrap; } .card-actions { width: 100%; } .courseware-toolbar { align-items: flex-start; flex-direction: column; } }
</style>
