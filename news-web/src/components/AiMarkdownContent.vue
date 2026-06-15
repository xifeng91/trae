<script setup>
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { computed } from 'vue';

marked.use({
  gfm: true,
  breaks: true,
});

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
});

const SAFE_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

const SAFE_ATTRS = ['alt', 'href', 'loading', 'rel', 'src', 'target', 'title'];

function isSafeRemoteUrl(url = '') {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function normalizeRenderedHtml(html = '') {
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';

    if (!isSafeRemoteUrl(href)) {
      link.removeAttribute('href');
      return;
    }

    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });

  template.content.querySelectorAll('img[src]').forEach((image) => {
    const src = image.getAttribute('src') || '';

    if (!isSafeRemoteUrl(src)) {
      image.remove();
      return;
    }

    image.setAttribute('loading', 'lazy');
    if (!image.getAttribute('alt')) image.setAttribute('alt', 'AI 解读配图');
  });

  return template.innerHTML;
}

const renderedHtml = computed(() => {
  const markdown = String(props.content || '').trim();
  if (!markdown) return '';

  const rawHtml = marked.parse(markdown);
  const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: SAFE_ATTRS,
    FORBID_ATTR: ['style', 'onclick', 'onerror', 'onload'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
  });

  return normalizeRenderedHtml(sanitizedHtml);
});
</script>

<template>
  <div v-if="renderedHtml" class="ai-markdown-content" v-html="renderedHtml" />
</template>
