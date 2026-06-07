/**
 * 每日简报 - 后端服务
 * 
 * 功能：
 * 1. 定时抓取RSS新闻（默认每小时）
 * 2. AI生成新闻解读
 * 3. 提供 RESTful API 给前端调用
 * 4. 提供静态文件服务（Nginx部署时可关闭）
 */

require('dotenv').config();

// 解决 Windows 终端中文乱码
if (process.platform === 'win32') {
  process.stdout.setDefaultEncoding('utf8');
  process.stderr.setDefaultEncoding('utf8');
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const rssFetcher = require('./backend/rssFetcher');
const newsAggregator = require('./backend/newsAggregator');
const aiInterpreter = require('./backend/aiInterpreter');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 内存缓存 + 文件持久化
// ============================================
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'news.json');

let cachedData = null;
let isFetching = false;

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * 缓存写入磁盘
 */
function saveToDisk(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[存储] 写入文件失败:', err.message);
  }
}

/**
 * 从磁盘恢复缓存
 */
function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[存储] 读取文件失败:', err.message);
  }
  return null;
}

/**
 * 更新数据并保存
 */
function updateData(data) {
  cachedData = data;
  if (!cachedData.subtitle) cachedData.subtitle = '';
  cachedData._cachedAt = Date.now();
  saveToDisk(data);
}

// ============================================
// 核心：抓取 → 聚合 → AI解读
// ============================================
async function fetchAndProcess() {
  if (isFetching) {
    console.log('[任务] 上一轮还在执行，跳过');
    return;
  }

  isFetching = true;
  const startTime = Date.now();
  console.log('\n' + '='.repeat(50));
  console.log(`[任务] 开始新一轮新闻抓取 ${new Date().toLocaleString('zh-CN')}`);
  console.log('='.repeat(50));

  try {
    // 1. 抓取RSS
    const rawItems = await rssFetcher.fetchAll();
    if (rawItems.length === 0) {
      console.warn('[任务] 未获取到任何新闻，保留旧数据');
      return;
    }

    // 2. 聚合去重
    const maxTotal = parseInt(process.env.MAX_NEWS_TOTAL) || 50;
    const aggregated = newsAggregator.aggregate(rawItems, maxTotal);

    // 3. AI解读（只对缺少解读的新闻生成）
    const apiConfig = aiInterpreter.getAPIConfig();
    let newsWithAI = aggregated.news;

    if (apiConfig) {
      console.log('[任务] AI已配置，开始生成解读...');
      newsWithAI = await aiInterpreter.batchInterpret(aggregated.news, 3);
    } else {
      console.warn('[任务] 未配置AI API，使用摘要作为解读');
      newsWithAI = aggregated.news.map(n => ({
        ...n,
        interpretation: `${n.summary}（这条新闻来自${n.source}，反映了${n.category === '国内' ? '国内' : n.category === '国际' ? '国际' : '相关'}领域的最新动态。）`
      }));
    }

    // 4. 用AI生成短摘要（≤30字）
    if (apiConfig) {
      newsWithAI = await aiInterpreter.batchShortenSummaries(newsWithAI, 5);
    } else {
      newsWithAI = newsWithAI.map(n => ({ ...n, shortSummary: (n.summary || n.title).slice(0, 30) }));
    }

    // 5. 用AI生成副标题
    let subtitle = await aiInterpreter.generateSubtitle(newsWithAI);
    console.log(`[任务] AI副标题: ${subtitle}`);

    // 5. 保存
    const result = {
      ...aggregated,
      news: newsWithAI,
      subtitle,
      updatedAt: new Date().toISOString(),
    };

    updateData(result);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[任务] 完成！耗时 ${elapsed}s，共 ${result.total} 条新闻`);
  } catch (err) {
    console.error('[任务] 执行失败:', err);
  } finally {
    isFetching = false;
  }
}

// ============================================
// 定时任务（默认每小时整点执行）
// ============================================
const cronExpr = process.env.CRON_SCHEDULE || '0 0 * * * *';
cron.schedule(cronExpr, () => {
  fetchAndProcess();
});
console.log(`[定时] Cron: ${cronExpr}`);

// ============================================
// API 路由
// ============================================

// CORS 头（允许前端跨域请求）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

/**
 * GET /api/news - 获取新闻数据
 * 前端轮询使用此接口
 */
app.get('/api/news', (req, res) => {
  if (cachedData) {
    return res.json(cachedData);
  }

  // 无缓存时尝试从磁盘恢复
  const disk = loadFromDisk();
  if (disk) {
    cachedData = disk;
    return res.json(disk);
  }

  // 完全无数据时返回 503
  res.status(503).json({
    error: '数据尚未准备好',
    message: '正在首次抓取新闻，请稍后重试',
  });
});

/**
 * GET /api/status - 服务状态检查
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    hasData: !!cachedData,
    isFetching,
    cachedAt: cachedData?._cachedAt || null,
    updatedAt: cachedData?.updatedAt || null,
    total: cachedData?.total || 0,
    uptime: process.uptime(),
  });
});

/**
 * POST /api/refresh - 手动触发刷新
 */
app.post('/api/refresh', (req, res) => {
  if (isFetching) {
    return res.json({ message: '正在执行中，请稍候' });
  }
  fetchAndProcess();
  res.json({ message: '刷新任务已启动' });
});

// ============================================
// 静态文件服务
// 上线后用 Nginx 代理静态文件，此部分可注释掉
// ============================================
app.use(express.static(path.join(__dirname)));

// SPA 兜底（首页）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// 启动
// ============================================
async function start() {
  // 启动时尝试从磁盘恢复数据
  const disk = loadFromDisk();
  if (disk) {
    cachedData = disk;
    console.log(`[启动] 从磁盘恢复 ${disk.total} 条新闻`);
  }

  // 如果没有数据或数据过期，立即执行首次抓取
  const now = new Date();
  const cacheAge = cachedData?._cachedAt ? (now - cachedData._cachedAt) / 1000 : Infinity;

  if (!cachedData || cacheAge > 3600) {
    console.log('[启动] 无缓存或已过期，开始首次抓取...');
    fetchAndProcess();
  }

  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  每日简报 后端服务`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  API: http://localhost:${PORT}/api/news`);
    console.log(`  Status: http://localhost:${PORT}/api/status`);
    console.log(`${'='.repeat(50)}\n`);
  });
}

// 全局错误保护，防止RSS抓取异常导致进程退出
process.on('unhandledRejection', (err) => {
  console.error('[进程] 未捕获的Promise拒绝:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[进程] 未捕获的异常:', err?.message || err);
});

start();
