import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';
import { config, currentClockInTimeZone } from './config.js';
import { initAuth, login, logout, authenticateRequest, changePassword, sessionCookie, clearSessionCookie } from './auth.js';
import { NotificationCenter } from './notifications.js';
import { WebSocketHub } from './websocket.js';
import { loadMarketSnapshot } from './marketData.js';
import { makeDecision, isDecisionTradeable } from './decisionEngine.js';
import { TradingRobot } from './tradingRobot.js';
import { getAdvisorReport } from './aiAdvisor.js';
import { readJson, writeJson } from './storage.js';
import { readSettings, updateSettings, publicSettings, stocksForMode } from './settings.js';
import { normalizeStockList, stockFromInput } from './symbols.js';
import { buildWeeklyTradingPlan, rankTopPerformers } from './ranking.js';
import { analyzeTodaysNewsWithAI, fetchNewsInterest } from './news.js';
import { buildBriefEmail, sendGmailBrief } from './email.js';
import { fetchHistoricalNewsArchive } from './news.js';
import { runBacktraceResearch } from './backtrace.js';

const notificationCenter = new NotificationCenter();
const tradingRobot = new TradingRobot();

let latestPayload = null;
let refreshInFlight = null;
let lastCronKey = '';
let rankingCache = { key: '', createdAt: 0, items: [] };
let weeklyPlanCache = { key: '', createdAt: 0, items: [] };

await initAuth();

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error', detail: error.message });
  }
});

const hub = new WebSocketHub(server, {
  authenticate: authenticateRequest
});

notificationCenter.setBroadcast((message) => hub.broadcast(message));

server.listen(config.port, () => {
  console.log(`Robot trading dashboard listening on http://localhost:${config.port}`);
});

refreshMarket('startup').catch((error) => {
  console.error('Startup refresh failed:', error);
});

setInterval(() => {
  checkScheduledAIJob().catch((error) => console.error('Scheduled AI job failed:', error));
}, 30_000);

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await readBody(req);
    const session = await login(body.username, body.password);
    if (!session) {
      sendJson(res, 401, { error: 'Invalid username or password.' });
      return;
    }
    sendJson(res, 200, { username: session.username }, { 'Set-Cookie': sessionCookie(session) });
    return;
  }

  const user = await authenticateRequest(req);
  if (url.pathname.startsWith('/api/') && !user) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/me') {
    sendJson(res, 200, { username: user.username });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    await logout(user.token);
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/password') {
    const body = await readBody(req);
    const result = await changePassword(user.username, body.oldPassword, body.newPassword);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/settings') {
    sendJson(res, 200, publicSettings(await readSettings()));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/settings') {
    const body = await readBody(req);
    const settings = await updateSettings(body);
    if (latestPayload) {
      latestPayload = {
        ...latestPayload,
        config: publicConfig(settings),
        settings: publicSettings(settings),
        tradePolicy: {
          ...(latestPayload.tradePolicy || {}),
          minScore: settings.autoTrade.minScore,
          minConfidence: settings.autoTrade.minConfidence,
          runOnRefresh: settings.autoTrade.runOnRefresh,
          takeProfitPct: settings.autoTrade.takeProfitPct,
          stopLossPct: settings.autoTrade.stopLossPct,
          parameterWeights: settings.autoTrade.parameterWeights
        }
      };
    }
    sendJson(res, 200, publicSettings(settings));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/config') {
    sendJson(res, 200, publicConfig(await readSettings()));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/snapshot') {
    if (!latestPayload) {
      latestPayload = await refreshMarket('api');
    }
    sendJson(res, 200, latestPayload);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/refresh') {
    const body = await readBody(req);
    const payload = await refreshMarket('manual', { symbolInput: body.symbol });
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/news-retry') {
    const body = await readBody(req);
    const payload = await refreshMarket('news-retry', { symbolInput: body.symbol, suppressTrade: true });
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/trade') {
    const body = await readBody(req);
    const result = await triggerManualTrade({ force: Boolean(body.force) });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/research/backtrace') {
    const body = await readBody(req);
    const payload = await runResearchBacktrace({
      symbolInput: body.symbol,
      refreshNews: Boolean(body.refreshNews)
    });
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/notifications') {
    sendJson(res, 200, { items: await notificationCenter.list() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/notifications/read') {
    const body = await readBody(req);
    sendJson(res, 200, { items: await notificationCenter.markRead(body.ids || []) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/critical-review') {
    const report = await runScheduledAIJob('manual', { force: true });
    sendJson(res, 200, report);
    return;
  }

  await serveStatic(req, res, url);
}

async function refreshMarket(reason, { symbolInput, allowTrade = false, suppressTrade = false } = {}) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const settings = await readSettings();
    const ranking = await getTopRanking(settings);
    const weeklyPlan = await getWeeklyTradingPlan(settings);
    const stock = stockFromInput(symbolInput || settings.activeSymbol || ranking[0]?.symbol);
    const snapshot = await loadMarketSnapshot(stock);
    broadcastNewsStatus({
      state: 'loading',
      stage: 'fetching',
      symbol: stock.yfSymbol,
      message: 'Fetching news sources',
      detail: 'Reading Yahoo RSS and web-search headlines before the AI verdict.'
    });
    const todaysNews = await fetchNewsInterest(stock, { todayOnly: true });
    broadcastNewsStatus({
      state: 'loading',
      stage: 'analyzing',
      symbol: stock.yfSymbol,
      message: todaysNews.items?.length ? 'Sending news to AI model' : 'Preparing local news verdict',
      detail: todaysNews.items?.length
        ? `${todaysNews.items.length} headline${todaysNews.items.length === 1 ? '' : 's'} found; requesting LM Studio analysis.`
        : 'No usable headline found in the 3-day window; local neutral verdict will be used.'
    });
    const newsAnalysis = await analyzeTodaysNewsWithAI(stock, todaysNews, snapshot);
    const newsStatus = buildNewsStatus(stock, todaysNews, newsAnalysis);
    broadcastNewsStatus(newsStatus);
    const beforePortfolio = await tradingRobot.getPortfolio();
    const decision = makeDecision(snapshot, beforePortfolio, { newsAnalysis, tradePolicy: settings.autoTrade });
    const executeTrade = isDecisionTradeable(decision, {
      enabled: settings.autoTrade.enabled && !suppressTrade && (allowTrade || settings.autoTrade.runOnRefresh),
      minScore: settings.autoTrade.minScore,
      minConfidence: settings.autoTrade.minConfidence
    });
    const tradeResult = await tradingRobot.applyDecision(snapshot, decision, reason, { execute: executeTrade });
    const [aiReports, researchReports] = await Promise.all([
      readJson('ai-reports.json', { reports: [] }),
      readJson('research-reports.json', { reports: [] })
    ]);

    if (tradeResult.transaction) {
      await notificationCenter.notify({
        title: `${tradeResult.transaction.type} ${snapshot.stock.yfSymbol}`,
        message: `${tradeResult.transaction.quantity} units at ${formatNumber(tradeResult.transaction.price)}. Balance: Rp ${formatNumber(tradeResult.transaction.balanceAfter)}.`,
        level: tradeResult.transaction.type === 'BUY' ? 'success' : 'warning',
        category: 'trade',
        metadata: tradeResult.transaction
      });
    }

    latestPayload = {
      config: publicConfig(settings),
      settings: publicSettings(settings),
      snapshot: trimSnapshot(snapshot),
      decision,
      news: {
        feed: todaysNews,
        analysis: newsAnalysis,
        status: newsStatus
      },
      tradePolicy: {
        executeTrade,
        minScore: settings.autoTrade.minScore,
        minConfidence: settings.autoTrade.minConfidence,
        runOnRefresh: settings.autoTrade.runOnRefresh,
        takeProfitPct: settings.autoTrade.takeProfitPct,
        stopLossPct: settings.autoTrade.stopLossPct,
        parameterWeights: settings.autoTrade.parameterWeights
      },
      ranking,
      weeklyPlan,
      portfolio: markToMarket(tradeResult.portfolio, snapshot),
      notifications: (await notificationCenter.list()).slice(0, 40),
      aiReports: sortReports(aiReports.reports).slice(0, 12),
      research: latestResearchForSymbol(researchReports.reports, stock.yfSymbol),
      updatedAt: new Date().toISOString()
    };
    await writeJson('market-cache.json', latestPayload);
    hub.broadcast({ type: 'snapshot', payload: latestPayload });
    return latestPayload;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function runResearchBacktrace({ symbolInput, refreshNews = false } = {}) {
  let settings = await readSettings();
  const stock = stockFromInput(symbolInput || settings.activeSymbol);
  broadcastResearchStatus(stock, 'loading', 'Loading one-year daily K-Line history');
  const snapshot = await loadMarketSnapshot(stock);
  const to = snapshot.latest?.date;
  if (!to) throw new Error('Research could not find a valid latest candle.');
  const from = addDays(to, -365);
  broadcastResearchStatus(stock, 'loading', 'Collecting backdated news archive');
  const archive = await getHistoricalNewsArchive(stock, { from, to, force: refreshNews });
  broadcastResearchStatus(stock, 'loading', 'Testing daily parameters and previous-candle performance');
  const report = runBacktraceResearch({
    snapshot,
    newsItems: archive.items,
    settings,
    applyAdjustments: true
  });

  if (report.adjustment.applied) {
    settings = await updateSettings({
      autoTrade: {
        minScore: report.finalStrategy.minScore,
        takeProfitPct: report.finalStrategy.takeProfitPct,
        stopLossPct: report.finalStrategy.stopLossPct,
        parameterWeights: report.finalStrategy.parameterWeights
      },
      aiCron: {
        minScoreToAutoTrade: report.finalStrategy.minScore
      }
    });
  }

  const researchState = await readJson('research-reports.json', { reports: [] });
  researchState.reports = sortReports([report, ...(researchState.reports || [])]).slice(0, 40);
  await writeJson('research-reports.json', researchState);

  await notificationCenter.notify({
    title: `1Y Daily Research ${stock.yfSymbol}`,
    message: `${report.final.tradeCount ? `${report.final.winRatePercentage}% final strategy win rate` : 'Final strategy win rate is not measurable'} across ${report.final.tradeCount} validation trades. ${report.adjustment.applied ? 'Validated parameters were applied.' : report.adjustment.recommendation}`,
    level: report.adjustment.applied ? 'success' : 'info',
    category: 'research',
    metadata: {
      symbol: stock.yfSymbol,
      range: '1y',
      timeframe: '1D',
      winRatePercentage: report.final.winRatePercentage,
      applied: report.adjustment.applied
    }
  });

  const basePayload = latestPayload?.snapshot?.yfSymbol === stock.yfSymbol
    ? latestPayload
    : await refreshMarket('post-research-load', { symbolInput: stock.yfSymbol, suppressTrade: true });
  const portfolio = await tradingRobot.getPortfolio();
  const displaySnapshot = trimSnapshot(snapshot);
  const decision = makeDecision(snapshot, portfolio, {
    newsAnalysis: basePayload.news?.analysis,
    tradePolicy: settings.autoTrade
  });
  latestPayload = {
    ...basePayload,
    settings: publicSettings(settings),
    snapshot: displaySnapshot,
    decision,
    research: report,
    tradePolicy: {
      ...basePayload.tradePolicy,
      minScore: settings.autoTrade.minScore,
      minConfidence: settings.autoTrade.minConfidence,
      takeProfitPct: settings.autoTrade.takeProfitPct,
      stopLossPct: settings.autoTrade.stopLossPct,
      parameterWeights: settings.autoTrade.parameterWeights
    },
    portfolio: markToMarket(portfolio, displaySnapshot),
    notifications: (await notificationCenter.list()).slice(0, 40),
    updatedAt: new Date().toISOString()
  };
  await writeJson('market-cache.json', latestPayload);
  broadcastResearchStatus(
    stock,
    'completed',
    report.final.tradeCount
      ? `Research completed at ${report.final.winRatePercentage}% final strategy win rate`
      : 'Research completed with no executable validation trade'
  );
  hub.broadcast({ type: 'snapshot', payload: latestPayload });
  return latestPayload;
}

async function getHistoricalNewsArchive(stock, { from, to, force = false } = {}) {
  const state = await readJson('historical-news.json', { symbols: {} });
  const cached = state.symbols?.[stock.yfSymbol];
  const cacheFresh = cached?.schemaVersion === 2
    && cached?.fetchedAt
    && Date.now() - Date.parse(cached.fetchedAt) < 24 * 60 * 60 * 1000;
  const cacheCoversRange = cached?.from <= from && cached?.to >= to;
  if (!force && cacheFresh && cacheCoversRange) return cached;

  const fetched = await fetchHistoricalNewsArchive(stock, { from, to });
  const mergedItems = mergeArchivedNewsItems([...(cached?.items || []), ...(fetched.items || [])])
    .filter((item) => item.publishedDate >= from && item.publishedDate <= to)
    .slice(0, 800);
  const archive = {
    ...fetched,
    schemaVersion: 2,
    from,
    to,
    itemCount: mergedItems.length,
    items: mergedItems
  };
  state.symbols = { ...(state.symbols || {}), [stock.yfSymbol]: archive };
  await writeJson('historical-news.json', state);
  return archive;
}

function broadcastResearchStatus(stock, state, message) {
  hub.broadcast({
    type: 'research-status',
    payload: {
      state,
      symbol: stock.yfSymbol,
      message,
      updatedAt: new Date().toISOString()
    }
  });
}

function mergeArchivedNewsItems(items) {
  const seen = new Set();
  return items
    .filter((item) => item?.title && item?.publishedDate)
    .filter((item) => {
      const key = `${item.publishedDate}|${String(item.title).toLowerCase().replace(/\s+/g, ' ').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.publishedDate).localeCompare(String(a.publishedDate)));
}

async function triggerManualTrade({ force = false } = {}) {
  const settings = await readSettings();
  const payload = latestPayload || await refreshMarket('trade-load');
  const decision = payload.decision;
  const snapshot = payload.snapshot;
  const gateAllowed = isDecisionTradeable(decision, {
    enabled: settings.autoTrade.enabled,
    minScore: settings.autoTrade.minScore,
    minConfidence: settings.autoTrade.minConfidence
  });
  const execute = force ? decision.action !== 'HOLD' : gateAllowed;
  const tradeResult = await tradingRobot.applyDecision(snapshot, decision, force ? 'manual-trade' : 'manual-auto-trade', { execute });
  const note = tradeResult.transaction
    ? 'Trade executed.'
    : execute
      ? 'No trade was possible for the current position state.'
      : force
        ? 'Current verdict is HOLD, so no trade was executed.'
        : 'Auto trade gate blocked execution.';

  await notificationCenter.notify({
    title: tradeResult.transaction ? `${tradeResult.transaction.type} ${snapshot.stock?.yfSymbol || snapshot.yfSymbol}` : 'Trade not executed',
    message: tradeResult.transaction
      ? `${tradeResult.transaction.quantity} units at ${formatNumber(tradeResult.transaction.price)}. Balance: Rp ${formatNumber(tradeResult.transaction.balanceAfter)}.`
      : `${note} Action: ${decision.action}, score: ${formatNumber(decision.score)}, min score: ${formatNumber(settings.autoTrade.minScore)}.`,
    level: tradeResult.transaction ? 'success' : 'info',
    category: tradeResult.transaction ? 'trade' : 'trade-gate',
    metadata: {
      force,
      gateAllowed,
      action: decision.action,
      score: decision.score,
      minScore: settings.autoTrade.minScore,
      transaction: tradeResult.transaction
    }
  });

  latestPayload = await refreshMarket(tradeResult.transaction ? 'post-trade' : 'post-trade-check');
  latestPayload = {
    ...latestPayload,
    tradeResult: {
      executed: Boolean(tradeResult.transaction),
      transaction: tradeResult.transaction,
      note,
      force,
      gateAllowed
    },
    notifications: (await notificationCenter.list()).slice(0, 40)
  };
  hub.broadcast({ type: 'snapshot', payload: latestPayload });
  return latestPayload;
}

async function checkScheduledAIJob() {
  const settings = await readSettings();
  if (!settings.aiCron.enabled) return;
  const clock = currentClockInTimeZone(config.timeZone);
  if (!settings.aiCron.times.includes(clock.time)) return;
  const key = `${clock.date} ${clock.time}`;
  if (lastCronKey === key) return;
  lastCronKey = key;
  await runScheduledAIJob(clock.time, { settings });
}

async function runScheduledAIJob(label, { force = false, settings: providedSettings } = {}) {
  const settings = providedSettings || await readSettings();
  if (!settings.aiCron.enabled && !force) {
    return { skipped: true, reason: 'AI cron is disabled.' };
  }

  const ranking = await getTopRanking(settings, { force });
  const candidates = await evaluateCandidates(settings, ranking);
  const best = candidates[0];
  if (!best) {
    return { skipped: true, reason: 'No candidates could be evaluated.' };
  }

  const executeTrade = isDecisionTradeable(best.decision, {
    enabled: settings.autoTrade.enabled,
    minScore: settings.aiCron.minScoreToAutoTrade,
    minConfidence: settings.aiCron.minConfidence
  });
  const tradeResult = await tradingRobot.applyDecision(best.snapshot, best.decision, `ai-cron-${label}`, { execute: executeTrade });
  const report = await getAdvisorReport(best.snapshot, best.decision, tradeResult.portfolio, label);
  const emailText = buildBriefEmail({ report, candidates });
  const emailResult = settings.aiCron.emailEnabled ? await sendGmailBrief(settings, {
    subject: `Robot Trading Brief: ${best.symbol} ${best.decision.action} score ${best.decision.score}`,
    text: emailText
  }).catch((error) => ({ sent: false, reason: error.message })) : { sent: false, reason: 'Email disabled for this AI job.' };

  const state = await readJson('ai-reports.json', { reports: [] });
  const savedReport = {
    id: `ai_${Date.now()}`,
    label,
    symbol: best.symbol,
    tvSymbol: best.tvSymbol,
    action: best.decision.action,
    score: best.decision.score,
    technicalScore: best.decision.technicalScore,
    newsScore: best.decision.newsScore,
    confidence: best.decision.confidence,
    confidencePercentage: best.decision.confidencePercentage,
    newsAnalysis: best.newsAnalysis,
    interestScore: best.interestScore,
    tradeExecuted: Boolean(tradeResult.transaction),
    trade: tradeResult.transaction,
    email: emailResult,
    candidates: candidates.map(lightCandidate),
    ...report
  };
  state.reports = sortReports([savedReport, ...state.reports]).slice(0, 80);
  await writeJson('ai-reports.json', state);

  await notificationCenter.notify({
    title: `AI job ${label}: ${best.symbol}`,
    message: `${report.text} Email: ${emailResult.sent ? 'sent' : emailResult.reason}.`,
    level: best.decision.action === 'BUY' ? 'success' : best.decision.action === 'SELL' ? 'warning' : 'info',
    category: 'ai-review',
    metadata: {
      label,
      symbol: best.symbol,
      decision: best.decision.action,
      score: best.decision.score,
      tradeExecuted: Boolean(tradeResult.transaction),
      email: emailResult
    }
  });

  latestPayload = await refreshMarket(`post-ai-${label}`);
  latestPayload = { ...latestPayload, aiReports: state.reports.slice(0, 12), notifications: (await notificationCenter.list()).slice(0, 40) };
  hub.broadcast({ type: 'snapshot', payload: latestPayload });
  return savedReport;
}

async function evaluateCandidates(settings, ranking) {
  const portfolio = await tradingRobot.getPortfolio();
  const stocks = stocksForMode(settings, ranking);
  const candidates = [];

  for (const stock of stocks.slice(0, 10)) {
    try {
      const snapshot = await loadMarketSnapshot(stock);
      const rankingRecord = ranking.find((item) => item.symbol === stock.yfSymbol) || null;
      const news = await fetchNewsInterest(stock, { todayOnly: true });
      const newsAnalysis = await analyzeTodaysNewsWithAI(stock, news, snapshot);
      const decision = makeDecision(snapshot, portfolio, { newsAnalysis, tradePolicy: settings.autoTrade });
      const headlineInterest = Math.min(Number(newsAnalysis.headlineCount || 0), 4) * 0.5;
      const interestScore = round((decision.score || 0) + ((rankingRecord?.performance3m || 0) * 0.45) + headlineInterest);
      candidates.push({
        stock,
        symbol: stock.yfSymbol,
        tvSymbol: stock.tvSymbol,
        snapshot: trimSnapshot(snapshot),
        decision,
        ranking: rankingRecord,
        news,
        newsAnalysis,
        interestScore
      });
    } catch (error) {
      candidates.push({
        stock,
        symbol: stock.yfSymbol,
        tvSymbol: stock.tvSymbol,
        error: error.message,
        decision: { action: 'HOLD', score: 0, confidence: 'low', confidencePercentage: 0, verdict: 'Candidate failed' },
        news: { score: 0, items: [] },
        newsAnalysis: { verdict: 'neutral', score: 0, confidencePercentage: 0, summary: error.message },
        interestScore: -999
      });
    }
  }

  return candidates.sort((a, b) => b.interestScore - a.interestScore);
}

async function getTopRanking(settings, { force = false } = {}) {
  const key = normalizeStockList(settings.rankingUniverse).map((stock) => stock.yfSymbol).join(',');
  const fresh = Date.now() - rankingCache.createdAt < 10 * 60 * 1000;
  if (!force && fresh && rankingCache.key === key) return rankingCache.items;
  const items = await rankTopPerformers(settings.rankingUniverse, { months: 3, limit: 10 });
  rankingCache = { key, createdAt: Date.now(), items };
  return items;
}

async function getWeeklyTradingPlan(settings, { force = false } = {}) {
  const key = normalizeStockList(settings.rankingUniverse).map((stock) => stock.yfSymbol).join(',');
  const fresh = Date.now() - weeklyPlanCache.createdAt < 10 * 60 * 1000;
  if (!force && fresh && weeklyPlanCache.key === key) return weeklyPlanCache.items;
  const items = await buildWeeklyTradingPlan(settings.rankingUniverse, { limit: 10 });
  weeklyPlanCache = { key, createdAt: Date.now(), items };
  return items;
}

function broadcastNewsStatus(status) {
  const payload = {
    updatedAt: new Date().toISOString(),
    ...status
  };
  hub.broadcast({ type: 'news-status', payload });
  return payload;
}

function buildNewsStatus(stock, news, analysis) {
  const headlineCount = Number.isFinite(analysis?.headlineCount)
    ? analysis.headlineCount
    : (analysis?.items || news?.items || []).length;
  if (analysis?.mode === 'lmstudio' || analysis?.engine?.usedLmStudio) {
    return {
      state: 'completed',
      stage: 'completed',
      symbol: stock.yfSymbol,
      message: 'News verdict completed',
      detail: `Fetched ${headlineCount} headline${headlineCount === 1 ? '' : 's'} and analyzed them with LM Studio.`,
      engine: 'LM Studio',
      headlineCount
    };
  }
  if (analysis?.mode === 'local-fallback') {
    return {
      state: 'fallback',
      stage: 'completed',
      symbol: stock.yfSymbol,
      message: 'News fetch completed with fallback',
      detail: `Fetched ${headlineCount} headline${headlineCount === 1 ? '' : 's'}, but LM Studio failed${analysis.error ? `: ${analysis.error}` : ''}. Local scoring was used.`,
      engine: 'Local fallback',
      headlineCount,
      error: analysis?.error || ''
    };
  }
  if (news?.error && headlineCount === 0) {
    return {
      state: 'failed',
      stage: 'completed',
      symbol: stock.yfSymbol,
      message: 'News fetch completed with errors',
      detail: `${news.error}. Local neutral scoring was used because no source headline was available.`,
      engine: 'Local rules',
      headlineCount,
      error: news.error
    };
  }
  return {
    state: 'completed',
    stage: 'completed',
    symbol: stock.yfSymbol,
    message: 'News verdict completed',
    detail: headlineCount
      ? `Fetched ${headlineCount} headline${headlineCount === 1 ? '' : 's'} and scored them locally.`
      : 'News fetch completed, but no usable headline was found in the configured window.',
    engine: 'Local rules',
    headlineCount
  };
}

function trimSnapshot(snapshot) {
  return {
    ...snapshot,
    candles: snapshot.candles.slice(-180),
    reversalMarkers: snapshot.reversalMarkers.slice(-80),
    calibration: {
      ...snapshot.calibration,
      records: snapshot.calibration.records
        .slice()
        .sort((a, b) => b.occurrences - a.occurrences || Math.abs(b.avgSignedReturn) - Math.abs(a.avgSignedReturn))
    }
  };
}

function markToMarket(portfolio, snapshot) {
  const output = JSON.parse(JSON.stringify(portfolio));
  const position = output.positions?.[snapshot.symbol];
  if (position && snapshot.latest?.close) {
    position.marketValue = roundMoney(position.quantity * snapshot.latest.close);
    position.unrealizedProfit = roundMoney(position.marketValue - (position.quantity * position.averagePrice));
    position.unrealizedProfitPct = roundMoney((position.unrealizedProfit / (position.quantity * position.averagePrice)) * 100);
  }
  output.equity = roundMoney(output.balance + Object.values(output.positions || {}).reduce((sum, item) => sum + (item.marketValue || item.invested || 0), 0));
  return output;
}

async function serveStatic(req, res, url) {
  const filePath = url.pathname === '/' ? path.join(config.publicDir, 'index.html') : path.join(config.publicDir, url.pathname);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(config.publicDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  try {
    const content = await fs.readFile(normalized);
    res.writeHead(200, {
      'Content-Type': contentType(normalized),
      'Cache-Control': normalized.endsWith('index.html') ? 'no-store' : 'public, max-age=60'
    });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') sendText(res, 404, 'Not found');
    else throw error;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function publicConfig(settings) {
  return {
    symbol: config.symbol,
    yfSymbol: config.yfSymbol,
    interval: config.interval,
    historyFrom: config.historyFrom,
    historyTo: config.historyTo,
    refreshPolicy: 'on-demand',
    initialBalance: config.initialBalance,
    tradeAllocationPct: config.tradeAllocationPct,
    maxPositionPct: config.maxPositionPct,
    lotSize: config.lotSize,
    timeZone: config.timeZone,
    criticalHours: settings?.aiCron?.times || config.criticalHours,
    telegramEnabled: Boolean(config.telegram.botToken && config.telegram.chatId),
    emailEnabled: Boolean(settings?.email?.enabled),
    aiMode: config.ai.mode,
    research: { range: '1y', timeframe: '1D' }
  };
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function sortReports(reports = []) {
  return reports.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function latestResearchForSymbol(reports = [], symbol) {
  return sortReports(reports).find((report) => report.symbol === symbol) || null;
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function lightCandidate(item) {
  return {
    symbol: item.symbol,
    tvSymbol: item.tvSymbol,
    action: item.decision.action,
    score: item.decision.score,
    technicalScore: item.decision.technicalScore,
    newsScore: item.decision.newsScore,
    newsRawScore: item.decision.newsRawScore,
    confidence: item.decision.confidence,
    confidencePercentage: item.decision.confidencePercentage,
    interestScore: item.interestScore,
    performance3m: item.ranking?.performance3m ?? null,
    newsVerdict: item.newsAnalysis?.verdict || 'neutral',
    newsConfidencePercentage: item.newsAnalysis?.confidencePercentage ?? 0,
    headline: item.news?.items?.[0]?.title || ''
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}
