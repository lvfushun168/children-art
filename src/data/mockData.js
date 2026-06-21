export const navItems = [
  { id: 'tasks', label: '今日课后' },
  { id: 'students', label: '学生' },
  { id: 'classes', label: '班级' },
  { id: 'courses', label: '课程资料' },
  { id: 'templates', label: '模板配置' },
  { id: 'archives', label: '作品档案' },
  { id: 'wheat', label: '小麦留痕' },
  { id: 'settings', label: '系统配置' }
]

export const school = {
  name: '星禾美育',
  campus: '滨江校区',
  storage: 'system://works/2026/06',
  aiProvider: 'OpenAI 图文能力',
  objectStorage: '校区私有作品库',
  watermark: '星禾美育 · 滨江校区'
}

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

export const classes = [
  {
    id: 1,
    name: '周二创想班',
    time: '每周二 17:40',
    teacher: '林老师',
    group: '家长微信群：周二创想班',
    studentIds: [1, 2, 3, 4],
    courseId: 1
  },
  {
    id: 2,
    name: '线描提高班',
    time: '每周三 19:20',
    teacher: '林老师',
    group: '家长微信群：线描提高班',
    studentIds: [5],
    courseId: 3
  },
  {
    id: 3,
    name: '幼儿启蒙班',
    time: '每周四 18:30',
    teacher: '周老师',
    group: '家长微信群：幼儿启蒙班',
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
  { id: 1, title: '向日葵色彩延伸课', url: 'https://example.com/sunflower-color', note: '适合 5-7 岁课后复习' },
  { id: 2, title: '暖色系观察练习', url: 'https://example.com/warm-color', note: '亲子 10 分钟观察任务' },
  { id: 3, title: '海底世界亲子练习', url: 'https://example.com/fish', note: '低龄形状组合练习' },
  { id: 4, title: '线描建筑进阶课', url: 'https://example.com/city-line', note: '适合线描提高班' }
]

export const templates = {
  image: [
    { name: '家长展示标准版', ratio: '4:5', brightness: '+15%', watermark: '右下角校区水印', border: '米白作品框' },
    { name: '内部归档版', ratio: '1:1', brightness: '+10%', watermark: '课程名+老师名', border: '无边框' },
    { name: '作品档案版', ratio: '原比例', brightness: '不调整', watermark: '隐藏水印', border: '原图保留' }
  ],
  comment: [
    { name: '温暖亲切版', tone: '像微信语音一样自然', length: '60-80字', rule: '亮点、建议、鼓励' },
    { name: '低龄鼓励版', tone: '更软、更具体', length: '50-70字', rule: '少建议，多鼓励' },
    { name: '专业简洁版', tone: '适合高龄段家长', length: '80-100字', rule: '课程目标、完成度、下一步' }
  ],
  prompt: [
    { name: '1v1 课评生成', model: '学生记录 + 课程参考 + 模板规则', status: '启用' },
    { name: '作品美化提示词', model: '保留原作笔触，轻微提亮和裁切', status: '启用' }
  ],
  watermark: [
    { name: '校区基础水印', value: school.watermark, status: '启用' },
    { name: '课程名水印', value: '课程主题 + 老师名', status: '可选' }
  ]
}

export const tasks = [
  {
    id: 1,
    date: '6月21日',
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
    id: 3,
    date: '6月21日',
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

export const lessonMaterials = [
  {
    id: 1,
    type: '范画',
    title: '向日葵完整范画',
    image: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=720&q=80',
    visible: true
  },
  {
    id: 2,
    type: '步骤图',
    title: '花盘和花瓣分步示意',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=720&q=80',
    visible: true
  }
]

export const homeworkSeed = {
  content: '回家观察一种暖色系植物，和家长说一说主体、背景分别在哪里。',
  requirement: '可拍一张观察照片，下节课前发给老师即可。',
  dueDate: '6月24日',
  externalLinkIds: [1, 2],
  visible: true
}

export const displayConfigSeed = {
  showMaterials: true,
  showHomework: true,
  showHighlight: true,
  showLessonType: true
}

export const archives = [
  {
    id: 1,
    date: '6月9日',
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
    className: '线描提高班',
    course: '老街房子',
    works: 6,
    comments: 6,
    highlights: 1,
    teacher: '林老师',
    wheatStatus: '已人工处理'
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
    note: '已在小麦标记课程完成'
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
  { id: 4, name: '水印配置', value: school.watermark, status: '已启用' }
]

export const initialBulkRecord =
  '彤彤：向日葵，用色大胆，叶子形态有进步，下次注意背景留白\n浩浩：恐龙世界，想象力丰富，涂色比以前均匀，爪子细节可以更细致\n安安：海底世界，构图完整，小鱼排列有节奏，水草层次可以再丰富'
