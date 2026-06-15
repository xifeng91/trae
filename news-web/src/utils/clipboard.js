import { CATEGORY_OPTIONS } from './categories';
import { formatDisplayDate } from './format';

export function buildBriefingText(data) {
  const dateText = formatDisplayDate(data?.date);
  const lines = [`今日简报 | ${dateText}`, '='.repeat(30), ''];

  CATEGORY_OPTIONS.filter((item) => item.value !== '全部').forEach((category) => {
    const items = data.news.filter((news) => news.category === category.value);
    if (items.length === 0) return;

    lines.push(`【${category.label}新闻】`, '');
    items.forEach((news) => {
      lines.push(`${news.title}`);
      lines.push(`摘要：${news.shortSummary || news.summary || '暂无摘要'}`);
      lines.push(`解读：${news.interpretation || '暂无解读'}`);
      if (news.sourceUrl) lines.push(`来源：${news.sourceUrl}`);
      lines.push('');
    });
  });

  lines.push('='.repeat(30), '一键生成，快速掌握今日世界要点。');
  return lines.join('\n');
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
