export const navItems = [
  { id: 'tasks', label: '今日任务' },
  { id: 'students', label: '学生' },
  { id: 'classes', label: '班级' },
  { id: 'courses', label: '课程' },
  { id: 'templates', label: '模板' },
  { id: 'archives', label: '作品档案' },
  { id: 'channels', label: '分发通道' }
]

export const school = {
  name: '星禾美育',
  campus: '滨江校区',
  storage: 'system://works/2026/06'
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
    works: 12
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
    works: 9
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
    works: 15
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
    works: 7
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
    works: 18
  }
]

export const classes = [
  {
    id: 1,
    name: '周二创想班',
    time: '每周二 17:40',
    teacher: '林老师',
    group: '家长微信群：周二创想班',
    internalGroup: '企微课效群：滨江美术课效',
    studentIds: [1, 2, 3, 4],
    courseId: 1
  },
  {
    id: 2,
    name: '线描提高班',
    time: '每周三 19:20',
    teacher: '林老师',
    group: '家长微信群：线描提高班',
    internalGroup: '企微课效群：滨江美术课效',
    studentIds: [5],
    courseId: 3
  },
  {
    id: 3,
    name: '幼儿启蒙班',
    time: '每周四 18:30',
    teacher: '周老师',
    group: '家长微信群：幼儿启蒙班',
    internalGroup: '企微课效群：滨江美术课效',
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
    defaultFocus: '色彩',
    commentTemplate: '温暖亲切版',
    imageTemplate: '家长群标准版'
  },
  {
    id: 2,
    title: '彩色小鱼',
    age: '4-6岁',
    goal: '练习形状组合和颜色搭配',
    materials: '油画棒、彩纸、胶棒',
    defaultFocus: '想象力',
    commentTemplate: '低龄鼓励版',
    imageTemplate: '作品档案版'
  },
  {
    id: 3,
    title: '城市建筑',
    age: '7-9岁',
    goal: '训练线条秩序和建筑层次',
    materials: '针管笔、马克笔、素描纸',
    defaultFocus: '构图',
    commentTemplate: '专业简洁版',
    imageTemplate: '内部课效版'
  }
]

export const templates = {
  image: [
    { name: '家长群标准版', ratio: '4:5', brightness: '+15%', watermark: '右下角校区水印', border: '米白作品框' },
    { name: '内部课效版', ratio: '1:1', brightness: '+10%', watermark: '课程名+老师名', border: '无边框' },
    { name: '作品档案版', ratio: '原比例', brightness: '不调整', watermark: '隐藏水印', border: '原图保留' }
  ],
  comment: [
    { name: '温暖亲切版', tone: '像微信语音一样自然', length: '60-80字', rule: '亮点、建议、鼓励' },
    { name: '低龄鼓励版', tone: '更软、更具体', length: '50-70字', rule: '少建议，多鼓励' },
    { name: '专业简洁版', tone: '适合高龄段家长', length: '80-100字', rule: '课程目标、完成度、下一步' }
  ]
}

export const channels = [
  { id: 1, name: '家长微信群', type: '辅助复制', target: '周二创想班家长群', status: '可用', risk: '个人微信不做自动群发' },
  { id: 2, name: '企业微信课效群', type: 'Webhook', target: '滨江美术课效', status: '已连接', risk: '可自动推送合集' },
  { id: 3, name: '系统作品库', type: '对象存储', target: school.storage, status: '已启用', risk: '形成平台资产' },
  { id: 4, name: '百度网盘备份', type: '开放接口', target: '星禾美育/课后作品', status: '待授权', risk: '作为外部备份' }
]

export const tasks = [
  {
    id: 1,
    date: '6月16日',
    time: '17:40',
    classId: 1,
    courseId: 1,
    teacher: '林老师',
    status: '处理中',
    recordsImported: false,
    imagesProcessed: false,
    commentsGenerated: false,
    distributed: false,
    archived: false
  },
  {
    id: 2,
    date: '6月16日',
    time: '18:30',
    classId: 3,
    courseId: 2,
    teacher: '周老师',
    status: '待处理',
    recordsImported: false,
    imagesProcessed: false,
    commentsGenerated: false,
    distributed: false,
    archived: false
  },
  {
    id: 3,
    date: '6月16日',
    time: '19:20',
    classId: 2,
    courseId: 3,
    teacher: '林老师',
    status: '待处理',
    recordsImported: false,
    imagesProcessed: false,
    commentsGenerated: false,
    distributed: false,
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
    record: sessionSeed[1].record,
    focus: sessionSeed[1].focus,
    comment: '',
    confirmed: false,
    delivered: false,
    archived: false
  },
  {
    id: 2,
    attendance: '到课',
    image: sessionSeed[2].image,
    imageMatched: true,
    processed: false,
    record: sessionSeed[2].record,
    focus: sessionSeed[2].focus,
    comment: '',
    confirmed: false,
    delivered: false,
    archived: false
  },
  {
    id: 3,
    attendance: '到课',
    image: sessionSeed[3].image,
    imageMatched: true,
    processed: false,
    record: sessionSeed[3].record,
    focus: sessionSeed[3].focus,
    comment: '',
    confirmed: false,
    delivered: false,
    archived: false
  },
  {
    id: 4,
    attendance: '请假',
    image: sessionSeed[4].image,
    imageMatched: false,
    processed: false,
    record: '',
    focus: sessionSeed[4].focus,
    comment: '',
    confirmed: false,
    delivered: false,
    archived: false
  }
]

export const archives = [
  { id: 1, date: '6月9日', className: '周二创想班', course: '森林里的小屋', works: 8, comments: 8, teacher: '林老师' },
  { id: 2, date: '6月12日', className: '线描提高班', course: '老街房子', works: 6, comments: 6, teacher: '林老师' }
]

export const initialBulkRecord =
  '彤彤：向日葵，用色大胆，叶子形态有进步，下次注意背景留白\n浩浩：恐龙世界，想象力丰富，涂色比以前均匀，爪子细节可以更细致\n安安：海底世界，构图完整，小鱼排列有节奏，水草层次可以再丰富'
