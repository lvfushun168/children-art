export const navGroups = [
  {
    id: 'afterClass',
    label: '课后工作',
    description: '今日课次与交付',
    mark: '课',
    items: [
      { id: 'tasks', label: '今日课后', mark: '课' },
      { id: 'supervision', label: '教管看板', mark: '管', description: '老师完成情况与评分' },
      { id: 'production', label: '制作中心', mark: '制' }
    ]
  },
  {
    id: 'basic',
    label: '基础信息',
    description: '老师、学生、班级、课程与课程链接',
    mark: '信',
    items: [
      { id: 'teachers', label: '老师', mark: '师' },
      { id: 'students', label: '学生', mark: '生' },
      { id: 'classes', label: '班级', mark: '班' },
      { id: 'externalLinks', label: '外链', mark: '链' }
    ]
  },
  {
    id: 'materials',
    label: '素材档案',
    description: '课次素材、归档与课外事项',
    mark: '档',
    items: [
      { id: 'courses', label: '课程资料', mark: '课' },
      { id: 'archives', label: '档案中心', mark: '档' },
      { id: 'extraTasks', label: '课外任务', mark: '外' }
    ]
  },
  {
    id: 'operations',
    label: '运营配置',
    description: '导入、模板与系统',
    mark: '配',
    items: [
      { id: 'imports', label: '数据导入', mark: '导' },
      { id: 'templates', label: '模板配置', mark: '配' },
      { id: 'accountManagement', label: '账号管理', mark: '账' },
      { id: 'roleManagement', label: '角色管理', mark: '角' },
      { id: 'permissionResources', label: '权限资源', mark: '权' },
      { id: 'settings', label: '系统配置', mark: '系' }
    ]
  }
]
