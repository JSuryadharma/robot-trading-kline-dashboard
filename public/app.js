const elements = {
  loginView: document.querySelector('#loginView'),
  appView: document.querySelector('#appView'),
  loginForm: document.querySelector('#loginForm'),
  loginError: document.querySelector('#loginError'),
  appLoadingBar: document.querySelector('#appLoadingBar'),
  appLoadingText: document.querySelector('#appLoadingText'),
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
  tradingPlanBadge: document.querySelector('#tradingPlanBadge'),
  tradingPlanTable: document.querySelector('#tradingPlanTable'),
  researchBadge: document.querySelector('#researchBadge'),
  runResearchButton: document.querySelector('#runResearchButton'),
  researchStatus: document.querySelector('#researchStatus'),
  researchSummary: document.querySelector('#researchSummary'),
  researchAdjustment: document.querySelector('#researchAdjustment'),
  researchParameters: document.querySelector('#researchParameters'),
  researchTechnical: document.querySelector('#researchTechnical'),
  researchWeightForm: document.querySelector('#researchWeightForm'),
  researchWeightScenario: document.querySelector('#researchWeightScenario'),
  researchWeightScenarioButtons: document.querySelectorAll('[data-research-weight-scenario]'),
  researchWeightControls: document.querySelector('#researchWeightControls'),
  researchWeightStatus: document.querySelector('#researchWeightStatus'),
  researchTradeTable: document.querySelector('#researchTradeTable'),
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
  newsFetchStatus: document.querySelector('#newsFetchStatus'),
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
  stopLossPct: document.querySelector('#stopLossPct'),
  stopLossLabel: document.querySelector('#stopLossLabel'),
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
  notificationEmailForm: document.querySelector('#notificationEmailForm'),
  notificationEmailEnabled: document.querySelector('#notificationEmailEnabled'),
  notificationGmailTo: document.querySelector('#notificationGmailTo'),
  notificationGmailUser: document.querySelector('#notificationGmailUser'),
  notificationGmailAppPassword: document.querySelector('#notificationGmailAppPassword'),
  notificationEmailStatus: document.querySelector('#notificationEmailStatus'),
  settingsStatus: document.querySelector('#settingsStatus')
};

const state = {
  socket: null,
  payload: null,
  reconnectTimer: null,
  tradingViewSymbol: '',
  lastActionMessage: '',
  newsStatus: null,
  loadingScopes: new Map(),
  tradingViewObserver: null,
  tradingViewLoaderTimer: null,
  researchWeightScenario: 'best',
  activeView: localStorage.getItem('robotTradingActiveView') || 'summary'
};

const loadingScopeSelectors = {
  snapshot: [
    '.summary-grid',
    '.tradingview-panel',
    '.trading-plan-panel',
    '.timeframe-panel',
    '.decision-panel',
    '.indicator-panel',
    '.ranking-panel',
    '.signal-panel',
    '.position-overview-panel',
    '.ledger-panel',
    '.notifications-panel'
  ],
  news: ['.ai-panel', '.timeframe-panel', '.decision-panel'],
  research: ['.research-panel'],
  trade: ['.position-overview-panel', '.ledger-panel'],
  settings: ['.settings-panel', '.notification-email-panel'],
  notifications: ['.notifications-panel'],
  tradingView: ['.tradingview-panel']
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

const structureSignalIds = new Set([
  'bullish_bos',
  'bearish_bos',
  'bullish_trend_change',
  'bearish_trend_change'
]);

const technicalWeightDefinitions = [
  { key: 'candle', label: 'Previous candle' },
  { key: 'trend', label: 'Trend' },
  { key: 'momentum', label: 'Momentum' },
  { key: 'volatility', label: 'Volatility' },
  { key: 'volume', label: 'Volume' },
  { key: 'calibration', label: 'Calibration' },
  { key: 'triggers', label: 'Reversal triggers' }
];

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
    setButtonBusy(elements.refreshButton, true);
    setContentLoading('snapshot', true, 'Refreshing market data');
    setContentLoading('news', true, 'Updating news and AI verdict');
    setNewsFetchStatus({
      state: 'loading',
      stage: 'refresh',
      message: 'Refreshing market data',
      detail: 'Waiting for K-line, news fetch, and AI verdict API response.'
    });
    try {
      const payload = await api('/api/refresh', { method: 'POST' });
      updatePayload(payload);
    } finally {
      setContentLoading('snapshot', false);
      setContentLoading('news', false);
      setButtonBusy(elements.refreshButton, false);
    }
  });

  elements.criticalReviewButton.addEventListener('click', async () => {
    setButtonBusy(elements.criticalReviewButton, true);
    setContentLoading('news', true, 'Running scheduled AI check');
    setNewsFetchStatus({
      state: 'loading',
      stage: 'critical-review',
      message: 'Running scheduled AI check',
      detail: 'Fetching candidate news and preparing AI decision report.'
    });
    try {
      await api('/api/critical-review', { method: 'POST' });
      await loadSnapshot();
    } finally {
      setContentLoading('news', false);
      setButtonBusy(elements.criticalReviewButton, false);
    }
  });

  elements.runResearchButton.addEventListener('click', runBackTraceResearch);
  elements.researchWeightForm.addEventListener('submit', saveResearchWeights);
  elements.researchWeightScenarioButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.researchWeightScenario = button.dataset.researchWeightScenario;
      renderResearchWeightEditor(state.payload?.research, state.researchWeightScenario);
    });
  });
  elements.researchWeightControls.addEventListener('input', (event) => {
    const input = event.target.closest('[data-research-weight]');
    if (!input) return;
    state.researchWeightScenario = 'custom';
    syncResearchWeightOutputs();
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
    elements.activeSymbolSelect.disabled = true;
    setContentLoading('snapshot', true, `Loading ${activeSymbol}`);
    setContentLoading('news', true, `Fetching ${activeSymbol} news`);
    setNewsFetchStatus({
      state: 'loading',
      stage: 'symbol-refresh',
      symbol: activeSymbol,
      message: 'Fetching selected stock news',
      detail: 'Refreshing market data and AI news verdict for the selected symbol.'
    });
    try {
      await saveSettings({ activeSymbol });
      const payload = await api('/api/refresh', { method: 'POST', body: { symbol: activeSymbol } });
      updatePayload(payload);
    } finally {
      elements.activeSymbolSelect.disabled = false;
      setContentLoading('snapshot', false);
      setContentLoading('news', false);
    }
  });

  elements.settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = elements.settingsForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true);
    setContentLoading('settings', true, 'Saving auto-trade rules');
    elements.settingsStatus.textContent = 'Saving...';
    try {
      const settings = gatherSettingsForm();
      const saved = await saveSettings(settings).catch((error) => ({ error: error.message }));
      if (saved.error) {
        elements.settingsStatus.textContent = saved.error;
        return;
      }
      elements.gmailAppPassword.value = '';
      elements.settingsStatus.textContent = 'Saved';
      await loadSnapshot();
    } finally {
      setButtonBusy(submitButton, false);
      setContentLoading('settings', false);
    }
  });

  elements.notificationEmailForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = elements.notificationEmailForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true);
    setContentLoading('settings', true, 'Saving Gmail SMTP settings');
    elements.notificationEmailStatus.textContent = 'Saving SMTP settings...';
    try {
      const saved = await saveSettings(gatherNotificationEmailSettings()).catch((error) => ({ error: error.message }));
      if (saved.error) {
        elements.notificationEmailStatus.textContent = saved.error;
        return;
      }
      elements.notificationGmailAppPassword.value = '';
      elements.notificationEmailStatus.textContent = saved.email.gmailAppPasswordSet
        ? 'Saved. Gmail push can send through SMTP.'
        : 'Saved. Add a Gmail app password before SMTP can send.';
      await loadSnapshot();
    } finally {
      setButtonBusy(submitButton, false);
      setContentLoading('settings', false);
    }
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

  [elements.minScoreToAutoTrade, elements.takeProfitPct, elements.stopLossPct].forEach((input) => {
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
    setButtonBusy(elements.markReadButton, true);
    setContentLoading('notifications', true, 'Updating notifications');
    try {
      const result = await api('/api/notifications/read', { method: 'POST', body: { ids: [] } });
      if (state.payload) {
        state.payload.notifications = result.items || [];
        renderNotifications(state.payload.notifications);
      }
    } finally {
      setButtonBusy(elements.markReadButton, false);
      setContentLoading('notifications', false);
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
  setContentLoading('snapshot', true, 'Loading subscribed market content');
  try {
    const payload = await api('/api/snapshot');
    updatePayload(payload);
  } finally {
    setContentLoading('snapshot', false);
  }
}

function connectWebSocket() {
  if (state.socket) state.socket.close();
  clearTimeout(state.reconnectTimer);
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
  state.socket = socket;

  socket.addEventListener('open', () => {
    elements.connectionDot.classList.add('online');
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'snapshot') updatePayload(message.payload);
    if (message.type === 'news-status') setNewsFetchStatus(message.payload);
    if (message.type === 'research-status') setResearchStatus(message.payload);
    if (message.type === 'notification' && state.payload) {
      state.payload.notifications = [message.payload, ...(state.payload.notifications || [])];
      renderNotifications(state.payload.notifications);
    }
  });

  socket.addEventListener('close', () => {
    elements.connectionDot.classList.remove('online');
    setContentLoading('snapshot', false);
    state.reconnectTimer = setTimeout(connectWebSocket, 3000);
  });
}

function updatePayload(payload) {
  state.payload = payload;
  setContentLoading('snapshot', false);
  setContentLoading('trade', false);
  if (payload.news?.status) {
    state.newsStatus = payload.news.status;
  }
  render(payload);
}

function setContentLoading(scope, active, label = 'Updating content') {
  if (!loadingScopeSelectors[scope]) return;
  if (active) state.loadingScopes.set(scope, label);
  else state.loadingScopes.delete(scope);
  syncContentLoaders();
}

function syncContentLoaders() {
  const selectors = [...new Set(Object.values(loadingScopeSelectors).flat())];
  const activeScopes = [...state.loadingScopes.entries()];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((target) => {
      const active = activeScopes.filter(([scope]) => loadingScopeSelectors[scope].includes(selector));
      let loader = [...target.children].find((child) => child.classList?.contains('content-loader'));
      if (!active.length) {
        target.classList.remove('content-is-loading');
        target.removeAttribute('aria-busy');
        loader?.remove();
        return;
      }
      if (!loader) {
        loader = document.createElement('div');
        loader.className = 'content-loader';
        loader.setAttribute('role', 'status');
        loader.innerHTML = '<span class="loader-spinner" aria-hidden="true"></span><strong></strong>';
        target.appendChild(loader);
      }
      loader.querySelector('strong').textContent = active.at(-1)[1];
      target.classList.add('content-is-loading');
      target.setAttribute('aria-busy', 'true');
    });
  });

  const latest = activeScopes.at(-1);
  elements.appLoadingBar?.classList.toggle('hidden', !latest);
  if (latest && elements.appLoadingText) elements.appLoadingText.textContent = latest[1];
}

function setButtonBusy(button, busy) {
  if (!button) return;
  button.disabled = Boolean(busy);
  button.classList.toggle('button-busy', Boolean(busy));
  if (busy) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

function render(payload) {
  const { snapshot, decision, portfolio, settings, ranking, weeklyPlan } = payload;
  const latest = snapshot.latest || {};
  const position = portfolio.positions?.[snapshot.symbol];
  const rankRecord = ranking.find((item) => item.symbol === snapshot.yfSymbol);

  elements.symbolTitle.textContent = snapshot.yfSymbol;
  elements.verdictValue.textContent = decision.action;
  elements.verdictSub.textContent = `${decision.verdict} | Final ${formatNumber(decision.score)} = Tech ${formatNumber(decision.technicalScore)} ${signedNumber(decision.newsScore)} news`;
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
  elements.scoreBadge.textContent = `Final ${formatNumber(decision.score)} | Tech ${formatNumber(decision.technicalScore)} | News ${signedNumber(decision.newsScore)}`;
  elements.indicatorDate.textContent = latest.date || '--';
  const significance = snapshot.signalSignificance || snapshot.calibration || {};
  elements.calibrationBadge.textContent = `${significance.windowLabel || 'Signal'} | ${significance.candleCount || '--'} candles | ${significance.lookAhead || '--'}D fwd`;
  elements.tradingPlanBadge.textContent = `${weeklyPlan?.length || 0} stocks`;
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
  renderTradingPlan(weeklyPlan || []);
  renderResearch(payload.research);
  renderRanking(ranking || []);
  renderIndicators(latest);
  renderSignificance(snapshot.signalSignificance?.records || snapshot.calibration.records || []);
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
  elements.stopLossPct.value = settings.autoTrade.stopLossPct;
  elements.minConfidence.value = settings.aiCron.minConfidence;
  elements.runOnRefresh.checked = Boolean(settings.autoTrade.runOnRefresh);
  const symbolOptions = symbolOptionList(settings, state.payload?.ranking || []);
  renderMultiSelect(elements.selectedSymbols, symbolOptions, settings.selectedSymbols || []);
  renderMultiSelect(elements.rankingUniverse, symbolOptions, settings.rankingUniverse || []);
  elements.emailEnabled.checked = Boolean(settings.email.enabled && settings.aiCron.emailEnabled);
  elements.gmailTo.value = settings.email.gmailTo || '';
  elements.gmailUser.value = settings.email.gmailUser || '';
  elements.gmailAppPassword.placeholder = settings.email.gmailAppPasswordSet ? 'Saved' : '';
  elements.notificationEmailEnabled.checked = Boolean(settings.email.enabled && settings.aiCron.emailEnabled);
  elements.notificationGmailTo.value = settings.email.gmailTo || 'jsuryadharma9@gmail.com';
  elements.notificationGmailUser.value = settings.email.gmailUser || 'jsuryadharma9@gmail.com';
  elements.notificationGmailAppPassword.placeholder = settings.email.gmailAppPasswordSet ? 'Saved' : '';
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
      takeProfitPct: Number(elements.takeProfitPct.value),
      stopLossPct: Number(elements.stopLossPct.value)
    },
    email: {
      enabled: elements.emailEnabled.checked,
      gmailTo: elements.gmailTo.value.trim(),
      gmailUser: elements.gmailUser.value.trim(),
      gmailAppPassword: elements.gmailAppPassword.value
    }
  };
}

function gatherNotificationEmailSettings() {
  return {
    aiCron: {
      emailEnabled: elements.notificationEmailEnabled.checked
    },
    email: {
      enabled: elements.notificationEmailEnabled.checked,
      gmailTo: elements.notificationGmailTo.value.trim() || 'jsuryadharma9@gmail.com',
      gmailUser: elements.notificationGmailUser.value.trim() || 'jsuryadharma9@gmail.com',
      gmailAppPassword: elements.notificationGmailAppPassword.value
    }
  };
}

async function saveSettings(settings) {
  return await api('/api/settings', { method: 'POST', body: settings });
}

function syncRuleControls() {
  elements.minScoreLabel.textContent = formatNumber(Number(elements.minScoreToAutoTrade.value));
  elements.takeProfitLabel.textContent = `${formatNumber(Number(elements.takeProfitPct.value))}%`;
  elements.stopLossLabel.textContent = `${formatNumber(Number(elements.stopLossPct.value))}%`;
  renderRulePreview();
}

function applyRulePreset(preset) {
  const presets = {
    conservative: { score: 70, profit: 9, stop: 3, confidence: 'high', refresh: false },
    balanced: { score: 58, profit: 7, stop: 4.5, confidence: 'medium', refresh: false },
    active: { score: 48, profit: 5, stop: 6, confidence: 'medium', refresh: true }
  };
  const next = presets[preset] || presets.balanced;
  elements.minScoreToAutoTrade.value = next.score;
  elements.takeProfitPct.value = next.profit;
  elements.stopLossPct.value = next.stop;
  elements.minConfidence.value = next.confidence;
  elements.runOnRefresh.checked = next.refresh;
  syncRuleControls();
  highlightRulePreset({
    autoTrade: {
      minScore: next.score,
      takeProfitPct: next.profit,
      stopLossPct: next.stop,
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
  const stop = Number(settings.autoTrade?.stopLossPct);
  const confidence = settings.autoTrade?.minConfidence || settings.aiCron?.minConfidence;
  const refresh = Boolean(settings.autoTrade?.runOnRefresh);
  const presetKey = score >= 68 && profit >= 8 && stop <= 3.5 && confidence === 'high'
    ? 'conservative'
    : score <= 50 && profit <= 5.5 && stop >= 5.5 && refresh
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
    runOnRefresh: elements.runOnRefresh.checked,
    takeProfitPct: Number(elements.takeProfitPct.value),
    stopLossPct: Number(elements.stopLossPct.value)
  };
  const gate = tradeGateStatus(decision, policy);
  elements.rulePreview.className = `rule-preview ${gate.allowed ? 'ready' : 'blocked'}`;
  elements.rulePreview.innerHTML = `
    <strong>${gate.allowed ? 'Current verdict can trade' : 'Current verdict will not trade'}</strong>
    <span>${escapeHtml(gate.reason)} Risk ${formatNumber(policy.stopLossPct)}% / target ${formatNumber(policy.takeProfitPct)}% (${formatNumber(policy.takeProfitPct / Math.max(policy.stopLossPct, 0.5))}x).${policy.runOnRefresh ? ' Trade on refresh is on.' : ' Manual trigger still available.'}</span>
  `;
}

async function triggerTrade({ force = false, extraButton = null } = {}) {
  const buttons = [elements.autoTradeButton, elements.manualTradeButton, extraButton].filter(Boolean);
  buttons.forEach((button) => setButtonBusy(button, true));
  setContentLoading('trade', true, force ? 'Executing paper trade' : 'Checking auto-trade gate');
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
    setContentLoading('trade', false);
    buttons.forEach((button) => setButtonBusy(button, false));
    if (state.payload) {
      renderPositionOverview(
        state.payload.snapshot,
        state.payload.portfolio,
        state.payload.decision,
        state.payload.settings,
        state.payload.tradePolicy,
        state.payload.tradeResult
      );
    }
  }
}

async function retryNewsVerdict(button) {
  const symbol = state.payload?.snapshot?.stock?.yfSymbol || elements.activeSymbolSelect.value;
  setButtonBusy(button, true);
  setContentLoading('news', true, 'Retrying news and AI verdict');
  state.lastActionMessage = 'Retrying news crawl and LM Studio verdict...';
  setNewsFetchStatus({
    state: 'loading',
    stage: 'retry',
    symbol,
    message: 'Retrying news verdict',
    detail: 'Fetching latest headlines and sending them to the configured AI endpoint.'
  });
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
    setContentLoading('news', false);
    setButtonBusy(button, false);
  }
}

function renderTradingView(tvSymbol) {
  if (!tvSymbol || state.tradingViewSymbol === tvSymbol) return;
  state.tradingViewSymbol = tvSymbol;
  setContentLoading('tradingView', true, 'Loading TradingView K-Line');
  state.tradingViewObserver?.disconnect();
  clearTimeout(state.tradingViewLoaderTimer);
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
  const completeLoading = () => {
    setContentLoading('tradingView', false);
    state.tradingViewObserver?.disconnect();
    state.tradingViewObserver = null;
    clearTimeout(state.tradingViewLoaderTimer);
  };
  state.tradingViewObserver = new MutationObserver(() => {
    const frame = elements.tradingViewWidget.querySelector('iframe');
    if (!frame) return;
    frame.addEventListener('load', completeLoading, { once: true });
    clearTimeout(state.tradingViewLoaderTimer);
    state.tradingViewLoaderTimer = setTimeout(completeLoading, 2500);
  });
  state.tradingViewObserver.observe(elements.tradingViewWidget, { childList: true, subtree: true });
  state.tradingViewLoaderTimer = setTimeout(completeLoading, 8000);
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
    'AI News Verdict',
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

function renderTradingPlan(items) {
  elements.tradingPlanTable.innerHTML = items.map((item) => `
    <tr data-symbol="${escapeHtml(item.symbol)}">
      <td>${item.rank}</td>
      <td><button class="table-button" data-symbol="${escapeHtml(item.symbol)}">${escapeHtml(item.symbol)}</button></td>
      <td>${currency(item.latestClose)}</td>
      <td class="${item.performance1d >= 0 ? 'positive' : 'negative'}">${priceDiff(item.diff1d, item.performance1d)}</td>
      <td class="${item.performance1w >= 0 ? 'positive' : 'negative'}">${priceDiff(item.diff1w, item.performance1w)}</td>
      <td>${currency(item.weekLow)} - ${currency(item.weekHigh)}</td>
      <td>${compactNumber(item.avgVolume5)}</td>
      <td>${escapeHtml(item.plan || '--')}</td>
    </tr>
  `).join('') || `<tr><td colspan="8">No weekly trading plan data.</td></tr>`;

  elements.tradingPlanTable.querySelectorAll('button[data-symbol]').forEach((button) => {
    button.addEventListener('click', async () => {
      const symbol = button.dataset.symbol;
      setButtonBusy(button, true);
      setContentLoading('snapshot', true, `Loading ${symbol}`);
      setContentLoading('news', true, `Fetching ${symbol} news`);
      try {
        await saveSettings({ activeSymbol: symbol });
        const payload = await api('/api/refresh', { method: 'POST', body: { symbol } });
        updatePayload(payload);
      } finally {
        setContentLoading('snapshot', false);
        setContentLoading('news', false);
        setButtonBusy(button, false);
      }
    });
  });
}

async function runBackTraceResearch() {
  const symbol = state.payload?.snapshot?.yfSymbol || elements.activeSymbolSelect.value;
  const panel = elements.researchSummary.closest('.research-panel');
  panel?.classList.remove('collapsed');
  setButtonBusy(elements.runResearchButton, true);
  setContentLoading('research', true, 'Running 1Y daily backtrace');
  setResearchStatus({
    state: 'loading',
    message: 'Preparing one-year daily research',
    detail: 'Loading completed candles and the backdated news archive.'
  });
  try {
    const payload = await api('/api/research/backtrace', {
      method: 'POST',
      body: { symbol }
    });
    updatePayload(payload);
    panel?.classList.remove('collapsed');
  } catch (error) {
    setResearchStatus({ state: 'failed', message: 'Research failed', detail: error.message });
  } finally {
    setContentLoading('research', false);
    setButtonBusy(elements.runResearchButton, false);
  }
}

function setResearchStatus(status = {}) {
  if (!elements.researchStatus) return;
  const stateClass = ['idle', 'loading', 'completed', 'failed'].includes(status.state) ? status.state : 'idle';
  elements.researchStatus.className = `research-status ${stateClass}`;
  elements.researchStatus.innerHTML = `
    <strong>${escapeHtml(status.message || 'Research is ready')}</strong>
    <span>${escapeHtml(status.detail || '')}${status.updatedAt ? ` | ${shortDateTime(status.updatedAt)}` : ''}</span>
  `;
}

function renderResearch(report) {
  if (!elements.researchSummary) return;
  if (!report) {
    elements.researchBadge.textContent = 'Not run';
    elements.researchSummary.innerHTML = '';
    elements.researchAdjustment.innerHTML = '';
    elements.researchParameters.innerHTML = '';
    elements.researchTechnical.innerHTML = '';
    elements.researchWeightForm.classList.add('hidden');
    elements.researchWeightControls.innerHTML = '';
    elements.researchTradeTable.innerHTML = '<tr><td colspan="7">No validation trades yet.</td></tr>';
    return;
  }

  const finalMetrics = report.final || report.optimized || {};
  const technical = report.technicalAssessment || {};
  elements.researchBadge.textContent = `1Y · 1D | ${researchWinRate(finalMetrics)}`;
  setResearchStatus({
    state: 'completed',
    message: `${report.symbol} 1Y daily backtrace completed`,
    detail: `${report.from} to ${report.to} | ${report.candleCount} daily candles | ${report.split?.validationCandles || 0} out-of-sample candles`,
    updatedAt: report.createdAt
  });
  elements.researchSummary.innerHTML = [
    ['Auto-Trade Success', researchWinRate(finalMetrics), finalMetrics.tradeCount ? metricTone(finalMetrics.winRatePercentage - 50) : 'neutral'],
    ['Net Return', signedPercent(finalMetrics.totalReturnPercentage), metricTone(finalMetrics.totalReturnPercentage)],
    ['Completed Trades', formatNumber(finalMetrics.tradeCount), 'neutral'],
    ['Profit Factor', finalMetrics.tradeCount ? formatNumber(finalMetrics.profitFactor) : 'N/A', metricTone((finalMetrics.profitFactor || 0) - 1)],
    ['Max Drawdown', percent(finalMetrics.maxDrawdownPercentage), volatilityTone(finalMetrics.maxDrawdownPercentage)],
    ['Average Hold', finalMetrics.tradeCount ? `${formatNumber(finalMetrics.averageHoldDays)}D` : 'N/A', 'neutral']
  ].map(([label, value, tone]) => `
    <div class="research-metric tone-${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');

  const adjustment = report.adjustment || {};
  const noValidationTrades = Number(finalMetrics.tradeCount) === 0;
  const adjustmentRecommendation = noValidationTrades
    ? 'Current parameters retained'
    : adjustment.applied
      ? 'Validated parameters are now active'
      : 'Current parameters remain active';
  const adjustmentReason = noValidationTrades
    ? finalMetrics.diagnostics?.highestExecutableScore !== undefined
      ? adjustment.reason
      : 'No BUY entry qualified in the validation window. Win rate is not measurable until at least one trade is completed.'
    : adjustment.reason;
  elements.researchAdjustment.className = `research-adjustment ${adjustment.applied ? 'applied' : adjustment.shouldApply ? 'recommended' : 'kept'}`;
  elements.researchAdjustment.innerHTML = `
    <div>
      <span>${escapeHtml(noValidationTrades ? 'No validation entries' : adjustment.applied ? 'Final tuned strategy' : 'Final live strategy')}</span>
      <strong>${escapeHtml(adjustmentRecommendation)}</strong>
    </div>
    <small>${escapeHtml(adjustmentReason || '')}</small>
  `;

  elements.researchParameters.innerHTML = (report.parameterComparison || []).map((item) => `
    <div class="research-parameter-row ${item.changed ? 'changed' : ''}">
      <span>${escapeHtml(item.label)}${isFiniteNumber(item.validationWinRatePercentage) ? `<small>${formatNumber(item.validationWinRatePercentage)}% directional success | ${formatNumber(item.occurrences)} signals</small>` : ''}</span>
      <b>${escapeHtml(researchParameterValue(item))}</b>
    </div>
  `).join('') || emptyText('No parameter comparison');

  elements.researchTechnical.innerHTML = `
    <div class="research-technical-metrics">
      <span><small>Directional success</small><strong>${isFiniteNumber(technical.directionalSuccessRatePercentage) ? `${formatNumber(technical.directionalSuccessRatePercentage)}%` : 'N/A'}</strong></span>
      <span><small>Qualified signals</small><strong>${formatNumber(technical.occurrences || 0)}</strong></span>
      <span><small>Avg signed 5D return</small><strong>${isFiniteNumber(technical.averageForwardReturnPercentage) ? signedPercent(technical.averageForwardReturnPercentage) : 'N/A'}</strong></span>
    </div>
    <p>${escapeHtml(technical.executionRule || 'Assess after the daily close; execute at the next session open.')}</p>
    <div class="research-input-list">${(technical.inputs || []).map((input) => `<span>${escapeHtml(input)}</span>`).join('')}</div>
  `;
  renderResearchWeightEditor(report, state.researchWeightScenario);

  elements.researchTradeTable.innerHTML = (report.trades || []).map((trade) => `
    <tr>
      <td>${escapeHtml(trade.signalDate || '--')}</td>
      <td>${escapeHtml(trade.entryDate || '--')}</td>
      <td>${escapeHtml(trade.exitDate || '--')}</td>
      <td>${formatNumber(trade.entryScore)}</td>
      <td class="research-candle-cell"><strong class="${(trade.previousCandle?.score || 0) > 0 ? 'positive' : (trade.previousCandle?.score || 0) < 0 ? 'negative' : ''}">${signedNumber(trade.previousCandle?.score || 0)}</strong><small>${isFiniteNumber(trade.previousCandle?.changePct) ? signedPercent(trade.previousCandle.changePct) : '--'}</small></td>
      <td class="${trade.returnPercentage > 0 ? 'positive' : 'negative'}">${signedPercent(trade.returnPercentage)}</td>
      <td>${escapeHtml(trade.exitReason || '--')}</td>
    </tr>
  `).join('') || '<tr><td colspan="7">No validation trades in this window.</td></tr>';
}

function renderResearchWeightEditor(report, scenario = 'best') {
  if (!report || !elements.researchWeightForm) return;
  const selectedScenario = scenario === 'active' ? 'active' : 'best';
  const finalMetrics = report.final || report.baseline || {};
  const bestMetrics = report.optimized || {};
  const activeWeights = state.payload?.settings?.autoTrade?.parameterWeights
    || report.finalStrategy?.parameterWeights
    || {};
  const bestWeights = report.recommendedStrategy?.parameterWeights || activeWeights;
  const weights = selectedScenario === 'best' ? bestWeights : activeWeights;
  state.researchWeightScenario = selectedScenario;
  elements.researchWeightForm.classList.remove('hidden');
  elements.researchWeightScenarioButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.researchWeightScenario === selectedScenario);
  });
  elements.researchWeightScenario.textContent = selectedScenario === 'best'
    ? `Best tested: ${researchMetricsLabel(bestMetrics)}. ${report.adjustment?.applied ? 'Validated and active.' : 'Not automatically applied by the guard.'}`
    : `Active final: ${researchMetricsLabel(finalMetrics)}.`;
  elements.researchWeightControls.innerHTML = technicalWeightDefinitions.map((definition) => {
    const value = normalizedResearchWeight(weights[definition.key]);
    return `
      <label class="research-weight-control">
        <span><strong>${escapeHtml(definition.label)}</strong><output data-research-weight-output="${escapeHtml(definition.key)}">${formatNumber(value)}x</output></span>
        <input type="range" min="0.5" max="1.5" step="0.05" value="${value}" data-research-weight="${escapeHtml(definition.key)}">
      </label>
    `;
  }).join('');
  elements.researchWeightStatus.textContent = selectedScenario === 'best'
    ? 'Best-tested weights are staged. Save to use them, then rerun the backtrace.'
    : 'These are the currently active technical weights.';
}

function syncResearchWeightOutputs() {
  elements.researchWeightScenarioButtons.forEach((button) => button.classList.remove('active'));
  elements.researchWeightControls.querySelectorAll('[data-research-weight]').forEach((input) => {
    const output = elements.researchWeightControls.querySelector(`[data-research-weight-output="${input.dataset.researchWeight}"]`);
    if (output) output.textContent = `${formatNumber(Number(input.value))}x`;
  });
  elements.researchWeightScenario.textContent = 'Custom technical weights';
  elements.researchWeightStatus.textContent = 'Custom weights are staged. Save, then rerun the backtrace to validate them.';
}

async function saveResearchWeights(event) {
  event.preventDefault();
  const submitButton = elements.researchWeightForm.querySelector('button[type="submit"]');
  const currentWeights = {
    ...(state.payload?.settings?.autoTrade?.parameterWeights || {})
  };
  elements.researchWeightControls.querySelectorAll('[data-research-weight]').forEach((input) => {
    currentWeights[input.dataset.researchWeight] = normalizedResearchWeight(input.value);
  });
  setButtonBusy(submitButton, true);
  elements.researchWeightStatus.textContent = 'Saving technical weights...';
  try {
    const saved = await saveSettings({ autoTrade: { parameterWeights: currentWeights } });
    if (state.payload) {
      state.payload.settings = saved;
      state.payload.tradePolicy = {
        ...(state.payload.tradePolicy || {}),
        parameterWeights: saved.autoTrade.parameterWeights
      };
    }
    renderSettings(saved);
    state.researchWeightScenario = 'active';
    renderResearchWeightEditor(state.payload?.research, 'active');
    elements.researchWeightStatus.textContent = 'Saved. Run the 1Y backtrace again to validate these active weights.';
  } catch (error) {
    elements.researchWeightStatus.textContent = error.message;
  } finally {
    setButtonBusy(submitButton, false);
  }
}

function researchMetricsLabel(metrics = {}) {
  return Number(metrics.tradeCount) > 0
    ? `${formatNumber(metrics.winRatePercentage)}% success / ${formatNumber(metrics.tradeCount)} trades`
    : 'no completed validation trade';
}

function normalizedResearchWeight(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0.5, Math.min(1.5, Math.round(parsed * 20) / 20));
}

function researchParameterValue(item = {}) {
  const value = formatNumber(item.final ?? item.recommended);
  if (['takeProfitPct', 'stopLossPct'].includes(item.key)) return `${value}%`;
  if (item.key === 'maxHoldDays') return `${value}D`;
  if (!['minScore'].includes(item.key)) return `${value}x`;
  return value;
}

function researchWinRate(metrics = {}) {
  return Number(metrics.tradeCount) > 0 ? `${formatNumber(metrics.winRatePercentage)}%` : 'N/A';
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
      <td>${currency(item.buyTarget)}</td>
      <td>${currency(item.sellTarget)}</td>
      <td>${compactNumber(item.avgVolume20)}</td>
    </tr>
  `).join('') || `<tr><td colspan="9">No ranking data.</td></tr>`;

  elements.rankingTable.querySelectorAll('button[data-symbol]').forEach((button) => {
    button.addEventListener('click', async () => {
      const symbol = button.dataset.symbol;
      setButtonBusy(button, true);
      setContentLoading('snapshot', true, `Loading ${symbol}`);
      setContentLoading('news', true, `Fetching ${symbol} news`);
      try {
        await saveSettings({ activeSymbol: symbol });
        const payload = await api('/api/refresh', { method: 'POST', body: { symbol } });
        updatePayload(payload);
      } finally {
        setContentLoading('snapshot', false);
        setContentLoading('news', false);
        setButtonBusy(button, false);
      }
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
  const active = records
    .filter((record) => record.occurrences > 0)
    .sort((a, b) => (
      structureSignalPriority(b) - structureSignalPriority(a)
      || Number(b.significanceLevel || 0) - Number(a.significanceLevel || 0)
      || Math.abs(Number(b.avgSignedReturn || 0)) - Math.abs(Number(a.avgSignedReturn || 0))
      || Number(b.occurrences || 0) - Number(a.occurrences || 0)
    ))
    .slice(0, 12);
  elements.significanceTable.innerHTML = active.map((record) => `
    <tr class="${isStructureSignal(record) ? 'structure-signal-row' : ''}">
      <td>${escapeHtml(record.label)}</td>
      <td class="${record.direction === 'bullish' ? 'positive' : 'negative'}">${record.direction}</td>
      <td>${record.occurrences}</td>
      <td>${percent((record.winRate || 0) * 100)}</td>
      <td class="${record.avgSignedReturn >= 0 ? 'positive' : 'negative'}">${signedPercent(record.avgSignedReturn)}</td>
      <td>${formatNumber(record.weightMultiplier)}x</td>
    </tr>
  `).join('') || `<tr><td colspan="6">No calibrated signal hits yet.</td></tr>`;
}

function isStructureSignal(record) {
  const label = String(record?.label || '');
  return structureSignalIds.has(record?.id) || /break of structure|trend change/i.test(label);
}

function structureSignalPriority(record) {
  if (!isStructureSignal(record)) return 0;
  return /break of structure/i.test(record?.label || '') || String(record?.id || '').includes('_bos') ? 2 : 1;
}

function renderTechnicalSignalChart(snapshot = state.payload?.snapshot) {
  const canvas = elements.signalChart;
  const allCandles = snapshot?.candles || [];
  const windowFrom = snapshot?.signalSignificance?.from;
  const windowTo = snapshot?.signalSignificance?.to;
  const candles = windowFrom && windowTo
    ? allCandles.filter((candle) => candle.date >= windowFrom && candle.date <= windowTo)
    : allCandles.slice(-22);
  if (!canvas || candles.length < 2) return;

  const parentWidth = canvas.parentElement?.getBoundingClientRect().width || 640;
  const cssWidth = Math.max(300, Math.floor(parentWidth));
  const cssHeight = window.innerWidth <= 540 ? 260 : 300;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssWidth * ratio);
  canvas.height = Math.floor(cssHeight * ratio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { left: 42, right: 12, top: 18, bottom: 34 };
  const plotWidth = cssWidth - pad.left - pad.right;
  const volumeHeight = window.innerWidth <= 540 ? 36 : 44;
  const volumeGap = 10;
  const priceHeight = cssHeight - pad.top - pad.bottom - volumeHeight - volumeGap;
  const values = candles.flatMap((candle) => [candle.high, candle.low, candle.sma20, candle.sma50]).filter(isFiniteNumber);
  if (!values.length) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const xAt = (index) => pad.left + ((index + 0.5) / candles.length) * plotWidth;
  const yAt = (value) => pad.top + (1 - ((value - min) / span)) * priceHeight;
  const candleWidth = Math.max(4, Math.min(12, (plotWidth / candles.length) * 0.58));
  const volumeTop = pad.top + priceHeight + volumeGap;
  const volumeMax = Math.max(1, ...candles.map((candle) => candle.volume || 0).filter(isFiniteNumber));

  ctx.fillStyle = '#fbfcfe';
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.strokeStyle = '#d9e0e8';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) {
    const y = pad.top + (priceHeight / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(cssWidth - pad.right, y);
    ctx.stroke();
  }

  drawVolumeBars(ctx, candles, xAt, volumeTop, volumeHeight, volumeMax, candleWidth, pad.left, cssWidth - pad.right);
  drawCandles(ctx, candles, xAt, yAt, candleWidth);
  drawChartLine(ctx, candles, 'sma20', xAt, yAt, '#087f8c', 1.6);
  drawChartLine(ctx, candles, 'sma50', xAt, yAt, '#2d5bff', 1.4);
  drawStructureMarkers(ctx, candles, snapshot?.reversalMarkers || [], xAt, yAt, {
    top: pad.top,
    bottom: pad.top + priceHeight
  });

  const latest = candles.at(-1);
  if (isFiniteNumber(latest?.close)) {
    const y = yAt(latest.close);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#177245';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(cssWidth - pad.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#177245';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(currency(latest.close), Math.max(pad.left, cssWidth - 104), Math.max(pad.top + 10, y - 5));
  }

  ctx.fillStyle = '#667085';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(formatNumber(max), 4, pad.top + 4);
  ctx.fillText(formatNumber(min), 4, pad.top + priceHeight);
  ctx.fillText(chartDateLabel(candles[0]?.date), pad.left, cssHeight - 10);
  ctx.fillText(chartDateLabel(candles.at(Math.floor(candles.length / 2))?.date), Math.max(pad.left, cssWidth / 2 - 18), cssHeight - 10);
  ctx.fillText(chartDateLabel(candles.at(-1)?.date), Math.max(pad.left, cssWidth - 58), cssHeight - 10);

  drawLegend(ctx, pad.left, 12, [
    ['Candle', '#17202a'],
    ['MA20', '#087f8c'],
    ['MA50', '#2d5bff'],
    ['BOS/TC', '#177245']
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
  renderNewsFetchStatus(news?.status || state.newsStatus);

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
          <span>${shortDateTime(report.createdAt)} | ${escapeHtml(newsDateLabel(report.newsAnalysis))} | news ${escapeHtml(report.newsAnalysis?.verdict || 'neutral')} | final ${formatNumber(report.score)} (tech ${formatNumber(report.technicalScore)}, news ${signedNumber(report.newsScore)}) | trade ${report.tradeExecuted ? 'executed' : 'not executed'} | email ${report.email?.sent ? 'sent' : 'off'}</span>
        </summary>
        ${renderNewsDetail(report.newsAnalysis || newsSummary(report), sourceUrl)}
      </details>
    `;
  }).join('');

  elements.aiReports.innerHTML = currentNewsHtml + reportHtml || emptyText('No AI decision reports');
}

function setNewsFetchStatus(status) {
  state.newsStatus = {
    updatedAt: new Date().toISOString(),
    ...(status || {})
  };
  renderNewsFetchStatus(state.newsStatus);
}

function renderNewsFetchStatus(status) {
  if (!elements.newsFetchStatus) return;
  const current = status || state.payload?.news?.status || state.newsStatus || {
    state: 'idle',
    message: 'Waiting for news refresh',
    detail: 'News fetch and AI verdict progress will appear here.'
  };
  elements.newsFetchStatus.className = `news-fetch-status ${statusClass(current.state)}`;
  elements.newsFetchStatus.innerHTML = `
    <span>${escapeHtml((current.stage || current.state || 'status').replaceAll('-', ' '))}</span>
    <strong>${escapeHtml(current.message || 'Waiting for news refresh')}</strong>
    <small>${escapeHtml(current.detail || '')}${current.updatedAt ? ` | ${shortDateTime(current.updatedAt)}` : ''}</small>
  `;
}

function statusClass(value) {
  return ['idle', 'loading', 'completed', 'fallback', 'failed'].includes(value) ? value : 'idle';
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
        <span>${escapeHtml(profile.description)} News impact ${escapeHtml(signedNumber(decision.newsScore))} is included in the auto-trade score (${escapeHtml(newsVerdict)}).</span>
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
  const targets = snapshot.priceTargets || decision.priceTargets || {};
  const structure = snapshot.marketStructure || decision.marketStructure || {};
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
    ['Verdict', `${decision.action} | final ${formatNumber(decision.score)} = tech ${formatNumber(decision.technicalScore)} ${signedNumber(decision.newsScore)} news`],
    ['Buy Target', currency(targets.buyTarget)],
    ['Sell Target', currency(targets.sellTarget)],
    ['Technical Stop', currency(targets.stopLoss)],
    ['Risk / Reward', targets.riskReward ? `${formatNumber(targets.riskReward)}x` : '--'],
    ['Structure', `${structure.breakOfStructure || 'none'} BOS | ${structure.trendChange || 'none'} trend change`],
    ['Take Profit', `${formatNumber(autoTrade.takeProfitPct ?? tradePolicy?.takeProfitPct ?? 7)}%`],
    ['Auto Stop Loss', `${formatNumber(autoTrade.stopLossPct ?? tradePolicy?.stopLossPct ?? 4.5)}%`]
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
    return { allowed: false, reason: `Combined score ${formatNumber(score)} is below min ${formatNumber(minScore)}.` };
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
      description: 'Short-term view from momentum, volume, and recent news.',
      components: [
        { label: 'Momentum', match: 'momentum' },
        { label: 'Volume', match: 'volume' },
        { label: 'News', match: 'news' }
      ]
    },
    swing: {
      label: 'Swing',
      threshold: 8,
      description: 'Swing view from trend, reversal triggers, and recent news.',
      components: [
        { label: 'Trend', match: 'trend' },
        { label: 'Momentum', match: 'momentum' },
        { label: 'Reversal', match: 'reversal' },
        { label: 'News', match: 'news' }
      ]
    },
    position: {
      label: 'Position',
      threshold: 7,
      description: 'Position view from trend, risk, historical edge, and recent news.',
      components: [
        { label: 'Trend', match: 'trend' },
        { label: 'Risk', match: 'volatility' },
        { label: 'History', match: 'historical' },
        { label: 'News', match: 'news' }
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
    const initiallyCollapsed = panel.classList.contains('collapsed');
    button.setAttribute('aria-label', `${initiallyCollapsed ? 'Expand' : 'Collapse'} ${title}`);
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

function drawCandles(ctx, candles, xAt, yAt, candleWidth) {
  candles.forEach((candle, index) => {
    if (![candle.open, candle.high, candle.low, candle.close].every(isFiniteNumber)) return;
    const bullish = candle.close >= candle.open;
    const color = bullish ? '#177245' : '#c2414b';
    const x = xAt(index);
    const highY = yAt(candle.high);
    const lowY = yAt(candle.low);
    const openY = yAt(candle.open);
    const closeY = yAt(candle.close);
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(2, Math.abs(closeY - openY));

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillRect(x - (candleWidth / 2), bodyTop, candleWidth, bodyHeight);
  });
}

function drawVolumeBars(ctx, candles, xAt, top, height, maxVolume, candleWidth, left, right) {
  candles.forEach((candle, index) => {
    if (!isFiniteNumber(candle.volume)) return;
    const barHeight = Math.max(1, (candle.volume / maxVolume) * height);
    const bullish = candle.close >= candle.open;
    ctx.fillStyle = bullish ? 'rgba(23, 114, 69, 0.22)' : 'rgba(194, 65, 75, 0.22)';
    ctx.fillRect(xAt(index) - (candleWidth / 2), top + height - barHeight, candleWidth, barHeight);
  });
  ctx.strokeStyle = '#d9e0e8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top + height);
  ctx.lineTo(right, top + height);
  ctx.stroke();
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

function drawStructureMarkers(ctx, candles, markers, xAt, yAt, bounds) {
  if (!Array.isArray(markers) || !markers.length) return;
  const visibleIndexByDate = new Map(candles.map((candle, index) => [candle.date, index]));
  const visibleMarkers = markers
    .filter((marker) => structureSignalIds.has(marker.id) && visibleIndexByDate.has(marker.date))
    .slice(-18);

  visibleMarkers.forEach((marker) => {
    const index = visibleIndexByDate.get(marker.date);
    const candle = candles[index];
    const value = isFiniteNumber(marker.close) ? marker.close : candle?.close;
    if (!isFiniteNumber(value)) return;

    const bearish = marker.direction === 'bearish';
    const x = xAt(index);
    const y = clampNumber(yAt(value) + (bearish ? 13 : -13), bounds.top + 12, bounds.bottom - 12);
    const color = bearish ? '#c2414b' : '#177245';
    const label = marker.id.includes('_bos') ? 'BOS' : 'TC';

    drawSignalTriangle(ctx, x, y, bearish ? 'down' : 'up', color);
    ctx.fillStyle = color;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, bearish ? y - 8 : y + 14);
    ctx.textAlign = 'left';
  });
}

function drawSignalTriangle(ctx, x, y, direction, color) {
  const size = 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (direction === 'down') {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size, y - size);
    ctx.lineTo(x + size, y - size);
  } else {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.lineTo(x + size, y + size);
  }
  ctx.closePath();
  ctx.fill();
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
    offset += label.length > 5 ? 72 : 56;
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
  const newsImpact = Number(state.payload?.decision?.newsScore || 0);

  elements.newsWindowSummary.innerHTML = `
    <div class="news-window-card ${escapeHtml(analysis.verdict || 'neutral')}">
      <div>
        <span class="news-window-kicker">${escapeHtml(newsDateLabel(analysis))}</span>
        <strong>${escapeHtml(summarySnippet(analysis.summary, 86))}</strong>
        <span>${headlineCount} headline${headlineCount === 1 ? '' : 's'} | ${escapeHtml(sourceLabel)} | ${escapeHtml(engine.label)}</span>
      </div>
      <div class="news-window-score">
        <b>${escapeHtml(analysis.verdict || 'neutral')} ${formatNumber(analysis.confidencePercentage)}%</b>
        <small>Trade impact ${escapeHtml(signedNumber(newsImpact))}</small>
      </div>
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
        ? `Completed with local fallback. LM Studio error: ${summarySnippet(analysis.error, 90)}`
        : 'Completed with local fallback after LM Studio did not return a usable verdict.'
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

function priceDiff(diff, pct) {
  if (!isFiniteNumber(diff) || !isFiniteNumber(pct)) return '--';
  return `${diff >= 0 ? '+' : ''}${currency(diff)} (${signedPercent(pct)})`;
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

function chartDateLabel(value) {
  if (!value) return '--';
  return String(value).slice(5) || String(value);
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
