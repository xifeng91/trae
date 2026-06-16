import { computed, reactive } from 'vue';
import { getInterpretationStreamUrl } from '../api/newsApi';

const TYPEWRITER_INTERVAL = 22;
const TYPEWRITER_CHUNK_SIZE = 2;

const entries = reactive(new Map());
let ownerSequence = 0;

export function createInterpretationOwnerKey() {
  ownerSequence += 1;
  return `news-card-${ownerSequence}`;
}

function parseEventPayload(event) {
  try {
    return JSON.parse(event.data || '{}');
  } catch (error) {
    return {};
  }
}

function createEntry(news = {}) {
  const interpretation = String(news.interpretation || '').trim();
  const status = interpretation ? 'success' : news.interpretationStatus || 'pending';

  return reactive({
    id: news.id || '',
    status,
    displayText: interpretation,
    fullText: interpretation,
    rawText: interpretation,
    error: '',
    ownerKey: '',
    eventSource: null,
    typewriterTimer: null,
    incomingBuffer: '',
    streamDone: false,
    pendingStatus: 'success',
    isCachedStream: false,
  });
}

export function getInterpretationEntry(news = {}) {
  const newsId = news.id || '';
  if (!newsId) return createEntry(news);

  if (!entries.has(newsId)) {
    entries.set(newsId, createEntry(news));
  }

  const entry = entries.get(newsId);
  const interpretation = String(news.interpretation || '').trim();
  if (interpretation && (!entry.fullText || entry.status !== 'success')) {
    entry.displayText = interpretation;
    entry.fullText = interpretation;
    entry.rawText = interpretation;
    entry.status = 'success';
  }

  if (!entry.status || entry.status === 'pending') {
    entry.status = news.interpretationStatus || entry.status || 'pending';
  }

  return entry;
}

function closeStream(entry) {
  if (!entry.eventSource) return;

  entry.eventSource.close();
  entry.eventSource = null;
}

function stopTypewriter(entry) {
  if (!entry.typewriterTimer) return;

  window.clearInterval(entry.typewriterTimer);
  entry.typewriterTimer = null;
}

function resetEntry(entry, ownerKey) {
  closeStream(entry);
  stopTypewriter(entry);
  entry.displayText = '';
  entry.fullText = '';
  entry.rawText = '';
  entry.error = '';
  entry.ownerKey = ownerKey;
  entry.incomingBuffer = '';
  entry.streamDone = false;
  entry.pendingStatus = 'success';
  entry.isCachedStream = false;
}

function finishTypewriterIfReady(entry) {
  if (!entry.streamDone || entry.incomingBuffer.length > 0) return;

  stopTypewriter(entry);
  entry.displayText = entry.fullText || entry.displayText;
  entry.status = entry.pendingStatus;
}

function flushTypewriter(entry) {
  if (entry.incomingBuffer.length === 0) {
    finishTypewriterIfReady(entry);
    return;
  }

  const chunk = entry.incomingBuffer.slice(0, TYPEWRITER_CHUNK_SIZE);
  entry.incomingBuffer = entry.incomingBuffer.slice(TYPEWRITER_CHUNK_SIZE);
  entry.displayText += chunk;
}

function startTypewriter(entry) {
  if (entry.typewriterTimer) return;

  entry.typewriterTimer = window.setInterval(() => flushTypewriter(entry), TYPEWRITER_INTERVAL);
  flushTypewriter(entry);
}

function enqueueText(entry, text = '') {
  if (!text) return;

  entry.rawText += text;
  if (entry.isCachedStream) return;

  entry.incomingBuffer += text;
  startTypewriter(entry);
}

function completeEntry(entry, payload = {}) {
  entry.pendingStatus = payload.interpretationStatus || payload.aiStatus || 'success';
  entry.fullText = payload.interpretation || entry.rawText || entry.displayText;
  entry.streamDone = true;
  closeStream(entry);

  if (entry.isCachedStream) {
    stopTypewriter(entry);
    entry.displayText = entry.fullText;
    entry.status = entry.pendingStatus;
    return;
  }

  if (entry.fullText && entry.fullText.length > entry.displayText.length + entry.incomingBuffer.length) {
    entry.incomingBuffer += entry.fullText.slice(entry.displayText.length + entry.incomingBuffer.length);
    startTypewriter(entry);
  }

  finishTypewriterIfReady(entry);
}

function failEntry(entry, message) {
  entry.error = message || 'AI 解读生成失败，请稍后重试';
  entry.status = 'failed';
  entry.streamDone = true;
  closeStream(entry);
  stopTypewriter(entry);
}

export function startInterpretation(news = {}, ownerKey, options = {}) {
  const entry = getInterpretationEntry(news);
  if (!news.id) return entry;

  if (!options.force) {
    if (entry.status === 'success' && entry.fullText) return entry;
    if (entry.status === 'generating') return entry;
    if (entry.displayText || entry.fullText) return entry;
  }

  resetEntry(entry, ownerKey);
  entry.status = 'generating';

  const eventSource = new EventSource(getInterpretationStreamUrl(news.id, { force: options.force }));
  entry.eventSource = eventSource;

  eventSource.addEventListener('meta', (event) => {
    const payload = parseEventPayload(event);
    entry.isCachedStream = payload.status === 'cached';
    entry.status = payload.status === 'cached' ? 'generating' : payload.status || 'generating';
  });

  eventSource.addEventListener('delta', (event) => {
    const payload = parseEventPayload(event);
    enqueueText(entry, payload.text || '');
  });

  eventSource.addEventListener('done', (event) => {
    completeEntry(entry, parseEventPayload(event));
  });

  eventSource.addEventListener('fail', (event) => {
    const payload = parseEventPayload(event);
    failEntry(entry, payload.message);
  });

  eventSource.onerror = () => {
    if (entry.eventSource !== eventSource) return;
    failEntry(entry, 'AI 解读连接中断，请稍后重试');
  };

  return entry;
}

export function useInterpretationCache(news, ownerKey) {
  const entry = computed(() => getInterpretationEntry(news.value || news));
  const isOwner = computed(() => entry.value.ownerKey === ownerKey);
  const isGenerating = computed(() => entry.value.status === 'generating');
  const interpretationText = computed(() => {
    if (entry.value.status === 'success') return entry.value.fullText || entry.value.displayText;
    if (isOwner.value) return entry.value.displayText;

    return '';
  });
  const hasInterpretation = computed(() => interpretationText.value.trim().length > 0);
  const canRetry = computed(() => entry.value.status === 'failed' || Boolean(entry.value.error));

  return {
    canRetry,
    entry,
    hasInterpretation,
    interpretationText,
    isGenerating,
    isOwner,
    startInterpretation,
  };
}
