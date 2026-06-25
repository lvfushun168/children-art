<script setup>
import { computed, ref } from 'vue'
import PageHead from '../components/layout/PageHead.vue'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const selectedId = ref(props.state.settings[0]?.id || null)
const selected = () => props.state.settings.find((item) => item.id === selectedId.value)
const clone = (value) => JSON.parse(JSON.stringify(value))
const draft = ref(clone(selected() || {}))

const selectSetting = (setting) => {
  selectedId.value = setting.id
  draft.value = clone(setting)
}

const save = () => {
  props.state.updateSetting(selectedId.value, draft.value)
}

const isCloudDrive = computed(() => draft.value.type === 'cloudDrive')
const providerTypes = ['百度网盘', '阿里云盘', '本地 NAS', '自定义接口']
const authTypes = ['OAuth2', 'Access Token', 'AK/SK', '自定义签名']

const addCloudProvider = () => {
  if (!draft.value.value?.providers) {
    draft.value.value = {
      providers: [],
      directoryRule: '校区 / 班级 / 学生 / 年月 / 课程名',
      defaultArchiveTargets: []
    }
  }
  const id = `provider-${Date.now()}`
  draft.value.value.providers.push({
    id,
    name: '新的网盘',
    type: '自定义接口',
    authType: 'Access Token',
    endpoint: '',
    appKey: '',
    tokenStatus: '未授权',
    archiveDefault: false,
    enabled: false
  })
}

const testCloudProvider = (provider) => {
  provider.tokenStatus = provider.endpoint ? '连接正常' : '待填写接口地址'
}

const newTeacher = ref({ name: '', phone: '', role: '老师', status: '启用' })

const addTeacher = () => {
  const teacher = props.state.addTeacher(newTeacher.value)
  newTeacher.value = { name: '', phone: '', role: '老师', status: '启用' }
  return teacher
}

const toggleTeacherClass = (teacher, classId) => {
  teacher.classes = teacher.classes.includes(classId)
    ? teacher.classes.filter((id) => id !== classId)
    : [...teacher.classes, classId]
}
</script>

<template>
  <PageHead eyebrow="后台配置" title="系统配置">
    <button class="primary" @click="save">保存当前配置</button>
  </PageHead>

  <section class="settings-layout">
    <aside class="panel master-list">
      <div class="section-head">
        <div>
          <span>配置项</span>
          <strong>{{ state.settings.length }} 项</strong>
        </div>
      </div>
      <button
        v-for="setting in state.settings"
        :key="setting.id"
        class="master-row"
        :class="{ active: setting.id === selectedId }"
        @click="selectSetting(setting)"
      >
        <strong>{{ setting.name }}</strong>
        <span>{{ setting.status }}</span>
      </button>
    </aside>

    <section class="panel">
      <div class="section-head">
        <div>
          <span>配置详情</span>
          <strong>{{ draft.name }}</strong>
        </div>
      </div>
      <div v-if="!isCloudDrive" class="form-grid">
        <label>配置名称<input v-model="draft.name" /></label>
        <label>状态<input v-model="draft.status" /></label>
        <label class="wide">配置值<textarea v-model="draft.value" rows="5" /></label>
      </div>
      <div v-else class="cloud-setting-panel">
        <div class="form-grid">
          <label>配置名称<input v-model="draft.name" /></label>
          <label>状态<select v-model="draft.status"><option>已启用</option><option>停用</option><option>待配置</option></select></label>
          <label class="wide">默认归档目录规则<input v-model="draft.value.directoryRule" /></label>
        </div>
        <div class="section-head compact">
          <div>
            <span>网盘通道</span>
            <strong>{{ draft.value.providers.length }} 个接口</strong>
          </div>
          <button class="secondary" @click="addCloudProvider">新增网盘</button>
        </div>
        <article v-for="provider in draft.value.providers" :key="provider.id" class="cloud-provider-card">
          <div class="cloud-provider-head">
            <label>网盘名称<input v-model="provider.name" /></label>
            <label>网盘类型<select v-model="provider.type"><option v-for="type in providerTypes" :key="type">{{ type }}</option></select></label>
            <label>授权方式<select v-model="provider.authType"><option v-for="type in authTypes" :key="type">{{ type }}</option></select></label>
          </div>
          <div class="form-grid">
            <label class="wide">接口地址<input v-model="provider.endpoint" placeholder="https://..." /></label>
            <label>AppKey / 标识<input v-model="provider.appKey" /></label>
            <label>授权状态<input v-model="provider.tokenStatus" /></label>
          </div>
          <div class="cloud-provider-actions">
            <label class="inline-check"><input v-model="provider.enabled" type="checkbox" /> <span>启用该网盘</span></label>
            <label class="inline-check"><input v-model="provider.archiveDefault" type="checkbox" /> <span>课次归档默认勾选</span></label>
            <button class="ghost" @click="testCloudProvider(provider)">测试连接</button>
          </div>
        </article>
      </div>
      <div class="notice-box">
        <strong>一期系统边界</strong>
        <small>这里只维护 AI、存储、网盘、水印和基础角色配置，不接管排课、课消和财务主流程。</small>
      </div>
    </section>

    <aside class="panel">
      <div class="section-head">
        <div>
          <span>账号、角色与授权</span>
          <strong>{{ state.teachers.length }} 个账号</strong>
        </div>
      </div>
      <div v-for="teacher in state.teachers" :key="teacher.id" class="teacher-row">
        <input v-model="teacher.name" />
        <input v-model="teacher.phone" />
        <select v-model="teacher.role">
          <option>老师</option>
          <option>管理员</option>
        </select>
        <select v-model="teacher.status">
          <option>启用</option>
          <option>停用</option>
        </select>
        <div class="permission-picker">
          <strong>{{ teacher.role === '管理员' ? '全部班级' : '授权班级' }}</strong>
          <label v-for="klass in state.classes" :key="klass.id" class="inline-check">
            <input
              type="checkbox"
              :disabled="teacher.role === '管理员'"
              :checked="teacher.role === '管理员' || teacher.classes.includes(klass.id)"
              @change="toggleTeacherClass(teacher, klass.id)"
            />
            <span>{{ klass.name }}</span>
          </label>
        </div>
      </div>
      <div class="teacher-row new">
        <input v-model="newTeacher.name" placeholder="姓名" />
        <input v-model="newTeacher.phone" placeholder="手机号" />
        <select v-model="newTeacher.role">
          <option>老师</option>
          <option>管理员</option>
        </select>
        <button class="primary" @click="addTeacher">新增</button>
      </div>
      <div class="notice-box">
        <strong>权限验收点</strong>
        <small>老师账号只应返回授权班级课次；管理员可查看全部课次、基础数据、系统配置和账号角色。</small>
      </div>
    </aside>
  </section>
</template>
