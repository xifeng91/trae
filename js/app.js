/**
 * 今日简报 - 主应用逻辑
 * 支持两种模式：
 *   API模式（优先）：从后端 /api/news 获取实时数据
 *   本地模式（降级）：使用 NewsData 静态数据
 */

const App = {
  currentData: null,
  currentCategory: '全部',
  apiBase: '/api',
  pollInterval: null,

  /** DOM 元素引用 */
  els: {},

  /** 缓存DOM引用 */
  cacheElements() {
    this.els = {
      app: document.getElementById('app'),
      loading: document.getElementById('loading'),
      header: document.getElementById('header'),
      stats: document.getElementById('stats'),
      tabs: document.getElementById('tabs'),
      newsList: document.getElementById('news-list'),
      footer: document.getElementById('footer'),
      toast: document.getElementById('toast'),
      refreshBtn: document.getElementById('refresh-btn'),
      copyBtn: document.getElementById('copy-btn'),
    };
  },

  /** 初始化 */
  init() {
    this.cacheElements();
    this.loadData();

    // 设置轮询：每60秒检查一次是否有新数据
    this.setupPolling();

    // 页面可见性变化时检查
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdates();
      }
    });

    // 刷新按钮
    this.els.refreshBtn.addEventListener('click', () => {
      this.loadData(true);
    });

    // 复制按钮
    this.els.copyBtn.addEventListener('click', () => {
      this.copyToClipboard();
    });
  },

  /** 加载数据 */
  async loadData(forceRefresh = false) {
    this.showLoading();

    try {
      let data;

      if (forceRefresh) {
        // 强制刷新：触发后端刷新并等待
        try {
          await fetch(`${this.apiBase}/refresh`, { method: 'POST' });
        } catch (e) { /* 忽略 */ }
        // 等1秒让后端开始抓取
        await new Promise(r => setTimeout(r, 1000));
      }

      // 尝试从API获取
      data = await this.fetchFromAPI();

      if (data) {
        this.currentData = data;
        // 缓存到 LocalStorage 作为降级备用
        this.cacheToLocal(data);
        this.render();
        return;
      }

      // API 失败，从 LocalStorage 恢复
      const cached = this.loadFromLocal();
      if (cached) {
        this.currentData = cached;
        this.render();
        this.showToast('📡 使用缓存数据');
        return;
      }

      // 最后降级：使用静态数据
      if (typeof NewsData !== 'undefined') {
        this.currentData = NewsData.getNews();
        this.render();
        this.showToast('📋 使用本地数据');
        return;
      }

      throw new Error('所有数据源都不可用');

    } catch (e) {
      console.error('[App] 加载失败:', e);
      this.showError('新闻加载失败，请稍后重试');
    }
  },

  /** 从API获取数据 */
  async fetchFromAPI() {
    try {
      const resp = await fetch(`${this.apiBase}/news`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        if (resp.status === 503) {
          console.log('[API] 数据尚未就绪');
          return null;
        }
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (data && data.news && data.news.length > 0) {
        console.log(`[API] 获取 ${data.total} 条新闻`);
        return data;
      }
      return null;
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        console.warn('[API] 请求超时');
      } else {
        console.warn('[API] 请求失败:', err.message);
      }
      return null;
    }
  },

  /** 检查是否有更新 */
  async checkForUpdates() {
    const data = await this.fetchFromAPI();
    if (!data) return;

    // 检查更新时间是否变了
    if (this.currentData && data.updatedAt === this.currentData.updatedAt) {
      return; // 数据没变
    }

    this.currentData = data;
    this.cacheToLocal(data);
    this.render();
    this.showToast('🔄 简报已更新');
  },

  /** 设置轮询 */
  setupPolling() {
    this.pollInterval = setInterval(() => {
      this.checkForUpdates();
    }, 60 * 1000); // 每60秒检查一次
  },

  /** 缓存到 LocalStorage */
  cacheToLocal(data) {
    try {
      localStorage.setItem('daily_news_briefing', JSON.stringify(data));
    } catch (e) { /* ignore */ }
  },

  /** 从 LocalStorage 加载 */
  loadFromLocal() {
    try {
      const raw = localStorage.getItem('daily_news_briefing');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  /** 显示加载动画 */
  showLoading() {
    this.els.loading.style.display = 'block';
    this.els.header.style.display = 'none';
    this.els.stats.style.display = 'none';
    this.els.tabs.style.display = 'none';
    this.els.newsList.style.display = 'none';
    this.els.footer.style.display = 'none';
  },

  /** 渲染页面 */
  render() {
    if (!this.currentData || !this.currentData.news) {
      this.showError('暂无新闻数据');
      return;
    }

    const data = this.currentData;

    // 隐藏加载
    this.els.loading.style.display = 'none';

    // 渲染各部分
    this.renderHeader(data);
    this.renderStats(data);
    this.renderTabs();
    this.renderNewsList(data);
    this.renderFooter(data);

    // 显示界面
    this.els.header.style.display = 'block';
    this.els.stats.style.display = 'flex';
    this.els.tabs.style.display = 'flex';
    this.els.newsList.style.display = 'block';
    this.els.footer.style.display = 'block';
  },

  /** 渲染头部 */
  renderHeader(data) {
    const dateParts = data.date.split('-');
    const displayDate = `${dateParts[0]}年${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`;
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const dayOfWeek = weekDays[new Date(data.date).getDay()];

    this.els.header.querySelector('.date').textContent = `${displayDate} 星期${dayOfWeek}`;

    // 渲染AI副标题
    const subtitleEl = this.els.header.querySelector('.header-subtitle');
    if (data.subtitle) {
      subtitleEl.textContent = data.subtitle;
      subtitleEl.style.display = 'block';
    } else {
      subtitleEl.style.display = 'none';
    }
  },

  /** 渲染统计数据 */
  renderStats(data) {
    const stats = data.stats;
    const p0Count = data.news.filter(n => n.priority === 'P0').length;
    const p1Count = data.news.filter(n => n.priority === 'P1').length;

    this.els.stats.innerHTML = `
      <span class="stat-item">📰 共 <span class="num">${data.total}</span> 条</span>
      <span class="stat-item">🔴 要闻 <span class="num">${p0Count}</span></span>
      <span class="stat-item">🟠 关注 <span class="num">${p1Count}</span></span>
      <span class="stat-item">🇨🇳 国内 <span class="num">${stats.domestic || 0}</span></span>
      <span class="stat-item">🌍 国际 <span class="num">${stats.international || 0}</span></span>
      <span class="stat-item">💰 财经 <span class="num">${stats.finance || 0}</span></span>
      <span class="stat-item">📱 科技 <span class="num">${stats.tech || 0}</span></span>
    `;
  },

  /** 渲染分类标签 */
  renderTabs() {
    const categories = ['全部', '国内', '国际', '财经', '科技'];
    this.els.tabs.innerHTML = categories.map(cat =>
      `<button class="tab-btn ${cat === this.currentCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>`
    ).join('');

    this.els.tabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentCategory = btn.dataset.category;
        this.renderTabs();
        this.renderNewsList(this.currentData);
      });
    });
  },

  /** 渲染新闻列表 */
  renderNewsList(data) {
    if (!data) return;
    const filtered = data.news.filter(n =>
      this.currentCategory === '全部' || n.category === this.currentCategory
    );

    if (filtered.length === 0) {
      this.els.newsList.innerHTML = '<div class="empty-state">暂无相关分类的新闻</div>';
      return;
    }

    this.els.newsList.innerHTML = filtered.map(news => this.buildCardHTML(news)).join('');

    this.els.newsList.querySelectorAll('.news-card').forEach(card => {
      card.addEventListener('click', () => {
        card.classList.toggle('expanded');
      });
    });
  },

  /** 构建单个新闻卡片HTML */
  buildCardHTML(news) {
    const priorityLabel = { P0: '要闻', P1: '关注', P2: '补充' }[news.priority] || '资讯';
    const categoryClass = { '国内': 'domestic', '国际': 'international', '财经': 'finance', '科技': 'tech' }[news.category] || '';

    return `
      <div class="news-card" data-id="${news.id}">
        <div class="news-card-header">
          <div class="news-priority ${news.priority.toLowerCase()}">${priorityLabel}</div>
          <div class="news-content">
            <div class="news-title">${this.escapeHtml(news.title)}</div>
            <div class="news-summary">${this.escapeHtml(news.shortSummary || news.summary)}</div>
            <div class="news-meta">
              <span class="news-tag ${categoryClass}">${news.category}</span>
              <span class="news-source">${news.source} · ${news.time}</span>
            </div>
          </div>
          <div class="news-expand-icon">▼</div>
        </div>
        <div class="news-detail">
          <div class="news-detail-content">
            <div class="news-detail-section">
              <span class="news-detail-label"><span class="emoji">🎯</span>一句话概括</span>
              ${this.escapeHtml(news.shortSummary || news.summary)}
            </div>
            <div class="news-detail-section">
              <span class="news-detail-label"><span class="emoji">💡</span>我该如何理解</span>
              ${this.formatParagraphs(this.escapeHtml(news.interpretation))}
            </div>
            <div class="news-detail-section">
              <span class="news-detail-label"><span class="emoji">📎</span>来源</span>
              <span class="source-badge">${this.escapeHtml(news.source)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /** 将纯文本按空行分割成段落 */
  formatParagraphs(text) {
    if (!text) return '';
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map(p => p.trim()).filter(p => p).map(p => `<p>${p}</p>`).join('');
  },

  /** HTML转义 */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /** 渲染底部 */
  renderFooter(data) {
    const updateTime = new Date(data.updatedAt);
    const timeStr = `${String(updateTime.getHours()).padStart(2, '0')}:${String(updateTime.getMinutes()).padStart(2, '0')}`;
    const el = this.els.footer.querySelector('.update-time');
    if (el) el.textContent = `更新于 ${data.date} ${timeStr}`;
  },

  /** 复制全文到剪贴板 */
  copyToClipboard() {
    if (!this.currentData) return;

    const data = this.currentData;
    const dateParts = data.date.split('-');
    const displayDate = `${dateParts[0]}年${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`;

    let text = `📋 今日简报 | ${displayDate}\n`;
    text += `${'='.repeat(30)}\n\n`;

    const categories = ['国内', '国际', '财经', '科技'];
    categories.forEach(cat => {
      const items = data.news.filter(n => n.category === cat);
      if (items.length === 0) return;

      const catEmoji = { '国内': '🇨🇳', '国际': '🌍', '财经': '💰', '科技': '📱' };
      text += `${catEmoji[cat]} 【${cat}新闻】\n\n`;

      items.forEach(news => {
        const priorityLabel = { P0: '🔴', P1: '🟠', P2: '🟢' }[news.priority] || '⚪';
        text += `${priorityLabel} ${news.title}\n`;
        text += `  ${news.summary}\n`;
        text += `  💡 ${news.interpretation}\n`;
        text += `  🔗 ${news.sourceUrl}\n\n`;
      });
    });

    text += `${'='.repeat(30)}\n`;
    text += `一键生成，3分钟掌握今日世界要点。`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('✅ 已复制到剪贴板！');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  },

  /** 降级复制方案 */
  fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      this.showToast('✅ 已复制到剪贴板！');
    } catch (e) {
      this.showToast('❌ 复制失败，请手动选择复制');
    }
    document.body.removeChild(textarea);
  },

  /** 显示toast提示 */
  showToast(msg) {
    const toast = this.els.toast;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  },

  /** 显示错误提示 */
  showError(msg) {
    this.els.loading.style.display = 'none';
    this.els.newsList.innerHTML = `<div class="empty-state">${msg}</div>`;
    this.els.newsList.style.display = 'block';
  }
};

// ============================================
// 启动应用
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
