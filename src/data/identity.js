export const identityStatusOptions = [
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '停用' }
]

export const identityStatusLabel = (status) => ({
  ENABLED: '启用',
  DISABLED: '停用'
}[status] || status || '未知')

export const identityModuleLabel = (module) => ({
  identity: '身份与权限',
  masterdata: '基础信息',
  import: '数据导入',
  lesson: '课后交付',
  artwork: '作品与素材',
  feedback: '课评与反馈',
  ai: 'AI 能力',
  share: '家长分享',
  touch: '家长触达',
  archive: '档案管理',
  wheat: '小麦留痕',
  todo: '待办中心',
  quality: '教管质检',
  crm: '学生档案',
  portfolio: '作品集',
  configuration: '系统配置',
  file: '文件与上传',
  extra: '课外任务'
}[String(module || '').toLowerCase()] || module || '其他')

export const identityStatusClass = (status) => status === 'ENABLED' ? 'status-enabled' : 'status-disabled'
