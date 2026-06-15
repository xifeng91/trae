/**
 * 新闻聚合/筛选模块
 * 去重、优先级排序、分类计数
 */

/**
 * 中文关键词 → 优先级映射
 * 标题或摘要中包含这些词，提升优先级
 */
const PRIORITY_KEYWORDS = {
  P0: [
    '习近平', '总书记', '国务院', '全国人大', '政治局',
    '突发', '紧急', '地震', '战争', '停火',
    '央行', '降准', '降息', '加息',
    '峰会', '重大', '历史性', '里程碑',
  ],
  P1: [
    '政策', '改革', '发布', '出台', '规划',
    '贸易', '出口', '投资', '市场', '股市',
    'AI', '人工智能', '芯片', '量子', '航天',
    '医保', '教育', '住房', '养老',
  ],
};

/**
 * 标题相似度检测（简单去重）
 * 判断两条新闻是否报道同一事件
 */
function isDuplicate(titleA, titleB) {
  // 提取核心关键词比较
  const a = titleA.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const b = titleB.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');

  // 短标题直接比较
  if (a.length <= 10) return a === b;

  // 长标题检查重叠度
  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length > b.length ? a : b;

  let matchCount = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matchCount++;
  }

  const ratio = matchCount / shorter.length;
  return ratio > 0.7;
}

/**
 * 计算优先级
 * 根据来源默认优先级 + 关键词匹配
 */
function calcPriority(item, defaultPriority) {
  const text = item.title + (item.summary || '');

  // 先检查 P0 关键词
  for (const kw of PRIORITY_KEYWORDS.P0) {
    if (text.includes(kw)) return 'P0';
  }

  // 检查 P1 关键词，如果原本是 P0 或 P1 就升级
  for (const kw of PRIORITY_KEYWORDS.P1) {
    if (text.includes(kw)) {
      if (defaultPriority === 'P0' || defaultPriority === 'P1') return 'P1';
    }
  }

  return defaultPriority || 'P2';
}

/**
 * 聚合和筛选
 * @param {Array} rawItems - 原始抓取条目
 * @param {number} maxTotal - 最终保留数量（默认30）
 * @returns {Object} { news, stats }
 */
function aggregate(rawItems, maxTotal = 30) {
  console.log(`[聚合] 处理 ${rawItems.length} 条原始新闻`);

  // 1. 去重（按标题相似度）
  const unique = [];
  for (const item of rawItems) {
    const isDup = unique.some(existing => isDuplicate(existing.title, item.title));
    if (!isDup) unique.push(item);
  }
  console.log(`  → 去重后剩余 ${unique.length} 条`);

  // 2. 计算优先级
  const withPriority = unique.map(item => ({
    ...item,
    priority: calcPriority(item, item.priority || 'P2'),
  }));

  // 3. 排序：P0 > P1 > P2，同优先级内按时间
  const priorityOrder = { P0: 0, P1: 1, P2: 2 };
  withPriority.sort((a, b) => {
    const po = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (po !== 0) return po;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  // 4. 按分类均匀取，确保每个分类都有
  const selected = [];
  const categories = ['国内', '国际', '财经', '科技'];
  const perCategory = Math.floor(maxTotal / categories.length);

  // 第一轮：每个分类取均匀数量
  for (const cat of categories) {
    const catItems = withPriority.filter(item => item.category === cat);
    selected.push(...catItems.slice(0, perCategory));
  }

  // 第二轮：补足到 maxTotal（按优先级）
  if (selected.length < maxTotal) {
    const selectedIds = new Set(selected.map(s => s.title));
    const remaining = withPriority.filter(item => !selectedIds.has(item.title));
    selected.push(...remaining.slice(0, maxTotal - selected.length));
  }

  const finalList = selected.slice(0, maxTotal);

  // 5. 格式化
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const newsList = finalList.map((item, idx) => ({
    id: `n${String(idx + 1).padStart(2, '0')}`,
    title: item.title.slice(0, 40),
    summary: item.summary ? item.summary.slice(0, 120) : item.title.slice(0, 60),
    category: item.category,
    priority: item.priority,
    source: item.source,
    sourceUrl: item.link,
    interpretation: item.interpretation || `${item.summary || item.title}`,
    date: dateStr,
    time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
  }));

  // 统计
  const stats = {};
  for (const cat of categories) {
    stats[cat.toLowerCase()] = newsList.filter(n => n.category === cat).length;
  }

  console.log(`[聚合完成] 最终 ${newsList.length} 条`);
  console.log(`  P0: ${newsList.filter(n => n.priority === 'P0').length}`);
  console.log(`  P1: ${newsList.filter(n => n.priority === 'P1').length}`);
  console.log(`  P2: ${newsList.filter(n => n.priority === 'P2').length}`);

  return {
    date: dateStr,
    updatedAt: new Date().toISOString(),
    total: newsList.length,
    news: newsList,
    stats,
  };
}

module.exports = { aggregate, isDuplicate, calcPriority };
