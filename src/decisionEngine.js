const triggerBaseScores = {
  golden_ma_5_20: 16,
  death_ma_5_20: -16,
  price_reclaims_ma20: 11,
  price_loses_ma20: -11,
  rsi_rebound_30: 13,
  rsi_fades_70: -13,
  stoch_bull_cross: 9,
  stoch_bear_cross: -9,
  macd_bull_cross: 12,
  macd_bear_cross: -12,
  lower_band_reversal: 10,
  upper_band_rejection: -10,
  bullish_bos: 18,
  bearish_bos: -18,
  bullish_trend_change: 14,
  bearish_trend_change: -14
};

export const defaultParameterWeights = Object.freeze({
  candle: 1,
  trend: 1,
  momentum: 1,
  volatility: 1,
  volume: 1,
  calibration: 1,
  triggers: 1,
  news: 1
});

export function makeDecision(snapshot, portfolio, context = {}) {
  const latest = snapshot.latest;
  if (!latest) {
    return {
      action: 'HOLD',
      verdict: 'No data',
      score: 0,
      technicalScore: 0,
      newsScore: 0,
      newsRawScore: 0,
      scoreBreakdown: { technical: 0, news: 0, final: 0 },
      confidence: 'low',
      confidencePercentage: 0,
      parameters: [],
      reasons: ['No usable candle data is available.'],
      thresholds: { buy: 38, sell: -38 }
    };
  }

  const recordsById = Object.fromEntries(snapshot.calibration.records.map((record) => [record.id, record]));
  const parameters = [];
  const parameterWeights = normalizeParameterWeights(context.parameterWeights || context.tradePolicy?.parameterWeights);
  let score = 0;

  score += addParameter(parameters, previousCandleScore(latest, snapshot.candles), 'Previous candle performance', parameterWeights.candle);
  score += addParameter(parameters, trendScore(latest, snapshot.candles), 'Trend structure', parameterWeights.trend);
  score += addParameter(parameters, momentumScore(latest), 'Momentum', parameterWeights.momentum);
  score += addParameter(parameters, volatilityScore(latest), 'Volatility risk', parameterWeights.volatility);
  score += addParameter(parameters, volumeScore(latest), 'Volume confirmation', parameterWeights.volume);
  score += addParameter(parameters, calibrationBias(snapshot.calibration), 'Historical signal calibration', parameterWeights.calibration);

  const triggerContribution = triggerScore(snapshot.currentSignals, recordsById);
  score += addParameter(parameters, triggerContribution, 'Current reversal/swing triggers', parameterWeights.triggers);
  const technicalScore = score;

  const newsContribution = newsScore(context.newsAnalysis);
  const appliedNewsScore = addParameter(parameters, newsContribution, 'AI News Verdict', parameterWeights.news);
  score += appliedNewsScore;

  const thresholds = adjustedThresholds(snapshot.calibration, latest);
  const position = portfolio.positions?.[snapshot.symbol];
  let action = 'HOLD';
  let verdict = 'Hold / wait';

  if (score >= thresholds.buy && !position) {
    action = 'BUY';
    verdict = 'Buy candidate';
  } else if (score <= thresholds.sell && position) {
    action = 'SELL';
    verdict = 'Sell / reduce risk';
  } else if (position && shouldTakeProfitOrStop(latest, position, score, context.tradePolicy)) {
    action = latest.close >= position.averagePrice ? 'SELL' : 'SELL';
    verdict = latest.close >= position.averagePrice ? 'Take profit' : 'Stop-loss protection';
  }

  const confidencePercentage = combinedConfidencePercentage(score);
  const confidence = confidencePercentage >= 72 ? 'high' : confidencePercentage >= 52 ? 'medium' : 'low';
  const reasons = buildReasons(latest, snapshot.currentSignals, parameters, position);

  return {
    action,
    verdict,
    score: round(score),
    technicalScore: round(technicalScore),
    newsScore: round(appliedNewsScore),
    newsBaseScore: round(newsContribution.score),
    newsRawScore: round(newsContribution.rawScore),
    newsReliabilityPercentage: newsContribution.reliabilityPercentage,
    parameterWeights,
    scoreBreakdown: {
      technical: round(technicalScore),
      news: round(appliedNewsScore),
      final: round(score)
    },
    confidence,
    confidencePercentage,
    thresholds,
    parameters,
    newsAnalysis: context.newsAnalysis || null,
    priceTargets: snapshot.priceTargets || null,
    marketStructure: snapshot.marketStructure || null,
    reasons,
    triggerAdjustments: snapshot.currentSignals.map((signal) => ({
      ...signal,
      baseScore: triggerBaseScores[signal.id] || 0,
      multiplier: recordsById[signal.id]?.weightMultiplier || 1,
      winRate: recordsById[signal.id]?.winRate ?? null,
      avgSignedReturn: recordsById[signal.id]?.avgSignedReturn ?? null,
      significanceLevel: recordsById[signal.id]?.significanceLevel ?? null
    }))
  };
}

export function isDecisionTradeable(decision, policy = {}) {
  if (!policy.enabled || !decision || decision.action === 'HOLD') return false;
  const minScore = Number.isFinite(policy.minScore) ? policy.minScore : 58;
  const minConfidence = policy.minConfidence || 'medium';
  if (confidenceRank(decision.confidence) < confidenceRank(minConfidence)) return false;
  if (decision.action === 'BUY') return decision.score >= minScore;
  if (decision.action === 'SELL') {
    const protective = /take profit|stop-loss/i.test(decision.verdict || '');
    return protective || Math.abs(decision.score) >= minScore;
  }
  return false;
}

function previousCandleScore(latest, candles = []) {
  const previous = candles.length > 1 ? candles.at(-2) : null;
  if (![latest.open, latest.high, latest.low, latest.close].every(isFiniteNumber)) {
    return { score: 0, value: 'Insufficient completed candle data' };
  }

  const range = latest.high - latest.low;
  if (!(range > 0)) return { score: 0, value: 'Completed candle had no usable range' };
  const bodyStrength = (latest.close - latest.open) / range;
  const closeLocation = (latest.close - latest.low) / range;
  const changePct = isFiniteNumber(latest.changePct)
    ? latest.changePct
    : isFiniteNumber(previous?.close) && previous.close !== 0
      ? ((latest.close - previous.close) / previous.close) * 100
      : 0;
  const gapPct = isFiniteNumber(previous?.close) && previous.close !== 0
    ? ((latest.open - previous.close) / previous.close) * 100
    : 0;
  const volumeRatio = isFiniteNumber(latest.volume) && isFiniteNumber(latest.volumeSma20) && latest.volumeSma20 > 0
    ? latest.volume / latest.volumeSma20
    : null;

  let score = 0;
  if (bodyStrength >= 0.45 && closeLocation >= 0.7) score += 7;
  else if (bodyStrength <= -0.45 && closeLocation <= 0.3) score -= 7;
  else if (closeLocation >= 0.75 && changePct > 0) score += 4;
  else if (closeLocation <= 0.25 && changePct < 0) score -= 4;

  if (changePct >= 1) score += 3;
  else if (changePct <= -1) score -= 3;
  if (gapPct >= 0.75) score += 2;
  else if (gapPct <= -0.75) score -= 2;
  if (volumeRatio >= 1.2) score += changePct >= 0 ? 2 : -2;

  return {
    score: clamp(score, -14, 14),
    value: `Completed candle ${signed(round(changePct))}% | body ${signed(round(bodyStrength * 100))}% of range | close location ${round(closeLocation * 100)}% | gap ${signed(round(gapPct))}%${volumeRatio === null ? '' : ` | volume ${round(volumeRatio)}x`}`
  };
}

function trendScore(latest, candles) {
  let score = 0;
  const details = [];
  if (isFiniteNumber(latest.sma20)) {
    score += latest.close > latest.sma20 ? 8 : -8;
    details.push(`Close ${latest.close > latest.sma20 ? 'above' : 'below'} MA-20`);
  }
  if (isFiniteNumber(latest.sma50)) {
    score += latest.close > latest.sma50 ? 10 : -10;
    details.push(`Close ${latest.close > latest.sma50 ? 'above' : 'below'} MA-50`);
  }
  if (isFiniteNumber(latest.sma200)) {
    score += latest.close > latest.sma200 ? 12 : -12;
    details.push(`Close ${latest.close > latest.sma200 ? 'above' : 'below'} MA-200`);
  }
  if ([latest.sma5, latest.sma20, latest.sma50].every(isFiniteNumber)) {
    if (latest.sma5 > latest.sma20 && latest.sma20 > latest.sma50) {
      score += 12;
      details.push('MA-5 > MA-20 > MA-50');
    } else if (latest.sma5 < latest.sma20 && latest.sma20 < latest.sma50) {
      score -= 12;
      details.push('MA-5 < MA-20 < MA-50');
    }
  }
  const slope = slopeOf(candles, 'sma20', 5);
  if (isFiniteNumber(slope)) {
    score += slope > 0 ? 6 : -6;
    details.push(`MA-20 slope ${slope > 0 ? 'rising' : 'falling'}`);
  }
  return { score, value: details.join(', ') || 'Insufficient MA data' };
}

function momentumScore(latest) {
  let score = 0;
  const details = [];
  if (isFiniteNumber(latest.rsi14)) {
    if (latest.rsi14 >= 52 && latest.rsi14 <= 68) score += 10;
    else if (latest.rsi14 > 70) score -= 10;
    else if (latest.rsi14 < 30) score += 6;
    else if (latest.rsi14 < 45) score -= 4;
    details.push(`RSI ${latest.rsi14}`);
  }
  if ([latest.stochK, latest.stochD].every(isFiniteNumber)) {
    score += latest.stochK > latest.stochD ? 7 : -7;
    if (latest.stochK > 85) score -= 5;
    if (latest.stochK < 15) score += 4;
    details.push(`Stoch K/D ${latest.stochK}/${latest.stochD}`);
  }
  if (isFiniteNumber(latest.macdHistogram)) {
    score += latest.macdHistogram > 0 ? 10 : -10;
    details.push(`MACD histogram ${latest.macdHistogram}`);
  }
  return { score, value: details.join(', ') || 'Insufficient momentum data' };
}

function volatilityScore(latest) {
  let score = 0;
  const details = [];
  if (isFiniteNumber(latest.atrPct)) {
    if (latest.atrPct > 5) score -= 8;
    else if (latest.atrPct < 2.5) score += 4;
    details.push(`ATR ${latest.atrPct}%`);
  }
  if ([latest.close, latest.bbUpper, latest.bbLower].every(isFiniteNumber)) {
    if (latest.close > latest.bbUpper) score -= 7;
    else if (latest.close < latest.bbLower) score += 5;
    else score += 2;
    details.push('Bollinger position checked');
  }
  return { score, value: details.join(', ') || 'Insufficient volatility data' };
}

function volumeScore(latest) {
  if (![latest.volume, latest.volumeSma20, latest.changePct].every(isFiniteNumber)) {
    return { score: 0, value: 'Insufficient volume data' };
  }
  const expansion = latest.volume / latest.volumeSma20;
  let score = 0;
  if (expansion > 1.25 && latest.changePct > 0) score = 7;
  else if (expansion > 1.25 && latest.changePct < 0) score = -7;
  else if (expansion < 0.75) score = -2;
  return { score, value: `Volume ${round(expansion)}x 20D average` };
}

function calibrationBias(calibration) {
  const score = clamp((calibration.bullishEdge - calibration.bearishEdge) * 1.2, -8, 8);
  const value = `Bull edge ${calibration.bullishEdge}%, bear edge ${calibration.bearishEdge}%`;
  return { score, value };
}

function triggerScore(signals, recordsById) {
  if (signals.length === 0) return { score: 0, value: 'No fresh crossover/reversal trigger on latest candle' };
  const parts = [];
  let score = 0;
  for (const signal of signals) {
    const base = triggerBaseScores[signal.id] || 0;
    const multiplier = recordsById[signal.id]?.weightMultiplier || 1;
    const contribution = base * multiplier;
    score += contribution;
    parts.push(`${signal.label} (${round(contribution)})`);
  }
  return { score, value: parts.join(', ') };
}

function newsScore(newsAnalysis) {
  if (!newsAnalysis) {
    return {
      score: 0,
      rawScore: 0,
      reliabilityPercentage: 0,
      value: 'No AI news analysis yet | auto-trade impact 0',
      forceBias: 'neutral'
    };
  }
  const verdict = String(newsAnalysis.verdict || 'neutral').toLowerCase();
  const confidence = clamp(Number(newsAnalysis.confidencePercentage) || 0, 0, 100);
  const headlineCount = newsAnalysis.headlineCount ?? newsAnalysis.items?.length ?? 0;
  const parsedRawScore = clamp(Number(newsAnalysis.score) || 0, -18, 18);
  const rawScore = verdict === 'positive'
    ? Math.abs(parsedRawScore)
    : verdict === 'negative'
      ? -Math.abs(parsedRawScore)
      : 0;
  const confidenceWeight = confidence / 100;
  const coverageWeight = headlineCount >= 4 ? 1 : headlineCount >= 2 ? 0.85 : headlineCount === 1 ? 0.65 : 0;
  const freshnessWeight = newsAnalysis.selectedPeriod === 'web-search' ? 0.75 : 1;
  const engineWeight = newsAnalysis.engine?.usedLmStudio || newsAnalysis.mode === 'lmstudio'
    ? 1
    : newsAnalysis.mode === 'local-fallback'
      ? 0.7
      : 0.6;
  const reliability = confidenceWeight * coverageWeight * freshnessWeight * engineWeight;
  const score = clamp(rawScore * reliability, -14, 14);
  const range = newsAnalysis.dateRange?.from && newsAnalysis.dateRange?.to
    ? `${newsAnalysis.dateRange.from} to ${newsAnalysis.dateRange.to}`
    : newsAnalysis.today || 'latest window';
  const engine = newsAnalysis.engine?.label || (newsAnalysis.mode === 'lmstudio' ? 'LM Studio' : 'Local news rules');
  const value = `${capitalize(verdict)} news | reliability-adjusted ${signed(round(score))} from raw ${signed(round(rawScore))} | ${confidence}% confidence | ${headlineCount} headline${headlineCount === 1 ? '' : 's'} | ${engine} | ${range}`;
  return {
    score,
    rawScore,
    reliabilityPercentage: round(reliability * 100),
    value,
    forceBias: verdict === 'positive' ? 'bullish' : verdict === 'negative' ? 'bearish' : 'neutral'
  };
}

function adjustedThresholds(calibration, latest) {
  let buy = 38;
  let sell = -38;
  const bullishHelp = clamp(calibration.bullishEdge, -5, 8);
  const bearishHelp = clamp(calibration.bearishEdge, -5, 8);
  buy -= Math.max(0, bullishHelp * 0.6);
  sell += Math.max(0, bearishHelp * 0.6);
  if (isFiniteNumber(latest.sma200) && latest.close < latest.sma200) buy += 5;
  return { buy: round(buy), sell: round(sell) };
}

function shouldTakeProfitOrStop(latest, position, score, policy = {}) {
  const pnlPct = ((latest.close - position.averagePrice) / position.averagePrice) * 100;
  const takeProfitPct = Number.isFinite(policy.takeProfitPct) ? policy.takeProfitPct : 7;
  const stopLossPct = Number.isFinite(policy.stopLossPct) ? policy.stopLossPct : 4.5;
  if (pnlPct >= takeProfitPct && score < 25) return true;
  if (pnlPct <= -stopLossPct) return true;
  return false;
}

function addParameter(parameters, item, name, weight = 1) {
  const baseScore = Number.isFinite(item.score) ? item.score : 0;
  const score = baseScore * weight;
  parameters.push({
    name,
    value: weight === 1 ? item.value : `${item.value} | weight ${round(weight)}x`,
    score: round(score),
    baseScore: round(baseScore),
    weight: round(weight),
    bias: item.forceBias || (score > 2 ? 'bullish' : score < -2 ? 'bearish' : 'neutral')
  });
  return score;
}

export function normalizeParameterWeights(input = {}) {
  return Object.fromEntries(Object.entries(defaultParameterWeights).map(([key, fallback]) => [
    key,
    round(clamp(Number(input?.[key]) || fallback, 0.5, 1.5))
  ]));
}

function buildReasons(latest, signals, parameters, position) {
  const top = parameters
    .slice()
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 4)
    .map((item) => `${item.name}: ${item.value}`);
  if (signals.length > 0) top.push(`Fresh signals: ${signals.map((signal) => signal.label).join(', ')}`);
  if (position) {
    const pnlPct = ((latest.close - position.averagePrice) / position.averagePrice) * 100;
    top.push(`Open position P/L: ${round(pnlPct)}%`);
  }
  return top;
}

function slopeOf(candles, key, lookback) {
  const latest = candles.at(-1)?.[key];
  const prior = candles.at(-1 - lookback)?.[key];
  if (![latest, prior].every(isFiniteNumber)) return null;
  return latest - prior;
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function confidenceRank(value) {
  return { low: 1, medium: 2, high: 3 }[value] || 0;
}

function combinedConfidencePercentage(score) {
  const scoreConfidence = clamp((Math.abs(score) / 82) * 72, 0, 72);
  return round(clamp(18 + scoreConfidence, 0, 100));
}

function capitalize(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function signed(value) {
  return `${value >= 0 ? '+' : ''}${value}`;
}
