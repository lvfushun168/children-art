<script setup>
import { computed } from 'vue'
import AppIcon from '../common/AppIcon.vue'

const props = defineProps({
  folder: { type: Object, required: true },
  activeId: { default: null },
  children: { type: Array, default: () => [] },
  expanded: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  canManage: { type: Boolean, default: false },
  resolveChildren: { type: Function, default: () => [] },
  resolveLoading: { type: Function, default: () => false },
  resolveExpanded: { type: Function, default: () => false }
})

const emit = defineEmits(['select', 'toggle', 'rename', 'delete', 'move'])
const selected = computed(() => String(props.activeId ?? '') === String(props.folder.id ?? ''))
</script>

<template>
  <li class="courseware-tree-node">
    <div class="courseware-tree-row" :class="{ selected }">
      <button
        class="tree-toggle"
        type="button"
        :aria-label="expanded ? '收起目录' : '展开目录'"
        :disabled="loading"
        @click.stop="emit('toggle', folder)"
      >
        <span v-if="loading" class="tree-spinner"><AppIcon name="pending" :size="13" /></span>
        <AppIcon v-else :name="expanded ? 'collapse' : 'expand'" :size="14" />
      </button>
      <button class="tree-folder" type="button" @click="emit('select', folder)">
        <span class="tree-folder-mark"><AppIcon name="courseware" :size="15" /></span>
        <span class="tree-folder-name" :title="folder.name">{{ folder.name }}</span>
        <small>{{ Number(folder.childCount || 0) + Number(folder.itemCount || 0) }}</small>
      </button>
      <div v-if="canManage" class="tree-actions">
        <button type="button" title="重命名" aria-label="重命名" @click.stop="emit('rename', folder)"><AppIcon name="edit" :size="13" /></button>
        <button type="button" title="移动" aria-label="移动" @click.stop="emit('move', folder)"><AppIcon name="move" :size="13" /></button>
        <button type="button" title="删除" aria-label="删除" @click.stop="emit('delete', folder)"><AppIcon name="delete" :size="13" /></button>
      </div>
    </div>
    <ul v-if="expanded && children.length" class="courseware-tree-children">
      <CoursewareFolderTreeNode
        v-for="child in children"
        :key="child.id"
        :folder="child"
        :active-id="activeId"
        :children="resolveChildren(child)"
        :expanded="resolveExpanded(child)"
        :loading="resolveLoading(child)"
        :can-manage="canManage"
        :resolve-children="resolveChildren"
        :resolve-loading="resolveLoading"
        :resolve-expanded="resolveExpanded"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
        @rename="emit('rename', $event)"
        @delete="emit('delete', $event)"
        @move="emit('move', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.courseware-tree-node { list-style: none; }
.courseware-tree-row { display: flex; align-items: center; gap: 4px; min-height: 38px; border-radius: 10px; padding: 2px 5px; }
.courseware-tree-row.selected { background: var(--color-primary-soft); }
.tree-toggle, .tree-folder, .tree-actions button { border: 0; background: transparent; color: inherit; cursor: pointer; }
.tree-toggle { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 28px; color: var(--color-muted); font-size: 18px; }
.tree-folder { display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1; text-align: left; padding: 6px 4px; }
.tree-folder-mark { display: inline-flex; color: var(--color-status-warning-text); }
.tree-folder-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-folder small { color: var(--color-muted); }
.tree-actions { display: flex; gap: 2px; opacity: 0; transition: opacity .15s ease; }
.courseware-tree-row:hover .tree-actions, .courseware-tree-row:focus-within .tree-actions { opacity: 1; }
.tree-actions button { display: inline-flex; align-items: center; justify-content: center; color: var(--color-muted); padding: 4px; }
.tree-actions button:hover { color: var(--color-primary); }
.courseware-tree-children { margin: 0 0 0 17px; padding: 0; }
.tree-spinner { display: inline-flex; animation: spin 0.9s linear infinite; }
</style>
