import { config, todayInTimeZone } from './config.js';

export async function fetchNewsInterest(stock, { timeoutMs = 10_000, todayOnly = false, lookbackDays = 3 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const today = todayInTimeZone(config.timeZone);
  const fromDate = dateDaysAgo(today, lookbackDays);
  const errors = [];

  try {
    let rssItems = [];
    let webItems = [];

    try {
      rssItems = await fetchYahooRssItems(stock, controller.signal);
    } catch (error) {
      errors.push(`Yahoo RSS: ${error.message}`);
    }

    try {
      webItems = await fetchBingNewsSearchItems(stock, { signal: controller.signal, today });
    } catch (error) {
      errors.push(`Bing News search: ${error.message}`);
    }

    const items = mergeNewsItems([...rssItems, ...webItems]);
    const todaysItems = items.filter((item) => dateInTimeZone(item.publishedAt, config.timeZone) === today);
    const windowItems = items.filter((item) => isDateBetween(item.publishedDate, fromDate, today));
    const webSearchFallback = todayOnly && windowItems.length === 0 && webItems.length > 0;
    const recentFallback = todayOnly && windowItems.length === 0 && rssItems.length > 0;
    const selectedItems = todayOnly
      ? (windowItems.length ? windowItems : webItems.slice(0, 6))
      : (todaysItems.length ? todaysItems : windowItems.length ? windowItems : items.slice(0, 5));
    return {
      source: sourceLabel(rssItems, webItems),
      today,
      dateRange: { from: fromDate, to: today },
      lookbackDays,
      todayOnly,
      recentFallback,
      webSearchFallback,
      olderItemsAvailable: recentFallback,
      selectedPeriod: todayOnly ? (webSearchFallback ? 'web-search' : '3d') : 'today',
      todayItemCount: todaysItems.length,
      windowItemCount: windowItems.length,
      webSearchItemCount: webItems.length,
      score: scoreNews(selectedItems),
      items: selectedItems.slice(0, 6),
      allItems: items.slice(0, 10),
      errors
    };
  } catch (error) {
    return {
      source: 'none',
      today,
      dateRange: { from: fromDate, to: today },
      lookbackDays,
      todayOnly,
      score: 0,
      error: [error.message, ...errors].filter(Boolean).join('; '),
      items: [],
      allItems: []
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeTodaysNewsWithAI(stock, news, snapshot = {}) {
  const headlines = (news.items || []).slice(0, 6);
  if (headlines.length > 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ai.lmStudioTimeoutMs);
    try {
      const prompt = buildNewsPrompt(stock, news, snapshot);
      const headers = { 'Content-Type': 'application/json' };
      if (config.ai.lmStudioApiKey) {
        headers.Authorization = `Bearer ${config.ai.lmStudioApiKey}`;
      }
      const response = await fetch(openAICompatibleUrl(config.ai.lmStudioBaseUrl, 'chat/completions'), {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: config.ai.lmStudioModel,
          messages: [
            {
              role: 'system',
              content: 'You classify stock-news impact for trading. Return strict JSON only. Do not include markdown or extra prose.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: config.ai.lmStudioMaxTokens,
          reasoning_effort: config.ai.lmStudioReasoningEffort
        })
      });
      if (!response.ok) throw new Error(`LM Studio API HTTP ${response.status}`);
      const body = await response.json();
      const text = chatCompletionText(body);
      const parsed = parseJsonFromText(text) || inferAnalysisFromModelText(text, stock, news);
      return normalizeAIAnalysis(parsed, {
        mode: 'lmstudio',
        prompt,
        rawText: text,
        stock,
        news
      });
    } catch (error) {
      return {
        ...localNewsAnalysis(stock, news),
        mode: 'local-fallback',
        engine: newsEngineMetadata('local-fallback'),
        error: error.message
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return localNewsAnalysis(stock, news);
}

async function fetchYahooRssItems(stock, signal) {
  const url = new URL('https://feeds.finance.yahoo.com/rss/2.0/headline');
  url.searchParams.set('s', stock.yfSymbol);
  url.searchParams.set('region', 'US');
  url.searchParams.set('lang', 'en-US');
  const response = await fetch(url, {
    signal,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!response.ok) throw new Error(`news HTTP ${response.status}`);
  const xml = await response.text();
  return rssItemsFromXml(xml, {
    source: 'yahoo-rss',
    sourceName: 'Yahoo Finance'
  }).slice(0, 12);
}

async function fetchBingNewsSearchItems(stock, { signal, today }) {
  const queries = [
    `${stock.code} ${stock.name || ''} news`,
    `${stock.name || stock.code} Indonesia news`,
    `${stock.code} saham berita`,
    `${stock.yfSymbol} stock news`
  ].map((query) => query.replace(/\s+/g, ' ').trim());
  const items = [];
  const errors = [];
  for (const query of [...new Set(queries)]) {
    try {
      const url = new URL('https://www.bing.com/news/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'rss');
      url.searchParams.set('mkt', 'en-ID');
      url.searchParams.set('setlang', 'en');
      const response = await fetch(url, {
        signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RobotTradingNewsCrawler/1.0)' }
      });
      if (!response.ok) throw new Error(`search HTTP ${response.status}`);
      const xml = await response.text();
      items.push(...rssItemsFromXml(xml, {
        source: 'bing-news-search',
        sourceName: 'Bing News Search',
        searchQuery: query,
        unwrapLinks: true
      }));
      if (items.length >= 8) break;
    } catch (error) {
      errors.push(`${query}: ${error.message}`);
    }
  }
  const merged = mergeNewsItems(items).slice(0, 8);
  if (merged.length === 0 && errors.length) throw new Error(errors.slice(0, 2).join('; '));
  return merged;
}

function rssItemsFromXml(xml, { source, sourceName, searchQuery = '', unwrapLinks = false } = {}) {
  return [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((match) => {
      const rawLink = decodeXml(textBetween(match[1], 'link'));
      const link = unwrapLinks ? unwrapBingUrl(rawLink) : rawLink;
      const publishedAt = decodeXml(textBetween(match[1], 'pubDate'));
      const summary = cleanSummary(decodeXml(textBetween(match[1], 'description')));
      const itemSourceName = decodeXml(textBetween(match[1], 'News:Source')) || sourceName || domainFromUrl(link);
      return {
        title: cleanSummary(decodeXml(textBetween(match[1], 'title'))),
        link,
        publishedAt,
        publishedDate: dateInTimeZone(publishedAt, config.timeZone),
        summary,
        source,
        sourceName: itemSourceName,
        sourceDomain: domainFromUrl(link),
        searchQuery
      };
    })
    .filter((item) => item.title && item.link);
}

function buildNewsPrompt(stock, news) {
  const periodLabel = news.webSearchFallback
    ? `web-search results because no dated headline was found from ${news.dateRange?.from || news.today} to ${news.dateRange?.to || news.today}`
    : news.recentFallback
    ? `recent headlines because no headline was found from ${news.dateRange?.from || news.today} to ${news.dateRange?.to || news.today}`
    : `news updates from ${news.dateRange?.from || news.today} to ${news.dateRange?.to || news.today}`;
  const headlineText = (news.items || [])
    .map((item, index) => [
      `${index + 1}. [${item.publishedDate || 'unknown date'}] ${item.title} (${item.publishedAt || 'unknown time'})`,
      `   Summary: ${item.summary || 'No search snippet available.'}`,
      `   Source: ${item.sourceName || item.source || 'unknown'} ${item.link ? `- ${item.link}` : ''}`
    ].join('\n'))
    .join('\n') || 'No headlines found.';
  return [
    `Analyze ${periodLabel} for ${stock.yfSymbol} (${stock.name || stock.code}).`,
    'Use only the news updates. Do not use price, indicator, chart, or technical context.',
    'Summarize what happened in the 3-day news window, including dates when available.',
    'Classify only the stock-news impact for short-term trading as positive, neutral, or negative.',
    'Return strict JSON only with keys: verdict, score, confidencePercentage, summary, reasons, dailySummary.',
    'score must be from -18 to 18, where positive supports buying and negative supports selling/avoiding.',
    'confidencePercentage must be 0 to 100.',
    'reasons must be an array of short strings.',
    'dailySummary must be an array of short strings in this format: YYYY-MM-DD: what happened.',
    'Headlines:',
    headlineText
  ].join('\n');
}

function localNewsAnalysis(stock, news) {
  const items = news.items || [];
  if (items.length === 0) {
    const olderNote = news.recentFallback ? ' Older RSS headlines exist, but they are outside the 3-day decision window and were ignored.' : '';
    const webNote = news.webSearchItemCount === 0 ? ' Web-search did not return usable source results.' : '';
    return {
      mode: 'local',
      engine: newsEngineMetadata('local'),
      verdict: 'neutral',
      score: 0,
      confidencePercentage: 35,
      summary: `No RSS or web-search headlines found for ${stock.yfSymbol} from ${news.dateRange?.from || news.today} to ${news.dateRange?.to || news.today}.${olderNote}${webNote}`,
      reasons: ['No headline catalyst was available from the configured news feed.'],
      headlineCount: 0,
      today: news.today,
      dateRange: news.dateRange,
      selectedPeriod: news.selectedPeriod || '3d',
      dailySummary: [],
      sourceUrl: primaryNewsSourceUrl(news),
      items
    };
  }

  const positivePattern = /\b(upgrade|beats?|profit|growth|record|surge|rally|dividend|buyback|approval|contract|expansion|raises?|strong|secures?|wins?|partnership)\b/i;
  const negativePattern = /\b(downgrade|loss|probe|lawsuit|plunge|falls?|cuts?|weak|default|delay|decline|misses?|risk|sanction|fraud|warning)\b/i;
  let raw = 0;
  const reasons = [];
  for (const item of items) {
    const positive = positivePattern.test(item.title);
    const negative = negativePattern.test(item.title);
    if (positive) raw += 1;
    if (negative) raw -= 1;
    if (positive || negative) reasons.push(item.title);
  }
  const score = clamp(raw * 6, -18, 18);
  const verdict = score > 3 ? 'positive' : score < -3 ? 'negative' : 'neutral';
  const confidencePercentage = clamp(45 + Math.abs(score) * 2.5 + Math.min(items.length, 4) * 3, 35, 86);
  const periodLabel = news.selectedPeriod === 'web-search' ? 'web-search fallback' : news.selectedPeriod === '3d' ? '3-day' : 'today';
  const dailySummary = groupHeadlinesByDate(items);
  const sourceNames = sourceNamesFromItems(items);
  return {
    mode: 'local',
    engine: newsEngineMetadata('local'),
    verdict,
    score,
    confidencePercentage: round(confidencePercentage),
    summary: `${items.length} ${periodLabel} headline${items.length === 1 ? '' : 's'} analyzed for ${stock.yfSymbol}; news reads ${verdict}. Sources: ${sourceNames.join(', ') || news.source || 'news feed'}.`,
    reasons: reasons.slice(0, 3),
    headlineCount: items.length,
    today: news.today,
    dateRange: news.dateRange,
    selectedPeriod: news.selectedPeriod || '3d',
    dailySummary,
    sourceUrl: primaryNewsSourceUrl(news),
    items
  };
}

function normalizeAIAnalysis(parsed, context) {
  const fallback = localNewsAnalysis(context.stock, context.news);
  const verdict = ['positive', 'negative', 'neutral'].includes(String(parsed?.verdict || '').toLowerCase())
    ? String(parsed.verdict).toLowerCase()
    : fallback.verdict;
  const signedScore = verdict === 'negative' ? -Math.abs(Number(parsed?.score ?? fallback.score)) : Number(parsed?.score ?? fallback.score);
  return {
    mode: context.mode,
    engine: newsEngineMetadata(context.mode),
    verdict,
    score: clamp(signedScore, -18, 18),
    confidencePercentage: clamp(Number(parsed?.confidencePercentage ?? fallback.confidencePercentage), 0, 100),
    summary: String(parsed?.summary || fallback.summary).slice(0, 260),
    reasons: Array.isArray(parsed?.reasons) ? parsed.reasons.map((item) => String(item)).slice(0, 4) : fallback.reasons,
    dailySummary: Array.isArray(parsed?.dailySummary) ? parsed.dailySummary.map((item) => String(item)).slice(0, 4) : fallback.dailySummary,
    headlineCount: context.news.items?.length || 0,
    today: context.news.today,
    dateRange: context.news.dateRange,
    selectedPeriod: context.news.selectedPeriod || '3d',
    sourceUrl: primaryNewsSourceUrl(context.news),
    items: context.news.items || [],
    prompt: context.prompt,
    rawText: context.rawText
  };
}

function newsEngineMetadata(mode) {
  if (mode === 'lmstudio') {
    return {
      provider: 'lmstudio',
      label: 'LM Studio',
      model: config.ai.lmStudioModel,
      usedLmStudio: true
    };
  }
  if (mode === 'local-fallback') {
    return {
      provider: 'local-fallback',
      label: 'Local fallback',
      model: 'keyword scoring',
      attemptedProvider: 'lmstudio',
      attemptedModel: config.ai.lmStudioModel,
      usedLmStudio: false
    };
  }
  return {
    provider: 'local',
    label: 'Local rules',
    model: 'keyword scoring',
    usedLmStudio: false
  };
}

function inferAnalysisFromModelText(text, stock, news) {
  const value = String(text || '');
  const verdictMatch = value.match(/(?:sentiment|impact|verdict|classification)\s*[:\-]\s*(?:overwhelmingly|strongly|moderately|slightly)?\s*(positive|negative|neutral)/i);
  if (!verdictMatch) return null;

  const verdict = verdictMatch[1].toLowerCase();
  const strong = /\b(overwhelmingly|strongly|very|clear|clearly|significant|highly)\b/i.test(value);
  const mild = /\b(slightly|mild|limited|mixed|cautious)\b/i.test(value);
  const magnitude = verdict === 'neutral' ? 0 : strong ? 12 : mild ? 5 : 8;
  const score = verdict === 'negative' ? -magnitude : magnitude;
  const confidencePercentage = verdict === 'neutral' ? 52 : strong ? 72 : mild ? 58 : 64;
  const firstHeadline = news.items?.[0]?.title || stock.yfSymbol;

  return {
    verdict,
    score,
    confidencePercentage,
    summary: `LM Studio reads the available headline as ${verdict}: ${firstHeadline}`,
    reasons: news.items?.slice(0, 3).map((item) => item.title) || [],
    dailySummary: groupHeadlinesByDate(news.items || [])
  };
}

function primaryNewsSourceUrl(news) {
  if (news.recentFallback && (news.items || []).length === 0) return '';
  const item = (news.items || []).find((entry) => entry.link)
    || (news.allItems || []).find((entry) => entry.link);
  return item?.link || '';
}

function mergeNewsItems(items) {
  const seen = new Set();
  return items
    .filter((item) => item?.title && item?.link)
    .filter((item) => {
      const key = normalizeNewsKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.publishedDate || '').localeCompare(String(a.publishedDate || '')));
}

function normalizeNewsKey(item) {
  const urlKey = item.link ? item.link.replace(/[?#].*$/, '').toLowerCase() : '';
  const titleKey = String(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return urlKey || titleKey;
}

function sourceLabel(rssItems, webItems) {
  if (rssItems.length && webItems.length) return 'yahoo-rss+bing-news-search';
  if (webItems.length) return 'bing-news-search';
  if (rssItems.length) return 'yahoo-rss';
  return 'none';
}

function sourceNamesFromItems(items) {
  return [...new Set((items || [])
    .map((item) => item.sourceName || item.sourceDomain || domainFromUrl(item.link))
    .filter(Boolean))]
    .slice(0, 4);
}

function unwrapBingUrl(value) {
  try {
    const url = new URL(value);
    const target = url.searchParams.get('url');
    return target ? decodeURIComponent(target) : value;
  } catch {
    return value;
  }
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function cleanSummary(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function openAICompatibleUrl(baseUrl, path) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function chatCompletionText(body) {
  const message = body.choices?.[0]?.message || {};
  return message.content
    || message.reasoning_content
    || body.output_text
    || body.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join('\n')
    || '';
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function scoreNews(items) {
  const highInterest = /\b(upgrade|downgrade|earnings|profit|merger|acquisition|dividend|buyback|record|surge|plunge|guidance|approval|contract|lawsuit|probe)\b/i;
  return items.reduce((score, item) => score + 1 + (highInterest.test(item.title) ? 2 : 0), 0);
}

function groupHeadlinesByDate(items) {
  const groups = new Map();
  for (const item of items) {
    const date = item.publishedDate || 'unknown date';
    const list = groups.get(date) || [];
    list.push(item.title);
    groups.set(date, list);
  }
  return [...groups.entries()].map(([date, titles]) => `${date}: ${titles.slice(0, 2).join('; ')}`);
}

function dateDaysAgo(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - Math.max(0, Number(days) || 0));
  return date.toISOString().slice(0, 10);
}

function isDateBetween(dateText, fromDate, toDate) {
  return Boolean(dateText) && dateText >= fromDate && dateText <= toDate;
}

function dateInTimeZone(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function clamp(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function textBetween(text, tag) {
  const match = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '') : '';
}

function decodeXml(value) {
  return String(value || '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}
