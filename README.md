# 今日简报

今日简报是一个个人自用的新闻聚合与 AI 解读应用。前端负责快速浏览、分类切换、搜索、详情阅读、主题切换和手动刷新；后端负责 RSS 新闻抓取、近 24 小时过滤、去重分类、缓存、搜索、AI 解读生成和定时刷新。

项目已按前后端独立方式拆分：

```text
news-app/
├─ news-web/      # Vue 3 + Vite 前端静态应用
├─ news-api/      # Node.js + Express 后端 API 服务
├─ old-code/      # 历史单体代码归档，仅作参考
└─ README.md
```

生产环境推荐由 Nginx 托管前端静态文件，并将 `/api` 反向代理到后端服务。个人部署可以直接使用 ECS 公网 IP，不强制购买域名。

```text
http://ECS公网IP/      -> news-web/dist
http://ECS公网IP/api   -> news-api
```

## 功能概览

- 首页展示近 24 小时新闻，支持 `全部`、`投资`、`国内`、`国际`、`财经`、`科技`、`社会`、`商业` 分类。
- 新闻按优先级和发布时间排序，每次分页加载 8 条，滚动到底部自动加载更多。
- 新闻卡片展示标题、摘要、来源、发布时间、分类和原文入口。
- 详情页支持图片预览、原文跳转和 AI Markdown 解读。
- AI 解读通过 SSE 流式输出，已生成内容会写回缓存，重复打开详情优先复用缓存。
- 支持本地搜索今日简报，也支持联网补充搜索并保存 7 天搜索历史。
- 支持亮色/暗色主题切换，并在本地持久化。
- 后端支持启动刷新、定时刷新、读取时自动补刷新、手动刷新冷却和刷新任务锁。
- 未配置 DeepSeek Key 时，详情页会返回可展示的降级解读，不影响新闻浏览。

## 技术栈

前端：

- Vue 3
- Vue Router 4
- Vite 5
- Tailwind CSS 4
- Axios
- lucide-vue-next
- marked + DOMPurify

后端：

- Node.js
- Express
- Axios
- rss-parser
- node-cron
- dotenv

## 目录说明

```text
news-web/
├─ src/
│  ├─ api/             # Axios 实例和接口方法
│  ├─ components/      # 通用和业务组件
│  ├─ composables/     # 新闻列表、主题、AI 解读缓存等组合式逻辑
│  ├─ router/          # Hash 路由
│  ├─ styles/          # 全局样式
│  ├─ utils/           # 分类、格式化、缓存和数据标准化工具
│  └─ views/           # Home、NewsDetail、Search、SearchHistory
├─ public/             # 静态资源
├─ index.html
├─ vite.config.mjs
└─ package.json
```

```text
news-api/
├─ src/
│  ├─ app.js                   # Express 应用和路由挂载
│  ├─ index.js                 # 服务启动入口
│  ├─ config/
│  │  ├─ env.js                # 环境变量读取
│  │  └─ newsSources.js        # RSS 新闻源配置
│  ├─ constants/
│  │  └─ categories.js         # 分类、专题和优先级常量
│  ├─ jobs/
│  │  └─ scheduler.js          # 定时刷新任务
│  ├─ routes/
│  │  ├─ healthRoutes.js       # 健康检查
│  │  ├─ newsRoutes.js         # 新闻列表、详情、AI 解读流
│  │  ├─ refreshRoutes.js      # 刷新任务
│  │  └─ searchRoutes.js       # 本地搜索、联网搜索、搜索历史
│  ├─ services/
│  │  ├─ aiNewsService.js      # DeepSeek 流式解读和降级解读
│  │  ├─ newsCleanService.js   # 过滤、去重、分类、优先级
│  │  ├─ newsFetchService.js   # RSS 抓取
│  │  ├─ newsStoreService.js   # 今日新闻缓存
│  │  ├─ refreshService.js     # 刷新编排、详情、SSE
│  │  ├─ searchCacheService.js # 搜索历史缓存
│  │  └─ searchService.js      # 搜索匹配、联网补充、排序
│  └─ utils/                   # 日期和文本工具
├─ storage/                    # 运行时缓存目录
└─ package.json
```

## 本地运行

安装依赖：

```bash
pnpm install
```

复制后端环境变量文件：

```bash
cd news-api
cp .env.example .env
```

前端默认通过 `/api` 请求后端。本地开发时 Vite 会把 `/api` 代理到 `http://localhost:3000`，通常不需要额外配置。需要覆盖时可以复制前端环境变量文件：

```bash
cd news-web
cp .env.example .env
```

启动后端：

```bash
pnpm dev:api
```

启动前端：

```bash
pnpm dev:web
```

常用脚本：

```bash
pnpm dev:web       # 启动前端开发服务
pnpm dev:api       # 启动后端 API
pnpm build:web     # 构建前端静态文件到 news-web/dist
pnpm preview:web   # 预览前端构建产物
pnpm check:api     # 检查后端 JS 语法
```

## 环境变量

前端 `news-web/.env`：

```text
VITE_API_BASE_URL=/api
```

后端 `news-api/.env`：

```text
PORT=3000
DEEPSEEK_API_KEY=
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
AI_MODEL=deepseek-v4-flash
AI_CONCURRENCY=3
AI_INTERPRETATION_MAX_TOKENS=

MAX_ITEMS_PER_FEED=30
MAX_NEWS_PER_CATEGORY=24
NEWS_FETCH_TIMEOUT_MS=20000
NEWS_RETENTION_HOURS=24
NEWS_PAGE_SIZE=8
SEARCH_HISTORY_RETENTION_DAYS=7
SEARCH_RESULT_LIMIT=20
ONLINE_SEARCH_CACHE_MINUTES=10

CRON_SCHEDULE=0 0 */2 * * *
INITIAL_REFRESH_ON_START=true
READ_REFRESH_MAX_AGE_MINUTES=120
MANUAL_REFRESH_COOLDOWN_MINUTES=5
APP_TIME_ZONE=Asia/Shanghai
```

真实密钥只允许放在后端 `.env` 或服务器环境变量中，禁止写入前端源码、README 示例值、构建产物和 Git 仓库。

## 接口说明

所有接口都挂载在 `/api` 下。

### 健康检查

```text
GET /api/health
```

返回服务状态、当前日期、刷新状态和进程运行时间。

### 新闻列表

```text
GET /api/news?category=全部&page=1&pageSize=8
```

说明：

- `category` 支持 `全部`、`投资`、`国内`、`国际`、`财经`、`科技`、`社会`、`商业`。
- `pageSize` 默认 8，最大不超过后端每类保留数量。
- 缓存过期时接口会异步触发刷新；如果暂时没有数据，可能返回 `202` 和准备中的提示。

响应核心字段：

```json
{
  "date": "2026-06-16",
  "updatedAt": "2026-06-16T08:00:00.000Z",
  "retentionHours": 24,
  "isRefreshing": false,
  "categories": ["国内", "国际", "财经", "科技", "社会", "商业"],
  "counts": {
    "total": 48,
    "投资": 12
  },
  "pagination": {
    "page": 1,
    "pageSize": 8,
    "total": 48
  },
  "items": []
}
```

### 新闻详情

```text
GET /api/news/:id
```

详情会优先从今日缓存读取；联网搜索结果进入搜索缓存后，也可以通过详情页读取和生成 AI 解读。

### AI 解读流

```text
GET /api/news/:id/interpretation/stream
GET /api/news/:id/interpretation/stream?force=1
```

使用 Server-Sent Events 返回 `meta`、`delta`、`done` 或 `fail` 事件。`force=1` 会忽略已缓存解读并重新生成。

### 手动刷新

```text
POST /api/refresh
```

说明：

- 后端有刷新任务锁，同一时间只允许一个刷新任务运行。
- 手动刷新有冷却时间，默认 5 分钟。
- 接口会立即返回任务状态，不等待完整抓取流程结束。

### 刷新状态

```text
GET /api/refresh/status
```

返回 `status`、`taskId`、`startedAt`、`finishedAt`、`lastRunAt`、`nextRunAt`、`lastError` 和 `message`。

### 本地搜索

```text
GET /api/search/local?q=关键词&category=全部&page=1&pageSize=24
```

在今日缓存内搜索标题、摘要和正文片段，返回高亮片段、来源、分类和分页信息。

### 联网搜索

```text
GET /api/search/online?q=关键词&limit=20
POST /api/search/online
```

联网搜索会拉取或复用 RSS 候选新闻，和本地缓存去重后排序返回。结果会写入搜索历史缓存，方便后续从详情页继续生成 AI 解读。

### 搜索历史

```text
GET /api/search/history?bucket=today
```

`bucket` 支持 `today`、`yesterday`、`earlier`。搜索历史默认保留 7 天。

## 缓存与刷新策略

- 今日新闻缓存写入 `news-api/storage/todayNews.json`。
- 搜索历史和联网结果缓存写入 `news-api/storage/searchHistory.json`。
- 新闻默认保留近 24 小时数据。
- 每个分类默认最多保留 24 条。
- 服务启动时默认检查并刷新一次，取决于 `INITIAL_REFRESH_ON_START`。
- 定时刷新默认每 2 小时执行一次，取决于 `CRON_SCHEDULE`。
- 读取新闻时如果缓存超过 `READ_REFRESH_MAX_AGE_MINUTES`，会异步触发刷新。
- AI 解读按详情页触发生成，成功后写回对应新闻缓存或搜索缓存。
- DeepSeek 调用失败或未配置 Key 时，后端返回降级解读，前端仍可展示。

## 部署建议

构建前端：

```bash
pnpm build:web
```

启动后端生产服务：

```bash
pnpm --filter daily-news-api start
```

推荐服务器结构：

```text
ECS
├─ Nginx
│  ├─ /      -> news-web/dist
│  └─ /api   -> http://127.0.0.1:3000
├─ Node.js
├─ PM2
└─ news-api
```

Nginx 反向代理需要关闭 SSE 缓冲，避免 AI 解读流式输出被代理层攒包。`/api/news/:id/interpretation/stream` 已设置 `X-Accel-Buffering: no`，Nginx 侧仍建议为 `/api` 配置 `proxy_buffering off`。

部署后检查：

```text
http://ECS公网IP/
http://ECS公网IP/api/health
```

## 验收清单

- `pnpm check:api` 能通过。
- `pnpm build:web` 能完成构建。
- 后端启动后可以访问 `/api/health`。
- 首页可以加载近 24 小时新闻并分页加载更多。
- 分类切换、主题切换、手动刷新可用。
- 新闻详情页可以打开原文、预览图片并生成 AI 解读。
- 未配置 DeepSeek Key 时，AI 解读区域仍能显示降级内容。
- 本地搜索、联网搜索和搜索历史页面可用。
- 生产环境通过公网 IP 访问页面，且 `/api` 能被 Nginx 正确代理。

## 旧代码归档

历史单体代码已归档到 `old-code/`，不参与当前构建：

```text
old-code/
├─ backend/                    # 旧单体服务业务模块
├─ data/                       # 旧缓存数据
├─ reference/legacy-frontend/  # 旧原生前端
└─ server.js                   # 旧 Express 单体入口
```
