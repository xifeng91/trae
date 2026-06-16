import { CATEGORY_OPTIONS } from './categories';
import { formatDisplayDate } from './format';

export function buildBriefingText(data) {
  const dateText = formatDisplayDate(data?.date);
  const newsItems = data?.items || data?.news || [];
  const lines = [`近 24 小时简报 | ${dateText}`, '='.repeat(30), ''];

  CATEGORY_OPTIONS.filter((item) => item.value !== '全部').forEach((category) => {
    const items = newsItems.filter((news) => news.category === category.value);
    if (items.length === 0) return;

    lines.push(`【${category.label}新闻】`, '');
    items.forEach((news) => {
      lines.push(`${news.title}`);
      lines.push(`总览：${news.overview || news.summary || news.shortSummary || '暂无总览'}`);
      lines.push(`解读：${news.interpretation || '暂无解读'}`);
      if (news.sourceUrl) lines.push(`来源：${news.sourceUrl}`);
      lines.push('');
    });
  });

  lines.push('='.repeat(30), '一键生成，快速掌握近 24 小时世界要点。');
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
