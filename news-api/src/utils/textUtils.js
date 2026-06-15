function decodeEntities(text = '') {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#\d+;/g, ' ')
    .trim();
}

function stripHtml(text = '') {
  return decodeEntities(String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(text = '') {
  return stripHtml(text)
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function limitText(text = '', maxLength = 80) {
  const normalized = stripHtml(text);
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength);
}

function normalizeText(text = '') {
  return stripHtml(text).replace(/\s+/g, ' ').trim();
}

function buildStableId(parts) {
  const sourceText = parts.filter(Boolean).join('|');
  let hash = 0;

  for (let index = 0; index < sourceText.length; index += 1) {
    hash = (hash << 5) - hash + sourceText.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

module.exports = {
  buildStableId,
  decodeEntities,
  limitText,
  normalizeText,
  normalizeTitle,
  stripHtml,
};
