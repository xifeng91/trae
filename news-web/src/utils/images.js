export function isGifImageUrl(url = '') {
  const text = String(url || '').trim().toLowerCase();
  if (!text) return false;
  if (text.startsWith('data:image/gif')) return true;

  const path = text.split(/[?#]/)[0];
  return path.endsWith('.gif');
}

export function getRenderableImageUrl(url = '') {
  const text = String(url || '').trim();
  if (!text || isGifImageUrl(text)) return '';

  if (text.startsWith('/')) return text;

  try {
    const baseUrl = globalThis.location?.origin || 'http://localhost';
    const parsedUrl = new URL(text, baseUrl);
    const isRemoteImage = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    const isInlineImage = parsedUrl.protocol === 'data:' && parsedUrl.href.startsWith('data:image/');

    return isRemoteImage || isInlineImage ? text : '';
  } catch (error) {
    return '';
  }
}
