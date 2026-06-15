/**
 * RSS 新闻抓取模块
 * 使用 axios 内置超时机制，避免 Promise.race 的未捕获 rejection 问题
 */

const axios = require('axios');

/**
 * 使用 axios 抓取并解析 RSS 源
 */
async function fetchRSS(url) {
  const resp = await axios.get(url, {
    timeout: 20000,
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
  });

  const xml = resp.data;
  if (!xml || xml.trim().length === 0) return [];

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  // 解码 HTML 实体（通用方法）
  function decodeEntities(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#x60;/g, '`')
      .replace(/&#123;/g, '{')
      .replace(/&#125;/g, '}')
      .replace(/&#\d+;/g, ' ')
      .trim();
  }

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    // 通用提取：取标签内容，先解码CDATA，再剥离真实HTML标签
    const extract = (tag) => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      if (!m) return '';
      // 先解码CDATA（<![CDATA[内容]]> → 内容），避免被HTML标签剥离误杀
      let content = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      // 再剥离HTML标签
      return content.replace(/<[^>]*>/g, '').trim();
    };

    // 对 description 特殊处理：有些RSS源把HTML实体编码的标签放里边
    const extractDescription = () => {
      const m = /<description[^>]*>([\s\S]*?)<\/description>/i.exec(block);
      if (!m) return '';
      // 1. 先解码CDATA
      let content = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      // 2. 解码实体（&lt;figure&gt; → <figure>）
      const decoded = decodeEntities(content);
      // 3. 再剥离所有HTML标签
      const stripped = decoded.replace(/<[^>]*>/g, '');
      // 4. 规范化空白
      return stripped.replace(/\s+/g, ' ').trim();
    };

    let title = extract('title');
    if (!title) continue;
    title = decodeEntities(title);

    const summary = extractDescription().slice(0, 120);

    items.push({
      title,
      summary,
      link: extract('link'),
      pubDate: extract('pubDate') || new Date().toISOString(),
    });
  }

  return items;
}

/**
 * 新闻源配置
 */
const NEWS_SOURCES = [
  // ====== 国内时政 ======
  { name: '联合早报', url: 'https://plink.anyfeeder.com/zaobao/realtime/china',   category: '国内', defaultPriority: 'P0' },

  // ====== 国际时事（从中国可访问） ======
  { name: 'China Daily', url: 'https://www.chinadaily.com.cn/rss/world_rss.xml',   category: '国际', defaultPriority: 'P0' },
  { name: '人民网国际', url: 'http://www.people.com.cn/rss/world.xml',              category: '国际', defaultPriority: 'P1' },
  { name: '新华网国际', url: 'http://www.xinhuanet.com/world/news_world.xml',       category: '国际', defaultPriority: 'P1' },

  // ====== 财经 ======
  { name: '财新', url: 'https://plink.anyfeeder.com/weixin/caixinwang',            category: '财经', defaultPriority: 'P1' },

  // ====== 科技 ======
  { name: '36氪', url: 'https://36kr.com/feed',                                     category: '科技', defaultPriority: 'P1' },
  { name: '爱范儿', url: 'https://www.ifanr.com/feed',                             category: '科技', defaultPriority: 'P2' },
];

/**
 * 抓取单个源（安全版 - 所有错误内部消化）
 */
async function fetchSingle(source) {
  try {
    const items = await fetchRSS(source.url);
    const withMeta = items.slice(0, 50).map(item => ({
      ...item,
      source: source.name,
      category: source.category,
      priority: source.defaultPriority,
    }));
    console.log(`  [${source.name}] ${withMeta.length} 条`);
    return withMeta;
  } catch (err) {
    const msg = err.message || err.code || 'unknown';
    console.log(`  [${source.name}] ${msg.slice(0, 40)}`);
    return [];
  }
}

/**
 * 抓取所有新闻源
 * 使用 Promise.allSettled 防止单个失败影响整体
 */
async function fetchAll() {
  console.log('='.repeat(40));
  console.log(`[开始抓取] ${NEWS_SOURCES.length} 个新闻源`);
  console.log('='.repeat(40));

  const results = await Promise.allSettled(
    NEWS_SOURCES.map(src => fetchSingle(src))
  );

  let items = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      items = items.concat(r.value);
    }
  });

  console.log(`\n[抓取完成] 共 ${items.length} 条原始新闻`);
  return items;
}

module.exports = { fetchAll, fetchSingle, NEWS_SOURCES };
