<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PageHead from '../components/layout/PageHead.vue'
import { sameId } from '../services/mappers'
import {
  DEFAULT_BAIDU_BACKEND_BASE_URL,
  DEFAULT_BAIDU_FRONTEND_BASE_URL,
  DEFAULT_BAIDU_FRONTEND_RETURN_PATH
} from '../services/baiduConfig'

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
const DEFAULT_ARCHIVE_RULE = '/{campus}/教学资料归档/课程归总/{year}/{term}+{classType}归总'
const archiveRuleVariableGroups = [
  {
    label: '课次信息',
    variables: [
      { token: '{year}', label: '年份' },
      { token: '{month}', label: '月份' },
      { token: '{term}', label: '学期' },
      { token: '{date}', label: '日期' },
      { token: '{lessonId}', label: '课次 ID' }
    ]
  },
  {
    label: '教学组织',
    variables: [
      { token: '{campus}', label: '校区' },
      { token: '{classType}', label: '班型' },
      { token: '{className}', label: '班级' },
      { token: '{courseTitle}', label: '课程' },
      { token: '{teacherName}', label: '老师' }
    ]
  },
  {
    label: '归档内容',
    variables: [
      { token: '{studentName}', label: '学生' },
      { token: '{assetType}', label: '资料类型' }
    ]
  }
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
        providers,
        directoryRule: group.category === 'cloud' ? (base.value?.directoryRule || DEFAULT_ARCHIVE_RULE) : ''
      }
    }
  })
})

const selected = () => providerSettings.value.find((item) => sameId(item.id, selectedId.value))
const draft = ref({})
const archiveRuleInput = ref(null)
const archiveRuleVariableMenu = ref(null)
const archiveRuleVariableMenuOpen = ref(false)
const archiveRuleVariableSelection = ref({ start: 0, end: 0 })
const archiveRuleValue = computed(() => draft.value.value?.directoryRule || DEFAULT_ARCHIVE_RULE)
const archiveRulePreview = computed(() => {
  const values = {
    campus: '大学城校区',
    date: '2026-08-23',
    year: '2026',
    month: '08',
    term: '秋季学期',
    classType: '创想班',
    className: '大班A',
    course: '秋日树屋',
    courseTitle: '秋日树屋',
    teacher: '李老师',
    teacherName: '李老师',
    lessonId: '1024',
    studentName: '小明',
    assetType: '学生作品'
  }
  return archiveRuleValue.value.replace(/\{([A-Za-z][A-Za-z0-9_]*)}/g, (match, key) => values[key] || match)
})

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

const captureArchiveRuleVariableSelection = () => {
  const input = archiveRuleInput.value
  if (!input || typeof input.selectionStart !== 'number' || typeof input.selectionEnd !== 'number') return
  archiveRuleVariableSelection.value = {
    start: input.selectionStart,
    end: input.selectionEnd
  }
}

const toggleArchiveRuleVariableMenu = () => {
  if (!archiveRuleVariableMenuOpen.value) captureArchiveRuleVariableSelection()
  archiveRuleVariableMenuOpen.value = !archiveRuleVariableMenuOpen.value
}

const closeArchiveRuleVariableMenu = () => {
  archiveRuleVariableMenuOpen.value = false
}

const closeArchiveRuleVariableMenuFromOutside = (event) => {
  if (!archiveRuleVariableMenuOpen.value || archiveRuleVariableMenu.value?.contains(event.target)) return
  closeArchiveRuleVariableMenu()
}

const closeArchiveRuleVariableMenuFromKeyboard = (event) => {
  if (event.key === 'Escape') closeArchiveRuleVariableMenu()
}

const insertArchiveVariable = (token) => {
  if (!isCloudCategory.value) return
  const current = archiveRuleValue.value
  const input = archiveRuleInput.value
  const start = archiveRuleVariableMenuOpen.value
    ? archiveRuleVariableSelection.value.start
    : input && typeof input.selectionStart === 'number' ? input.selectionStart : current.length
  const end = archiveRuleVariableMenuOpen.value
    ? archiveRuleVariableSelection.value.end
    : input && typeof input.selectionEnd === 'number' ? input.selectionEnd : start
  draft.value.value.directoryRule = `${current.slice(0, start)}${token}${current.slice(end)}`
  closeArchiveRuleVariableMenu()
  nextTick(() => {
    if (!archiveRuleInput.value) return
    const caret = start + token.length
    archiveRuleInput.value.focus()
    archiveRuleInput.value.setSelectionRange(caret, caret)
  })
}

const save = () => {
  if (!isProviderSetting.value) {
    props.state.notify('当前配置不可保存')
    return
  }
  if (!draft.value.value?.providers?.length && !isCloudCategory.value) {
    props.state.notify(`请先添加${currentProviderLabel.value}通道`)
    return
  }
  props.state.updateSetting(selectedId.value, draft.value)
}

const selectedGroup = computed(() => providerSettings.value.find((group) => sameId(group.id, selectedId.value)) || providerGroupDefinitions.find((group) => group.id === selectedId.value) || providerGroupDefinitions[0])
const currentProviderLabel = computed(() => selectedGroup.value?.providerLabel || '通道')
const isCloudCategory = computed(() => selectedGroup.value?.category === 'cloud')
const isAiCategory = computed(() => selectedGroup.value?.category === 'ai')
const isProviderSetting = computed(() => Boolean(draft.value.category))
const canSave = computed(() => Boolean(
  isProviderSetting.value && (isCloudCategory.value
    ? draft.value.value?.directoryRule !== undefined
    : draft.value.value?.providers?.length)
))
const providerTypeCatalog = computed(() => props.state.providerTypeCatalog || {
  cloud: props.state.providerTypeOptions || [],
  wecom: [],
  ai: []
})
const providerTypes = computed(() => {
  // 云盘配置固定使用百度网盘，不向用户开放 Provider 类型选择。
  if (isCloudCategory.value) return ['BAIDU_NETDISK']
  const options = providerTypeCatalog.value?.[selectedGroup.value?.category] || []
  if (isAiCategory.value) return ['HTTP_AI']
  if (options.length) return options
  return [...new Set((draft.value.value?.providers || []).map((provider) => provider.providerType || provider.type).filter(Boolean))]
})
const authTypes = ['OAuth2', 'Access Token', 'API Key（secretRef）', 'AK/SK', '自定义签名']
const textProtocolOptions = ['OPENAI_COMPATIBLE', 'CHILDREN_ART']
const imageProtocolOptions = ['WAN_NATIVE', 'OPENAI_COMPATIBLE']
const imageSizeOptions = ['1K', '2K', '4K']
const aiCapabilityOptions = [
  { value: 'FEEDBACK_GENERATION', label: '文本生成 / 课评' },
  { value: 'TEXT_TO_IMAGE', label: '文生图' },
  { value: 'IMAGE_TO_IMAGE', label: '图生图' }
]
const isBaiduProvider = (provider) => String(provider?.providerType || provider?.type || '').toUpperCase() === 'BAIDU_NETDISK'
const baiduProviders = computed(() => (draft.value.value?.providers || []).filter(isBaiduProvider))
const canAddProvider = computed(() => {
  if (!providerTypes.value.length) return false
  if (isCloudCategory.value) return !baiduProviders.value.length
  return providerTypes.value.some((type) => String(type).toUpperCase() !== 'BAIDU_NETDISK' || !baiduProviders.value.length)
})

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
}

const baiduStatusLabel = (provider) => {
  if (provider.oauthConfigured === false) return '后端未配置'
  if (provider.oauthStatus === 'AUTH_REQUIRED') return '需要重新授权'
  if (provider.oauthAuthorized) return provider.baiduDisplayName ? `已授权（${provider.baiduDisplayName}）` : '已授权'
  return '待授权'
}

const baiduStatusClass = (provider) => {
  if (provider.oauthConfigured === false || provider.oauthStatus === 'AUTH_REQUIRED') return 'warning'
  if (provider.oauthAuthorized) return 'success'
  return 'muted'
}

const addProvider = () => {
  if (!draft.value.value?.providers) {
    draft.value.value = {
      providers: [],
      directoryRule: DEFAULT_ARCHIVE_RULE,
      defaultArchiveTargets: []
    }
  }
  const id = `provider-${Date.now()}`
  const providerType = isCloudCategory.value
    ? 'BAIDU_NETDISK'
    : providerTypes.value.find((type) => String(type).toUpperCase() !== 'BAIDU_NETDISK' || !baiduProviders.value.length) || ''
  draft.value.value.providers.push({
    id,
    name: `新的${currentProviderLabel.value}`,
    type: providerType,
    providerType,
    authType: isAiCategory.value ? 'API Key' : providerType === 'BAIDU_NETDISK' ? 'OAuth2' : 'Access Token',
    endpoint: '',
    appKey: '',
    appId: '',
    secretKey: '',
    secretRef: '',
    capabilities: isAiCategory.value ? ['FEEDBACK_GENERATION', 'TEXT_TO_IMAGE', 'IMAGE_TO_IMAGE'] : [],
    config: isAiCategory.value ? {
      protocol: 'OPENAI_COMPATIBLE',
      textProtocol: 'OPENAI_COMPATIBLE',
      textEndpoint: '',
      textModel: '',
      imageProtocol: 'WAN_NATIVE',
      imageEndpoint: '',
      imageModel: '',
      imageSize: '1K',
      watermark: false,
      thinkingMode: false
    } : {},
    backendBaseUrl: DEFAULT_BAIDU_BACKEND_BASE_URL,
    frontendBaseUrl: DEFAULT_BAIDU_FRONTEND_BASE_URL,
    frontendReturnPath: DEFAULT_BAIDU_FRONTEND_RETURN_PATH,
    authorizeUrl: '',
    tokenUrl: '',
    scope: '',
    callbackPath: '',
    apiBaseUrl: '',
    uploadBaseUrl: '',
    stateTtl: 'PT10M',
    chunkSizeBytes: 4194304,
    tokenRefreshSkew: 'PT5M',
    tokenStatus: '未授权',
    archiveDefault: false,
    enabled: false
  })
}

const setProviderType = (provider, value) => {
  provider.type = value
  provider.providerType = value
  if (String(value).toUpperCase() === 'HTTP_AI') {
    provider.authType = 'API Key'
    provider.capabilities = provider.capabilities?.length
      ? provider.capabilities
      : ['FEEDBACK_GENERATION', 'TEXT_TO_IMAGE', 'IMAGE_TO_IMAGE']
    provider.config = {
      protocol: 'OPENAI_COMPATIBLE',
      textProtocol: 'OPENAI_COMPATIBLE',
      textEndpoint: provider.config?.textEndpoint || provider.endpoint || '',
      textModel: provider.config?.textModel || '',
      imageProtocol: provider.config?.imageProtocol || 'WAN_NATIVE',
      imageEndpoint: provider.config?.imageEndpoint || '',
      imageModel: provider.config?.imageModel || '',
      imageSize: provider.config?.imageSize || '1K',
      watermark: provider.config?.watermark === true,
      thinkingMode: provider.config?.thinkingMode === true
    }
  }
  if (isBaiduProvider(provider)) {
    provider.authType = 'OAuth2'
    provider.endpoint = ''
    provider.appKey = ''
    provider.secretRef = ''
  }
}

const testProvider = async (provider) => {
  await props.state.testProvider(provider)
  if (isBaiduProvider(provider)) await refreshBaiduStatuses()
}

const authorizeBaidu = async (provider) => {
  await props.state.startBaiduOAuth(provider)
}

const refreshBaiduStatuses = async () => {
  const providers = draft.value.value?.providers || []
  await Promise.all(providers.filter(isBaiduProvider).map(async (provider) => {
    const status = await props.state.baiduOAuthStatus?.(provider)
    if (!status) return
    provider.oauthStatus = status.status || ''
    provider.oauthAuthorized = Boolean(status.authorized)
    provider.oauthConfigured = status.oauthConfigured !== false
    provider.baiduUid = status.baiduUid || ''
    provider.baiduDisplayName = status.displayName || ''
    provider.authorizedAt = status.authorizedAt || ''
    provider.expiresAt = status.expiresAt || ''
    provider.oauthScope = status.scope || ''
    provider.authErrorCode = status.errorCode || ''
    provider.authErrorMessage = status.errorMessage || ''
    provider.callbackUrl = status.callbackUrl || ''
    provider.frontendReturnUrl = status.frontendReturnUrl || ''
    provider.tokenStatus = baiduStatusLabel(provider)
  }))
}

watch(() => (providerSettings.value || []).flatMap((group) => group.value?.providers || [])
  .filter(isBaiduProvider).map((provider) => String(provider.id)).join(','), () => {
  refreshBaiduStatuses().catch(() => {})
}, { immediate: true })

const returnToList = () => {
  draft.value = clone(selected() || {})
  mobileStage.value = 'list'
  refreshBaiduStatuses().catch(() => {})
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
  document.addEventListener('pointerdown', closeArchiveRuleVariableMenuFromOutside)
  document.addEventListener('keydown', closeArchiveRuleVariableMenuFromKeyboard)
  const oauthResult = new URLSearchParams(window.location.search).get('baiduOAuth')
  if (oauthResult === 'success') props.state.notify('百度网盘授权成功')
  if (oauthResult === 'failure') props.state.notify('百度网盘授权失败，请重试')
  refreshBaiduStatuses().catch(() => {})
  if (oauthResult) {
    const url = new URL(window.location.href)
    url.searchParams.delete('baiduOAuth')
    url.searchParams.delete('providerId')
    url.searchParams.delete('reason')
    window.history.replaceState({}, document.title, url.toString())
  }
})

onBeforeUnmount(() => {
  cleanupMobileMedia()
  document.removeEventListener('pointerdown', closeArchiveRuleVariableMenuFromOutside)
  document.removeEventListener('keydown', closeArchiveRuleVariableMenuFromKeyboard)
})
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
          <div v-if="isCloudCategory" class="wide archive-rule-editor">
            <label>默认归档目录规则
              <input
                ref="archiveRuleInput"
                v-model="draft.value.directoryRule"
                :placeholder="DEFAULT_ARCHIVE_RULE"
                autocomplete="off"
              />
            </label>
            <div class="archive-rule-toolbar">
              <span>插入变量：</span>
              <div ref="archiveRuleVariableMenu" class="archive-rule-variable-menu">
                <button
                  class="ghost archive-rule-variable-trigger"
                  type="button"
                  :aria-expanded="archiveRuleVariableMenuOpen"
                  aria-haspopup="menu"
                  @click.stop="toggleArchiveRuleVariableMenu"
                >
                  <span>选择变量</span>
                  <b aria-hidden="true">⌄</b>
                </button>
                <div v-if="archiveRuleVariableMenuOpen" class="archive-rule-variable-popover" role="menu" aria-label="目录规则变量">
                  <section v-for="group in archiveRuleVariableGroups" :key="group.label" class="archive-rule-variable-group">
                    <strong>{{ group.label }}</strong>
                    <button
                      v-for="variable in group.variables"
                      :key="variable.token"
                      class="archive-rule-variable-option"
                      type="button"
                      role="menuitem"
                      @click="insertArchiveVariable(variable.token)"
                    >
                      <span>{{ variable.label }}</span>
                      <code>{{ variable.token }}</code>
                    </button>
                  </section>
                </div>
              </div>
            </div>
            <p class="settings-hint">使用花括号变量组成目录层级，保存后由后端归档任务按当前校区、课次和资料信息渲染。</p>
            <p class="archive-rule-preview">预览：<code>{{ archiveRulePreview }}</code></p>
          </div>
        </div>

        <div v-if="!draft.value.providers.length" class="notice-box">暂未配置{{ currentProviderLabel }}通道。</div>
        <article v-for="provider in draft.value.providers" :key="provider.id" class="cloud-provider-card">
          <template v-if="isBaiduProvider(provider)">
            <div class="baidu-provider-heading">
              <div>
                <span class="provider-card-eyebrow">百度网盘账号</span>
                <strong>{{ provider.baiduDisplayName || '尚未绑定百度账号' }}</strong>
                <small>{{ provider.baiduUid ? `账号标识：${provider.baiduUid}` : '每个校区绑定一个百度网盘账号' }}</small>
              </div>
              <span class="status-pill" :class="baiduStatusClass(provider)">{{ baiduStatusLabel(provider) }}</span>
            </div>
            <div class="form-grid baidu-meta-grid">
              <label>配置名称<input v-model="provider.name" /></label>
              <label>百度 AppID<input v-model="provider.appId" placeholder="百度开放平台 AppID" /></label>
              <label>百度 AppKey<input v-model="provider.appKey" placeholder="百度开放平台 AppKey" /></label>
              <label>百度 SecretKey<input v-model="provider.secretKey" type="password" :placeholder="provider.baiduSecretKeyConfigured ? '已配置，留空保持不变' : '百度开放平台 SecretKey'" autocomplete="new-password" /></label>
              <label>后端公开地址<input v-model="provider.backendBaseUrl" placeholder="http://mengdi.ccwu.cc:10001" /></label>
              <label>前端域名<input v-model="provider.frontendBaseUrl" placeholder="http://mengdi.ccwu.cc:10001" /></label>
              <label>前端回跳路径<input v-model="provider.frontendReturnPath" :placeholder="DEFAULT_BAIDU_FRONTEND_RETURN_PATH" /></label>
              <label>最近授权时间<input :value="formatDateTime(provider.authorizedAt)" disabled /></label>
              <label>授权有效期<input :value="formatDateTime(provider.expiresAt)" disabled /></label>
              <label>授权范围<input :value="provider.oauthScope || '—'" disabled /></label>
              <label class="wide">OAuth 回调地址<input :value="provider.callbackUrl || '保存后读取后端配置'" disabled /></label>
              <label class="wide">授权完成回跳<input :value="provider.frontendReturnUrl || '保存后读取前端配置'" disabled /></label>
            </div>
            <details class="baidu-advanced-settings">
              <summary>高级百度接口配置</summary>
              <div class="form-grid">
                <label>授权地址<input v-model="provider.authorizeUrl" placeholder="https://openapi.baidu.com/oauth/2.0/authorize" /></label>
                <label>Token 地址<input v-model="provider.tokenUrl" placeholder="https://openapi.baidu.com/oauth/2.0/token" /></label>
                <label>授权范围<input v-model="provider.scope" placeholder="basic,netdisk" /></label>
                <label>回调路径<input v-model="provider.callbackPath" placeholder="/api/v1/configuration/providers/%s/baidu/oauth/callback" /></label>
                <label>百度 API 地址<input v-model="provider.apiBaseUrl" placeholder="https://pan.baidu.com" /></label>
                <label>分片上传地址<input v-model="provider.uploadBaseUrl" placeholder="https://d.pcs.baidu.com" /></label>
                <label>OAuth State 有效期<input v-model="provider.stateTtl" placeholder="PT10M" /></label>
                <label>分片大小（字节）<input v-model="provider.chunkSizeBytes" type="number" min="262144" max="33554432" /></label>
                <label>Token 刷新提前量<input v-model="provider.tokenRefreshSkew" placeholder="PT5M" /></label>
              </div>
            </details>
            <p v-if="provider.authErrorMessage" class="settings-error">{{ provider.authErrorMessage }}</p>
            <div class="cloud-provider-actions">
              <label class="inline-check"><input v-model="provider.enabled" type="checkbox" /> <span>启用百度网盘归档</span></label>
              <button class="secondary" @click="authorizeBaidu(provider)">{{ provider.oauthAuthorized ? '重新授权百度网盘' : '授权百度网盘' }}</button>
              <button class="ghost" @click="testProvider(provider)">测试连接</button>
            </div>
          </template>
          <template v-else-if="isAiCategory">
            <div class="cloud-provider-head">
              <label>{{ currentProviderLabel }}名称<input v-model="provider.name" /></label>
              <label>{{ currentProviderLabel }}类型<AdaptiveSelect :model-value="provider.providerType || provider.type" :options="providerTypes" @update:model-value="setProviderType(provider, $event)" /></label>
              <label>授权方式<input value="API Key" disabled /></label>
            </div>
            <div class="form-grid ai-provider-grid">
              <label class="wide">API Key（直接保存到当前校区配置）
                <input v-model="provider.secretRef" type="password" :placeholder="provider.secretRefPresent ? '已配置，留空保持不变' : '请输入 API Key'" autocomplete="new-password" />
              </label>
              <label>授权状态<input :value="provider.tokenStatus" disabled /></label>
              <div class="wide ai-capabilities">
                <span class="field-label">支持能力</span>
                <label v-for="capability in aiCapabilityOptions" :key="capability.value" class="inline-check">
                  <input v-model="provider.capabilities" type="checkbox" :value="capability.value" />
                  <span>{{ capability.label }}</span>
                </label>
              </div>
              <div class="wide ai-section-title">文本调用</div>
              <label>文本协议<AdaptiveSelect v-model="provider.config.textProtocol" :options="textProtocolOptions" /></label>
              <label>文本模型<input v-model="provider.config.textModel" placeholder="例如 qwen3.8-max" /></label>
              <label class="wide">文本接口地址
                <input v-model="provider.config.textEndpoint" placeholder="https://.../compatible-mode/v1" />
              </label>
              <div class="wide ai-section-title">文生图 / 图生图</div>
              <label>图片协议<AdaptiveSelect v-model="provider.config.imageProtocol" :options="imageProtocolOptions" /></label>
              <label>图片模型<input v-model="provider.config.imageModel" placeholder="例如 wan2.7-image-pro" /></label>
              <label class="wide">图片接口地址
                <input v-model="provider.config.imageEndpoint" placeholder="Wan 原生接口；可填 /api/v1/services/aigc/multimodal-generation/generation" />
              </label>
              <label>默认图片尺寸<AdaptiveSelect v-model="provider.config.imageSize" :options="imageSizeOptions" /></label>
              <label class="inline-check ai-toggle"><input v-model="provider.config.watermark" type="checkbox" /> <span>启用图片水印</span></label>
              <label class="inline-check ai-toggle"><input v-model="provider.config.thinkingMode" type="checkbox" /> <span>启用图片思考模式</span></label>
            </div>
            <p class="settings-hint">文本和图片可以共用一个密钥，但允许使用不同协议和接口地址。图片协议选 WAN_NATIVE 时支持把学生原图作为输入进行图生图。</p>
            <div class="cloud-provider-actions">
              <label class="inline-check"><input v-model="provider.enabled" type="checkbox" /> <span>启用该 AI</span></label>
              <button class="ghost" type="button" @click="testProvider(provider)">测试连接</button>
            </div>
          </template>
          <template v-else>
            <div class="cloud-provider-head">
              <label>{{ currentProviderLabel }}名称<input v-model="provider.name" /></label>
              <label v-if="!isCloudCategory">{{ currentProviderLabel }}类型<AdaptiveSelect :model-value="provider.providerType || provider.type" :options="providerTypes" @update:model-value="setProviderType(provider, $event)" /></label>
              <label>授权方式<AdaptiveSelect v-model="provider.authType" :options="authTypes" /></label>
            </div>
            <div class="form-grid">
              <label class="wide">接口地址<input v-model="provider.endpoint" placeholder="https://..." /></label>
              <label>AppKey / 标识<input v-model="provider.appKey" /></label>
              <label>授权状态<input v-model="provider.tokenStatus" disabled /></label>
            </div>
            <div class="cloud-provider-actions">
              <label class="inline-check"><input v-model="provider.enabled" type="checkbox" /> <span>启用该{{ currentProviderLabel }}</span></label>
              <button class="ghost" @click="testProvider(provider)">测试连接</button>
            </div>
          </template>
        </article>

      </div>
    </section>

  </section>
</template>
