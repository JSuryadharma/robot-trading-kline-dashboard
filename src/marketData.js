import { config, todayInTimeZone } from './config.js';
import { fetchKlines } from './datasources/index.js';
import { enrichCandles, detectSignals } from './indicators.js';
import { calibrateSignals } from './calibration.js';
import { defaultStock, stockFromInput } from './symbols.js';

export async function loadMarketSnapshot(stockInput = defaultStock()) {
  const stock = stockFromInput(stockInput);
  const fetchTo = maxDate(todayInTimeZone(config.timeZone), config.historyTo);
  const raw = await fetchKlines({
    symbol: stock.tvSymbol,
    yfSymbol: stock.yfSymbol,
    interval: config.interval,
    from: config.historyFrom,
    to: fetchTo
  });
  const candles = enrichCandles(raw.candles);
  const latest = candles.at(-1) || null;
  const calibrationCandles = candles.filter((candle) => candle.date >= config.historyFrom && candle.date <= config.historyTo);
  const calibration = calibrateSignals(calibrationCandles, {
    from: config.historyFrom,
    to: config.historyTo,
    lookAhead: 10
  });
  const currentSignals = latest ? detectSignals(candles, candles.length - 1) : [];
  const reversalMarkers = buildReversalMarkers(candles);

  return {
    symbol: stock.tvSymbol,
    yfSymbol: stock.yfSymbol,
    stock,
    interval: config.interval,
    source: raw.source,
    sourceAttempts: raw.attempts || [],
    warnings: raw.warnings || [],
    historyWindow: {
      from: config.historyFrom,
      to: config.historyTo,
      candleCount: calibrationCandles.length
    },
    fetchedAt: new Date().toISOString(),
    latest,
    currentSignals,
    calibration,
    historySummary: summarizeHistory(candles),
    candles,
    reversalMarkers
  };
}

function buildReversalMarkers(candles) {
  const markers = [];
  for (let index = 1; index < candles.length; index += 1) {
    for (const signal of detectSignals(candles, index)) {
      markers.push({
        index,
        date: candles[index].date,
        close: candles[index].close,
        changePct: candles[index].changePct,
        id: signal.id,
        label: signal.label,
        direction: signal.direction,
        rsi14: candles[index].rsi14,
        stochK: candles[index].stochK,
        stochD: candles[index].stochD
      });
    }
  }
  return markers.slice(-120);
}

function maxDate(a, b) {
  return a > b ? a : b;
}

function summarizeHistory(candles) {
  if (!candles.length) {
    return {
      latestClose: null,
      latestDate: null,
      returns: {},
      range3m: {},
      averageVolume20: null,
      volatility20: null
    };
  }

  const latest = candles.at(-1);
  const recent3m = candles.slice(-63);
  const recent20 = candles.slice(-20);
  return {
    latestClose: latest.close,
    latestDate: latest.date,
    returns: {
      oneDay: returnFor(candles, 1),
      fiveDay: returnFor(candles, 5),
      oneMonth: returnFor(candles, 21),
      threeMonth: returnFor(candles, 63),
      fromCalibrationStart: returnFor(candles, candles.length - 1)
    },
    range3m: {
      high: round(Math.max(...recent3m.map((candle) => candle.high))),
      low: round(Math.min(...recent3m.map((candle) => candle.low))),
      drawdownFromHigh: drawdown(latest.close, Math.max(...recent3m.map((candle) => candle.high)))
    },
    averageVolume20: round(average(recent20.map((candle) => candle.volume))),
    volatility20: round(standardDeviation(recent20.map((candle) => candle.changePct).filter(Number.isFinite)))
  };
}

function returnFor(candles, lookback) {
  if (candles.length <= lookback) return null;
  const latest = candles.at(-1).close;
  const prior = candles.at(-1 - lookback).close;
  if (!Number.isFinite(latest) || !Number.isFinite(prior) || prior === 0) return null;
  return round(((latest - prior) / prior) * 100);
}

function drawdown(price, high) {
  if (!Number.isFinite(price) || !Number.isFinite(high) || high === 0) return null;
  return round(((price - high) / high) * 100);
}

function average(values) {
  const filtered = values.filter(Number.isFinite);
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function standardDeviation(values) {
  const avg = average(values);
  if (!Number.isFinite(avg)) return null;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}
