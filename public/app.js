const elements = {
  loginView: document.querySelector('#loginView'),
  appView: document.querySelector('#appView'),
  loginForm: document.querySelector('#loginForm'),
  loginError: document.querySelector('#loginError'),
  username: document.querySelector('#username'),
  password: document.querySelector('#password'),
  logoutButton: document.querySelector('#logoutButton'),
  refreshButton: document.querySelector('#refreshButton'),
  criticalReviewButton: document.querySelector('#criticalReviewButton'),
  bellButton: document.querySelector('#bellButton'),
  bellCount: document.querySelector('#bellCount'),
  markReadButton: document.querySelector('#markReadButton'),
  notificationPanel: document.querySelector('#notificationPanel'),
  notificationList: document.querySelector('#notificationList'),
  activeViewEyebrow: document.querySelector('#activeViewEyebrow'),
  activeViewTitle: document.querySelector('#activeViewTitle'),
  activeViewDescription: document.querySelector('#activeViewDescription'),
  navItems: document.querySelectorAll('[data-view-target]'),
  pagePanels: document.querySelectorAll('[data-page]'),
  connectionDot: document.querySelector('#connectionDot'),
  symbolTitle: document.querySelector('#symbolTitle'),
  activeSymbolSelect: document.querySelector('#activeSymbolSelect'),
  verdictValue: document.querySelector('#verdictValue'),
  verdictSub: document.querySelector('#verdictSub'),
  priceValue: document.querySelector('#priceValue'),
  priceSub: document.querySelector('#priceSub'),
  rankValue: document.querySelector('#rankValue'),
  rankSub: document.querySelector('#rankSub'),
  balanceValue: document.querySelector('#balanceValue'),
  equityValue: document.querySelector('#equityValue'),
  positionValue: document.querySelector('#positionValue'),
  pnlValue: document.querySelector('#pnlValue'),
  sourceSub: document.querySelector('#sourceSub'),
  historyWindow: document.querySelector('#historyWindow'),
  historySummaryGrid: document.querySelector('#historySummaryGrid'),
  latestDateBadge: document.querySelector('#latestDateBadge'),
  scoreBadge: document.querySelector('#scoreBadge'),
  parameterList: document.querySelector('#parameterList'),
  rankingBadge: document.querySelector('#rankingBadge'),
  rankingTable: document.querySelector('#rankingTable'),
  indicatorDate: document.querySelector('#indicatorDate'),
  indicatorGrid: document.querySelector('#indicatorGrid'),
  calibrationBadge: document.querySelector('#calibrationBadge'),
  significanceTable: document.querySelector('#significanceTable'),
  signalChart: document.querySelector('#signalChart'),
  transactionTable: document.querySelector('#transactionTable'),
  aiReports: document.querySelector('#aiReports'),
  aiJobBadge: document.querySelector('#aiJobBadge'),
  newsWindowSummary: document.querySelector('#newsWindowSummary'),
  timeframeSelect: document.querySelector('#timeframeSelect'),
  timeframeVerdict: document.querySelector('#timeframeVerdict'),
  positionModeBadge: document.querySelector('#positionModeBadge'),
  positionOverviewGrid: document.querySelector('#positionOverviewGrid'),
  tradeGateSummary: document.querySelector('#tradeGateSummary'),
  autoTradeButton: document.querySelector('#autoTradeButton'),
  manualTradeButton: document.querySelector('#manualTradeButton'),
  tradeStatus: document.querySelector('#tradeStatus'),
  tradingViewShell: document.querySelector('#tradingViewShell'),
  tradingViewWidget: document.querySelector('#tradingViewWidget'),
  settingsForm: document.querySelector('#settingsForm'),
  cronEnabled: document.querySelector('#cronEnabled'),
  autoTradeEnabled: document.querySelector('#autoTradeEnabled'),
  cronTimes: document.querySelector('#cronTimes'),
  cronTimeInputs: document.querySelectorAll('[data-cron-time]'),
  symbolsMode: document.querySelector('#symbolsMode'),
  minScoreToAutoTrade: document.querySelector('#minScoreToAutoTrade'),
  minScoreLabel: document.querySelector('#minScoreLabel'),
  takeProfitPct: document.querySelector('#takeProfitPct'),
  takeProfitLabel: document.querySelector('#takeProfitLabel'),
  minConfidence: document.querySelector('#minConfidence'),
  runOnRefresh: document.querySelector('#runOnRefresh'),
  rulePreview: document.querySelector('#rulePreview'),
  rulePresetButtons: document.querySelectorAll('[data-rule-preset]'),
  selectedSymbols: document.querySelector('#selectedSymbols'),
  rankingUniverse: document.querySelector('#rankingUniverse'),
  emailEnabled: document.querySelector('#emailEnabled'),
  gmailTo: document.querySelector('#gmailTo'),
  gmailUser: document.querySelector('#gmailUser'),
  gmailAppPassword: document.querySelector('#gmailAppPassword'),
  settingsStatus: document.querySelector('#settingsStatus')
};

const state = {
  socket: null,
  payload: null,
  reconnectTimer: null,
  tradingViewSymbol: '',
  lastActionMessage: '',
  activeView: localStorage.getItem('robotTradingActiveView') || 'summary'
};

const viewCopy = {
  summary: {
    eyebrow: 'Portfolio',
    title: 'Portfolio',
    description: 'Saldo, harga, verdict, dan monitor K-Line.'
  },
  ai: {
    eyebrow: 'History',
    title: 'AI History',
    description: 'News search, bias timeframe, dan ringkasan verdict.'
  },
  position: {
    eyebrow: 'Bot Control',
    title: 'Auto Trade',
    description: 'Gate, margin profit, dan eksekusi paper order.'
  },
  notifications: {
    eyebrow: 'Activity',
    title: 'Activity',
    description: 'Notifikasi trend, ranking, dan order autotrade.'
  }
};

init();

async function init() {
  bindEvents();
  const me = await api('/api/me').catch(() => null);
  if (me?.username) {
    showApp();
    await loadSnapshot();
    connectWebSocket();
  } else {
    showLogin();
  }
}

function bindEvents() {
  setupCollapsiblePanels();

  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.loginError.textContent = '';
    const result = await api('/api/login', {
      method: 'POST',
      body: {
        username: elements.username.value,
        password: elements.password.value
      }
    }).catch((error) => ({ error: error.message }));

    if (result.error) {
      elements.loginError.textContent = result.error;
      return;
    }

    showApp();
    await loadSnapshot();
    connectWebSocket();
  });

  elements.logoutButton.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => null);
    if (state.socket) state.socket.close();
    showLogin();
  });

  elements.refreshButton.addEventListener('click', async () => {
    elements.refreshButton.disabled = true;
    try {
      const payload = await api('/api/refresh', { method: 'POST' });
      updatePayload(payload);
    } finally {
      elements.refreshButton.disabled = false;
    }
  });

  elements.criticalReviewButton.addEventListener('click', async () => {
    elements.criticalReviewButton.disabled = true;
    try {
      await api('/api/critical-review', { method: 'POST' });
      await loadSnapshot();
    } finally {
      elements.criticalReviewButton.disabled = false;
    }
  });

  elements.autoTradeButton.addEventListener('click', () => {
    triggerTrade({ force: false });
  });

  elements.manualTradeButton.addEventListener('click', () => {
    triggerTrade({ force: true });
  });

  elements.aiReports.addEventListener('click', async (event) => {
    const retryButton = event.target.closest('[data-news-retry]');
    if (retryButton) {
      await retryNewsVerdict(retryButton);
      return;
    }
    const autoTradeButton = event.target.closest('[data-auto-trade-trigger]');
    if (autoTradeButton) {
      await triggerTrade({ force: false, extraButton: autoTradeButton });
    }
  });

  elements.activeSymbolSelect.addEventListener('change', async () => {
    const activeSymbol = elements.activeSymbolSelect.value;
    await saveSettings({ activeSymbol });
    const payload = await api('/api/refresh', { method: 'POST', body: { symbol: activeSymbol } });
    updatePayload(payload);
  });

  elements.settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.settingsStatus.textContent = 'Saving...';
    const settings = gatherSettingsForm();
    const saved = await saveSettings(settings).catch((error) => ({ error: error.message }));
    if (saved.error) {
      elements.settingsStatus.textContent = saved.error;
      return;
    }
    elements.gmailAppPassword.value = '';
    elements.settingsStatus.textContent = 'Saved';
    await loadSnapshot();
  });

  elements.navItems.forEach((button) => {
    button.addEventListener('click', () => {
      activateView(button.dataset.viewTarget);
    });
  });

  elements.timeframeSelect.addEventListener('change', () => {
    if (state.payload) renderTimeframeVerdict(state.payload.decision, state.payload.news);
  });

  elements.cronTimeInputs.forEach((input) => {
    input.addEventListener('change', syncCronTimesFromChecks);
  });

  [elements.minScoreToAutoTrade, elements.takeProfitPct].forEach((input) => {
    input.addEventListener('input', syncRuleControls);
  });

  [elements.autoTradeEnabled, elements.runOnRefresh, elements.minConfidence].forEach((input) => {
    input.addEventListener('change', syncRuleControls);
  });

  elements.rulePresetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyRulePreset(button.dataset.rulePreset);
    });
  });

  elements.bellButton.addEventListener('click', () => {
    activateView('notifications');
  });

  elements.markReadButton.addEventListener('click', async () => {
    const result = await api('/api/notifications/read', { method: 'POST', body: { ids: [] } });
    if (state.payload) {
      state.payload.notifications = result.items || [];
      renderNotifications(state.payload.notifications);
    }
  });

  window.addEventListener('resize', () => {
    fitTradingViewMonitor();
    renderTechnicalSignalChart();
  });
}

function showLogin() {
  document.body.classList.remove('app-active');
  elements.appView.classList.add('hidden');
  elements.loginView.classList.remove('hidden');
  elements.password.value = '';
  elements.username.focus();
}

function showApp() {
  document.body.classList.add('app-active');
  elements.loginView.classList.add('hidden');
  elements.appView.classList.remove('hidden');
  activateView(state.activeView, { persist: false });
}

function activateView(view, options = {}) {
  const nextView = viewCopy[view] ? view : 'summary';
  const copy = viewCopy[nextView];
  state.activeView = nextView;
  elements.appView.dataset.activeView = nextView;
  elements.activeViewEyebrow.textContent = copy.eyebrow;
  elements.activeViewTitle.textContent = copy.title;
  elements.activeViewDescription.textContent = copy.description;
  elements.navItems.forEach((button) => {
    const active = button.dataset.viewTarget === nextView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  elements.pagePanels.forEach((panel) => {
    const pages = String(panel.dataset.page || '').split(/\s+/);
    panel.classList.toggle('active-page-panel', pages.includes(nextView));
  });
  if (options.persist !== false) {
    localStorage.setItem('robotTradingActiveView', nextView);
  }
  if (nextView === 'summary') {
    setTimeout(fitTradingViewMonitor, 50);
  }
  if (nextView === 'ai') {
    setTimeout(renderTechnicalSignalChart, 50);
  }
}

async function loadSnapshot() {
  const payload = await api('/api/snapshot');
  updatePayload(payload);
}

function connectWebSocket() {
  if (state.socket) state.socket.close();
  clearTimeout(state.reconnectTimer);
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
  state.socket = socket;

  socket.addEventListener('open', () => {
    elements.connectionDot.classList.add('online');
    socket.send(JSON.stringify({ type: 'refresh' }));
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'snapshot') updatePayload(message.payload);
    if (message.type === 'notification' && state.payload) {
      state.payload.notifications = [message.payload, ...(state.payload.notifications || [])];
      renderNotifications(state.payload.notifications);
    }
  });

  socket.addEventListener('close', () => {
    elements.connectionDot.classList.remove('online');
    state.reconnectTimer = setTimeout(connectWebSocket, 3000);
  });
}

function updatePayload(payload) {
  state.payload = payload;
  render(payload);
}

function render(payload) {
  const { snapshot, decision, portfolio, settings, ranking } = payload;
  const latest = snapshot.latest || {};
  const position = portfolio.positions?.[snapshot.symbol];
  const rankRecord = ranking.find((item) => item.symbol === snapshot.yfSymbol);

  elements.symbolTitle.textContent = snapshot.yfSymbol;
  elements.verdictValue.textContent = decision.action;
  elements.verdictSub.textContent = `${decision.verdict} | ${decision.confidencePercentage ?? '--'}% confidence`;
  elements.priceValue.textContent = currency(latest.close);
  elements.priceSub.textContent = `Close: ${currency(latest.close)} | Diff: ${signedPercent(latest.changePct)}`;
  elements.rankValue.textContent = rankRecord ? `#${rankRecord.rank}` : '--';
  elements.rankSub.textContent = rankRecord ? `Performance: ${signedPercent(rankRecord.performance3m)}` : 'Performance: --';
  elements.balanceValue.textContent = currency(portfolio.balance);
  elements.equityValue.textContent = `Equity: ${currency(portfolio.equity)}`;
  elements.positionValue.textContent = position ? `${formatNumber(position.quantity)} units` : 'No position';
  elements.pnlValue.textContent = position ? `P/L: ${currency(position.unrealizedProfit)} (${signedPercent(position.unrealizedProfitPct)})` : `Realized: ${currency(portfolio.realizedProfit || 0)}`;
  elements.sourceSub.textContent = `Monitor: TradingView | Data: ${snapshot.source}${snapshot.warnings?.[0] ? ` | ${snapshot.warnings[0]}` : ` | ${snapshot.yfSymbol} ${snapshot.interval}`}`;
  elements.historyWindow.textContent = `${snapshot.historyWindow.candleCount} candles`;
  elements.latestDateBadge.textContent = latest.date || '--';
  elements.scoreBadge.textContent = `Score ${formatNumber(decision.score)} | Confidence ${formatNumber(decision.confidencePercentage)}%`;
  elements.indicatorDate.textContent = latest.date || '--';
  elements.calibrationBadge.textContent = `${snapshot.calibration.lookAhead}D forward`;
  elements.rankingBadge.textContent = `${ranking.length} stocks`;
  elements.aiJobBadge.textContent = settings.aiCron.enabled ? settings.aiCron.times.join(', ') : 'Disabled';

  const verdictCard = document.querySelector('.verdict-card');
  verdictCard.classList.toggle('buy', decision.action === 'BUY');
  verdictCard.classList.toggle('sell', decision.action === 'SELL');

  renderSymbolOptions(settings, ranking);
  renderSettings(settings);
  renderTradingView(snapshot.stock?.tvSymbol || snapshot.symbol);
  fitTradingViewMonitor();
  renderHistorySummary(snapshot.historySummary || {});
  renderParameters(decision.parameters || []);
  renderRanking(ranking || []);
  renderIndicators(latest);
  renderSignificance(snapshot.calibration.records || []);
  renderTechnicalSignalChart(snapshot);
  renderTransactions(portfolio.transactions || []);
  renderNotifications(payload.notifications || []);
  renderAiReports(payload.aiReports || [], payload.news);
  renderTimeframeVerdict(decision, payload.news);
  renderPositionOverview(snapshot, portfolio, decision, settings, payload.tradePolicy, payload.tradeResult);
  activateView(state.activeView, { persist: false });
}

function renderSymbolOptions(settings, ranking) {
  const symbols = new Set([
    ...(settings.selectedSymbols || []),
    ...(settings.rankingUniverse || []),
    ...(ranking || []).map((item) => item.symbol)
  ]);
  elements.activeSymbolSelect.innerHTML = [...symbols].sort().map((symbol) => `
    <option value="${escapeHtml(symbol)}"${symbol === settings.activeSymbol ? ' selected' : ''}>${escapeHtml(symbol)}</option>
  `).join('');
}

function renderSettings(settings) {
  elements.cronEnabled.checked = Boolean(settings.aiCron.enabled);
  elements.autoTradeEnabled.checked = Boolean(settings.autoTrade.enabled);
  elements.cronTimes.value = settings.aiCron.times.join(', ');
  elements.cronTimeInputs.forEach((input) => {
    input.checked = settings.aiCron.times.includes(input.value);
  });
  elements.symbolsMode.value = settings.aiCron.symbolsMode;
  elements.minScoreToAutoTrade.value = settings.aiCron.minScoreToAutoTrade;
  elements.takeProfitPct.value = settings.autoTrade.takeProfitPct;
  elements.minConfidence.value = settings.aiCron.minConfidence;
  elements.runOnRefresh.checked = Boolean(settings.autoTrade.runOnRefresh);
  const symbolOptions = symbolOptionList(settings, state.payload?.ranking || []);
  renderMultiSelect(elements.selectedSymbols, symbolOptions, settings.selectedSymbols || []);
  renderMultiSelect(elements.rankingUniverse, symbolOptions, settings.rankingUniverse || []);
  elements.emailEnabled.checked = Boolean(settings.email.enabled && settings.aiCron.emailEnabled);
  elements.gmailTo.value = settings.email.gmailTo || '';
  elements.gmailUser.value = settings.email.gmailUser || '';
  elements.gmailAppPassword.placeholder = settings.email.gmailAppPasswordSet ? 'Saved' : '';
  syncRuleControls();
  highlightRulePreset(settings);
}

function gatherSettingsForm() {
  return {
    selectedSymbols: selectedMultiValues(elements.selectedSymbols),
    rankingUniverse: selectedMultiValues(elements.rankingUniverse),
    aiCron: {
      enabled: elements.cronEnabled.checked,
      times: selectedCronTimes(),
      symbolsMode: elements.symbolsMode.value,
      minScoreToAutoTrade: Number(elements.minScoreToAutoTrade.value),
      minConfidence: elements.minConfidence.value,
      emailEnabled: elements.emailEnabled.checked
    },
    autoTrade: {
      enabled: elements.autoTradeEnabled.checked,
      runOnRefresh: elements.runOnRefresh.checked,
      minScore: Number(elements.minScoreToAutoTrade.value),
      minConfidence: elements.minConfidence.value,
      takeProfitPct: Number(elements.takeProfitPct.value)
    },
    email: {
      enabled: elements.emailEnabled.checked,
      gmailTo: elements.gmailTo.value.trim(),
      gmailUser: elements.gmailUser.value.trim(),
      gmailAppPassword: elements.gmailAppPassword.value
    }
  };
}

async function saveSettings(settings) {
  return await api('/api/settings', { method: 'POST', body: settings });
}

function syncRuleControls() {
  elements.minScoreLabel.textContent = formatNumber(Number(elements.minScoreToAutoTrade.value));
  elements.takeProfitLabel.textContent = `${formatNumber(Number(elements.takeProfitPct.value))}%`;
  renderRulePreview();
}

function applyRulePreset(preset) {
  const presets = {
    conservative: { score: 70, profit: 9, confidence: 'high', refresh: false },
    balanced: { score: 58, profit: 7, confidence: 'medium', refresh: false },
    active: { score: 48, profit: 5, confidence: 'medium', refresh: true }
  };
  const next = presets[preset] || presets.balanced;
  elements.minScoreToAutoTrade.value = next.score;
  elements.takeProfitPct.value = next.profit;
  elements.minConfidence.value = next.confidence;
  elements.runOnRefresh.checked = next.refresh;
  syncRuleControls();
  highlightRulePreset({
    autoTrade: {
      minScore: next.score,
      takeProfitPct: next.profit,
      runOnRefresh: next.refresh
    },
    aiCron: {
      minConfidence: next.confidence
    }
  });
}

function highlightRulePreset(settings) {
  const score = Number(settings.autoTrade?.minScore ?? settings.aiCron?.minScoreToAutoTrade);
  const profit = Number(settings.autoTrade?.takeProfitPct);
  const confidence = settings.autoTrade?.minConfidence || settings.aiCron?.minConfidence;
  const refresh = Boolean(settings.autoTrade?.runOnRefresh);
  const presetKey = score >= 68 && profit >= 8 && confidence === 'high'
    ? 'conservative'
    : score <= 50 && profit <= 5.5 && refresh
      ? 'active'
      : 'balanced';
  elements.rulePresetButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.rulePreset === presetKey);
  });
}

function renderRulePreview() {
  if (!elements.rulePreview || !state.payload?.decision) return;
  const decision = state.payload.decision;
  const policy = {
    enabled: elements.autoTradeEnabled.checked,
    minScore: Number(elements.minScoreToAutoTrade.value),
    minConfidence: elements.minConfidence.value,
    runOnRefresh: elements.runOnRefresh.checked
  };
  const gate = tradeGateStatus(decision, policy);
  elements.rulePreview.className = `rule-preview ${gate.allowed ? 'ready' : 'blocked'}`;
  elements.rulePreview.innerHTML = `
    <strong>${gate.allowed ? 'Current verdict can trade' : 'Current verdict will not trade'}</strong>
    <span>${escapeHtml(gate.reason)}${policy.runOnRefresh ? ' Trade on refresh is on.' : ' Manual trigger still available.'}</span>
  `;
}

async function triggerTrade({ force = false, extraButton = null } = {}) {
  const buttons = [elements.autoTradeButton, elements.manualTradeButton, extraButton].filter(Boolean);
  buttons.forEach((button) => {
    button.disabled = true;
  });
  state.lastActionMessage = force ? 'Executing current verdict...' : 'Checking auto-trade gate...';
  elements.tradeStatus.textContent = state.lastActionMessage;
  try {
    const payload = await api('/api/trade', { method: 'POST', body: { force } });
    const result = payload.tradeResult;
    state.lastActionMessage = result?.executed
      ? `Executed ${result.transaction.type} ${formatNumber(result.transaction.quantity)} units.`
      : result?.note || 'No trade executed.';
    updatePayload(payload);
    elements.tradeStatus.textContent = state.lastActionMessage;
  } catch (error) {
    state.lastActionMessage = error.message;
    elements.tradeStatus.textContent = state.lastActionMessage;
    if (state.payload) renderAiReports(state.payload.aiReports || [], state.payload.news);
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

async function retryNewsVerdict(button) {
  const symbol = state.payload?.snapshot?.stock?.yfSymbol || elements.activeSymbolSelect.value;
  button.disabled = true;
  button.textContent = 'Retrying...';
  state.lastActionMessage = 'Retrying news crawl and LM Studio verdict...';
  if (state.payload) renderAiReports(state.payload.aiReports || [], state.payload.news);
  try {
    const payload = await api('/api/news-retry', { method: 'POST', body: { symbol } });
    const mode = payload.news?.analysis?.mode || 'local';
    const engine = payload.news?.analysis?.engine?.label || mode;
    state.lastActionMessage = `News verdict refreshed using ${engine}.`;
    updatePayload(payload);
  } catch (error) {
    state.lastActionMessage = `News retry failed: ${error.message}`;
    if (state.payload) renderAiReports(state.payload.aiReports || [], state.payload.news);
  } finally {
    button.disabled = false;
    button.textContent = 'Retry news verdict';
  }
}

function renderTradingView(tvSymbol) {
  if (!tvSymbol || state.tradingViewSymbol === tvSymbol) return;
  state.tradingViewSymbol = tvSymbol;
  elements.tradingViewWidget.innerHTML = '';
  fitTradingViewMonitor();
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.text = JSON.stringify({
    autosize: true,
    symbol: tvSymbol,
    interval: 'D',
    timezone: 'Asia/Jakarta',
    theme: 'light',
    style: '1',
    locale: 'en',
    enable_publishing: false,
    allow_symbol_change: true,
    calendar: false,
    support_host: 'https://www.tradingview.com'
  });
  elements.tradingViewWidget.appendChild(script);
  setTimeout(fitTradingViewMonitor, 500);
  setTimeout(fitTradingViewMonitor, 1800);
}

function fitTradingViewMonitor() {
  const shell = elements.tradingViewShell;
  if (!shell || shell.classList.contains('hidden')) return;
  const shellWidth = shell.getBoundingClientRect().width || window.innerWidth || 390;
  const viewportHeight = window.innerHeight || 720;
  const mobileShell = shellWidth <= 540;
  const mobileHeight = Math.max(300, Math.min(380, viewportHeight * 0.42));
  const height = mobileShell ? mobileHeight : 650;
  document.documentElement.style.setProperty('--tv-monitor-height', `${Math.round(height)}px`);
}

function renderHistorySummary(summary) {
  const returns = summary.returns || {};
  const range = summary.range3m || {};
  const items = [
    { label: '1D', value: signedPercent(returns.oneDay), tone: metricTone(returns.oneDay) },
    { label: '5D', value: signedPercent(returns.fiveDay), tone: metricTone(returns.fiveDay) },
    { label: '1M', value: signedPercent(returns.oneMonth), tone: metricTone(returns.oneMonth) },
    { label: '3M', value: signedPercent(returns.threeMonth), tone: metricTone(returns.threeMonth) },
    { label: '3M High', value: currency(range.high), tone: 'neutral' },
    { label: '3M Low', value: currency(range.low), tone: 'neutral' },
    { label: 'Drawdown', value: signedPercent(range.drawdownFromHigh), tone: metricTone(range.drawdownFromHigh) },
    { label: 'Volatility 20D', value: percent(summary.volatility20), tone: volatilityTone(summary.volatility20) },
    { label: 'Avg Volume 20D', value: compactNumber(summary.averageVolume20), tone: 'neutral' }
  ];
  const slides = [items.slice(0, 4), items.slice(4)];
  elements.historySummaryGrid.innerHTML = slides.map((slide, index) => `
    <section class="history-summary-slide" aria-label="Price summary ${index + 1} of ${slides.length}">
      ${slide.map((item) => `
        <article class="history-summary-card tone-${escapeHtml(item.tone)}">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.value)}</span>
        </article>
      `).join('')}
    </section>
  `).join('');
}

function metricTone(value) {
  if (!isFiniteNumber(value)) return 'neutral';
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

function volatilityTone(value) {
  if (!isFiniteNumber(value)) return 'neutral';
  if (value >= 8) return 'negative';
  if (value >= 5) return 'watch';
  return 'neutral';
}

function renderParameters(parameters) {
  const priority = [
    'Momentum',
    'Current reversal/swing triggers',
    'Volume confirmation',
    'Volatility risk',
    'Trend structure'
  ];
  const selected = priority
    .map((name) => parameters.find((item) => item.name === name))
    .filter(Boolean);
  elements.parameterList.innerHTML = selected.map((item) => `
    <div class="parameter-row">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.value || '--')}</span>
      </div>
      <span class="score-pill ${item.bias}">${signedNumber(item.score)}</span>
    </div>
  `).join('') || emptyText('No short-term parameters');
}

function renderRanking(ranking) {
  elements.rankingTable.innerHTML = ranking.map((item) => `
    <tr data-symbol="${escapeHtml(item.symbol)}">
      <td>${item.rank}</td>
      <td><button class="table-button" data-symbol="${escapeHtml(item.symbol)}">${escapeHtml(item.symbol)}</button></td>
      <td>${currency(item.latestClose)}</td>
      <td class="${item.performance3m >= 0 ? 'positive' : 'negative'}">${signedPercent(item.performance3m)}</td>
      <td>${currency(item.high3m)}</td>
      <td>${currency(item.low3m)}</td>
      <td>${compactNumber(item.avgVolume20)}</td>
    </tr>
  `).join('') || `<tr><td colspan="7">No ranking data.</td></tr>`;

  elements.rankingTable.querySelectorAll('button[data-symbol]').forEach((button) => {
    button.addEventListener('click', async () => {
      const symbol = button.dataset.symbol;
      await saveSettings({ activeSymbol: symbol });
      const payload = await api('/api/refresh', { method: 'POST', body: { symbol } });
      updatePayload(payload);
    });
  });
}

function renderIndicators(latest) {
  const volumeRatio = [latest.volume, latest.volumeSma20].every(isFiniteNumber)
    ? latest.volume / latest.volumeSma20
    : null;
  const ma20Gap = [latest.close, latest.sma20].every(isFiniteNumber)
    ? ((latest.close - latest.sma20) / latest.sma20) * 100
    : null;
  const items = [
    ['MA-20 gap', signedPercent(ma20Gap)],
    ['RSI 14', latest.rsi14],
    ['Stoch K/D', `${formatNumber(latest.stochK)} / ${formatNumber(latest.stochD)}`],
    ['MACD Hist', latest.macdHistogram],
    ['Volume', volumeRatio ? `${formatNumber(volumeRatio)}x 20D` : '--'],
    ['ATR %', latest.atrPct],
    ['MA-20', latest.sma20]
  ];
  elements.indicatorGrid.innerHTML = items.map(([label, value]) => `
    <div class="indicator-item">
      <strong>${label}</strong>
      <span>${typeof value === 'string' ? escapeHtml(value) : formatNumber(value)}</span>
    </div>
  `).join('');
}

function renderSignificance(records) {
  const active = records.filter((record) => record.occurrences > 0).slice(0, 10);
  elements.significanceTable.innerHTML = active.map((record) => `
    <tr>
      <td>${escapeHtml(record.label)}</td>
      <td class="${record.direction === 'bullish' ? 'positive' : 'negative'}">${record.direction}</td>
      <td>${record.occurrences}</td>
      <td>${percent((record.winRate || 0) * 100)}</td>
      <td class="${record.avgSignedReturn >= 0 ? 'positive' : 'negative'}">${signedPercent(record.avgSignedReturn)}</td>
      <td>${formatNumber(record.weightMultiplier)}x</td>
    </tr>
  `).join('') || `<tr><td colspan="6">No calibrated signal hits yet.</td></tr>`;
}

function renderTechnicalSignalChart(snapshot = state.payload?.snapshot) {
  const canvas = elements.signalChart;
  const candles = snapshot?.candles?.slice(-90) || [];
  if (!canvas || candles.length < 2) return;

  const parentWidth = canvas.parentElement?.getBoundingClientRect().width || 640;
  const cssWidth = Math.max(300, Math.floor(parentWidth));
  const cssHeight = 220;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssWidth * ratio);
  canvas.height = Math.floor(cssHeight * ratio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { left: 36, right: 12, top: 16, bottom: 28 };
  const plotWidth = cssWidth - pad.left - pad.right;
  const plotHeight = cssHeight - pad.top - pad.bottom;
  const values = candles.flatMap((candle) => [candle.close, candle.sma20, candle.sma50]).filter(isFiniteNumber);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const xAt = (index) => pad.left + (index / Math.max(1, candles.length - 1)) * plotWidth;
  const yAt = (value) => pad.top + (1 - ((value - min) / span)) * plotHeight;

  ctx.fillStyle = '#fbfcfe';
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.strokeStyle = '#d9e0e8';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) {
    const y = pad.top + (plotHeight / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(cssWidth - pad.right, y);
    ctx.stroke();
  }

  drawChartLine(ctx, candles, 'close', xAt, yAt, '#17202a', 2);
  drawChartLine(ctx, candles, 'sma20', xAt, yAt, '#087f8c', 1.6);
  drawChartLine(ctx, candles, 'sma50', xAt, yAt, '#2d5bff', 1.4);

  const latest = candles.at(-1);
  if (latest?.close) {
    const x = xAt(candles.length - 1);
    const y = yAt(latest.close);
    ctx.fillStyle = '#177245';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#667085';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(formatNumber(max), 4, pad.top + 4);
  ctx.fillText(formatNumber(min), 4, pad.top + plotHeight);
  ctx.fillText(candles[0]?.date || '', pad.left, cssHeight - 9);
  ctx.fillText(candles.at(-1)?.date || '', Math.max(pad.left, cssWidth - 86), cssHeight - 9);

  drawLegend(ctx, pad.left, 12, [
    ['Close', '#17202a'],
    ['MA20', '#087f8c'],
    ['MA50', '#2d5bff']
  ]);
}

function renderTransactions(transactions) {
  elements.transactionTable.innerHTML = transactions.slice(0, 14).map((tx) => `
    <tr>
      <td>${shortDateTime(tx.createdAt)}</td>
      <td>${escapeHtml(tx.symbol || '')}</td>
      <td class="${tx.type === 'BUY' ? 'positive' : 'negative'}">${tx.type}</td>
      <td>${formatNumber(tx.quantity)}</td>
      <td>${currency(tx.price)}</td>
      <td>${currency(tx.gross)}</td>
      <td class="${tx.realizedProfit >= 0 ? 'positive' : 'negative'}">${currency(tx.realizedProfit)}</td>
    </tr>
  `).join('') || `<tr><td colspan="7">No paper trades yet.</td></tr>`;
}

function renderNotifications(notifications) {
  const unread = notifications.filter((item) => !item.read).length;
  elements.bellCount.textContent = unread > 99 ? '99+' : String(unread);
  elements.bellCount.classList.toggle('hidden', unread === 0);
  elements.notificationList.innerHTML = notifications.slice(0, 12).map((item) => `
    <details class="list-item collapsible-list-item">
      <summary>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${shortDateTime(item.createdAt)} | ${escapeHtml(item.level)}</span>
      </summary>
      <span class="item-body">${escapeHtml(item.message)}</span>
    </details>
  `).join('') || emptyText('No notifications');
}

function renderAiReports(reports, news) {
  renderNewsWindowSummary(news);

  const currentSourceLabel = articleSourceLabel(news?.feed, news?.analysis);
  const currentSummary = summarySnippet(news?.analysis?.summary, 120);
  const currentEngine = aiEngineStatus(news?.analysis);
  const currentHeadlineCount = newsHeadlineCount(news?.analysis, news?.feed);
  const actionRow = renderNewsActionRow(news);
  const currentNewsHtml = news?.analysis ? `
    <details class="list-item collapsible-list-item news-verdict-item news-brief ${newsModeClass(news.analysis)} ${newsVerdictClass(news.analysis)}" open>
      <summary class="news-brief-summary">
        <span class="news-brief-topline">
          <b>${escapeHtml(newsDateLabel(news.analysis))}</b>
          <i>${escapeHtml(news.analysis.verdict || 'neutral')} ${formatNumber(news.analysis.confidencePercentage)}%</i>
        </span>
        <strong>AI News Brief</strong>
        <span>${escapeHtml(currentSummary)}</span>
        <span class="news-brief-meta">${currentHeadlineCount} headline${currentHeadlineCount === 1 ? '' : 's'} | ${escapeHtml(currentSourceLabel)} | ${escapeHtml(currentEngine.label)}</span>
      </summary>
      <div class="news-pipeline">
        <span><b>Articles</b>${escapeHtml(currentSourceLabel)}</span>
        <span><b>AI engine</b>${escapeHtml(currentEngine.label)}</span>
        <span><b>Status</b>${escapeHtml(currentEngine.detail)}</span>
      </div>
      ${actionRow}
      ${renderNewsDetail(news.analysis, currentNewsSourceUrl(news))}
    </details>
  ` : `
    <div class="list-item news-brief">
      <strong>AI News Brief</strong>
      <span>No news verdict is available for the current symbol.</span>
      ${actionRow}
    </div>
  `;

  const reportHtml = reports.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).map((report) => {
    const sourceUrl = newsSourceUrl(report);
    return `
      <details class="list-item collapsible-list-item">
        <summary>
          <strong>${escapeHtml(report.symbol || report.label)} | ${escapeHtml(report.action || report.mode)} | ${formatNumber(report.confidencePercentage)}%</strong>
          <span>${shortDateTime(report.createdAt)} | ${escapeHtml(newsDateLabel(report.newsAnalysis))} | news ${escapeHtml(report.newsAnalysis?.verdict || 'neutral')} | technical score ${formatNumber(report.score)} | trade ${report.tradeExecuted ? 'executed' : 'not executed'} | email ${report.email?.sent ? 'sent' : 'off'}</span>
        </summary>
        ${renderNewsDetail(report.newsAnalysis || newsSummary(report), sourceUrl)}
      </details>
    `;
  }).join('');

  elements.aiReports.innerHTML = currentNewsHtml + reportHtml || emptyText('No AI decision reports');
}

function renderNewsActionRow(news) {
  const decision = state.payload?.decision || {};
  const action = decision.action || 'HOLD';
  const autoDisabled = action === 'HOLD' ? 'disabled' : '';
  const retryButton = newsNeedsRetry(news)
    ? '<button type="button" class="text-button compact-action-button" data-news-retry>Retry news verdict</button>'
    : '';
  return `
    <div class="news-action-row">
      <button type="button" class="primary-button compact-action-button" data-auto-trade-trigger ${autoDisabled}>Trigger auto trade</button>
      ${retryButton}
      ${state.lastActionMessage ? `<span class="news-action-status">${escapeHtml(state.lastActionMessage)}</span>` : ''}
    </div>
  `;
}

function newsNeedsRetry(news) {
  const analysis = news?.analysis;
  const feed = news?.feed || {};
  if (!analysis) return true;
  if (analysis.mode === 'local-fallback' || analysis.error) return true;
  if (feed.error || (Array.isArray(feed.errors) && feed.errors.length && !newsHeadlineCount(analysis, feed))) return true;
  if ((feed.source === 'none' || feed.webSearchItemCount === 0) && newsHeadlineCount(analysis, feed) === 0) return true;
  return false;
}

function renderTimeframeVerdict(decision, news) {
  const parameters = decision.parameters || [];
  const profile = timeframeProfile(elements.timeframeSelect.value);
  const components = profile.components.map((component) => {
    const parameter = findParameter(parameters, component.match);
    const score = Number(parameter?.score || 0);
    return {
      label: component.label,
      value: parameter?.value || 'n/a',
      score,
      bias: score > 4 ? 'bullish' : score < -4 ? 'bearish' : 'neutral'
    };
  });
  const rawScore = components.reduce((total, item) => total + item.score, 0);
  const newsVerdict = news?.analysis?.verdict || 'neutral';
  const bias = rawScore >= profile.threshold ? 'Bullish' : rawScore <= -profile.threshold ? 'Bearish' : 'Neutral';
  const biasClass = bias.toLowerCase();
  const confidence = clampNumber(
    (Number(decision.confidencePercentage || 0) * 0.68) + (Math.min(100, Math.abs(rawScore) * 3.4) * 0.32),
    0,
    100
  );

  elements.timeframeVerdict.innerHTML = `
    <div class="timeframe-main ${biasClass}">
      <div>
        <strong>${escapeHtml(profile.label)}: ${bias}</strong>
        <span>${escapeHtml(profile.description)} News verdict is separate: ${escapeHtml(newsVerdict)}.</span>
      </div>
      <b>${formatNumber(confidence)}%</b>
    </div>
    <div class="timeframe-factors">
      ${components.map((item) => `
        <span class="factor-chip ${item.bias}">
          ${escapeHtml(item.label)} ${signedNumber(item.score)}
        </span>
      `).join('')}
    </div>
  `;
}

function renderPositionOverview(snapshot, portfolio, decision, settings, tradePolicy, tradeResult) {
  const latest = snapshot.latest || {};
  const position = portfolio.positions?.[snapshot.symbol];
  const autoTrade = settings?.autoTrade || tradePolicy || {};
  const gate = tradeGateStatus(decision, autoTrade);
  const positionLabel = position
    ? `${formatNumber(position.quantity)} units @ ${currency(position.averagePrice)}`
    : 'No open position';
  const pnlLabel = position
    ? `${currency(position.unrealizedProfit)} (${signedPercent(position.unrealizedProfitPct)})`
    : `Realized ${currency(portfolio.realizedProfit || 0)}`;
  const items = [
    ['Cash Balance', currency(portfolio.balance)],
    ['Position', positionLabel],
    ['Last Price', currency(latest.close)],
    ['Profit / Loss', pnlLabel],
    ['Verdict', `${decision.action} | score ${formatNumber(decision.score)}`],
    ['Take Profit', `${formatNumber(autoTrade.takeProfitPct ?? tradePolicy?.takeProfitPct ?? 7)}%`]
  ];

  elements.positionModeBadge.textContent = gate.allowed ? 'Ready' : 'Gate blocked';
  elements.positionOverviewGrid.innerHTML = items.map(([label, value]) => `
    <div class="mini-item">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `).join('');
  elements.tradeGateSummary.innerHTML = `
    <div class="trade-gate-card ${gate.allowed ? 'ready' : 'blocked'}">
      <div>
        <strong>${gate.allowed ? 'Auto trade ready' : 'Auto trade blocked'}</strong>
        <span>${escapeHtml(gate.reason)}</span>
      </div>
      <b>${escapeHtml(decision.action || 'HOLD')}</b>
    </div>
    ${tradeResult?.note ? `<span class="trade-note">${escapeHtml(tradeResult.note)}</span>` : ''}
  `;
  elements.autoTradeButton.disabled = decision.action === 'HOLD';
  elements.manualTradeButton.disabled = decision.action === 'HOLD';
  elements.manualTradeButton.textContent = decision.action === 'BUY'
    ? 'Buy now'
    : decision.action === 'SELL'
      ? 'Sell now'
      : 'Trade verdict';
}

function tradeGateStatus(decision, policy = {}) {
  const action = decision?.action || 'HOLD';
  if (action === 'HOLD') return { allowed: false, reason: 'Verdict is HOLD.' };
  if (!policy.enabled) return { allowed: false, reason: 'Auto trade gate is disabled.' };

  const minConfidence = policy.minConfidence || 'medium';
  if (confidenceRank(decision.confidence) < confidenceRank(minConfidence)) {
    return { allowed: false, reason: `Needs ${minConfidence} confidence, currently ${decision.confidence || '--'}.` };
  }

  const minScore = Number(policy.minScore ?? 58);
  const score = Number(decision.score || 0);
  const scoreOk = action === 'BUY'
    ? score >= minScore
    : /take profit|stop-loss/i.test(decision.verdict || '') || Math.abs(score) >= minScore;
  if (!scoreOk) {
    return { allowed: false, reason: `Score ${formatNumber(score)} is below min ${formatNumber(minScore)}.` };
  }

  return { allowed: true, reason: `${action} can use the paper balance now.` };
}

function confidenceRank(value) {
  return { low: 1, medium: 2, high: 3 }[value] || 0;
}

function timeframeProfile(value) {
  const profiles = {
    intraday: {
      label: 'Intraday',
      threshold: 5,
      description: 'Technical-only short term view from momentum and volume.',
      components: [
        { label: 'Momentum', match: 'momentum' },
        { label: 'Volume', match: 'volume' }
      ]
    },
    swing: {
      label: 'Swing',
      threshold: 8,
      description: 'Technical-only swing view from trend and reversal triggers.',
      components: [
        { label: 'Trend', match: 'trend' },
        { label: 'Momentum', match: 'momentum' },
        { label: 'Reversal', match: 'reversal' }
      ]
    },
    position: {
      label: 'Position',
      threshold: 7,
      description: 'Technical-only position view from trend, risk, and historical edge.',
      components: [
        { label: 'Trend', match: 'trend' },
        { label: 'Risk', match: 'volatility' },
        { label: 'History', match: 'historical' }
      ]
    }
  };
  return profiles[value] || profiles.swing;
}

function findParameter(parameters, match) {
  const needle = String(match).toLowerCase();
  return parameters.find((item) => String(item.name || '').toLowerCase().includes(needle));
}

function setupCollapsiblePanels() {
  document.querySelectorAll('.panel').forEach((panel) => {
    if (panel.dataset.noCollapse === 'true') return;
    const heading = panel.querySelector('.panel-heading');
    if (!heading || heading.querySelector('.collapse-toggle')) return;
    const title = heading.querySelector('h2')?.textContent || 'panel';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'collapse-toggle';
    button.setAttribute('aria-label', `Collapse ${title}`);
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    button.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('collapsed');
      button.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${title}`);
    });
    heading.appendChild(button);
  });
}

function syncCronTimesFromChecks() {
  elements.cronTimes.value = selectedCronTimes().join(', ');
}

function selectedCronTimes() {
  return [...elements.cronTimeInputs].filter((input) => input.checked).map((input) => input.value);
}

function symbolOptionList(settings, ranking) {
  return [...new Set([
    ...(settings.selectedSymbols || []),
    ...(settings.rankingUniverse || []),
    ...(ranking || []).map((item) => item.symbol)
  ])].sort();
}

function renderMultiSelect(select, options, selected) {
  const selectedSet = new Set(selected || []);
  select.innerHTML = options.map((symbol) => `
    <option value="${escapeHtml(symbol)}"${selectedSet.has(symbol) ? ' selected' : ''}>${escapeHtml(symbol)}</option>
  `).join('');
}

function selectedMultiValues(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function drawChartLine(ctx, candles, key, xAt, yAt, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  let started = false;
  candles.forEach((candle, index) => {
    const value = candle[key];
    if (!isFiniteNumber(value)) return;
    const x = xAt(index);
    const y = yAt(value);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  if (started) ctx.stroke();
}

function drawLegend(ctx, x, y, items) {
  ctx.font = '10px system-ui, sans-serif';
  let offset = 0;
  items.forEach(([label, color]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.lineTo(x + offset + 14, y);
    ctx.stroke();
    ctx.fillStyle = '#667085';
    ctx.fillText(label, x + offset + 18, y + 3);
    offset += 56;
  });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

function splitSymbols(value) {
  return String(value || '').split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
}

function newsSummary(report) {
  return report.newsAnalysis?.summary || 'No news summary available.';
}

function renderNewsWindowSummary(news) {
  if (!elements.newsWindowSummary) return;
  const analysis = news?.analysis;
  const feed = news?.feed || {};
  if (!analysis) {
    elements.newsWindowSummary.innerHTML = emptyText('No news verdict yet');
    return;
  }
  const sourceLabel = articleSourceLabel(feed, analysis);
  const engine = aiEngineStatus(analysis);
  const headlineCount = newsHeadlineCount(analysis, feed);

  elements.newsWindowSummary.innerHTML = `
    <div class="news-window-card ${escapeHtml(analysis.verdict || 'neutral')}">
      <div>
        <span class="news-window-kicker">${escapeHtml(newsDateLabel(analysis))}</span>
        <strong>${escapeHtml(summarySnippet(analysis.summary, 86))}</strong>
        <span>${headlineCount} headline${headlineCount === 1 ? '' : 's'} | ${escapeHtml(sourceLabel)} | ${escapeHtml(engine.label)}</span>
      </div>
      <b>${escapeHtml(analysis.verdict || 'neutral')} ${formatNumber(analysis.confidencePercentage)}%</b>
    </div>
  `;
}

function renderNewsDetail(detail, sourceUrl) {
  const analysis = detail && typeof detail === 'object' ? detail : null;
  const summary = analysis?.summary || detail || 'No news summary available.';
  const safeSourceUrl = safeHttpUrl(sourceUrl || analysis?.sourceUrl);
  const dailySummary = analysis?.dailySummary || [];
  const items = analysis?.items || [];
  const headlineCards = items.slice(0, 4).map((item) => {
    const itemUrl = safeHttpUrl(item.link);
    const sourceName = item.sourceName || sourceDomain(item.link) || item.source || 'source';
    const published = item.publishedDate || '--';
    const summaryText = item.summary ? summarySnippet(item.summary, 120) : '';
    return `
      <a href="${escapeHtml(itemUrl || '#')}" target="_blank" rel="noopener noreferrer">
        <b>${escapeHtml(published)} | ${escapeHtml(sourceName)}</b>
        <span>${escapeHtml(item.title || 'Untitled headline')}</span>
        ${summaryText ? `<em>${escapeHtml(summaryText)}</em>` : ''}
        <small>${escapeHtml(itemUrl || 'No source URL')}</small>
      </a>
    `;
  }).join('');
  return `
    <div class="news-detail">
      ${analysis ? `<span><b>Date</b> ${escapeHtml(newsDateLabel(analysis))}</span>` : ''}
      <span><b>Summary</b> ${escapeHtml(summary || 'No news summary available.')}</span>
      ${dailySummary.length ? `
        <div class="daily-summary">
          ${dailySummary.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
        </div>
      ` : ''}
      ${items.length ? `
        <details class="headline-collapse" open>
          <summary>Sources (${items.length})</summary>
          <div class="headline-list">${headlineCards}</div>
        </details>
      ` : ''}
      ${!items.length && safeSourceUrl ? `<a class="news-link" href="${escapeHtml(safeSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeSourceUrl)}</a>` : ''}
    </div>
  `;
}

function newsDateLabel(value) {
  if (!value) return 'No news date';
  const from = value.dateRange?.from;
  const to = value.dateRange?.to || value.today;
  if (from && to) return `${from} to ${to}`;
  return value.today || value.publishedDate || 'No news date';
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function currentNewsSourceUrl(news) {
  return news.analysis?.sourceUrl
    || news.feed?.items?.find((item) => item.link)?.link
    || news.feed?.allItems?.find((item) => item.link)?.link
    || '';
}

function newsSourceUrl(report) {
  return report.newsAnalysis?.sourceUrl
    || report.newsAnalysis?.items?.find((item) => item.link)?.link
    || report.news?.items?.find((item) => item.link)?.link
    || report.candidates?.find((item) => item.sourceUrl)?.sourceUrl
    || '';
}

function newsSourceLabel(analysis, feed) {
  const items = analysis?.items || feed?.items || [];
  const names = [...new Set(items
    .map((item) => item.sourceName || sourceDomain(item.link) || item.source)
    .filter(Boolean))]
    .slice(0, 2);
  if (names.length) return names.join(', ');
  if (feed?.source) return String(feed.source).replaceAll('-', ' ');
  return 'news search';
}

function articleSourceLabel(feed, analysis) {
  const source = String(feed?.source || '').toLowerCase();
  if (source.includes('yahoo') && source.includes('bing')) return 'Yahoo RSS + Bing News Search';
  if (source.includes('bing')) return 'Bing News Search';
  if (source.includes('yahoo')) return 'Yahoo Finance RSS';
  return newsSourceLabel(analysis, feed);
}

function aiEngineStatus(analysis) {
  const engine = analysis?.engine || {};
  const mode = analysis?.mode || engine.provider || 'local';
  const model = engine.model || engine.attemptedModel || '';
  if (mode === 'lmstudio' || engine.usedLmStudio) {
    return {
      label: 'LM Studio',
      detail: `Articles came from RSS/search, then LM Studio analyzed the headline text${model ? ` with ${model}` : ''}.`
    };
  }
  if (mode === 'local-fallback') {
    return {
      label: 'Local fallback',
      detail: analysis?.error
        ? `LM Studio was attempted but failed: ${summarySnippet(analysis.error, 90)}`
        : 'LM Studio was attempted but the local news scorer produced this verdict.'
    };
  }
  return {
    label: 'Local rules',
    detail: newsHeadlineCount(analysis) > 0
      ? 'Articles came from RSS/search; LM Studio was not used for this verdict.'
      : 'No usable article was found, so LM Studio was not called.'
  };
}

function newsHeadlineCount(analysis, feed) {
  const count = Number(analysis?.headlineCount);
  if (Number.isFinite(count)) return count;
  return (analysis?.items || feed?.items || []).length;
}

function newsModeClass(analysis) {
  const mode = analysis?.mode || analysis?.engine?.provider || 'local';
  if (mode === 'lmstudio') return 'news-engine-lmstudio';
  if (mode === 'local-fallback') return 'news-engine-fallback';
  return 'news-engine-local';
}

function newsVerdictClass(analysis) {
  const verdict = String(analysis?.verdict || '').toLowerCase();
  return ['positive', 'negative', 'neutral'].includes(verdict) ? verdict : 'neutral';
}

function summarySnippet(value, maxLength = 150) {
  const text = String(value || 'No news summary available.').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function sourceDomain(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function currency(value) {
  if (!isFiniteNumber(value)) return '--';
  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)}`;
}

function formatNumber(value) {
  if (!isFiniteNumber(value)) return '--';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(value);
}

function compactNumber(value) {
  if (!isFiniteNumber(value)) return '--';
  return new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

function percent(value) {
  if (!isFiniteNumber(value)) return '--';
  return `${formatNumber(value)}%`;
}

function signedPercent(value) {
  if (!isFiniteNumber(value)) return '--';
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}%`;
}

function signedNumber(value) {
  if (!isFiniteNumber(value)) return '--';
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}`;
}

function clampNumber(value, min, max) {
  if (!isFiniteNumber(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function shortDateTime(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function emptyText(text) {
  return `<div class="list-item"><span>${escapeHtml(text)}</span></div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}
