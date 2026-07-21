import { calibrateSignals } from './calibration.js';
import { defaultParameterWeights, makeDecision, normalizeParameterWeights } from './decisionEngine.js';
import { detectSignals } from './indicators.js';

const ONE_YEAR_SESSIONS = 252;

const POSITIVE_NEWS = /\b(upgrade|beat|beats|profit|growth|record|surge|rally|dividend|buyback|approval|contract|expansion|raise|raises|strong|secure|secures|win|wins|partnership|laba|untung|tumbuh|naik|melonjak|dividen|kontrak|ekspansi|rebound|penguatan|akuisisi|net buy)\b/i;
const NEGATIVE_NEWS = /\b(downgrade|loss|probe|lawsuit|plunge|fall|falls|cut|cuts|weak|default|delay|decline|miss|misses|risk|sanction|fraud|warning|rugi|turun|anjlok|gugatan|penyelidikan|gagal bayar|penurunan|risiko|suspensi|korupsi|peringatan|net sell)\b/i;

export function runBacktraceResearch({ snapshot, newsItems = [], settings, applyAdjustments = true } = {}) {
  const allCandles = oneYearCandles(snapshot?.candles || []);
  if (allCandles.length < 50) {
    throw new Error('Back trace needs at least 50 valid daily candles.');
  }

  const baselineStrategy = strategyFromSettings(settings);
  const timeline = buildHistoricalNewsTimeline(allCandles, newsItems);
  const selected = evaluateRange({
    allCandles,
    rangeKey: '1y',
    symbol: snapshot.symbol,
    baselineStrategy,
    newsTimeline: timeline.byDate
  });
  if (!selected) throw new Error('The one-year daily window does not have enough candles for walk-forward validation.');
  const adjustment = buildAdjustment(selected, baselineStrategy, applyAdjustments);
  const selectedCandles = allCandles.slice(selected.startIndex, selected.endIndex + 1);
  const finalStrategy = adjustment.applied ? selected.recommendedStrategy : baselineStrategy;
  const finalValidation = adjustment.applied ? selected.optimizedValidation : selected.baselineValidation;
  const finalParameterPerformance = evaluateParameterPerformance({
    allCandles,
    startIndex: selected.splitIndex + 1,
    endIndex: selected.endIndex,
    symbol: snapshot.symbol,
    newsTimeline: timeline.byDate,
    calibration: selected.calibration,
    strategy: finalStrategy
  });
  const technicalAssessment = buildPreviousCandleAssessment(finalParameterPerformance);

  return {
    id: `research_${Date.now()}`,
    symbol: snapshot.yfSymbol,
    tvSymbol: snapshot.symbol,
    createdAt: new Date().toISOString(),
    source: snapshot.source,
    requestedRange: '1y',
    selectedRange: '1y',
    selectedRangeLabel: `1Y / ${selectedCandles.length} daily candles`,
    timeframe: '1D',
    from: selectedCandles[0]?.date,
    to: selectedCandles.at(-1)?.date,
    candleCount: selectedCandles.length,
    maximumWindow: '1 year / 252 sessions',
    split: selected.split,
    baseline: selected.baselineValidation,
    optimized: selected.optimizedValidation,
    optimizedTraining: selected.optimizedTraining,
    final: finalValidation,
    finalStrategy,
    recommendedStrategy: selected.recommendedStrategy,
    parameterComparison: compareParameters(baselineStrategy, finalStrategy, finalParameterPerformance),
    technicalAssessment,
    adjustment,
    newsCoverage: {
      articleCount: newsItems.filter((item) => item.publishedDate >= selectedCandles[0]?.date && item.publishedDate <= selectedCandles.at(-1)?.date).length,
      sessionsWithNews: selectedCandles.filter((candle) => (timeline.byDate.get(candle.date)?.headlineCount || 0) > 0).length,
      sessionCoveragePercentage: round((selectedCandles.filter((candle) => (timeline.byDate.get(candle.date)?.headlineCount || 0) > 0).length / selectedCandles.length) * 100),
      method: 'Archived Google News RSS headlines, locally scored in a trailing 3-day window'
    },
    trades: finalValidation.trades.slice(-20).reverse(),
    methodology: [
      'Daily indicators and previous-candle performance use only the completed signal candle and older data.',
      'Signals execute at the next session open and include 0.4% round-trip cost.',
      'The oldest 70% tunes parameters; the newest 30% validates them.',
      'A zero-trade window is inconclusive; its win rate is not treated as a measured 0%.',
      'A recommendation is applied only when validation improves and has enough trades.'
    ]
  };
}

export function buildHistoricalNewsTimeline(candles, newsItems = [], { lagDays = 0 } = {}) {
  const sortedItems = newsItems
    .filter((item) => item?.publishedDate && item?.title)
    .slice()
    .sort((a, b) => a.publishedDate.localeCompare(b.publishedDate));
  const byDate = new Map();

  for (const candle of candles) {
    const from = addDays(candle.date, -3);
    const through = addDays(candle.date, -Math.max(0, Number(lagDays) || 0));
    const available = sortedItems.filter((item) => item.publishedDate >= from && item.publishedDate <= through);
    let rawTone = 0;
    const reasons = [];
    for (const item of available) {
      const text = `${item.title || ''} ${item.summary || ''}`;
      const positive = POSITIVE_NEWS.test(text);
      const negative = NEGATIVE_NEWS.test(text);
      if (positive && !negative) rawTone += 1;
      if (negative && !positive) rawTone -= 1;
      if (positive || negative) reasons.push(item.title);
    }
    const rawScore = clamp(rawTone * 4, -18, 18);
    const verdict = rawScore > 3 ? 'positive' : rawScore < -3 ? 'negative' : 'neutral';
    const confidencePercentage = available.length
      ? clamp(44 + (Math.abs(rawScore) * 2) + (Math.min(available.length, 4) * 3), 44, 88)
      : 35;
    byDate.set(candle.date, {
      mode: 'research-local',
      engine: { provider: 'historical-local', label: 'Historical headline rules', usedLmStudio: false },
      verdict,
      score: rawScore,
      confidencePercentage,
      headlineCount: available.length,
      selectedPeriod: '3d',
      today: through,
      dateRange: { from, to: through },
      reasons: reasons.slice(0, 3),
      items: available.slice(-6)
    });
  }

  return { byDate, itemCount: sortedItems.length };
}

function evaluateRange({ allCandles, rangeKey, symbol, baselineStrategy, newsTimeline }) {
  const requestedSessions = rangeKey === '1y' ? ONE_YEAR_SESSIONS : 0;
  if (!requestedSessions) return null;
  const sessions = Math.min(requestedSessions, allCandles.length);
  if (sessions < 50) return null;
  const startIndex = allCandles.length - sessions;
  const endIndex = allCandles.length - 1;
  const splitIndex = Math.min(endIndex - 15, startIndex + Math.max(35, Math.floor(sessions * 0.7)));
  if (splitIndex <= startIndex || endIndex - splitIndex < 15) return null;

  const calibration = calibrateSignals(allCandles.slice(startIndex, splitIndex + 1), {
    from: allCandles[startIndex].date,
    to: allCandles[splitIndex].date,
    lookAhead: 5
  });
  const strategies = strategyCandidates(baselineStrategy);
  const trainingResults = strategies.map((strategy) => ({
    strategy,
    metrics: simulate({
      allCandles,
      startIndex,
      endIndex: splitIndex,
      symbol,
      newsTimeline,
      calibration,
      strategy
    })
  }));
  const optimizedTraining = trainingResults.slice().sort((a, b) => objective(b.metrics) - objective(a.metrics))[0];
  const baselineValidation = simulate({
    allCandles,
    startIndex: splitIndex + 1,
    endIndex,
    symbol,
    newsTimeline,
    calibration,
    strategy: baselineStrategy
  });
  const optimizedValidation = simulate({
    allCandles,
    startIndex: splitIndex + 1,
    endIndex,
    symbol,
    newsTimeline,
    calibration,
    strategy: optimizedTraining.strategy
  });
  const parameterPerformance = evaluateParameterPerformance({
    allCandles,
    startIndex: splitIndex + 1,
    endIndex,
    symbol,
    newsTimeline,
    calibration,
    strategy: optimizedTraining.strategy
  });

  return {
    rangeKey,
    rangeLabel: `${rangeKey.toUpperCase()} / ${sessions} sessions`,
    startIndex,
    splitIndex,
    endIndex,
    calibration,
    split: {
      trainingFrom: allCandles[startIndex].date,
      trainingTo: allCandles[splitIndex].date,
      validationFrom: allCandles[splitIndex + 1].date,
      validationTo: allCandles[endIndex].date,
      trainingCandles: splitIndex - startIndex + 1,
      validationCandles: endIndex - splitIndex
    },
    baselineValidation,
    optimizedValidation,
    optimizedTraining: optimizedTraining.metrics,
    parameterPerformance,
    recommendedStrategy: optimizedTraining.strategy,
    selectionScore: robustSelectionScore(optimizedValidation, optimizedTraining.metrics)
  };
}

function evaluateParameterPerformance({ allCandles, startIndex, endIndex, symbol, newsTimeline, calibration, strategy }) {
  const lookAhead = 5;
  const stats = new Map();
  for (let index = startIndex; index <= endIndex - lookAhead; index += 1) {
    const candle = allCandles[index];
    const future = allCandles[index + lookAhead];
    const decision = makeDecision({
      symbol,
      latest: candle,
      candles: allCandles.slice(Math.max(0, index - 6), index + 1),
      currentSignals: detectSignals(allCandles, index),
      calibration
    }, { positions: {} }, {
      newsAnalysis: newsTimeline.get(candle.date),
      tradePolicy: { parameterWeights: strategy.parameterWeights, takeProfitPct: strategy.takeProfitPct }
    });
    const rawReturn = percentReturn(candle.close, future.close);
    for (const parameter of decision.parameters || []) {
      if (Math.abs(parameter.score) <= 2) continue;
      const record = stats.get(parameter.name) || { name: parameter.name, occurrences: 0, wins: 0, totalSignedReturn: 0 };
      const signedReturn = parameter.score > 0 ? rawReturn : -rawReturn;
      record.occurrences += 1;
      if (signedReturn > 0) record.wins += 1;
      record.totalSignedReturn += signedReturn;
      stats.set(parameter.name, record);
    }
  }
  return [...stats.values()].map((record) => ({
    name: record.name,
    occurrences: record.occurrences,
    winRatePercentage: round((record.wins / record.occurrences) * 100),
    averageSignedReturnPercentage: round(record.totalSignedReturn / record.occurrences)
  }));
}

function simulate({ allCandles, startIndex, endIndex, symbol, newsTimeline, calibration, strategy }) {
  let position = null;
  const trades = [];
  const diagnostics = {
    executableSessions: 0,
    decisionBuySignals: 0,
    policyPassSignals: 0,
    entrySignals: 0,
    nearMissSignals: 0,
    highestExecutableScore: null,
    strategyMinScore: strategy.minScore,
    lowestDecisionBuyThreshold: null,
    lowestEffectiveEntryThreshold: null
  };
  for (let index = startIndex; index < endIndex; index += 1) {
    const candle = allCandles[index];
    const nextCandle = allCandles[index + 1];
    const portfolio = {
      positions: position ? {
        [symbol]: {
          quantity: 1,
          averagePrice: position.entryPrice,
          openedAt: position.entryDate
        }
      } : {}
    };
    const decision = makeDecision({
      symbol,
      latest: candle,
      candles: allCandles.slice(Math.max(0, index - 6), index + 1),
      currentSignals: detectSignals(allCandles, index),
      calibration
    }, portfolio, {
      newsAnalysis: newsTimeline.get(candle.date),
      tradePolicy: {
        takeProfitPct: strategy.takeProfitPct,
        stopLossPct: strategy.stopLossPct,
        parameterWeights: strategy.parameterWeights
      }
    });

    if (!position) {
      diagnostics.executableSessions += 1;
      diagnostics.highestExecutableScore = diagnostics.highestExecutableScore === null
        ? decision.score
        : Math.max(diagnostics.highestExecutableScore, decision.score);
      diagnostics.lowestDecisionBuyThreshold = diagnostics.lowestDecisionBuyThreshold === null
        ? decision.thresholds.buy
        : Math.min(diagnostics.lowestDecisionBuyThreshold, decision.thresholds.buy);
      const effectiveEntryThreshold = Math.max(strategy.minScore, decision.thresholds.buy);
      diagnostics.lowestEffectiveEntryThreshold = diagnostics.lowestEffectiveEntryThreshold === null
        ? effectiveEntryThreshold
        : Math.min(diagnostics.lowestEffectiveEntryThreshold, effectiveEntryThreshold);
      if (decision.action === 'BUY') diagnostics.decisionBuySignals += 1;
      if (decision.score >= strategy.minScore) diagnostics.policyPassSignals += 1;
      if (decision.score >= Math.max(strategy.minScore, decision.thresholds.buy) - 10) diagnostics.nearMissSignals += 1;
    }

    if (!position && decision.action === 'BUY' && decision.score >= strategy.minScore) {
      diagnostics.entrySignals += 1;
      const previousCandle = decision.parameters?.find((parameter) => parameter.name === 'Previous candle performance');
      position = {
        entryDate: nextCandle.date,
        entryPrice: nextCandle.open,
        signalDate: candle.date,
        entryScore: decision.score,
        technicalScore: decision.technicalScore,
        newsScore: decision.newsScore,
        previousCandle: {
          date: candle.date,
          changePct: candle.changePct,
          score: previousCandle?.score || 0,
          bias: previousCandle?.bias || 'neutral',
          assessment: previousCandle?.value || 'No completed candle assessment'
        },
        holdDays: 0
      };
      continue;
    }

    if (!position) continue;
    position.holdDays += 1;
    const pnlPctAtClose = percentReturn(position.entryPrice, candle.close);
    const exitReason = pnlPctAtClose <= -strategy.stopLossPct
      ? 'Stop loss'
      : pnlPctAtClose >= strategy.takeProfitPct && decision.score < 25
        ? 'Take profit'
        : decision.score <= -strategy.minScore
          ? 'Bearish score'
          : position.holdDays >= strategy.maxHoldDays
            ? 'Time exit'
            : '';
    if (!exitReason) continue;
    trades.push(closeTrade(position, nextCandle.date, nextCandle.open, exitReason));
    position = null;
  }

  if (position) {
    const last = allCandles[endIndex];
    trades.push(closeTrade(position, last.date, last.close, 'Window end'));
  }
  return metricsFromTrades(trades, diagnostics);
}

function closeTrade(position, exitDate, exitPrice, exitReason) {
  const grossReturn = percentReturn(position.entryPrice, exitPrice);
  const netReturn = grossReturn - 0.4;
  return {
    signalDate: position.signalDate,
    entryDate: position.entryDate,
    exitDate,
    entryPrice: round(position.entryPrice),
    exitPrice: round(exitPrice),
    holdDays: position.holdDays,
    returnPercentage: round(netReturn),
    result: netReturn > 0 ? 'WIN' : 'LOSS',
    exitReason,
    entryScore: round(position.entryScore),
    technicalScore: round(position.technicalScore),
    newsScore: round(position.newsScore),
    previousCandle: position.previousCandle
  };
}

function metricsFromTrades(trades, diagnostics = {}) {
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
    averageHoldDays: trades.length ? round(trades.reduce((sum, trade) => sum + trade.holdDays, 0) / trades.length) : 0,
    trades,
    diagnostics: {
      ...diagnostics,
      highestExecutableScore: diagnostics.highestExecutableScore === null ? null : round(diagnostics.highestExecutableScore),
      lowestDecisionBuyThreshold: diagnostics.lowestDecisionBuyThreshold === null ? null : round(diagnostics.lowestDecisionBuyThreshold),
      lowestEffectiveEntryThreshold: diagnostics.lowestEffectiveEntryThreshold === null ? null : round(diagnostics.lowestEffectiveEntryThreshold)
    }
  };
}

function strategyFromSettings(settings = {}) {
  const autoTrade = settings.autoTrade || {};
  return {
    name: 'Current live parameters',
    minScore: clamp(Number(autoTrade.minScore) || 58, 38, 75),
    takeProfitPct: clamp(Number(autoTrade.takeProfitPct) || 7, 0.5, 40),
    stopLossPct: clamp(Number(autoTrade.stopLossPct) || 4.5, 0.5, 15),
    maxHoldDays: 10,
    parameterWeights: normalizeParameterWeights(autoTrade.parameterWeights)
  };
}

function strategyCandidates(baseline) {
  const weightProfiles = [
    { name: 'Current live parameters', weights: baseline.parameterWeights },
    { name: 'Completed candle confirmation', weights: { ...baseline.parameterWeights, candle: 1.35, trend: 1.1, volume: 1.1, news: 0.85 } },
    { name: 'Trend quality', weights: { ...baseline.parameterWeights, trend: 1.25, momentum: 0.9, volatility: 1.15, news: 0.85 } },
    { name: 'Momentum confirmation', weights: { ...baseline.parameterWeights, trend: 0.9, momentum: 1.3, volume: 1.2, triggers: 1.1, news: 0.9 } },
    { name: 'Structure breakout', weights: { ...baseline.parameterWeights, trend: 1.1, momentum: 0.9, volume: 1.2, triggers: 1.35 } },
    { name: 'News confirmed', weights: { ...baseline.parameterWeights, trend: 1.1, volatility: 1.1, news: 1.3 } },
    { name: 'News defensive', weights: { ...baseline.parameterWeights, momentum: 0.9, volatility: 1.3, news: 1.15 } },
    { name: 'Technical defensive', weights: { ...baseline.parameterWeights, trend: 1.2, volatility: 1.25, news: 0.65 } },
    { name: 'Balanced adaptive', weights: { candle: 1.15, trend: 1.1, momentum: 1.1, volatility: 1.1, volume: 1.05, calibration: 1, triggers: 1.15, news: 1.05 } }
  ];
  const minScores = uniqueNumbers([
    baseline.minScore,
    baseline.minScore - 8,
    baseline.minScore - 14,
    baseline.minScore - 20,
    baseline.minScore + 6,
    38,
    44
  ].map((value) => clamp(value, 38, 75)));
  const takeProfits = uniqueNumbers([baseline.takeProfitPct, baseline.takeProfitPct - 2, baseline.takeProfitPct + 2].map((value) => clamp(value, 0.5, 40)));
  const stopLosses = uniqueNumbers([baseline.stopLossPct, baseline.stopLossPct - 1, baseline.stopLossPct + 1].map((value) => clamp(value, 0.5, 15)));
  const holds = [5, 10, 15];
  const output = [];
  for (const profile of weightProfiles) {
    for (const minScore of minScores) {
      for (const takeProfitPct of takeProfits) {
        for (const stopLossPct of stopLosses) {
          for (const maxHoldDays of holds) {
            output.push({
              name: profile.name,
              minScore,
              takeProfitPct,
              stopLossPct,
              maxHoldDays,
              parameterWeights: normalizeParameterWeights(profile.weights)
            });
          }
        }
      }
    }
  }
  return output;
}

function buildPreviousCandleAssessment(performance = []) {
  const result = performance.find((item) => item.name === 'Previous candle performance') || {};
  return {
    name: 'Previous completed candle',
    timeframe: '1D',
    directionalSuccessRatePercentage: result.winRatePercentage ?? null,
    occurrences: result.occurrences || 0,
    averageForwardReturnPercentage: result.averageSignedReturnPercentage ?? null,
    inputs: ['OHLC body strength', 'close location', '1D price change', 'opening gap', 'volume versus 20D average'],
    executionRule: 'Assess after the daily close; simulated entry is the next session open.'
  };
}

function buildAdjustment(selected, baseline, applyAdjustments) {
  const before = selected.baselineValidation;
  const after = selected.optimizedValidation;
  const diagnostics = after.diagnostics || {};
  const noValidationEntries = after.tradeCount === 0;
  const insufficientBaseline = before.tradeCount < 2;
  const lowWinRate = !insufficientBaseline && before.winRatePercentage < 52;
  const candidateIsCredible = after.tradeCount >= 2
    && after.winRatePercentage >= Math.max(52, before.winRatePercentage + 3)
    && after.totalReturnPercentage > before.totalReturnPercentage
    && after.maxDrawdownPercentage <= Math.max(before.maxDrawdownPercentage + 2, 8);
  const activatesDormantStrategy = insufficientBaseline
    && after.tradeCount >= 3
    && after.winRatePercentage >= 55
    && after.totalReturnPercentage > 0;
  const shouldApply = (lowWinRate && candidateIsCredible) || activatesDormantStrategy;
  const changed = JSON.stringify(baseline) !== JSON.stringify(selected.recommendedStrategy);
  return {
    baselineState: noValidationEntries ? 'no validation entries' : insufficientBaseline ? 'insufficient trades' : lowWinRate ? 'low win rate' : 'acceptable',
    recommendation: noValidationEntries
      ? 'Keep current parameters; the one-year daily validation produced no qualifying trade.'
      : !changed
      ? 'Keep current parameters; training did not find a stronger profile.'
      : shouldApply
        ? 'Use the validated research parameters.'
        : 'Keep current live parameters until a stronger out-of-sample improvement appears.',
    shouldApply: shouldApply && changed,
    applied: Boolean(applyAdjustments && shouldApply && changed),
    reason: noValidationEntries
      ? `No executable BUY entry qualified: the highest score was ${diagnostics.highestExecutableScore ?? 'n/a'} versus the ${diagnostics.lowestEffectiveEntryThreshold ?? diagnostics.strategyMinScore ?? selected.recommendedStrategy.minScore} effective gate across ${diagnostics.executableSessions || 0} sessions. Win rate is not measurable yet.`
      : shouldApply
      ? `Validation improved from ${before.winRatePercentage}% to ${after.winRatePercentage}% with ${after.tradeCount} trades.`
      : `Candidate tuning was rejected: current strategy ${before.tradeCount} trades at ${before.winRatePercentage}% success versus candidate ${after.tradeCount} trades at ${after.winRatePercentage}% success.`
  };
}

function compareParameters(baseline, recommended, performance = []) {
  const labels = {
    candle: 'Previous candle',
    trend: 'Trend',
    momentum: 'Momentum',
    volatility: 'Volatility',
    volume: 'Volume',
    calibration: 'Calibration',
    triggers: 'Reversal triggers',
    news: 'Historical news'
  };
  const performanceNames = {
    candle: 'Previous candle performance',
    trend: 'Trend structure',
    momentum: 'Momentum',
    volatility: 'Volatility risk',
    volume: 'Volume confirmation',
    calibration: 'Historical signal calibration',
    triggers: 'Current reversal/swing triggers',
    news: 'AI News Verdict'
  };
  const performanceByName = new Map(performance.map((item) => [item.name, item]));
  const weights = Object.keys(defaultParameterWeights).map((key) => {
    const stats = performanceByName.get(performanceNames[key]) || {};
    return {
      key,
      label: labels[key],
      current: baseline.parameterWeights[key],
      recommended: recommended.parameterWeights[key],
      final: recommended.parameterWeights[key],
      changed: baseline.parameterWeights[key] !== recommended.parameterWeights[key],
      validationWinRatePercentage: stats.winRatePercentage ?? null,
      occurrences: stats.occurrences || 0,
      averageSignedReturnPercentage: stats.averageSignedReturnPercentage ?? null
    };
  });
  return [
    ...weights,
    { key: 'minScore', label: 'Minimum score', current: baseline.minScore, recommended: recommended.minScore, final: recommended.minScore, changed: baseline.minScore !== recommended.minScore },
    { key: 'takeProfitPct', label: 'Take profit %', current: baseline.takeProfitPct, recommended: recommended.takeProfitPct, final: recommended.takeProfitPct, changed: baseline.takeProfitPct !== recommended.takeProfitPct },
    { key: 'stopLossPct', label: 'Stop loss %', current: baseline.stopLossPct, recommended: recommended.stopLossPct, final: recommended.stopLossPct, changed: baseline.stopLossPct !== recommended.stopLossPct },
    { key: 'maxHoldDays', label: 'Maximum hold', current: baseline.maxHoldDays, recommended: recommended.maxHoldDays, final: recommended.maxHoldDays, changed: baseline.maxHoldDays !== recommended.maxHoldDays }
  ];
}

function robustSelectionScore(validation, training) {
  const samplePenalty = validation.tradeCount < 2 ? 24 : validation.tradeCount < 4 ? 8 : 0;
  return round(objective(validation) * 0.72 + objective(training) * 0.28 - samplePenalty);
}

function objective(metrics) {
  if (!metrics.tradeCount) return -100;
  return round(
    metrics.winRatePercentage
    + (metrics.totalReturnPercentage * 1.7)
    + (metrics.averageReturnPercentage * 2)
    + (Math.min(metrics.profitFactor, 4) * 3)
    + Math.min(metrics.tradeCount, 8)
    - (metrics.maxDrawdownPercentage * 1.4)
  );
}

function oneYearCandles(candles) {
  const sorted = candles.slice().sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = sorted.at(-1)?.date;
  if (!latestDate) return [];
  const cutoff = addDays(latestDate, -365);
  return sorted.filter((candle) => candle.date >= cutoff).slice(-252);
}

function uniqueNumbers(values) {
  return [...new Set(values.map(round))];
}

function percentReturn(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return 0;
  return ((to - from) / from) * 100;
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}
