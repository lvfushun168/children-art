# 访问地址
- 主站：http://localhost:5173/workspace/artist/library
- 学生展示页：http://localhost:5174/#/share/student/1/1?token=student-demo-1-1
- 课次展示页：http://localhost:5174/#/share/lesson/1?token=lesson-demo-1

工作台使用 history 路由。生产环境的 Nginx/Caddy 需要将非 `/api` 的未知路径回退到 `index.html`，否则直接刷新 `/workspace/...` 页面会被静态服务器判定为 404；现有 `#/share/...` 家长分享链接继续使用 hash 路由。

常用工作区地址：
- 首页：`/workspace/artist/library`
- 今日课后：`/workspace/after-class/tasks`
- 课次工作区：`/workspace/after-class/tasks/:lessonId?source=today|schedule`

## 部署地址配置

前端通过 `VITE_API_BASE_URL` 指向后端 API，生产环境应包含 `/api/v1` 前缀；本地开发时可以继续使用 Vite 代理。

```bash
VITE_API_BASE_URL=https://api.example.com/api/v1
VITE_API_PROXY_TARGET=http://localhost:8080
```

百度 OAuth 使用的前端回跳地址和后端公开地址在系统设置的【网盘配置】中维护，不通过百度相关环境变量配置。前端构建只需要通过 `VITE_API_BASE_URL` 指向当前后端 API。
