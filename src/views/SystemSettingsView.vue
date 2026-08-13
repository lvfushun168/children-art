<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const selectedId = ref(props.state.settings[0]?.id || null)
const isMobileFlow = ref(false)
const mobileStage = ref('list')
let cleanupMobileMedia = () => {}
const selected = () => props.state.settings.find((item) => sameId(item.id, selectedId.value))
const clone = (value) => JSON.parse(JSON.stringify(value))
const draft = ref(clone(selected() || {}))

watch(() => props.state.settings, (settings) => {
  if (!settings.length) {
    selectedId.value = null
    draft.value = {}
    return
  }
  if (!settings.some((setting) => sameId(setting.id, selectedId.value))) {
    selectedId.value = settings[0].id
    draft.value = clone(settings[0])
  }
}, { deep: true, immediate: true })

const selectSetting = (setting) => {
  selectedId.value = setting.id
  draft.value = clone(setting)
  if (isMobileFlow.value) mobileStage.value = 'detail'
}

const save = () => {
  if (!isCloudDrive.value) {
    props.state.notify('当前一期没有通用系统设置持久化接口')
    return
  }
  props.state.updateSetting(selectedId.value, draft.value)
}

const isCloudDrive = computed(() => draft.value.type === 'cloudDrive')
const providerTypes = computed(() => props.state.providerTypeOptions || [])
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
    type: providerTypes.value[0] || '',
    providerType: providerTypes.value[0] || '',
    authType: 'Access Token',
    endpoint: '',
    appKey: '',
    tokenStatus: '未授权',
    archiveDefault: false,
    enabled: false
  })
}

const testCloudProvider = async (provider) => {
  await props.state.testProvider(provider)
}

const newTeacher = ref({ name: '', phone: '', role: '老师', status: '启用' })

const addTeacher = async () => {
  const teacher = await props.state.addTeacher(newTeacher.value)
  if (!teacher) return null
  newTeacher.value = { name: '', phone: '', role: '老师', status: '启用' }
  return teacher
}

const teacherHasClass = (teacher, classId) => props.state.classes.some((klass) =>
  sameId(klass.id, classId) && sameId(klass.teacherId, teacher.id)
)

const saveTeacher = async (teacher) => {
  await props.state.updateTeacher(teacher.id, teacher)
}

const openAccounts = () => {
  mobileStage.value = 'accounts'
}

const returnToList = () => {
  draft.value = clone(selected() || {})
  mobileStage.value = 'list'
}

onMounted(() => {
  const media = window.matchMedia('(max-width: 680px)')
  const syncMobile = () => {
    isMobileFlow.value = media.matches
    if (media.matches) mobileStage.value = 'list'
  }
  syncMobile()
  media.addEventListener('change', syncMobile)
  cleanupMobileMedia = () => media.removeEventListener('change', syncMobile)
})

onBeforeUnmount(() => cleanupMobileMedia())
</script>

<template>
  <button
    v-if="groupLabel && (!isMobileFlow || mobileStage === 'list')"
    class="module-back-link"
    type="button"
    @click="$emit('backToGroup')"
  >
    ← 返回{{ groupLabel }}
  </button>

  <button
    v-if="isMobileFlow && mobileStage !== 'list'"
    class="module-back-link"
    type="button"
    @click="returnToList"
  >
    ← 返回配置列表
  </button>

  <PageHead eyebrow="后台配置" title="系统配置">
    <button v-if="!isMobileFlow || mobileStage === 'detail'" class="primary" :disabled="!isCloudDrive" @click="save">保存当前配置</button>
  </PageHead>

  <section class="settings-layout" :class="`mobile-settings-stage-${mobileStage}`">
    <aside v-show="!isMobileFlow || mobileStage === 'list'" class="panel master-list">
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
        :class="{ active: sameId(setting.id, selectedId) }"
        @click="selectSetting(setting)"
      >
        <strong>{{ setting.name }}</strong>
        <span>{{ setting.status }}</span>
      </button>
      <button v-if="isMobileFlow" class="master-row" @click="openAccounts">
        <strong>账号、角色与授权</strong>
        <span>{{ state.teachers.length }} 个账号</span>
      </button>
    </aside>

    <section v-show="!isMobileFlow || mobileStage === 'detail'" class="panel">
      <div class="section-head">
        <div>
          <span>配置详情</span>
          <strong>{{ draft.name }}</strong>
        </div>
      </div>
      <div v-if="!isCloudDrive" class="form-grid">
        <div class="notice-box">当前一期没有通用系统设置持久化接口，此处仅展示服务端返回内容。</div>
        <label>配置名称<input v-model="draft.name" /></label>
        <label>状态<input v-model="draft.status" /></label>
        <label class="wide">配置值<textarea v-model="draft.value" rows="5" /></label>
      </div>
      <div v-else class="cloud-setting-panel">
        <div class="form-grid">
          <label>配置名称<input v-model="draft.name" /></label>
          <label>状态<AdaptiveSelect v-model="draft.status" :options="['已启用', '停用', '待配置']" /></label>
          <label class="wide">默认归档目录规则<input v-model="draft.value.directoryRule" disabled placeholder="由服务端归档规则决定" /></label>
        </div>
        <div class="section-head compact">
          <div>
            <span>网盘通道</span>
            <strong>{{ draft.value.providers.length }} 个接口</strong>
          </div>
          <button class="secondary" :disabled="!providerTypes.length" @click="addCloudProvider">新增网盘</button>
        </div>
        <article v-for="provider in draft.value.providers" :key="provider.id" class="cloud-provider-card">
          <div class="cloud-provider-head">
            <label>网盘名称<input v-model="provider.name" /></label>
            <label>网盘类型<AdaptiveSelect v-model="provider.type" :options="providerTypes" /></label>
            <label>授权方式<AdaptiveSelect v-model="provider.authType" :options="authTypes" /></label>
          </div>
          <div class="form-grid">
            <label class="wide">接口地址<input v-model="provider.endpoint" placeholder="https://..." /></label>
            <label>AppKey / 标识<input v-model="provider.appKey" /></label>
            <label>授权状态<input v-model="provider.tokenStatus" disabled /></label>
          </div>
          <div class="cloud-provider-actions">
            <label class="inline-check"><input v-model="provider.enabled" type="checkbox" /> <span>启用该网盘</span></label>
            <label class="inline-check"><input v-model="provider.archiveDefault" type="checkbox" disabled /> <span>课次归档默认勾选（服务端规则）</span></label>
            <button class="ghost" @click="testCloudProvider(provider)">测试连接</button>
          </div>
        </article>
        <div class="notice-box">
          <small>当前协议只持久化通道名称、类型、能力、连接配置和启停状态；授权状态与目录默认勾选由服务端管理。</small>
        </div>
      </div>
    </section>

    <aside v-show="!isMobileFlow || mobileStage === 'accounts'" class="panel">
      <div class="section-head">
        <div>
          <span>账号、角色与授权</span>
          <strong>{{ state.teachers.length }} 个账号</strong>
        </div>
      </div>
      <div v-for="teacher in state.teachers" :key="teacher.id" class="teacher-row">
        <input v-model="teacher.name" />
        <input v-model="teacher.phone" />
        <AdaptiveSelect v-model="teacher.role" :options="['老师', '管理员']" />
        <AdaptiveSelect v-model="teacher.status" :options="['启用', '停用']" />
        <div class="permission-picker">
          <strong>班级关系（只读）</strong>
          <label v-for="klass in state.classes" :key="klass.id" class="inline-check">
            <input
              type="checkbox"
              disabled
              :checked="teacherHasClass(teacher, klass.id)"
            />
            <span>{{ klass.name }}</span>
          </label>
        </div>
        <div class="teacher-row-actions">
          <small>权限以服务端 me.permissions 为准；班级归属请在班级资料中调整。</small>
          <button class="ghost" type="button" @click="saveTeacher(teacher)">保存资料</button>
        </div>
      </div>
      <div class="teacher-row new">
        <input v-model="newTeacher.name" placeholder="姓名" />
        <input v-model="newTeacher.phone" placeholder="手机号" />
        <AdaptiveSelect v-model="newTeacher.role" :options="['老师', '管理员']" />
        <button class="primary" @click="addTeacher">新增</button>
      </div>
    </aside>
  </section>
</template>
