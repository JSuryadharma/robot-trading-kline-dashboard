import { buildHistoricalNewsTimeline } from './backtrace.js';
import { calibrateSignals } from './calibration.js';
import { defaultParameterWeights, makeDecision, normalizeParameterWeights } from './decisionEngine.js';
import { detectSignals } from './indicators.js';

const RANGE_SESSIONS = {
  '20d': 20,
  '40d': 40,
  '60d': 60
};

export function runDayTradeBacktraceResearch({ snapshot, newsItems = [], settings, range = 'auto', applyAdjustments = true } = {}) {
  const candles = snapshot?.candles || [];
  const sessionDates = [...new Set(candles.map((candle) => candle.date))];
  if (candles.length < 200 || sessionDates.length < 15) {
    throw new Error('Day-trade back trace needs at least 200 intraday candles across 15 market sessions.');
  }

  const baselineStrategy = strategyFromSettings(settings);
  const timeline = buildHistoricalNewsTimeline(candles, newsItems, { lagDays: 1 });
  const normalizedRange = range === 'auto' ? 'auto' : normalizeRange(range);
  const evaluatedRanges = Object.keys(RANGE_SESSIONS)
    .map((rangeKey) => evaluateRange({
      candles,
      sessionDates,
      rangeKey,
      symbol: snapshot.symbol,
      baselineStrategy,
      newsTimeline: timeline.byDate
    }))
    .filter(Boolean);
  if (!evaluatedRanges.length) {
    throw new Error('No intraday duration has enough market sessions for validation.');
  }

  const credible = evaluatedRanges.filter((item) => item.optimizedValidation.tradeCount >= 5);
  const selected = normalizedRange === 'auto'
    ? credible.length
      ? credible.slice().sort((a, b) => b.selectionScore - a.selectionScore)[0]
      : evaluatedRanges.slice().sort((a, b) => b.sessionCount - a.sessionCount)[0]
    : evaluatedRanges.find((item) => item.rangeKey === normalizedRange) || evaluatedRanges.at(-1);
  const adjustment = buildAdjustment(selected, baselineStrategy, applyAdjustments);
  const selectedDates = sessionDates.slice(-selected.sessionCount);
  const selectedDateSet = new Set(selectedDates);
  const selectedCandles = candles.filter((candle) => selectedDateSet.has(candle.date));
  const newsDates = new Set(selectedCandles.filter((candle) => (timeline.byDate.get(candle.date)?.headlineCount || 0) > 0).map((candle) => candle.date));

  return {
    id: `day_research_${Date.now()}`,
    mode: 'day-trade',
    symbol: snapshot.yfSymbol,
    tvSymbol: snapshot.symbol,
    createdAt: new Date().toISOString(),
    source: snapshot.source,
    interval: snapshot.interval || '15m',
    requestedRange: normalizedRange,
    selectedRange: selected.rangeKey,
    selectedRangeLabel: `${selected.sessionCount} sessions / ${snapshot.interval || '15m'}`,
    from: selectedDates[0],
    to: selectedDates.at(-1),
    candleCount: selectedCandles.length,
    sessionCount: selected.sessionCount,
    maximumWindow: '60 calendar days of 15-minute candles',
    split: selected.split,
    baseline: selected.baselineValidation,
    optimized: selected.optimizedValidation,
    optimizedTraining: selected.optimizedTraining,
    recommendedStrategy: selected.recommendedStrategy,
    parameterComparison: compareParameters(baselineStrategy, selected.recommendedStrategy),
    adjustment,
    rangeComparisons: evaluatedRanges.map(lightRangeResult),
    rangeSelectionReason: selectionReason(selected, normalizedRange, credible),
    newsCoverage: {
      articleCount: newsItems.filter((item) => item.publishedDate >= selectedDates[0] && item.publishedDate <= selectedDates.at(-1)).length,
      sessionsWithNews: newsDates.size,
      sessionCoveragePercentage: round((newsDates.size / selected.sessionCount) * 100),
      method: 'Archived headlines available through the prior day; same-day dated news is excluded to prevent look-ahead'
    },
    trades: selected.optimizedValidation.trades.slice(-30).reverse(),
    methodology: [
      'Uses 15-minute candles from regular IDX sessions over at most 60 calendar days.',
      'Signals execute at the next intraday candle open and include 0.4% round-trip cost.',
      'Every position closes on stop, target, time limit, bearish reversal, or the same-day session close.',
      'The oldest 65% of sessions tunes parameters; the newest 35% validates them.',
      'Backdated news is lagged by one day because the archive does not provide reliable intraday publication times.'
    ]
  };
}

function evaluateRange({ candles, sessionDates, rangeKey, symbol, baselineStrategy, newsTimeline }) {
  const requested = RANGE_SESSIONS[rangeKey];
  const sessionCount = Math.min(requested, sessionDates.length);
  if (sessionCount < 15) return null;
  const dates = sessionDates.slice(-sessionCount);
  const trainingSessionCount = Math.min(sessionCount - 5, Math.max(10, Math.floor(sessionCount * 0.65)));
  const trainingDates = dates.slice(0, trainingSessionCount);
  const validationDates = dates.slice(trainingSessionCount);
  if (validationDates.length < 5) return null;
  const trainingSet = new Set(trainingDates);
  const validationSet = new Set(validationDates);
  const calibrationCandles = candles.filter((candle) => trainingSet.has(candle.date));
  const calibration = calibrateSignals(calibrationCandles, {
    from: trainingDates[0],
    to: trainingDates.at(-1),
    lookAhead: 4
  });
  const candidates = strategyCandidates(baselineStrategy);
  const trainingResults = candidates.map((strategy) => ({
    strategy,
    metrics: simulate({ candles, allowedDates: trainingSet, symbol, newsTimeline, calibration, strategy })
  }));
  const optimizedTraining = trainingResults.slice().sort((a, b) => objective(b.metrics) - objective(a.metrics))[0];
  const baselineValidation = simulate({ candles, allowedDates: validationSet, symbol, newsTimeline, calibration, strategy: baselineStrategy });
  const optimizedValidation = simulate({ candles, allowedDates: validationSet, symbol, newsTimeline, calibration, strategy: optimizedTraining.strategy });

  return {
    rangeKey,
    rangeLabel: `${sessionCount} sessions / 15m`,
    sessionCount,
    split: {
      trainingFrom: trainingDates[0],
      trainingTo: trainingDates.at(-1),
      validationFrom: validationDates[0],
      validationTo: validationDates.at(-1),
      trainingSessions: trainingDates.length,
      validationSessions: validationDates.length,
      trainingCandles: calibrationCandles.length,
      validationCandles: candles.filter((candle) => validationSet.has(candle.date)).length
    },
    baselineValidation,
    optimizedValidation,
    optimizedTraining: optimizedTraining.metrics,
    recommendedStrategy: optimizedTraining.strategy,
    selectionScore: robustSelectionScore(optimizedValidation, optimizedTraining.metrics)
  };
}

function simulate({ candles, allowedDates, symbol, newsTimeline, calibration, strategy }) {
  let position = null;
  const trades = [];
  const tradedDates = new Set();
  const diagnostics = {
    executableCandles: 0,
    entrySignals: 0,
    highestExecutableScore: null,
    strategyMinScore: strategy.minScore
  };

  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!allowedDates.has(candle.date)) continue;
    const nextCandle = candles[index + 1];
    const portfolio = {
      positions: position ? {
        [symbol]: { quantity: 1, averagePrice: position.entryPrice, openedAt: position.entryAt }
      } : {}
    };
    const decision = makeDecision({
      symbol,
      latest: candle,
      candles: candles.slice(Math.max(0, index - 20), index + 1),
      currentSignals: detectSignals(candles, index),
      calibration
    }, portfolio, {
      newsAnalysis: newsTimeline.get(candle.date),
      tradePolicy: { takeProfitPct: strategy.takeProfitPct, parameterWeights: strategy.parameterWeights }
    });

    if (position) {
      position.holdBars += 1;
      const stopPrice = position.entryPrice * (1 - (strategy.stopLossPct / 100));
      const targetPrice = position.entryPrice * (1 + (strategy.takeProfitPct / 100));
      let exitReason = '';
      let exitPrice = candle.close;
      if (candle.low <= stopPrice) {
        exitReason = 'Stop loss';
        exitPrice = stopPrice;
      } else if (candle.high >= targetPrice) {
        exitReason = 'Take profit';
        exitPrice = targetPrice;
      } else if (decision.score <= -Math.max(28, strategy.minScore * 0.65)) {
        exitReason = 'Bearish reversal';
      } else if (position.holdBars >= strategy.maxHoldBars) {
        exitReason = 'Time exit';
      } else if (!nextCandle || nextCandle.date !== candle.date || !allowedDates.has(nextCandle.date)) {
        exitReason = 'Session close';
      }
      if (exitReason) {
        trades.push(closeTrade(position, candle, exitPrice, exitReason));
        position = null;
      }
      continue;
    }

    if (!nextCandle || nextCandle.date !== candle.date || tradedDates.has(candle.date) || !isEntryTime(candle.time)) continue;
    diagnostics.executableCandles += 1;
    diagnostics.highestExecutableScore = diagnostics.highestExecutableScore === null
      ? decision.score
      : Math.max(diagnostics.highestExecutableScore, decision.score);
    if (decision.action !== 'BUY' || decision.score < strategy.minScore) continue;
    diagnostics.entrySignals += 1;
    tradedDates.add(candle.date);
    position = {
      entryAt: timestampLabel(nextCandle.time),
      entryDate: nextCandle.date,
      entryPrice: nextCandle.open,
      entryScore: decision.score,
      technicalScore: decision.technicalScore,
      newsScore: decision.newsScore,
      holdBars: 0
    };
  }

  if (position) {
    const last = candles.filter((candle) => allowedDates.has(candle.date)).at(-1);
    trades.push(closeTrade(position, last, last.close, 'Window end'));
  }
  return metricsFromTrades(trades, diagnostics);
}

function closeTrade(position, candle, exitPrice, exitReason) {
  const grossReturn = percentReturn(position.entryPrice, exitPrice);
  const netReturn = grossReturn - 0.4;
  return {
    entryDate: position.entryDate,
    exitDate: candle.date,
    entryAt: position.entryAt,
    exitAt: timestampLabel(candle.time),
    entryPrice: round(position.entryPrice),
    exitPrice: round(exitPrice),
    holdDays: round(position.holdBars / 26),
    holdBars: position.holdBars,
    returnPercentage: round(netReturn),
    result: netReturn > 0 ? 'WIN' : 'LOSS',
    exitReason,
    entryScore: round(position.entryScore),
    technicalScore: round(position.technicalScore),
    newsScore: round(position.newsScore)
  };
}

function metricsFromTrades(trades, diagnostics) {
  const wins = trades.filter((trade) => trade.returnPercentage > 0);
  const losses = trades.filter((trade) => trade.returnPercentage <= 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.returnPercentage, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.returnPercentage, 0));
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const trade of trades) {
    equity *= 1 + (trade.returnPercentage / 100);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
  }
  return {
    tradeCount: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRatePercentage: trades.length ? round((wins.length / trades.length) * 100) : 0,
    totalReturnPercentage: round((equity - 1) * 100),
    averageReturnPercentage: trades.length ? round(trades.reduce((sum, trade) => sum + trade.returnPercentage, 0) / trades.length) : 0,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? 9.99 : 0,
    maxDrawdownPercentage: round(maxDrawdown),
    averageHoldDays: trades.length ? round(trades.reduce((sum, trade) => sum + trade.holdBars, 0) / trades.length / 26) : 0,
    averageHoldBars: trades.length ? round(trades.reduce((sum, trade) => sum + trade.holdBars, 0) / trades.length) : 0,
    diagnostics: {
      ...diagnostics,
      highestExecutableScore: diagnostics.highestExecutableScore === null ? null : round(diagnostics.highestExecutableScore)
    },
    trades
  };
}

function strategyFromSettings(settings = {}) {
  const source = settings.dayTrade || {};
  return {
    name: 'Current day-trade parameters',
    minScore: clamp(Number(source.minScore) || 44, 38, 70),
    takeProfitPct: clamp(Number(source.takeProfitPct) || 1.8, 0.8, 4),
    stopLossPct: clamp(Number(source.stopLossPct) || 1.2, 0.6, 3),
    maxHoldBars: clamp(Number(source.maxHoldBars) || 8, 3, 16),
    parameterWeights: normalizeParameterWeights(source.parameterWeights)
  };
}

function strategyCandidates(baseline) {
  const profiles = [
    { name: 'Current day-trade parameters', weights: baseline.parameterWeights },
    { name: 'Intraday momentum', weights: { ...baseline.parameterWeights, trend: 0.85, momentum: 1.35, volume: 1.3, triggers: 1.2, news: 0.8 } },
    { name: 'Breakout confirmation', weights: { ...baseline.parameterWeights, trend: 1.05, momentum: 1.15, volume: 1.35, triggers: 1.4, news: 0.75 } },
    { name: 'Risk controlled', weights: { ...baseline.parameterWeights, trend: 1.1, momentum: 1.05, volatility: 1.35, volume: 1.15, news: 0.65 } }
  ];
  const minScores = uniqueNumbers([baseline.minScore, baseline.minScore - 6, baseline.minScore + 6, 38, 44].map((value) => clamp(value, 38, 70)));
  const takeProfits = uniqueNumbers([baseline.takeProfitPct, baseline.takeProfitPct - 0.6, baseline.takeProfitPct + 0.6].map((value) => clamp(value, 0.8, 4)));
  const stopLosses = uniqueNumbers([baseline.stopLossPct, 1, 1.5].map((value) => clamp(value, 0.6, 3)));
  const holds = uniqueNumbers([baseline.maxHoldBars, 4, 8, 12].map((value) => clamp(value, 3, 16)));
  return profiles.flatMap((profile) => minScores.flatMap((minScore) => takeProfits.flatMap((takeProfitPct) => stopLosses.flatMap((stopLossPct) => holds.map((maxHoldBars) => ({
    name: profile.name,
    minScore,
    takeProfitPct,
    stopLossPct,
    maxHoldBars,
    parameterWeights: normalizeParameterWeights(profile.weights)
  }))))));
}

function buildAdjustment(selected, baseline, applyAdjustments) {
  const before = selected.baselineValidation;
  const after = selected.optimizedValidation;
  const credible = after.tradeCount >= 5
    && after.winRatePercentage >= Math.max(52, before.winRatePercentage + 3)
    && after.totalReturnPercentage > 0
    && after.totalReturnPercentage > before.totalReturnPercentage
    && after.profitFactor >= 1.1
    && after.maxDrawdownPercentage <= 6;
  const changed = JSON.stringify(baseline) !== JSON.stringify(selected.recommendedStrategy);
  return {
    baselineState: after.tradeCount === 0 ? 'no validation entries' : after.winRatePercentage < 52 ? 'low win rate' : 'acceptable',
    recommendation: credible && changed
      ? 'Use the validated day-trade parameters.'
      : after.tradeCount < 5
        ? 'Keep current day-trade parameters until at least 5 validation trades are available.'
        : 'Keep current day-trade parameters; the candidate did not improve return, win rate, and risk together.',
    shouldApply: credible && changed,
    applied: Boolean(applyAdjustments && credible && changed),
    reason: after.tradeCount
      ? `${after.tradeCount} same-day validation trades produced ${after.winRatePercentage}% wins, ${after.totalReturnPercentage}% return, and ${after.maxDrawdownPercentage}% drawdown.`
      : `No same-day BUY entry qualified; the highest executable score was ${after.diagnostics?.highestExecutableScore ?? 'n/a'} against the ${after.diagnostics?.strategyMinScore ?? selected.recommendedStrategy.minScore} gate.`
  };
}

function compareParameters(baseline, recommended) {
  const labels = {
    trend: 'Trend', momentum: 'Momentum', volatility: 'Volatility', volume: 'Volume', calibration: 'Calibration', triggers: 'Intraday triggers', news: 'Prior-day news'
  };
  return [
    ...Object.keys(defaultParameterWeights).map((key) => ({
      key,
      label: labels[key],
      current: baseline.parameterWeights[key],
      recommended: recommended.parameterWeights[key],
      changed: baseline.parameterWeights[key] !== recommended.parameterWeights[key]
    })),
    { key: 'minScore', label: 'Minimum score', current: baseline.minScore, recommended: recommended.minScore, changed: baseline.minScore !== recommended.minScore },
    { key: 'takeProfitPct', label: 'Take profit %', current: baseline.takeProfitPct, recommended: recommended.takeProfitPct, changed: baseline.takeProfitPct !== recommended.takeProfitPct },
    { key: 'stopLossPct', label: 'Stop loss %', current: baseline.stopLossPct, recommended: recommended.stopLossPct, changed: baseline.stopLossPct !== recommended.stopLossPct },
    { key: 'maxHoldBars', label: 'Maximum hold bars', current: baseline.maxHoldBars, recommended: recommended.maxHoldBars, changed: baseline.maxHoldBars !== recommended.maxHoldBars }
  ];
}

function robustSelectionScore(validation, training) {
  return round((objective(validation) * 0.78) + (objective(training) * 0.22) - (validation.tradeCount < 5 ? 18 : 0));
}

function objective(metrics) {
  if (!metrics.tradeCount) return -100;
  const samplePenalty = metrics.tradeCount < 3 ? 24 : metrics.tradeCount < 5 ? 10 : 0;
  return round(metrics.winRatePercentage + (metrics.totalReturnPercentage * 2.2) + (Math.min(metrics.profitFactor, 4) * 4) - (metrics.maxDrawdownPercentage * 1.8) - samplePenalty);
}

function lightRangeResult(item) {
  return {
    range: item.rangeKey,
    label: item.rangeLabel,
    selectionScore: item.selectionScore,
    baselineWinRatePercentage: item.baselineValidation.winRatePercentage,
    optimizedWinRatePercentage: item.optimizedValidation.winRatePercentage,
    tradeCount: item.optimizedValidation.tradeCount,
    totalReturnPercentage: item.optimizedValidation.totalReturnPercentage,
    maxDrawdownPercentage: item.optimizedValidation.maxDrawdownPercentage,
    executableSessions: item.split.validationSessions,
    highestExecutableScore: item.optimizedValidation.diagnostics?.highestExecutableScore ?? null,
    strategyMinScore: item.optimizedValidation.diagnostics?.strategyMinScore ?? item.recommendedStrategy.minScore,
    effectiveEntryThreshold: item.optimizedValidation.diagnostics?.strategyMinScore ?? item.recommendedStrategy.minScore
  };
}

function selectionReason(selected, requestedRange, credible) {
  if (requestedRange !== 'auto') return `Used the requested ${selected.rangeLabel} day-trade window.`;
  return credible.length
    ? 'Selected the strongest out-of-sample day-trade result with at least 5 validation trades.'
    : 'Selected the longest available intraday window because no duration had 5 validation trades.';
}

function isEntryTime(timestamp) {
  const minutes = jakartaMinutes(timestamp);
  return minutes >= 9 * 60 + 15 && minutes <= 14 * 60 + 30;
}

function jakartaMinutes(timestamp) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(timestamp * 1000));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return (Number(values.hour) * 60) + Number(values.minute);
}

function timestampLabel(timestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date(timestamp * 1000));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

function normalizeRange(value) {
  return RANGE_SESSIONS[value] ? value : '40d';
}

function uniqueNumbers(values) {
  return [...new Set(values.map(round))];
}

function percentReturn(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return 0;
  return ((to - from) / from) * 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}
