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
const DEFAULT_FILENAME_TEMPLATE = '{dateShort} 《{topic}》({assetSequence}) {teacherName} {studentName}'
const archiveRuleVariableGroups = [
  {
    label: '课次信息',
    variables: [
      { token: '{year}', label: '年份' },
      { token: '{month}', label: '月份' },
      { token: '{term}', label: '学期' },
      { token: '{date}', label: '日期' },
      { token: '{dateShort}', label: '日期（短格式）' },
      { token: '{topic}', label: '本次课题' },
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
      { token: '{assetType}', label: '资料类型' },
      { token: '{assetSequence}', label: '素材序号' },
      { token: '{assetName}', label: '素材/作品名称' }
    ]
  }
]

const selectedId = ref(null)
const selectedBaiduProviderId = ref(null)
const isBaiduDrawerOpen = ref(false)
const baiduDrawerMode = ref('edit')
const baiduDrawerDraft = ref(null)
const baiduDrawerBaseline = ref('')
const isMobileFlow = ref(false)
const mobileStage = ref('list')
let cleanupMobileMedia = () => {}
const clone = (value) => JSON.parse(JSON.stringify(value))
const BAIDU_EDITABLE_FIELDS = [
  'name',
  'appId',
  'appKey',
  'secretKey',
  'backendBaseUrl',
  'frontendBaseUrl',
  'frontendReturnPath',
  'directoryRule',
  'filenameTemplate',
  'authorizeUrl',
  'tokenUrl',
  'scope',
  'callbackPath',
  'apiBaseUrl',
  'uploadBaseUrl',
  'stateTtl',
  'chunkSizeBytes',
  'tokenRefreshSkew',
  'enabled'
]
const baiduProviderSnapshot = (provider = {}) => JSON.stringify(Object.fromEntries(
  BAIDU_EDITABLE_FIELDS.map((field) => [field, provider[field] ?? null])
))

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
const wecomDraft = ref({})
const archiveRuleInput = ref(null)
const archiveFilenameInput = ref(null)
const archiveRuleVariableMenu = ref(null)
const archiveRuleVariableMenuOpen = ref(false)
const archiveRuleVariableSelection = ref({ start: 0, end: 0 })
const activeArchiveTemplate = ref('directory')
const archiveRuleValue = computed(() => baiduDrawerDraft.value?.directoryRule || DEFAULT_ARCHIVE_RULE)
const archiveFilenameValue = computed(() => baiduDrawerDraft.value?.filenameTemplate ?? '')
const archiveRulePreview = computed(() => {
  const values = {
    campus: '大学城校区',
    date: '2026-08-23',
    dateShort: '2026.8.23',
    year: '2026',
    month: '08',
    term: '秋季学期',
    classType: '创想班',
    className: '大班A',
    course: '秋日树屋',
    courseTitle: '秋日树屋',
    topic: '小狗',
    teacher: '李老师',
    teacherName: '李老师',
    lessonId: '1024',
    studentName: '小明',
    assetName: '小狗原图',
    assetType: '学生作品',
    assetSequence: '3'
  }
  return archiveRuleValue.value.replace(/\{([A-Za-z][A-Za-z0-9_]*)}/g, (match, key) => values[key] || match)
})
const archiveFilenamePreview = computed(() => {
  const configured = String(baiduDrawerDraft.value?.filenameTemplate || '').trim()
  if (!configured) return '沿用系统默认命名（扩展名由系统自动追加）'
  const values = {
    dateShort: '2026.8.23',
    topic: '小狗',
    assetSequence: '3',
    teacherName: '李老师',
    studentName: '小明',
    assetName: '小狗原图',
    assetType: '学生作品'
  }
  const rendered = configured.replace(/\{([A-Za-z][A-Za-z0-9_]*)}/g, (match, key) => values[key] || '')
    .replace(/\(\s*\)/g, '')
    .replace(/（\s*）/g, '')
    .replace(/《\s*》/g, '')
    .replace(/【\s*】/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${rendered || '沿用系统默认命名'}.jpg`
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
  const current = settings.find((setting) => sameId(setting.id, selectedId.value))
  if (String(current?.category || '').toLowerCase() === 'wecom') {
    wecomDraft.value = clone(props.state.wecomConfiguration || current.value?.configuration || {})
  }
}, { deep: true, immediate: true })

const selectSetting = (setting) => {
  if (isBaiduDrawerOpen.value && !closeBaiduProviderDrawer()) return
  isBaiduDrawerOpen.value = false
  baiduDrawerDraft.value = null
  selectedId.value = setting.id
  draft.value = clone(setting)
  if (String(setting.category || '').toLowerCase() === 'wecom') {
    wecomDraft.value = clone(props.state.wecomConfiguration || setting.value?.configuration || {})
  }
  activeArchiveTemplate.value = 'directory'
  if (isMobileFlow.value) mobileStage.value = 'detail'
}

const setActiveArchiveTemplate = (templateType) => {
  activeArchiveTemplate.value = templateType
}

const activeArchiveInput = () => activeArchiveTemplate.value === 'filename'
  ? archiveFilenameInput.value
  : archiveRuleInput.value

const activeArchiveValue = () => activeArchiveTemplate.value === 'filename'
  ? baiduDrawerDraft.value?.filenameTemplate ?? ''
  : baiduDrawerDraft.value?.directoryRule ?? ''

const captureArchiveRuleVariableSelection = () => {
  const input = activeArchiveInput()
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
  if (!isCloudCategory.value || !baiduDrawerDraft.value) return
  const current = activeArchiveValue()
  const input = activeArchiveInput()
  const start = archiveRuleVariableMenuOpen.value
    ? archiveRuleVariableSelection.value.start
    : input && typeof input.selectionStart === 'number' ? input.selectionStart : current.length
  const end = archiveRuleVariableMenuOpen.value
    ? archiveRuleVariableSelection.value.end
    : input && typeof input.selectionEnd === 'number' ? input.selectionEnd : start
  const nextValue = `${current.slice(0, start)}${token}${current.slice(end)}`
  if (activeArchiveTemplate.value === 'filename') baiduDrawerDraft.value.filenameTemplate = nextValue
  else baiduDrawerDraft.value.directoryRule = nextValue
  closeArchiveRuleVariableMenu()
  nextTick(() => {
    const activeInput = activeArchiveInput()
    if (!activeInput) return
    const caret = start + token.length
    activeInput.focus()
    activeInput.setSelectionRange(caret, caret)
  })
}

const save = () => {
  if (isCloudCategory.value) {
    props.state.notify('请在百度网盘账号详情抽屉中保存配置')
    return
  }
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

const saveWecom = async () => {
  const value = wecomDraft.value || {}
  const required = ['corpId', 'corpSecret']
  if (required.some((field) => !String(value[field] || '').trim())) {
    props.state.notify('请完整填写 CorpID 和客户联系应用 Secret')
    return
  }
  const saved = await props.state.saveWecomConfiguration?.(value)
  if (saved) {
    wecomDraft.value = clone(saved)
    const group = selected()
    if (group) group.status = saved.status === 'ENABLED' ? '已启用' : '未启用'
  }
}

const saveCurrent = () => isWecomCategory.value ? saveWecom() : save()

const testWecom = () => props.state.testWecomConfiguration?.()

const selectedGroup = computed(() => providerSettings.value.find((group) => sameId(group.id, selectedId.value)) || providerGroupDefinitions.find((group) => group.id === selectedId.value) || providerGroupDefinitions[0])
const currentProviderLabel = computed(() => selectedGroup.value?.providerLabel || '通道')
const isCloudCategory = computed(() => selectedGroup.value?.category === 'cloud')
const isAiCategory = computed(() => selectedGroup.value?.category === 'ai')
const isWecomCategory = computed(() => selectedGroup.value?.category === 'wecom')
const isProviderSetting = computed(() => Boolean(draft.value.category))
const canSave = computed(() => Boolean(
  isWecomCategory.value
    ? ['corpId', 'corpSecret'].every((field) => String(wecomDraft.value?.[field] || '').trim())
    : isProviderSetting.value && !isCloudCategory.value && draft.value.value?.providers?.length
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
const baiduProviders = computed(() => (selected()?.value?.providers || []).filter(isBaiduProvider))
const selectedBaiduProvider = computed(() => baiduProviders.value.find((provider) => sameId(provider.id, selectedBaiduProviderId.value)) || null)
const baiduDrawerProvider = computed(() => baiduDrawerDraft.value || selectedBaiduProvider.value)
const baiduDrawerDirty = computed(() => Boolean(
  baiduDrawerDraft.value && baiduDrawerBaseline.value !== baiduProviderSnapshot(baiduDrawerDraft.value)
))
const isNewBaiduProvider = (provider) => !provider?.id || String(provider.id).startsWith('provider-')
const baiduAccountStatusLabel = (provider) => provider.enabled ? '已启用' : '已停用'
const baiduTestStatusLabel = (provider) => provider.testSuccess === true || provider.lastTestSuccess === true
  ? '测试成功'
  : provider.testSuccess === false || provider.lastTestSuccess === false
    ? '测试失败'
    : '未测试'
const canAddProvider = computed(() => {
  if (!providerTypes.value.length) return false
  if (isCloudCategory.value) return true
  return providerTypes.value.some((type) => String(type).toUpperCase() !== 'BAIDU_NETDISK' || !baiduProviders.value.length)
})

watch([selectedId, providerSettings], () => {
  if (!isCloudCategory.value) {
    selectedBaiduProviderId.value = null
    isBaiduDrawerOpen.value = false
    baiduDrawerDraft.value = null
    return
  }
  if (!baiduProviders.value.some((provider) => sameId(provider.id, selectedBaiduProviderId.value))) {
    selectedBaiduProviderId.value = baiduProviders.value[0]?.id || null
  }
}, { deep: true, immediate: true })

watch(() => props.state.wecomConfiguration, (value) => {
  if (value && isWecomCategory.value) wecomDraft.value = clone(value)
}, { deep: true, immediate: true })

const openBaiduProviderDrawer = (provider, mode = 'edit') => {
  if (!provider) return
  closeArchiveRuleVariableMenu()
  selectedBaiduProviderId.value = provider.id
  baiduDrawerMode.value = mode
  baiduDrawerDraft.value = clone(provider)
  baiduDrawerBaseline.value = baiduProviderSnapshot(baiduDrawerDraft.value)
  isBaiduDrawerOpen.value = true
  if (isMobileFlow.value) mobileStage.value = 'detail'
}

const selectBaiduProvider = (provider) => openBaiduProviderDrawer(provider)

const closeBaiduProviderDrawer = () => {
  if (baiduDrawerDirty.value && typeof window !== 'undefined' && !window.confirm('当前百度网盘账号有未保存修改，确定关闭吗？')) return false
  closeArchiveRuleVariableMenu()
  isBaiduDrawerOpen.value = false
  baiduDrawerDraft.value = null
  baiduDrawerBaseline.value = ''
  baiduDrawerMode.value = 'edit'
  return true
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
}

const baiduStatusLabel = (provider) => {
  if (provider.oauthConfigured === false) return '后端未配置'
  if (provider.oauthStatus === 'AUTH_REQUIRED') return '需要重新授权'
  if (provider.oauthAuthorized) return '已授权'
  return '待授权'
}

const baiduStatusClass = (provider) => {
  if (provider.oauthConfigured === false || provider.oauthStatus === 'AUTH_REQUIRED') return 'warning'
  if (provider.oauthAuthorized) return 'success'
  return 'muted'
}

const baiduAccountIdentityLabel = (provider) => provider.baiduDisplayName
  || (provider.oauthAuthorized ? '百度账号已授权' : '尚未绑定百度账号')

const addProvider = () => {
  if (!draft.value.value?.providers) {
    draft.value.value = {
      providers: [],
      defaultArchiveTargets: []
    }
  }
  const id = `provider-${Date.now()}`
  const providerType = isCloudCategory.value
    ? 'BAIDU_NETDISK'
    : providerTypes.value.find((type) => String(type).toUpperCase() !== 'BAIDU_NETDISK' || !baiduProviders.value.length) || ''
  const provider = {
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
    enabled: false,
    directoryRule: baiduProviders.value[0]?.directoryRule || DEFAULT_ARCHIVE_RULE,
    filenameTemplate: baiduProviders.value[0]?.filenameTemplate ?? DEFAULT_FILENAME_TEMPLATE
  }
  if (isCloudCategory.value) {
    closeArchiveRuleVariableMenu()
    baiduDrawerMode.value = 'new'
    baiduDrawerDraft.value = provider
    baiduDrawerBaseline.value = baiduProviderSnapshot(provider)
    isBaiduDrawerOpen.value = true
    if (isMobileFlow.value) mobileStage.value = 'detail'
    return
  }
  draft.value.value.providers.push(provider)
}

const saveBaiduProvider = async () => {
  const provider = baiduDrawerDraft.value
  if (provider && !String(provider.name || '').trim()) {
    props.state.notify('配置名称不能为空')
    return
  }
  let saved = null
  if (provider) {
    saved = await (isNewBaiduProvider(provider)
      ? props.state.createBaiduProvider?.(provider)
      : props.state.updateBaiduProvider?.(provider))
    if (!saved) return
    selectedBaiduProviderId.value = saved.id
  }
  if (!provider) return
  const current = selected()
  if (current) {
    draft.value = clone(current)
    const savedProvider = current.value?.providers?.find((item) => sameId(item.id, selectedBaiduProviderId.value))
    baiduDrawerDraft.value = clone(savedProvider || saved)
  } else {
    baiduDrawerDraft.value = clone(saved)
  }
  baiduDrawerMode.value = 'edit'
  baiduDrawerBaseline.value = baiduProviderSnapshot(baiduDrawerDraft.value)
  await refreshBaiduStatuses()
}

const disableBaiduProvider = async (provider) => {
  const saved = await props.state.disableProvider?.(provider)
  if (!saved) return
  selectedBaiduProviderId.value = saved.id
  isBaiduDrawerOpen.value = false
  baiduDrawerDraft.value = null
  const current = selected()
  if (current) draft.value = clone(current)
  await refreshBaiduStatuses()
}

const restoreBaiduProvider = async (provider) => {
  const saved = await props.state.restoreProvider?.(provider)
  if (!saved) return
  selectedBaiduProviderId.value = saved.id
  isBaiduDrawerOpen.value = false
  baiduDrawerDraft.value = null
  const current = selected()
  if (current) draft.value = clone(current)
  await refreshBaiduStatuses()
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
  provider.testMessage = ''
  provider.testSuccess = null
  const result = await props.state.testProvider(provider)
  if (result) {
    provider.testMessage = result.message || (result.success ? '连接成功' : '连接失败')
    provider.testSuccess = Boolean(result.success)
  } else {
    provider.testMessage = props.state.toast || '测试连接失败，请稍后重试'
    provider.testSuccess = false
  }
  if (isBaiduProvider(provider)) await refreshBaiduStatuses()
}

const authorizeBaidu = async (provider) => {
  await props.state.startBaiduOAuth(provider)
}

const refreshBaiduStatuses = async () => {
  const persistedProviders = (providerSettings.value || [])
    .flatMap((group) => group.value?.providers || [])
    .filter(isBaiduProvider)
  const candidates = [...persistedProviders, baiduDrawerDraft.value]
    .filter(isBaiduProvider)
    .filter((provider, index, values) => values.findIndex((item) => sameId(item.id, provider.id)) === index)
  await Promise.all(candidates.map(async (provider) => {
    const status = await props.state.baiduOAuthStatus?.(provider)
    if (!status) return
    ;[...persistedProviders, baiduDrawerDraft.value]
      .filter((item) => isBaiduProvider(item) && sameId(item.id, provider.id))
      .forEach((item) => {
        item.oauthStatus = status.status || ''
        item.oauthAuthorized = Boolean(status.authorized)
        item.oauthConfigured = status.oauthConfigured !== false
        item.baiduUid = status.baiduUid || ''
        item.baiduDisplayName = status.displayName || ''
        item.authorizedAt = status.authorizedAt || ''
        item.expiresAt = status.expiresAt || ''
        item.oauthScope = status.scope || ''
        item.authErrorCode = status.errorCode || ''
        item.authErrorMessage = status.errorMessage || ''
        item.callbackUrl = status.callbackUrl || ''
        item.frontendReturnUrl = status.frontendReturnUrl || ''
        item.tokenStatus = baiduStatusLabel(item)
      })
  }))
}

watch(() => (providerSettings.value || []).flatMap((group) => group.value?.providers || [])
  .filter(isBaiduProvider).map((provider) => String(provider.id)).join(','), () => {
  refreshBaiduStatuses().catch(() => {})
}, { immediate: true })

const returnToList = () => {
  if (isBaiduDrawerOpen.value && !closeBaiduProviderDrawer()) return
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
  <div v-if="props.state.toast" class="toast" role="status" aria-live="polite">
    {{ props.state.toast }}
  </div>

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
    <button v-if="(!isMobileFlow || mobileStage === 'detail') && !isCloudCategory" class="primary" :disabled="!canSave" @click="saveCurrent">保存当前配置</button>
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

    <section v-show="!isMobileFlow || mobileStage === 'detail'" class="panel settings-detail-panel">
      <div class="section-head">
        <div>
          <span>配置详情</span>
          <strong>{{ draft.name || '请选择配置项' }}</strong>
        </div>
      </div>
      <div v-if="!isProviderSetting" class="notice-box">暂无可配置的第三方通道。</div>
      <div v-else class="cloud-setting-panel">
        <section v-if="isCloudCategory" class="master-list panel directory-list-panel">
          <div class="section-head settings-baidu-account-toolbar">
            <div>
              <span>百度网盘账号</span>
              <strong>{{ baiduProviders.length }} 个账号</strong>
            </div>
            <button class="primary settings-baidu-add-button" type="button" :disabled="!canAddProvider" @click="addProvider">新增账号</button>
          </div>
          <div v-if="!baiduProviders.length" class="notice-box">还没有百度网盘账号，点击“新增账号”开始配置。</div>
          <div v-else class="directory-table-wrap">
            <table class="directory-table settings-baidu-account-table">
              <thead>
                <tr>
                  <th>配置名称</th>
                  <th>百度账号</th>
                  <th>授权状态</th>
                  <th>启用状态</th>
                  <th>最近测试</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="provider in baiduProviders"
                  :key="provider.id"
                  class="directory-table-row"
                  :class="{ active: sameId(provider.id, selectedBaiduProviderId) && isBaiduDrawerOpen }"
                  @click="selectBaiduProvider(provider)"
                >
                  <td><strong>{{ provider.name || '未命名账号' }}</strong></td>
                  <td>
                    <span>{{ baiduAccountIdentityLabel(provider) }}</span>
                    <small v-if="provider.baiduUid">UID {{ provider.baiduUid }}</small>
                  </td>
                  <td><span class="status-pill" :class="baiduStatusClass(provider)">{{ baiduStatusLabel(provider) }}</span></td>
                  <td><span class="template-status-tag" :class="{ disabled: !provider.enabled }">{{ baiduAccountStatusLabel(provider) }}</span></td>
                  <td>{{ baiduTestStatusLabel(provider) }}</td>
                  <td>
                    <div class="button-pair settings-baidu-account-actions">
                      <button class="ghost" type="button" @click.stop="selectBaiduProvider(provider)">编辑</button>
                      <button class="ghost" type="button" @click.stop="provider.enabled ? disableBaiduProvider(provider) : restoreBaiduProvider(provider)">
                        {{ provider.enabled ? '停用' : '恢复' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="directory-mobile-cards">
              <button
                v-for="provider in baiduProviders"
                :key="`mobile-${provider.id}`"
                type="button"
                class="directory-card"
                :class="{ active: sameId(provider.id, selectedBaiduProviderId) && isBaiduDrawerOpen }"
                @click="selectBaiduProvider(provider)"
              >
                <strong>{{ provider.name || '未命名账号' }}</strong>
                <span>{{ baiduAccountIdentityLabel(provider) }}<template v-if="provider.baiduUid"> · UID {{ provider.baiduUid }}</template></span>
                <small>{{ baiduStatusLabel(provider) }} · {{ baiduTestStatusLabel(provider) }}</small>
                <em>{{ baiduAccountStatusLabel(provider) }} · 点击查看详情</em>
              </button>
            </div>
          </div>
        </section>

        <section v-if="isWecomCategory" class="master-form-section wecom-settings-section">
          <div class="section-head">
            <div>
              <span>企业微信客户群</span>
              <strong>{{ wecomDraft.id ? '已配置' : '尚未配置' }}</strong>
            </div>
            <span class="status-pill" :class="{ success: wecomDraft.status === 'ENABLED', warning: wecomDraft.status !== 'ENABLED' }">
              {{ wecomDraft.status === 'ENABLED' ? '已启用' : '未启用' }}
            </span>
          </div>
          <div class="form-grid">
            <label>配置名称<input v-model="wecomDraft.name" placeholder="企业微信客户群" /></label>
            <label>CorpID<input v-model="wecomDraft.corpId" autocomplete="off" /></label>
            <label class="wide">客户联系应用 Secret<input v-model="wecomDraft.corpSecret" type="password" autocomplete="new-password" /></label>
            <label class="wide">API Base URL<input v-model="wecomDraft.apiBaseUrl" placeholder="https://qyapi.weixin.qq.com/cgi-bin" /></label>
            <label class="inline-check wide"><input v-model="wecomDraft.status" true-value="ENABLED" false-value="DISABLED" type="checkbox" /> <span>启用企业微信客户群触达</span></label>
          </div>
          <div class="cloud-provider-actions">
            <button class="ghost" type="button" @click="testWecom">测试客户群查询</button>
            <span v-if="wecomDraft.lastTestMessage" class="provider-test-feedback" :class="{ success: wecomDraft.lastTestSuccess }">
              {{ wecomDraft.lastTestMessage }}<template v-if="wecomDraft.lastTestedAt"> · {{ formatDateTime(wecomDraft.lastTestedAt) }}</template>
            </span>
          </div>
        </section>

        <div v-else-if="!isCloudCategory && !draft.value.providers.length" class="notice-box">暂未配置{{ currentProviderLabel }}通道。</div>
        <template v-else-if="!isCloudCategory">
          <article
            v-for="provider in draft.value.providers"
            :key="provider.id"
            class="cloud-provider-card"
          >
          <template v-if="isAiCategory">
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
              <button class="ghost" type="button" @click="testProvider(provider)">测试连接</button>
            </div>
          </template>
          </article>
        </template>
      </div>
    </section>
  </section>

  <div v-if="isBaiduDrawerOpen" class="directory-drawer-backdrop" @click.self="closeBaiduProviderDrawer">
    <section v-if="baiduDrawerProvider" class="panel directory-drawer template-config-drawer" role="dialog" aria-modal="true">
      <div class="section-head">
        <div>
          <span>{{ baiduDrawerMode === 'new' ? '新增' : '编辑' }}</span>
          <strong>{{ baiduDrawerMode === 'new' ? '新增百度网盘账号' : baiduDrawerProvider.name || '百度网盘账号' }}</strong>
          <small class="template-drawer-meta">
            {{ baiduAccountIdentityLabel(baiduDrawerProvider) }}<template v-if="baiduDrawerProvider.baiduUid"> · UID {{ baiduDrawerProvider.baiduUid }}</template>
          </small>
        </div>
        <div class="button-pair">
          <button class="ghost" type="button" @click="closeBaiduProviderDrawer">关闭</button>
          <button class="primary" type="button" :disabled="!String(baiduDrawerProvider.name || '').trim()" @click="saveBaiduProvider">
            {{ baiduDrawerMode === 'new' ? '保存账号' : '保存修改' }}
          </button>
        </div>
      </div>

      <form class="template-drawer-form" @submit.prevent="saveBaiduProvider">
        <section class="master-form-section">
          <strong>账号配置</strong>
          <div class="form-grid baidu-meta-grid">
            <label>配置名称<input v-model="baiduDrawerProvider.name" placeholder="例如：大学城校区百度网盘" /></label>
            <label>百度 AppID<input v-model="baiduDrawerProvider.appId" placeholder="百度开放平台 AppID" /></label>
            <label>百度 AppKey<input v-model="baiduDrawerProvider.appKey" placeholder="百度开放平台 AppKey" /></label>
            <label>百度 SecretKey<input v-model="baiduDrawerProvider.secretKey" type="password" :placeholder="baiduDrawerProvider.baiduSecretKeyConfigured ? '已配置，留空保持不变' : '百度开放平台 SecretKey'" autocomplete="new-password" /></label>
            <label>后端公开地址<input v-model="baiduDrawerProvider.backendBaseUrl" placeholder="http://mengdi.ccwu.cc:10001" /></label>
            <label>前端域名<input v-model="baiduDrawerProvider.frontendBaseUrl" placeholder="http://mengdi.ccwu.cc:10001" /></label>
            <label>前端回跳路径<input v-model="baiduDrawerProvider.frontendReturnPath" :placeholder="DEFAULT_BAIDU_FRONTEND_RETURN_PATH" /></label>
            <label>最近授权时间<input :value="formatDateTime(baiduDrawerProvider.authorizedAt)" disabled /></label>
            <label>授权有效期<input :value="formatDateTime(baiduDrawerProvider.expiresAt)" disabled /></label>
            <label>授权范围<input :value="baiduDrawerProvider.oauthScope || '—'" disabled /></label>
            <label class="wide">OAuth 回调地址<input :value="baiduDrawerProvider.callbackUrl || '保存后读取后端配置'" disabled /></label>
            <label class="wide">授权完成回跳<input :value="baiduDrawerProvider.frontendReturnUrl || '保存后读取前端配置'" disabled /></label>
          </div>
        </section>

        <section class="master-form-section settings-baidu-rules-section">
          <strong>归档规则</strong>
          <div class="form-grid">
            <div class="wide archive-rule-editor">
              <label>默认归档目录规则
                <input
                  ref="archiveRuleInput"
                  v-model="baiduDrawerProvider.directoryRule"
                  :placeholder="DEFAULT_ARCHIVE_RULE"
                  autocomplete="off"
                  @focus="setActiveArchiveTemplate('directory')"
                  @click="setActiveArchiveTemplate('directory')"
                />
              </label>
              <label>默认归档文件名规则
                <input
                  ref="archiveFilenameInput"
                  v-model="baiduDrawerProvider.filenameTemplate"
                  :placeholder="DEFAULT_FILENAME_TEMPLATE"
                  maxlength="500"
                  autocomplete="off"
                  @focus="setActiveArchiveTemplate('filename')"
                  @click="setActiveArchiveTemplate('filename')"
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
                  <div v-if="archiveRuleVariableMenuOpen" class="archive-rule-variable-popover" role="menu" aria-label="归档规则变量">
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
              <p class="settings-hint">使用花括号变量组成目录层级，保存后由该百度账号的归档任务按当前校区、课次和资料信息渲染。</p>
              <p class="archive-rule-preview">目录预览：<code>{{ archiveRulePreview }}</code></p>
              <p class="settings-hint">文件名模板不填写扩展名；文件扩展名由系统根据源文件自动追加。留空时新归档优先使用素材或作品名称，未填写时沿用源文件名。</p>
              <p class="archive-rule-preview">文件名预览：<code>{{ archiveFilenamePreview }}</code></p>
            </div>
          </div>
        </section>

        <details class="template-form-details" open>
          <summary>高级百度接口配置</summary>
          <div class="form-grid">
            <label>授权地址<input v-model="baiduDrawerProvider.authorizeUrl" placeholder="https://openapi.baidu.com/oauth/2.0/authorize" /></label>
            <label>Token 地址<input v-model="baiduDrawerProvider.tokenUrl" placeholder="https://openapi.baidu.com/oauth/2.0/token" /></label>
            <label>授权范围<input v-model="baiduDrawerProvider.scope" placeholder="basic,netdisk" /></label>
            <label>回调路径<input v-model="baiduDrawerProvider.callbackPath" placeholder="/api/v1/configuration/providers/%s/baidu/oauth/callback" /></label>
            <label>百度 API 地址<input v-model="baiduDrawerProvider.apiBaseUrl" placeholder="https://pan.baidu.com" /></label>
            <label>分片上传地址<input v-model="baiduDrawerProvider.uploadBaseUrl" placeholder="https://d.pcs.baidu.com" /></label>
            <label>OAuth State 有效期<input v-model="baiduDrawerProvider.stateTtl" placeholder="PT10M" /></label>
            <label>分片大小（字节）<input v-model="baiduDrawerProvider.chunkSizeBytes" type="number" min="262144" max="33554432" /></label>
            <label>Token 刷新提前量<input v-model="baiduDrawerProvider.tokenRefreshSkew" placeholder="PT5M" /></label>
          </div>
        </details>

        <p v-if="baiduDrawerProvider.authErrorMessage" class="settings-error">{{ baiduDrawerProvider.authErrorMessage }}</p>
        <div class="cloud-provider-actions">
          <label class="inline-check"><input v-model="baiduDrawerProvider.enabled" type="checkbox" /> <span>启用百度网盘归档</span></label>
          <button v-if="!isNewBaiduProvider(baiduDrawerProvider) && baiduDrawerProvider.enabled" class="danger-text" type="button" @click="disableBaiduProvider(baiduDrawerProvider)">停用账号</button>
          <button v-if="!isNewBaiduProvider(baiduDrawerProvider) && !baiduDrawerProvider.enabled" class="secondary" type="button" @click="restoreBaiduProvider(baiduDrawerProvider)">恢复账号</button>
          <button class="secondary" type="button" @click="authorizeBaidu(baiduDrawerProvider)">{{ baiduDrawerProvider.oauthAuthorized ? '重新授权百度网盘' : '授权百度网盘' }}</button>
          <button class="ghost" type="button" @click="testProvider(baiduDrawerProvider)">测试连接</button>
        </div>
        <p
          v-if="baiduDrawerProvider.testMessage"
          class="provider-test-feedback"
          :class="baiduDrawerProvider.testSuccess ? 'success' : 'error'"
        >
          {{ baiduDrawerProvider.testMessage }}
        </p>
      </form>
    </section>
  </div>
</template>
