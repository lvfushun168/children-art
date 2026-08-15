<script setup>
import { ref } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
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

const newTeacher = ref({ name: '', phone: '', role: '老师', status: '启用' })

const teacherHasClass = (teacher, classId) => props.state.classes.some((klass) =>
  sameId(klass.id, classId) && sameId(klass.teacherId, teacher.id)
)

const addTeacher = async () => {
  const teacher = await props.state.addTeacher(newTeacher.value)
  if (!teacher) return null
  newTeacher.value = { name: '', phone: '', role: '老师', status: '启用' }
  return teacher
}

const saveTeacher = async (teacher) => {
  await props.state.updateTeacher(teacher.id, teacher)
}
</script>

<template>
  <button v-if="groupLabel" class="module-back-link" type="button" @click="$emit('backToGroup')">
    ← 返回{{ groupLabel }}
  </button>

  <PageHead eyebrow="后台配置" title="权限配置" />

  <section class="permission-settings-layout">
    <section class="panel permission-settings-panel">
      <div class="section-head">
        <div>
          <span>账号、角色与授权</span>
          <strong>{{ state.teachers.length }} 个账号</strong>
        </div>
      </div>
      <div class="permission-settings-list">
        <article v-for="teacher in state.teachers" :key="teacher.id" class="teacher-row">
          <input v-model="teacher.name" aria-label="姓名" />
          <input v-model="teacher.phone" aria-label="手机号" />
          <AdaptiveSelect v-model="teacher.role" :options="['老师', '管理员']" aria-label="角色" />
          <AdaptiveSelect v-model="teacher.status" :options="['启用', '停用']" aria-label="状态" />
          <div class="permission-picker">
            <strong>班级关系（只读）</strong>
            <label v-for="klass in state.classes" :key="klass.id" class="inline-check">
              <input type="checkbox" disabled :checked="teacherHasClass(teacher, klass.id)" />
              <span>{{ klass.name }}</span>
            </label>
          </div>
          <div class="teacher-row-actions">
            <button class="ghost" type="button" @click="saveTeacher(teacher)">保存资料</button>
          </div>
        </article>

        <article class="teacher-row new">
          <input v-model="newTeacher.name" placeholder="姓名" aria-label="新增账号姓名" />
          <input v-model="newTeacher.phone" placeholder="手机号" aria-label="新增账号手机号" />
          <AdaptiveSelect v-model="newTeacher.role" :options="['老师', '管理员']" aria-label="新增账号角色" />
          <button class="primary" type="button" @click="addTeacher">新增</button>
        </article>
      </div>
    </section>
  </section>
</template>
