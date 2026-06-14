# 今日简报

每日新闻聚合与 AI 解读应用。项目目标是做一个自用的轻量新闻首页：快速浏览当天新闻，并通过 AI 提供 80 字以内概括和 150 字以内解读。

## README 的作用

本文件用于帮助新接手项目的人快速了解：

- 项目前后端目录结构
- 本地安装依赖和启动命令
- 后续前后端独立改造方案
- 目标接口、刷新策略和部署方式
- 旧版前端代码的归档位置

## 改造目标

当前项目已开始按前后端独立方向改造。前端保留现有 Vue 3 + Vite 结构，后端新增为可独立启动的 `news-api` 项目：

```text
./src/          # Vue 3 + Vite 前端，只负责展示与交互
./news-api/     # Node.js 后端，负责新闻抓取、AI 解读、缓存和接口
```

前端部署后通过相对路径请求 `/api`，生产环境由 Nginx 统一分发：

```text
http://ECS公网IP/        -> 前端静态文件
http://ECS公网IP/api     -> 后端 Node API
```

该方案不依赖域名，适合个人自用和阿里云 ECS 公网 IP 访问。

## 项目结构

当前结构：

```text
news-app/
├─ backend/                 # 后端业务模块
│  ├─ aiInterpreter.js      # AI 解读、短摘要、副标题生成
│  ├─ newsAggregator.js     # 新闻去重、排序、分类统计
│  └─ rssFetcher.js         # RSS 新闻源抓取
├─ data/
│  └─ news.json             # 新闻缓存数据
├─ dist/                    # Vite 生产构建产物
├─ reference/
│  └─ legacy-frontend/      # 旧版原生前端代码归档
├─ src/                     # 新版 Vue 前端源码
│  ├─ api/                  # Axios 请求封装
│  ├─ components/           # 页面组件
│  ├─ composables/          # 组合式业务逻辑
│  ├─ router/               # Vue Router 配置
│  ├─ styles/               # 全局样式
│  ├─ utils/                # 工具函数
│  └─ views/                # 页面级组件
├─ index.html               # Vite 前端入口
├─ news-api/                 # 新版独立后端 API 项目
├─ server.js                # Express 后端服务入口
├─ vite.config.mjs          # Vite 配置
├─ package.json             # 项目依赖与脚本
└─ .env.example             # 环境变量示例
```

新版后端结构：

```text
news-api/
├─ src/
│  ├─ app.js                 # Express 应用入口
│  ├─ config/
│  │  ├─ env.js              # 环境变量读取与校验
│  │  └─ newsSources.js      # 新闻源配置
│  ├─ jobs/
│  │  └─ scheduler.js        # 定时刷新任务
│  ├─ routes/
│  │  ├─ healthRoutes.js     # 健康检查接口
│  │  ├─ newsRoutes.js       # 新闻数据接口
│  │  └─ refreshRoutes.js    # 刷新任务接口
│  ├─ services/
│  │  ├─ aiNewsService.js    # DeepSeek 概括与解读
│  │  ├─ newsCleanService.js # 当天过滤、去重、排序和分类
│  │  ├─ newsFetchService.js # RSS/新闻源抓取
│  │  ├─ newsStoreService.js # 当日缓存读写
│  │  └─ refreshService.js   # 抓取、清洗、AI、存储流水线
│  └─ storage/
│     └─ todayNews.json      # 当日新闻缓存
├─ package.json
└─ .env.example
```

前端保持现有 Vue 3 架构，通过 `/api` 请求新版后端。

## 安装依赖

```bash
npm install
```

## 环境配置

复制环境变量示例文件：

```bash
cp .env.example .env
```

根据需要配置 `PORT`、`DEEPSEEK_API_KEY`、`AI_MODEL` 等变量。新版后端也提供独立示例：

```bash
cp news-api/.env.example news-api/.env
```

敏感信息只允许放在后端 `.env` 或服务器环境变量中，禁止写入前端源码、README 示例值和 Git 仓库。

## 启动项目

开发前端：

```bash
npm run dev
```

启动新版后端：

```bash
npm run dev:api
```

生产构建前端：

```bash
npm run build
```

启动生产服务：

```bash
npm start
```

## 目标接口设计

后续重构时忽略旧接口实现，以以下接口为目标。

### 获取新闻

```text
GET /api/news?category=全部&page=1&pageSize=8
```

说明：

- `category` 支持 `全部`、`国内`、`国际`、`财经`、`科技`
- 后端每类最多保留当天最新 24 条
- 前端每次展示 8 条
- 新闻只展示当天数据

响应示例：

```json
{
  "date": "2026-06-14",
  "updatedAt": "2026-06-14T10:00:00.000Z",
  "isRefreshing": false,
  "categories": ["国内", "国际", "财经", "科技"],
  "pagination": {
    "page": 1,
    "pageSize": 8,
    "total": 24
  },
  "items": [
    {
      "id": "20260614-tech-001",
      "title": "新闻标题",
      "category": "科技",
      "summary": "80字以内一句话概括",
      "interpretation": "150字以内AI解读",
      "source": "36氪",
      "sourceUrl": "https://example.com/news",
      "publishedAt": "2026-06-14T08:30:00.000Z",
      "priority": "P1",
      "aiStatus": "success"
    }
  ]
}
```

### 手动刷新

```text
POST /api/refresh
```

说明：

- 由前端刷新按钮触发
- 如果后端已有刷新任务运行，直接返回当前任务状态
- 后端需要做任务锁和冷却保护，避免重复调用 AI

```text
{
  "taskId": "refresh-20260614-100000",
  "status": "running",
  "message": "刷新任务已启动"
}
```

### 刷新任务状态

```text
GET /api/refresh/status
```

响应示例：

```json
{
  "status": "idle",
  "lastRunAt": "2026-06-14T10:00:00.000Z",
  "nextRunAt": "2026-06-14T12:00:00.000Z",
  "lastError": null
}
```

### 健康检查

```text
GET /api/health
```

用于本地验收、服务器部署和 Nginx 反向代理排查。

## 新闻刷新策略

- 后端定时任务每 2 小时执行一次，cron 表达式建议为 `0 0 */2 * * *`
- 用户进入页面时，前端只请求 `/api/news`
- 如果后端发现当天没有缓存，可以异步启动一次刷新任务
- 手动刷新由 `POST /api/refresh` 触发，但必须避免并发刷新
- 每次刷新开始时检查缓存日期，发现不是当天则清空昨日数据
- AI 失败时保留原始新闻和基础摘要，设置 `aiStatus: "failed"`，前端仍可展示
- 新闻获取由后端程序从可信新闻源抓取，AI 负责筛选、概括和解读，不让 AI 凭空生成新闻

## AI 处理策略

每条新闻最终需要包含：

- 标题：来自原始新闻源
- 一句话概括：AI 生成，控制在 80 字以内
- AI 解读：AI 生成，控制在 150 字以内
- 来源和源地址：用于跳转原文

AI 流程建议异步执行，原因是每类最多 24 条、合计最多 96 条新闻，同步等待全部 AI 处理完成会导致接口超时和页面卡顿。

## 阿里云 ECS 部署方案

个人自用阶段不需要购买域名，直接使用 ECS 公网 IP 即可。

推荐部署方式：

```text
ECS
├─ Nginx
│  ├─ /      -> 前端 dist 静态文件
│  └─ /api   -> 反向代理到 Node 后端 localhost:3000
├─ Node.js
├─ PM2
└─ news-api
```

访问方式：

```text
http://ECS公网IP/
http://ECS公网IP/api/health
```

后端环境变量只放在服务器：

```text
PORT=3000
DEEPSEEK_API_KEY=你的新密钥
AI_MODEL=deepseek-chat
CRON_SCHEDULE=0 0 */2 * * *
MAX_NEWS_PER_CATEGORY=24
```

## 改造步骤

1. 已完成：新增独立 `news-api` 结构，并实现 `/api/health`
2. 已完成：接入当天缓存读写和跨天清理
3. 已完成：迁移新闻源抓取、当天过滤、去重和分类逻辑
4. 已完成：实现 80 字概括和 150 字解读，支持 AI 失败降级
5. 已完成：实现 `/api/news`、`/api/refresh`、`/api/refresh/status`
6. 已完成：前端适配新字段、分页展示 8 条、源地址跳转
7. 待执行：本地验收，确认接口可访问、页面可显示、任务日志正常
8. 待执行：ECS 部署，使用 Nginx 托管前端并代理 `/api` 到后端

## 验收标准

- 本地前端可运行并展示新闻首页
- 本地后端接口可访问
- `/api/news` 能返回当天新闻
- `/api/refresh` 能触发刷新任务
- 定时任务每 2 小时正常执行并输出日志
- 第二天首次刷新会清空昨日数据
- 前端可通过新闻卡片跳转至源地址
- 阿里云 ECS 公网 IP 可访问页面和 `/api/health`

## 旧版前端

旧版原生 `HTML + CSS + JavaScript` 前端已归档到：

```text
reference/legacy-frontend/
```

该目录只用于参考，不参与当前项目构建。
