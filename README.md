# 今日简报

每日新闻聚合与 AI 解读应用。后端负责 RSS 抓取、新闻聚合、AI 解读和接口服务；前端使用 `Vite + Vue 3` 实现响应式新闻工作台。

## README 的作用

本文件用于帮助新接手项目的人快速了解：

- 项目前后端目录结构
- 本地安装依赖和启动命令
- 常用脚本和主要接口
- 旧版前端代码的归档位置

## 项目结构

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
├─ server.js                # Express 后端服务入口
├─ vite.config.js           # Vite 配置
├─ package.json             # 项目依赖与脚本
└─ .env.example             # 环境变量示例
```

## 安装依赖

```bash
npm install
```

## 环境配置

复制环境变量示例文件：

```bash
cp .env.example .env
```

根据需要配置 `PORT`、`DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`OPENROUTER_API_KEY` 等变量。

## 启动项目

开发前端：

```bash
npm run dev
```

启动后端：

```bash
npm run dev:server
```

生产构建前端：

```bash
npm run build
```

启动生产服务：

```bash
npm start
```

## 常用接口

```text
GET  /api/news     获取新闻数据
POST /api/refresh  手动触发新闻刷新任务
GET  /api/status   查看服务运行状态
```

## 旧版前端

旧版原生 `HTML + CSS + JavaScript` 前端已归档到：

```text
reference/legacy-frontend/
```

该目录只用于参考，不参与当前项目构建。
