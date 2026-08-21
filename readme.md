# 访问地址
- 主站：http://localhost:5173/workspace/artist/library
- 学生展示页：http://localhost:5174/#/share/student/1/1?token=student-demo-1-1
- 课次展示页：http://localhost:5174/#/share/lesson/1?token=lesson-demo-1

工作台使用 history 路由。生产环境的 Nginx/Caddy 需要将非 `/api` 的未知路径回退到 `index.html`，否则直接刷新 `/workspace/...` 页面会被静态服务器判定为 404；现有 `#/share/...` 家长分享链接继续使用 hash 路由。

常用工作区地址：
- 首页：`/workspace/artist/library`
- 今日课后：`/workspace/after-class/tasks`
- 课次工作区：`/workspace/after-class/tasks/:lessonId?source=today|schedule`
