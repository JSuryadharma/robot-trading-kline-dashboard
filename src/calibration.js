import { detectSignals, signalDefinitions } from './indicators.js';

export function calibrateSignals(candles, { from, to, lookAhead = 10 } = {}) {
  const windowed = candles.filter((candle) => (!from || candle.date >= from) && (!to || candle.date <= to));
  const stats = Object.fromEntries(Object.entries(signalDefinitions).map(([id, definition]) => [
    id,
    {
      id,
      label: definition.label,
      direction: definition.direction,
      occurrences: 0,
      wins: 0,
      avgSignedReturn: 0,
      avgRawReturn: 0,
      winRate: null,
      zScore: null,
      significanceLevel: null,
      weightMultiplier: 1
    }
  ]));

  const returnsById = Object.fromEntries(Object.keys(signalDefinitions).map((id) => [id, []]));

  for (let index = 1; index < windowed.length - lookAhead; index += 1) {
    const signals = detectSignals(windowed, index);
    if (signals.length === 0) continue;
    const entryClose = windowed[index].close;
    const exitClose = windowed[index + lookAhead].close;
    const rawReturn = ((exitClose - entryClose) / entryClose) * 100;

    for (const signal of signals) {
      const signedReturn = signal.direction === 'bullish' ? rawReturn : -rawReturn;
      returnsById[signal.id].push({ signedReturn, rawReturn });
    }
  }

  for (const [id, returns] of Object.entries(returnsById)) {
    const record = stats[id];
    record.occurrences = returns.length;
    if (returns.length === 0) continue;
    record.wins = returns.filter((item) => item.signedReturn > 0).length;
    record.winRate = record.wins / returns.length;
    record.avgSignedReturn = average(returns.map((item) => item.signedReturn));
    record.avgRawReturn = average(returns.map((item) => item.rawReturn));
    record.zScore = zScoreForWinRate(record.winRate, returns.length);
    record.significanceLevel = normalConfidence(record.zScore);
    record.weightMultiplier = multiplierForRecord(record);
  }

  const records = Object.values(stats);
  const bullishEdge = average(records.filter((item) => item.direction === 'bullish' && item.occurrences > 0).map((item) => item.avgSignedReturn));
  const bearishEdge = average(records.filter((item) => item.direction === 'bearish' && item.occurrences > 0).map((item) => item.avgSignedReturn));

  return {
    from,
    to,
    lookAhead,
    candleCount: windowed.length,
    records,
    bullishEdge: round(bullishEdge),
    bearishEdge: round(bearishEdge),
    summary: summarize(records)
  };
}

function summarize(records) {
  const active = records.filter((record) => record.occurrences > 0);
  const highConfidence = active
    .filter((record) => record.significanceLevel >= 0.8)
    .sort((a, b) => Math.abs(b.avgSignedReturn) - Math.abs(a.avgSignedReturn))
    .slice(0, 4)
    .map((record) => record.label);

  return {
    activeSignals: active.length,
    highConfidence
  };
}

function multiplierForRecord(record) {
  if (record.occurrences < 2 || record.winRate === null) return 1;
  const reliability = clamp((record.winRate - 0.5) * 1.4, -0.35, 0.35);
  const returnEdge = clamp(record.avgSignedReturn / 8, -0.25, 0.25);
  const samplePenalty = record.occurrences < 5 ? -0.1 : 0;
  return round(clamp(1 + reliability + returnEdge + samplePenalty, 0.55, 1.55));
}

function zScoreForWinRate(winRate, occurrences) {
  if (occurrences <= 0) return 0;
  const standardError = Math.sqrt(0.25 / occurrences);
  return (winRate - 0.5) / standardError;
}

function normalConfidence(zScore) {
  const probability = 0.5 * (1 + erf(Math.abs(zScore) / Math.SQRT2));
  return round(clamp(probability, 0, 0.999));
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  const absolute = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absolute);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absolute * absolute);
  return sign * y;
}

function average(values) {
  const filtered = values.filter(Number.isFinite);
  if (filtered.length === 0) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
