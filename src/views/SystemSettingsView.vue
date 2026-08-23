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

const providerGroupDefinitions = [
  { id: 'cloud', name: '网盘配置', category: 'cloud', providerLabel: '网盘' },
  { id: 'wecom', name: '企业微信配置', category: 'wecom', providerLabel: '企业微信' },
  { id: 'ai', name: 'AI 配置', category: 'ai', providerLabel: 'AI' }
]

const selectedId = ref(null)
const isMobileFlow = ref(false)
const mobileStage = ref('list')
let cleanupMobileMedia = () => {}
const clone = (value) => JSON.parse(JSON.stringify(value))

const providerCategory = (provider = {}) => {
  const backendCategory = String(provider.category || '').trim().toLowerCase()
  if (providerGroupDefinitions.some((group) => group.category === backendCategory)) return backendCategory
  const type = String(provider.providerType || provider.type || '').trim().toUpperCase()
  if (type.includes('WECOM') || type.includes('WE_COM') || type.includes('WECHAT') || type.includes('企业微信')) return 'wecom'
  if (type.includes('AI') || type.includes('OPENAI') || type.includes('CLAUDE') || type.includes('DEEPSEEK')) return 'ai'
  return 'cloud'
}

const providerLabelForCategory = (category) => providerGroupDefinitions.find((group) => group.category === category)?.providerLabel || '通道'
const baseProviderSetting = computed(() => props.state.settings.find((setting) => Array.isArray(setting.value?.providers)))
const allProviders = computed(() => baseProviderSetting.value?.value?.providers || [])
const backendProviderSettings = computed(() => props.state.providerGroups || [])
const providerSettings = computed(() => {
  if (backendProviderSettings.value.length) {
    return backendProviderSettings.value.map((group) => {
      const category = String(group.category || '').toLowerCase()
      const providers = group.value?.providers || group.providers || []
      return {
        ...group,
        id: group.id || group.key,
        category,
        providerLabel: group.providerLabel || providerLabelForCategory(category),
        value: {
          ...(group.value || {}),
          providers,
          directoryRule: group.value?.directoryRule || '',
          defaultArchiveTargets: group.value?.defaultArchiveTargets || []
        }
      }
    })
  }
  const base = baseProviderSetting.value
  if (!base) return []
  return providerGroupDefinitions.map((group) => {
    const providers = allProviders.value.filter((provider) => providerCategory(provider) === group.category)
    return {
      ...base,
      id: group.id,
      name: group.name,
      category: group.category,
      providerLabel: group.providerLabel,
      status: providers.length ? (providers.some((provider) => provider.enabled) ? '已启用' : '未启用') : '未配置',
      value: {
        ...(base.value || {}),
        providers
      }
    }
  })
})

const selected = () => providerSettings.value.find((item) => sameId(item.id, selectedId.value))
const draft = ref({})

watch(providerSettings, (settings) => {
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
  if (!isProviderSetting.value) {
    props.state.notify('当前配置不可保存')
    return
  }
  if (!draft.value.value?.providers?.length) {
    props.state.notify(`请先添加${currentProviderLabel.value}通道`)
    return
  }
  props.state.updateSetting(selectedId.value, draft.value)
}

const selectedGroup = computed(() => providerSettings.value.find((group) => sameId(group.id, selectedId.value)) || providerGroupDefinitions.find((group) => group.id === selectedId.value) || providerGroupDefinitions[0])
const currentProviderLabel = computed(() => selectedGroup.value?.providerLabel || '通道')
const isCloudCategory = computed(() => selectedGroup.value?.category === 'cloud')
const isProviderSetting = computed(() => Boolean(draft.value.category))
const canSave = computed(() => Boolean(isProviderSetting.value && draft.value.value?.providers?.length))
const providerTypeCatalog = computed(() => props.state.providerTypeCatalog || {
  cloud: props.state.providerTypeOptions || [],
  wecom: [],
  ai: []
})
const providerTypes = computed(() => {
  const options = providerTypeCatalog.value?.[selectedGroup.value?.category] || []
  if (options.length) return options
  return [...new Set((draft.value.value?.providers || []).map((provider) => provider.providerType || provider.type).filter(Boolean))]
})
const authTypes = ['OAuth2', 'Access Token', 'AK/SK', '自定义签名']
const isBaiduProvider = (provider) => String(provider?.providerType || provider?.type || '').toUpperCase() === 'BAIDU_NETDISK'

const addProvider = () => {
  if (!draft.value.value?.providers) {
    draft.value.value = {
      providers: [],
      directoryRule: '校区 / 班级 / 学生 / 年月 / 课程名',
      defaultArchiveTargets: []
    }
  }
  const id = `provider-${Date.now()}`
  const providerType = providerTypes.value[0] || ''
  draft.value.value.providers.push({
    id,
    name: `新的${currentProviderLabel.value}`,
    type: providerType,
    providerType,
    authType: providerType === 'BAIDU_NETDISK' ? 'OAuth2' : 'Access Token',
    endpoint: '',
    appKey: '',
    tokenStatus: '未授权',
    archiveDefault: false,
    enabled: false
  })
}

const setProviderType = (provider, value) => {
  provider.type = value
  provider.providerType = value
  if (isBaiduProvider(provider)) provider.authType = 'OAuth2'
}

const testProvider = async (provider) => {
  await props.state.testProvider(provider)
}

const authorizeBaidu = async (provider) => {
  await props.state.startBaiduOAuth(provider)
}

const refreshBaiduStatuses = async () => {
  const providers = draft.value.value?.providers || []
  for (const provider of providers.filter(isBaiduProvider)) {
    const status = await props.state.baiduOAuthStatus?.(provider)
    if (status) provider.tokenStatus = status.authorized
      ? `已授权${status.displayName ? `（${status.displayName}）` : ''}`
      : '待授权'
  }
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
  const oauthResult = new URLSearchParams(window.location.search).get('baiduOAuth')
  if (oauthResult === 'success') props.state.notify('百度网盘授权成功')
  if (oauthResult === 'failure') props.state.notify('百度网盘授权失败，请重试')
  refreshBaiduStatuses().catch(() => {})
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
    <button v-if="!isMobileFlow || mobileStage === 'detail'" class="primary" :disabled="!canSave" @click="save">保存当前配置</button>
  </PageHead>

  <section class="settings-layout" :class="`mobile-settings-stage-${mobileStage}`">
    <aside v-show="!isMobileFlow || mobileStage === 'list'" class="panel template-type-list settings-type-list">
      <button
        v-for="setting in providerSettings"
        :key="setting.id"
        type="button"
        :class="{ active: sameId(setting.id, selectedId) }"
        @click="selectSetting(setting)"
      >
        <strong>{{ setting.name }}</strong>
        <small>{{ setting.status }}</small>
      </button>
    </aside>

    <section v-show="!isMobileFlow || mobileStage === 'detail'" class="panel">
      <div class="section-head">
        <div>
          <span>配置详情</span>
          <strong>{{ draft.name || '请选择配置项' }}</strong>
        </div>
      </div>
      <div v-if="!isProviderSetting" class="notice-box">暂无可配置的第三方通道。</div>
      <div v-else class="cloud-setting-panel">
        <div class="form-grid">
          <label>配置名称<input :value="draft.name" disabled /></label>
          <label>当前状态<input :value="draft.status" disabled /></label>
          <label v-if="isCloudCategory" class="wide">默认归档目录规则<input v-model="draft.value.directoryRule" disabled /></label>
        </div>
        <div class="section-head compact">
          <div>
            <span>{{ currentProviderLabel }}通道</span>
            <strong>{{ draft.value.providers.length }} 个接口</strong>
          </div>
          <button class="secondary" :disabled="!providerTypes.length" @click="addProvider">新增{{ currentProviderLabel }}</button>
        </div>
        <div v-if="!draft.value.providers.length" class="notice-box">暂未配置{{ currentProviderLabel }}通道。</div>
        <article v-for="provider in draft.value.providers" :key="provider.id" class="cloud-provider-card">
          <div class="cloud-provider-head">
            <label>{{ currentProviderLabel }}名称<input v-model="provider.name" /></label>
            <label>{{ currentProviderLabel }}类型<AdaptiveSelect :model-value="provider.providerType || provider.type" :options="providerTypes" @update:model-value="setProviderType(provider, $event)" /></label>
            <label>授权方式<AdaptiveSelect v-model="provider.authType" :options="isBaiduProvider(provider) ? ['OAuth2'] : authTypes" :disabled="isBaiduProvider(provider)" /></label>
          </div>
          <div class="form-grid">
            <label class="wide">接口地址<input v-model="provider.endpoint" placeholder="https://..." /></label>
            <label>AppKey / 标识<input v-model="provider.appKey" /></label>
            <label>授权状态<input v-model="provider.tokenStatus" disabled /></label>
          </div>
          <div class="cloud-provider-actions">
            <label class="inline-check"><input v-model="provider.enabled" type="checkbox" /> <span>启用该{{ currentProviderLabel }}</span></label>
            <label v-if="isCloudCategory" class="inline-check"><input v-model="provider.archiveDefault" type="checkbox" disabled /> <span>课次归档默认勾选</span></label>
            <button v-if="isBaiduProvider(provider)" class="secondary" @click="authorizeBaidu(provider)">{{ provider.tokenStatus?.includes('已授权') ? '重新授权百度网盘' : '授权百度网盘' }}</button>
            <button class="ghost" @click="testProvider(provider)">测试连接</button>
          </div>
        </article>

      </div>
    </section>

  </section>
</template>
