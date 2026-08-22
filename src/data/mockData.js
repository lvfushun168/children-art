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
    description: '学生、班级与课程链接',
    mark: '信',
    items: [
      { id: 'students', label: '学生', mark: '生' },
      { id: 'classes', label: '班级', mark: '班' },
      { id: 'externalLinks', label: '外链', mark: '链' }
    ]
  },
  {
    id: 'materials',
    label: '素材档案',
    description: '备课、归档与课外事项',
    mark: '档',
    items: [
      { id: 'courses', label: '范画库', mark: '画' },
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

export const navItems = navGroups.flatMap((group) => group.items)

export const school = {
  name: '梦地美术',
  campus: '大学城校区',
  storage: '',
  aiProvider: 'OpenAI 图文能力',
  objectStorage: '校区私有作品库',
  watermark: '梦地美术 · 大学城校区'
}

export const teachers = [
  {
    id: 1,
    name: '林老师',
    phone: '13700009011',
    password: '123456',
    role: '老师',
    availableRoles: ['老师'],
    status: '启用',
    classes: [1, 2]
  },
  {
    id: 2,
    name: '周老师',
    phone: '13600002708',
    password: '123456',
    role: '老师',
    availableRoles: ['老师'],
    status: '启用',
    classes: [3]
  },
  {
    id: 3,
    name: '王教务',
    phone: '13900001822',
    password: '123456',
    role: '管理员',
    availableRoles: ['管理员', '老师'],
    status: '启用',
    classes: [1, 2, 3]
  },
  {
    id: 4,
    name: '系统管理员',
    username: 'admin',
    phone: '13800000000',
    password: 'admin123',
    role: '管理员',
    availableRoles: ['管理员'],
    status: '启用',
    classes: []
  }
]

export const students = [
  {
    id: 1,
    name: '彤彤',
    nickname: '彤彤',
    age: 6,
    parent: '彤彤妈妈',
    phone: '138****2190',
    classId: 1,
    status: '在读',
    note: '色彩表达大胆，容易忽略背景留白',
    residentialCommunity: '大学城雅居',
    schoolName: '大学城第一小学',
    trainingBrandInterest: '舞蹈、英语启蒙，家长关注品牌口碑',
    motherOccupation: '互联网产品经理',
    motherSocialCircleEducation: '同事圈/本科',
    motherCompanionTime: '工作日晚上陪伴，周末可到校沟通',
    fatherOccupation: '工程师',
    fatherSocialCircleEducation: '同学圈/本科',
    fatherCompanionTime: '周末陪伴较多',
    caregivingMode: '父母自带，外婆辅助',
    siblingRank: '独生女',
    primaryCaregiver: '妈妈',
    householdMembers: '父母、外婆同住',
    purchaseDecisionPower: '妈妈主决策，爸爸关注费用',
    decisionInterviewTime: '周六上午或周日傍晚',
    works: 12,
    highlights: 2
  },
  {
    id: 2,
    name: '浩浩',
    nickname: '浩浩',
    age: 7,
    parent: '浩浩爸爸',
    phone: '136****8821',
    classId: 1,
    status: '在读',
    note: '想象力丰富，细节刻画需要引导',
    residentialCommunity: '星河湾',
    schoolName: '实验小学',
    trainingBrandInterest: '机器人、围棋，对动手类课程兴趣高',
    motherOccupation: '银行客户经理',
    motherSocialCircleEducation: '客户圈/本科',
    motherCompanionTime: '工作日接送不稳定，周末可陪同',
    fatherOccupation: '个体经营',
    fatherSocialCircleEducation: '朋友创业圈/大专',
    fatherCompanionTime: '时间弹性，常负责接送',
    caregivingMode: '父亲接送为主',
    siblingRank: '两个孩子中的哥哥',
    primaryCaregiver: '爸爸',
    householdMembers: '父母、妹妹同住',
    purchaseDecisionPower: '父母共同决策，妈妈更关注学习效果',
    decisionInterviewTime: '工作日 19:30 后',
    works: 9,
    highlights: 1
  },
  {
    id: 3,
    name: '安安',
    nickname: '安安',
    age: 6,
    parent: '安安妈妈',
    phone: '139****0032',
    classId: 1,
    status: '在读',
    note: '构图稳定，适合增加画面层次训练',
    works: 15,
    highlights: 4
  },
  {
    id: 4,
    name: '米米',
    nickname: '米米',
    age: 5,
    parent: '米米妈妈',
    phone: '137****6158',
    classId: 1,
    status: '请假',
    note: '观察认真，线条控制进步明显',
    works: 7,
    highlights: 0
  },
  {
    id: 5,
    name: '小宇',
    nickname: '小宇',
    age: 8,
    parent: '小宇妈妈',
    phone: '135****7610',
    classId: 2,
    status: '在读',
    note: '线描基础较好，需要加强主题表达',
    works: 18,
    highlights: 3
  }
]

export const communicationRecords = [
  {
    id: 1,
    studentId: 1,
    contactPerson: '彤彤妈妈',
    contactRole: '母亲',
    contactMethod: '微信',
    content: '沟通本月作品整理情况，家长希望后续多保留孩子创作过程照片，便于发朋友圈和家庭纪念。',
    followUpAction: '下节课补拍 2 张过程照，并在课评里强调色彩表达进步。',
    recordedBy: '林老师',
    recordedAt: '2026/7/23 19:42:00',
    updatedAt: ''
  },
  {
    id: 2,
    studentId: 1,
    contactPerson: '彤彤妈妈',
    contactRole: '母亲',
    contactMethod: '到店沟通',
    content: '家长反馈孩子近期在家主动画画次数增加，对向日葵主题很有兴趣。',
    followUpAction: '',
    recordedBy: '王教务',
    recordedAt: '2026/7/18 11:20:00',
    updatedAt: ''
  },
  {
    id: 3,
    studentId: 2,
    contactPerson: '浩浩爸爸',
    contactRole: '父亲',
    contactMethod: '电话',
    content: '确认暑期班时间安排，爸爸更关注课程动手性和孩子课堂专注度。',
    followUpAction: '下次课后发送课堂专注表现摘要，便于家长判断续报。',
    recordedBy: '林老师',
    recordedAt: '2026/7/21 20:05:00',
    updatedAt: ''
  }
]

export const classes = [
  {
    id: 1,
    name: '周二创想班',
    time: '每周二 17:40',
    teacherId: 1,
    teacher: '林老师',
    group: '家长微信群：周二创想班',
    status: '开班中',
    studentIds: [1, 2, 3, 4],
    courseId: 1
  },
  {
    id: 2,
    name: '线描提高班',
    time: '每周三 19:20',
    teacherId: 1,
    teacher: '林老师',
    group: '家长微信群：线描提高班',
    status: '开班中',
    studentIds: [5],
    courseId: 3
  },
  {
    id: 3,
    name: '幼儿启蒙班',
    time: '每周四 18:30',
    teacherId: 2,
    teacher: '周老师',
    group: '家长微信群：幼儿启蒙班',
    status: '开班中',
    studentIds: [4],
    courseId: 2
  }
]

export const courses = [
  {
    id: 1,
    title: '夏日向日葵',
    age: '5-7岁',
    goal: '认识暖色系，学习主体和背景的关系',
    materials: '水彩笔、勾线笔、素描纸',
    reference: '引导孩子观察花盘、花瓣和叶片的形态差异，鼓励用暖色表达夏天的明亮感觉。',
    defaultFocus: '色彩',
    commentTemplate: '温暖亲切版',
    imageTemplate: '家长展示标准版',
    onlineLinks: ['向日葵色彩延伸课', '暖色系观察练习']
  },
  {
    id: 2,
    title: '彩色小鱼',
    age: '4-6岁',
    goal: '练习形状组合和颜色搭配',
    materials: '油画棒、彩纸、胶棒',
    reference: '低龄段重点鼓励表达，帮助孩子用圆形、三角形组合出鱼身和鱼鳍。',
    defaultFocus: '想象力',
    commentTemplate: '低龄鼓励版',
    imageTemplate: '作品档案版',
    onlineLinks: ['海底世界亲子练习']
  },
  {
    id: 3,
    title: '城市建筑',
    age: '7-9岁',
    goal: '训练线条秩序和建筑层次',
    materials: '针管笔、马克笔、素描纸',
    reference: '关注建筑的高低变化、窗户秩序和前后空间，适合用专业简洁口吻反馈。',
    defaultFocus: '构图',
    commentTemplate: '专业简洁版',
    imageTemplate: '内部归档版',
    onlineLinks: ['线描建筑进阶课']
  }
]

export const externalLinks = [
  { id: 1, title: '向日葵色彩延伸课', url: 'https://example.com/sunflower-color', platform: '创客匠人', note: '适合 5-7 岁课后复习', courseIds: [1], status: '启用' },
  { id: 2, title: '暖色系观察练习', url: 'https://example.com/warm-color', platform: '通用链接', note: '亲子 10 分钟观察任务', courseIds: [1], status: '启用' },
  { id: 3, title: '海底世界亲子练习', url: 'https://example.com/fish', platform: '创客匠人', note: '低龄形状组合练习', courseIds: [2], status: '启用' },
  { id: 4, title: '线描建筑进阶课', url: 'https://example.com/city-line', platform: '通用链接', note: '适合线描提高班', courseIds: [3], status: '启用' }
]

export const templates = {
  image: [
    { name: '家长展示标准版', ratio: '4:5', brightness: '+15%', watermark: '右下角校区水印', border: '米白作品框', crop: '居中裁切', quality: '高清', status: '启用' },
    { name: '内部归档版', ratio: '1:1', brightness: '+10%', watermark: '课程名+老师名', border: '无边框', crop: '主体居中', quality: '标准', status: '启用' },
    { name: '作品档案版', ratio: '原比例', brightness: '不调整', watermark: '隐藏水印', border: '原图保留', crop: '不裁切', quality: '原图', status: '启用' }
  ],
  comment: [
    { name: '温暖亲切版', tone: '像微信语音一样自然', length: '60-80字', structure: '亮点、建议、鼓励', taboo: '不夸大、不排名、不使用负面标签', sample: '今天色彩选择很大胆，下次可以让背景更透气。', status: '启用' },
    { name: '低龄鼓励版', tone: '更软、更具体', length: '50-70字', structure: '投入状态、具体动作、鼓励', taboo: '少建议，多鼓励', sample: '今天很愿意尝试颜色，老师看到他一直很投入。', status: '启用' },
    { name: '专业简洁版', tone: '适合高龄段家长', length: '80-100字', structure: '课程目标、完成度、下一步', taboo: '避免口语过多', sample: '本节课能围绕主题完成主体表达，下一步关注画面层次。', status: '启用' }
  ],
  prompt: [
    { name: '1v1 课评生成', model: '学生记录 + 课程参考 + 模板规则', scene: 'feedback', systemPrompt: '你是少儿美术老师助手，生成自然、具体、适合家长阅读的课评。', userPrompt: '学生：{{student}}；课程：{{course}}；课堂记录：{{record}}；模板：{{template}}', temperature: 0.7, maxTokens: 220, status: '启用' },
    { name: '作品美化提示词', model: '保留原作笔触，轻微提亮和裁切', scene: 'image', systemPrompt: '保留儿童原作笔触，不重绘主体，仅做轻微校正。', userPrompt: '按 {{imageTemplate}} 处理作品，输出处理图供老师确认。', temperature: 0.3, maxTokens: 120, status: '启用' }
  ]
}

export const tasks = [
  {
    id: 1,
    date: '6月21日',
    dateValue: '2026-06-21',
    time: '17:40',
    classId: 1,
    courseId: 1,
    teacher: '林老师',
    lessonType: '收费课',
    status: '处理中',
    wheatStatus: '未生成',
    importedFrom: '小麦课表复制',
    shareGenerated: false,
    archived: false
  },
  {
    id: 2,
    date: '6月21日',
    dateValue: '2026-06-21',
    time: '18:30',
    classId: 3,
    courseId: 2,
    teacher: '周老师',
    lessonType: '体验课',
    status: '已完成',
    wheatStatus: '异常',
    importedFrom: '手动补录',
    shareGenerated: false,
    archived: true,
    archiveVersion: 1
  },
  {
    id: 3,
    date: '6月21日',
    dateValue: '2026-06-21',
    time: '19:20',
    classId: 2,
    courseId: 3,
    teacher: '林老师',
    lessonType: '免费课',
    status: '待处理',
    wheatStatus: '未生成',
    importedFrom: '小麦 Excel 导入',
    shareGenerated: false,
    archived: false
  },
  {
    id: 4,
    date: '7月27日',
    dateValue: '2026-07-27',
    time: '14:00',
    classId: 1,
    courseId: 1,
    teacher: '林老师',
    lessonType: '收费课',
    status: '已完成',
    wheatStatus: '待处理',
    importedFrom: '小麦课表复制',
    shareGenerated: true,
    archived: true,
    archiveVersion: 1
  },
  {
    id: 5,
    date: '7月27日',
    dateValue: '2026-07-27',
    time: '16:30',
    classId: 2,
    courseId: 3,
    teacher: '林老师',
    lessonType: '收费课',
    status: '处理中',
    wheatStatus: '未生成',
    importedFrom: '小麦 Excel 导入',
    shareGenerated: false,
    archived: false
  },
  {
    id: 6,
    date: '7月27日',
    dateValue: '2026-07-27',
    time: '18:30',
    classId: 3,
    courseId: 2,
    teacher: '周老师',
    lessonType: '体验课',
    status: '待处理',
    wheatStatus: '未生成',
    importedFrom: '手动补录',
    shareGenerated: false,
    archived: false
  },
  {
    id: 7,
    date: '7月27日',
    dateValue: '2026-07-27',
    time: '19:40',
    classId: 3,
    courseId: 2,
    teacher: '周老师',
    lessonType: '免费课',
    status: '异常',
    wheatStatus: '未生成',
    importedFrom: '临时班级补录',
    shareGenerated: false,
    archived: false,
    exceptionType: '素材缺失',
    exceptionReason: '课堂视频未上传，等待老师补齐'
  }
]

export const qualityReviews = [
  {
    id: 1,
    lessonId: 2,
    teacher: '周老师',
    reviewer: '王教务',
    score: 8,
    comment: '体验课反馈完整，作品归档已完成；小麦消课异常需要当天跟进。',
    status: '已评分',
    reviewedAt: '2026/6/21 20:12:00'
  },
  {
    id: 2,
    lessonId: 4,
    teacher: '林老师',
    reviewer: '王教务',
    score: 9,
    comment: '课评具体，家长展示内容清楚，课效图可直接进入月度归档。',
    status: '已评分',
    reviewedAt: '2026/7/27 15:35:00'
  }
]

export const sessionSeed = {
  1: {
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=720&q=80',
    record: '向日葵，用色大胆，叶子形态有进步，下次注意背景留白',
    focus: '色彩'
  },
  2: {
    image: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=720&q=80',
    record: '恐龙世界，想象力丰富，涂色比以前均匀，爪子细节可以更细致',
    focus: '想象力'
  },
  3: {
    image: 'https://images.unsplash.com/photo-1456086272160-b28b0645b729?auto=format&fit=crop&w=720&q=80',
    record: '海底世界，构图完整，小鱼排列有节奏，水草层次可以再丰富',
    focus: '构图'
  },
  4: {
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=720&q=80',
    record: '彩色小鱼，颜色选择很活泼，鱼鳍形状有进步，背景气泡可以再丰富',
    focus: '细节'
  },
  5: {
    image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0ea?auto=format&fit=crop&w=720&q=80',
    record: '城市建筑，线条秩序稳定，楼房层次清楚，窗户比例可以再统一',
    focus: '构图'
  }
}

export const initialSessionStudents = [
  {
    id: 1,
    attendance: '到课',
    originalImage: sessionSeed[1].image,
    processedImage: '',
    imageProcessStatus: '未处理',
    imageProcessError: '',
    image: sessionSeed[1].image,
    imageMatched: true,
    processed: false,
    imageConfirmed: false,
    record: sessionSeed[1].record,
    focus: sessionSeed[1].focus,
    comment: '',
    confirmed: false,
    highlight: true,
    highlightNote: '色彩明亮，花瓣层次清楚，适合做本节课高光展示。',
    shareReady: false,
    archived: false
  },
  {
    id: 2,
    attendance: '到课',
    originalImage: sessionSeed[2].image,
    processedImage: '',
    imageProcessStatus: '未处理',
    imageProcessError: '',
    image: sessionSeed[2].image,
    imageMatched: true,
    processed: false,
    imageConfirmed: false,
    record: sessionSeed[2].record,
    focus: sessionSeed[2].focus,
    comment: '',
    confirmed: false,
    highlight: false,
    highlightNote: '',
    shareReady: false,
    archived: false
  },
  {
    id: 3,
    attendance: '到课',
    originalImage: sessionSeed[3].image,
    processedImage: '',
    imageProcessStatus: '未处理',
    imageProcessError: '',
    image: sessionSeed[3].image,
    imageMatched: true,
    processed: false,
    imageConfirmed: false,
    record: sessionSeed[3].record,
    focus: sessionSeed[3].focus,
    comment: '',
    confirmed: false,
    highlight: false,
    highlightNote: '',
    shareReady: false,
    archived: false
  },
  {
    id: 4,
    attendance: '请假',
    originalImage: sessionSeed[4].image,
    processedImage: '',
    imageProcessStatus: '未处理',
    imageProcessError: '',
    image: sessionSeed[4].image,
    imageMatched: false,
    processed: false,
    imageConfirmed: false,
    record: '',
    focus: sessionSeed[4].focus,
    comment: '',
    confirmed: false,
    highlight: false,
    highlightNote: '',
    shareReady: false,
    archived: false
  }
]

export const aiCallLogs = [
  { id: 1, time: '6月21日 15:42', type: '图片处理', target: '彤彤', status: '成功', retry: 0, cost: '0.012', message: '生成处理图，等待老师确认' },
  { id: 2, time: '6月21日 15:43', type: '课评生成', target: '全班', status: '成功', retry: 0, cost: '0.018', message: '生成 3 条 1v1 课评' },
  { id: 3, time: '6月21日 15:44', type: '图片处理', target: '浩浩', status: '失败', retry: 1, cost: '0.000', message: '图片过暗，接口返回质量不足' }
]

export const lessonMaterials = [
  {
    id: 1,
    type: '范画',
    title: '向日葵完整范画',
    image: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=720&q=80',
    visible: true,
    libraryId: 1
  },
  {
    id: 2,
    type: '步骤图',
    title: '花盘和花瓣分步示意',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=720&q=80',
    visible: true,
    libraryId: 2
  }
]

export const artworkLibrary = [
  { id: 1, type: '范画', title: '向日葵完整范画', theme: '花卉植物', age: '5-7岁', uploader: '林老师', usage: 8, image: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=720&q=80' },
  { id: 2, type: '步骤图', title: '花盘和花瓣分步示意', theme: '花卉植物', age: '5-7岁', uploader: '周老师', usage: 5, image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=720&q=80' },
  { id: 3, type: '范画', title: '海底世界色彩范画', theme: '动物世界', age: '4-6岁', uploader: '周老师', usage: 11, image: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=720&q=80' },
  { id: 4, type: '范画', title: '城市建筑线描示例', theme: '建筑空间', age: '7-9岁', uploader: '林老师', usage: 6, image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=720&q=80' }
]

export const homeworkSeed = {
  content: '回家观察一种暖色系植物，和家长说一说主体、背景分别在哪里。',
  requirement: '可拍一张观察照片，下节课前发给老师即可。',
  dueDate: '6月24日',
  externalLinkIds: [],
  visible: true
}

export const displayConfigSeed = {
  showMaterials: true,
  showHomework: true,
  showHighlight: true,
  showLessonType: true,
  accessPolicy: '链接密钥访问',
  expiresInDays: 30,
  expiresAt: '2026年7月21日 23:59',
  allowForward: false,
  publicStatus: '待发布'
}

export const archives = [
  {
    id: 1,
    date: '6月9日',
    dateValue: '2026-06-09',
    className: '周二创想班',
    course: '森林里的小屋',
    works: 8,
    comments: 8,
    highlights: 2,
    teacher: '林老师',
    wheatStatus: '已人工处理'
  },
  {
    id: 2,
    date: '6月12日',
    dateValue: '2026-06-12',
    className: '线描提高班',
    course: '老街房子',
    works: 6,
    comments: 6,
    highlights: 1,
    teacher: '林老师',
    wheatStatus: '已人工处理'
  }
]

export const archiveRecords = [
  {
    id: 1,
    date: '6月9日',
    dateValue: '2026-06-09',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '森林里的小屋',
    lessonType: '收费课',
    studentId: 1,
    studentName: '彤彤',
    artwork: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 2400,
    pixelHeight: 1800,
    title: '彤彤的森林小屋',
    description: '以暖色调表现森林中的小屋和树木层次。',
    tags: ['暖色', '空间层次'],
    note: '适合作为阶段成长记录。',
    feedback: '彤彤今天能把小屋主体画得很稳定，色彩搭配温暖，背景树木也有层次。下次可以继续注意前后空间。',
    homework: '回家观察一种小房子的屋顶形状，下节课分享。',
    highlight: true,
    highlightNote: '主体突出，暖色背景完整，是本节课优秀作品。',
    framed: true,
    framedAt: '2026-06-20',
    frameFee: 120,
    framerId: 1,
    framerName: '林老师',
    frameNote: '原木色画框，已完成交付。',
    updatedBy: '林老师',
    updatedAt: '2026/6/20 18:30:00',
    shareUrl: 'https://share.xinghe-art.local/student-archive-1',
    collectionIds: [1],
    wheatStatus: '已人工处理'
  },
  {
    id: 2,
    date: '6月9日',
    dateValue: '2026-06-09',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '森林里的小屋',
    lessonType: '收费课',
    studentId: 2,
    studentName: '浩浩',
    artwork: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 1500,
    pixelHeight: 1125,
    title: '浩浩的森林小屋',
    description: '围绕小屋、树林和小路完成的故事画。',
    tags: ['故事画'],
    note: '',
    feedback: '浩浩今天的小屋故事感很强，能主动增加树和小路。建议后续把门窗比例画得更清楚。',
    homework: '用铅笔画一条从家门口出发的小路。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-2',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 3,
    date: '6月12日',
    dateValue: '2026-06-12',
    time: '19:20',
    classId: 2,
    className: '线描提高班',
    teacher: '林老师',
    course: '老街房子',
    lessonType: '收费课',
    studentId: 5,
    studentName: '小宇',
    artwork: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0ea?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 3000,
    pixelHeight: 2250,
    title: '老街房子',
    description: '线描建筑练习，重点表现建筑高低和窗户秩序。',
    tags: ['线描', '建筑'],
    note: '已入选六月成长作品集。',
    feedback: '小宇本节课线条秩序很好，建筑高低关系清楚。下一步可以继续加强窗户细节的统一。',
    homework: '拍一张街边建筑照片，观察窗户排列规律。',
    highlight: true,
    highlightNote: '线条稳定，建筑层次完整，适合作为线描高光案例。',
    framed: true,
    framedAt: '2026-06-24',
    frameFee: 80,
    framerId: null,
    framerName: '城南装裱店',
    frameNote: '黑色窄边框。',
    updatedBy: '王教务',
    updatedAt: '2026/6/24 15:12:00',
    shareUrl: 'https://share.xinghe-art.local/student-archive-3',
    collectionIds: [2],
    wheatStatus: '已人工处理'
  },
  {
    id: 4,
    date: '6月18日',
    dateValue: '2026-06-18',
    time: '18:30',
    classId: 3,
    className: '幼儿启蒙班',
    teacher: '周老师',
    course: '彩色小鱼',
    lessonType: '体验课',
    studentId: 4,
    studentName: '米米',
    artwork: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 900,
    pixelHeight: 675,
    title: '彩色小鱼',
    description: '幼儿色彩启蒙作品。',
    tags: ['色彩', '启蒙'],
    note: '',
    feedback: '米米今天观察很认真，鱼鳍和气泡都画得很可爱。后续可以多鼓励她大胆选择颜色。',
    homework: '和家长一起找三种喜欢的鱼颜色。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-4',
    collectionIds: [],
    wheatStatus: '异常'
  },
  {
    id: 5,
    date: '4月14日',
    dateValue: '2026-04-14',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '春天的花园',
    lessonType: '收费课',
    studentId: 1,
    studentName: '彤彤',
    artwork: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 2600,
    pixelHeight: 1950,
    title: '彤彤的春天花园',
    description: '第一次尝试用暖色和冷色区分花丛和天空。',
    tags: ['色彩'],
    note: '',
    feedback: '彤彤今天愿意尝试更多颜色，花丛的层次比上次清楚。下一步可以关注天空和地面的衔接。',
    homework: '回家找一朵真花，观察花瓣的方向。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-5',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 6,
    date: '4月28日',
    dateValue: '2026-04-28',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '海底世界',
    lessonType: '收费课',
    studentId: 1,
    studentName: '彤彤',
    artwork: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 3000,
    pixelHeight: 2250,
    title: '彤彤的海底世界',
    description: '用水草和气泡把画面分成前后两层。',
    tags: ['构图', '色彩'],
    note: '',
    feedback: '彤彤这节课主动给小鱼加上了水草和气泡，画面开始有前后关系。继续保持这种观察。',
    homework: '和家长一起看一段海洋纪录片。',
    highlight: true,
    highlightNote: '第一次主动处理画面前后层次，是明显的进步节点。',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-6',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 7,
    date: '5月12日',
    dateValue: '2026-05-12',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '我的家',
    lessonType: '收费课',
    studentId: 1,
    studentName: '彤彤',
    artwork: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 1200,
    pixelHeight: 900,
    title: '彤彤画的家',
    description: '房子、院子和家人一起出现在画面里。',
    tags: ['故事画'],
    note: '',
    feedback: '彤彤今天把家人也画进了画面，故事感很足。房子的门窗比例可以再对照观察一下。',
    homework: '数一数自己家有几扇窗户。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-7',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 8,
    date: '5月26日',
    dateValue: '2026-05-26',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '夏日向日葵',
    lessonType: '收费课',
    studentId: 1,
    studentName: '彤彤',
    artwork: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 2400,
    pixelHeight: 1800,
    title: '彤彤的向日葵',
    description: '花盘的螺旋结构画得很认真。',
    tags: ['观察', '色彩'],
    note: '',
    feedback: '彤彤这节课对花盘的观察特别细，愿意慢下来画细节。背景可以再留一些呼吸的空间。',
    homework: '给家里的植物拍一张照片。',
    highlight: true,
    highlightNote: '观察细节的耐心明显提升，花盘结构画得比同龄孩子清楚。',
    framed: true,
    framedAt: '2026-06-02',
    frameFee: 100,
    framerId: 1,
    framerName: '林老师',
    frameNote: '原木框，已交付家长。',
    updatedBy: '林老师',
    updatedAt: '2026/6/2 19:20:00',
    shareUrl: 'https://share.xinghe-art.local/student-archive-8',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 9,
    date: '4月28日',
    dateValue: '2026-04-28',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '海底世界',
    lessonType: '收费课',
    studentId: 2,
    studentName: '浩浩',
    artwork: 'https://images.unsplash.com/photo-1456086272160-b28b0645b729?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 2200,
    pixelHeight: 1650,
    title: '浩浩的深海怪兽',
    description: '在海底世界主题里加入了自己想象的怪兽。',
    tags: ['想象力'],
    note: '',
    feedback: '浩浩的想象力很足，愿意在主题里加自己的角色。下一步可以把主角画得更完整一些。',
    homework: '给自己的怪兽起个名字，讲给家长听。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-9',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 10,
    date: '5月26日',
    dateValue: '2026-05-26',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '夏日向日葵',
    lessonType: '收费课',
    studentId: 2,
    studentName: '浩浩',
    artwork: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 1600,
    pixelHeight: 1200,
    title: '浩浩的向日葵田',
    description: '一整片向日葵，注意到了近大远小。',
    tags: ['构图'],
    note: '',
    feedback: '浩浩这节课画了一整片向日葵，开始注意近大远小。涂色比之前均匀很多。',
    homework: '观察路边的树，哪棵看起来更大。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-10',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 11,
    date: '5月12日',
    dateValue: '2026-05-12',
    time: '17:40',
    classId: 1,
    className: '周二创想班',
    teacher: '林老师',
    course: '我的家',
    lessonType: '收费课',
    studentId: 3,
    studentName: '安安',
    artwork: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 2800,
    pixelHeight: 2100,
    title: '安安的小院子',
    description: '院子里的物件摆放很有秩序。',
    tags: ['构图'],
    note: '',
    feedback: '安安的画面一直很稳定，这次院子里的物件摆放也很有秩序。可以尝试增加一点色彩变化。',
    homework: '给院子里的植物数一数颜色。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-11',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 12,
    date: '5月27日',
    dateValue: '2026-05-27',
    time: '19:20',
    classId: 2,
    className: '线描提高班',
    teacher: '林老师',
    course: '城市建筑',
    lessonType: '收费课',
    studentId: 5,
    studentName: '小宇',
    artwork: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 3200,
    pixelHeight: 2400,
    title: '小宇的天际线',
    description: '高低错落的建筑群线描练习。',
    tags: ['线描', '建筑'],
    note: '',
    feedback: '小宇这节课的建筑高低关系处理得很好，线条也保持得住。下一步注意窗户排列的节奏。',
    homework: '拍一张街景，找出最高的三栋楼。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '',
    updatedAt: '',
    shareUrl: 'https://share.xinghe-art.local/student-archive-12',
    collectionIds: [],
    wheatStatus: '已人工处理'
  },
  {
    id: 13,
    lessonId: 2,
    date: '6月24日',
    dateValue: '2026-06-24',
    time: '课外',
    classId: 3,
    className: '幼儿启蒙班',
    teacher: '周老师',
    course: '课外小作品补充归档',
    lessonType: '课外作品',
    studentId: 4,
    studentName: '米米',
    artwork: 'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?auto=format&fit=crop&w=720&q=80',
    pixelWidth: 1800,
    pixelHeight: 1350,
    title: '米米的课外小鱼练习',
    description: '家长发来的居家延伸练习，孩子补充了鱼身纹理和气泡。',
    tags: ['课外作品', '亲子练习'],
    note: '由周老师在课外任务中补录归档。',
    feedback: '',
    homework: '家长可上传孩子在家完成的小鱼延伸作品，老师确认后归入学生课外作品档案。',
    highlight: false,
    highlightNote: '',
    framed: false,
    framedAt: '',
    frameFee: 0,
    framerId: null,
    framerName: '',
    frameNote: '',
    updatedBy: '周老师',
    updatedAt: '2026/6/24 20:10:00',
    shareUrl: '',
    collectionIds: [],
    wheatStatus: '无需处理',
    storageTarget: '系统作品档案',
    sourceType: 'extraTask',
    archiveCategory: '课外作品',
    extraTaskId: 2,
    extraTaskTitle: '课外小作品补充归档',
    extraTaskStatus: '待归档'
  }
]

export const archiveCollections = [
  {
    id: 1,
    type: '学生成长作品集',
    title: '彤彤 · 春季成长作品集',
    owner: '林老师',
    target: '彤彤妈妈',
    className: '周二创想班',
    createdAt: '6月20日 21:10',
    status: '已发布',
    recordIds: [1],
    link: 'https://share.xinghe-art.local/collections/tongtong-spring',
    intro: '这是彤彤春季阶段里最值得记录的几件作品。',
    summary: '从构图和色彩表达上可以看到彤彤更愿意主动安排画面，也能把主体和背景关系处理得更完整。',
    teacherMessage: '接下来继续鼓励她大胆表达，同时关注画面层次和细节收尾。',
    displayConfig: { showDate: true, showCourse: true, showComment: false, showHighlight: true, showWatermark: true },
    note: '已在家长私聊中发送，可重复复制链接。'
  },
  {
    id: 2,
    type: '学生成长作品集',
    title: '小宇 · 6月成长作品集',
    owner: '林老师',
    target: '小宇妈妈',
    className: '线描提高班',
    createdAt: '6月20日 21:28',
    status: '已发布',
    recordIds: [3],
    link: 'https://share.xinghe-art.local/collections/xiaoyu-june',
    intro: '这是小宇 6 月线描课程中值得记录的作品。',
    summary: '从建筑主题中可以看到小宇在线条秩序、建筑层次和画面耐心上的阶段变化。',
    teacherMessage: '后续可以继续保持稳定的线条控制，并尝试增加更多建筑细节。',
    displayConfig: { showDate: true, showCourse: true, showComment: false, showHighlight: true, showWatermark: true },
    note: '已发给小宇妈妈，可重复复制链接。'
  }
]

export const extraTaskArchives = [
  {
    id: 1,
    title: '一周色彩观察小任务',
    taskType: '亲子观察任务',
    owner: '林老师',
    relatedLessonId: null,
    relatedLesson: '无归属课次',
    content: '请孩子和家长一起在家里找 3 个暖色物品，拍照后说一说它们让自己想到什么画面。',
    dueDate: '6月25日',
    status: '已发布',
    note: ''
  },
  {
    id: 2,
    title: '课外小作品补充归档',
    taskType: '学生课外作品',
    owner: '周老师',
    relatedLessonId: 2,
    relatedLesson: '6月21日 18:30 · 幼儿启蒙班',
    content: '家长可上传孩子在家完成的小鱼延伸作品，老师确认后归入学生课外作品档案。',
    dueDate: '6月28日',
    status: '待归档',
    note: ''
  }
]

export const wheatTraces = [
  {
    id: 1,
    lesson: '6月12日 19:20 · 线描提高班',
    course: '老街房子',
    teacher: '林老师',
    type: '收费课',
    status: '已人工处理',
    source: '课后归档生成',
    note: '已在小麦助教完成消课'
  },
  {
    id: 2,
    lesson: '6月18日 18:30 · 幼儿启蒙班',
    course: '彩色小鱼',
    teacher: '周老师',
    type: '体验课',
    status: '异常',
    source: '课后归档生成',
    note: '小麦课次名称不一致，待教务确认'
  }
]

export const importBatches = [
  { id: 1, source: '小麦 Excel 导入', time: '6月21日 09:18', success: 28, failed: 1, note: '1 名学生缺少班级字段，已手动补录' },
  { id: 2, source: '课表复制粘贴', time: '6月20日 21:42', success: 6, failed: 0, note: '生成 3 个今日课后待办' }
]

export const settings = [
  { id: 1, name: 'AI 接口', value: school.aiProvider, status: '已配置' },
  { id: 2, name: '作品存储', value: school.objectStorage, status: '已启用' },
  { id: 3, name: '账号角色', value: '管理员、老师', status: '基础可用' },
  { id: 4, name: '水印配置', value: school.watermark, status: '已启用' },
  {
    id: 5,
    name: '网盘配置',
    type: 'cloudDrive',
    status: '已启用',
    value: {
      providers: [
        {
          id: 'baidu',
          name: '百度网盘',
          type: '百度网盘',
          authType: 'OAuth2',
          endpoint: 'https://pan.baidu.com/rest/2.0/xpan/file',
          appKey: 'demo-baidu-app-key',
          tokenStatus: '已授权',
          archiveDefault: true,
          enabled: true
        }
      ],
      directoryRule: '校区 / 班级 / 学生 / 年月 / 课程名',
      defaultArchiveTargets: ['baidu']
    }
  },
  {
    id: 6,
    name: '企业微信触达',
    type: 'wecom',
    status: '已启用',
    value: '客户联系触达已配置 · 内部通知群机器人已配置 · 家长群绑定：周二创想班家长群'
  }
]

export const importPreviewRows = [
  { id: 1, type: 'student', name: '可可', nickname: '可可', className: '周二创想班', parent: '可可妈妈', phone: '138****4452', status: '可导入', issue: '' },
  { id: 2, type: 'student', name: '乐乐', nickname: '乐乐', className: '', parent: '乐乐爸爸', phone: '137****2381', status: '异常', issue: '缺少班级字段' },
  { id: 3, type: 'class', name: '周五创想班', teacher: '周老师', time: '每周五 18:30', course: '彩色小鱼', status: '可导入', issue: '' },
  { id: 4, type: 'lesson', name: '6月21日 20:10 体验课', teacher: '林老师', time: '20:10', course: '夏日向日葵', status: '重复', issue: '同班级同时间已存在课次' }
]

export const initialBulkRecord =
  '彤彤：向日葵，用色大胆，叶子形态有进步，下次注意背景留白\n浩浩：恐龙世界，想象力丰富，涂色比以前均匀，爪子细节可以更细致\n安安：海底世界，构图完整，小鱼排列有节奏，水草层次可以再丰富'
