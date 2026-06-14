export function formatDisplayDate(dateText) {
  if (!dateText) return '日期待更新';

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${weekDays[date.getDay()]}`;
}

export function formatUpdateTime(dateText) {
  if (!dateText) return '等待更新';

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}-${day} ${hour}:${minute}`;
}

export function formatNewsDateTime(dateText, timeText) {
  if (!dateText && !timeText) return '时间待更新';

  const normalizedTime = timeText || '00:00';
  const date = dateText ? new Date(`${dateText}T${normalizedTime}:00`) : new Date(timeText);

  if (Number.isNaN(date.getTime())) {
    return [dateText, timeText].filter(Boolean).join(' ') || '时间待更新';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

export function splitParagraphs(text) {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function getSourceHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}
