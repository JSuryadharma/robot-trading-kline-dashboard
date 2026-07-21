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
  const signalWindowTo = latest?.date || fetchTo;
  const signalWindowFrom = dateMonthsBefore(signalWindowTo, 1);
  const signalSignificanceCandles = candles.filter((candle) => candle.date >= signalWindowFrom && candle.date <= signalWindowTo);
  const signalSignificance = calibrateSignals(signalSignificanceCandles, {
    from: signalWindowFrom,
    to: signalWindowTo,
    lookAhead: 5
  });
  const currentSignals = latest ? detectSignals(candles, candles.length - 1) : [];
  const reversalMarkers = buildReversalMarkers(candles);
  const marketStructure = buildMarketStructure(candles);
  const priceTargets = buildPriceTargets(candles, marketStructure);

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
    signalSignificance: {
      ...signalSignificance,
      windowLabel: 'Latest 1M'
    },
    historySummary: summarizeHistory(candles),
    marketStructure,
    priceTargets,
    candles,
    reversalMarkers
  };
}

export async function loadIntradayMarketSnapshot(stockInput = defaultStock(), { interval = '15m', lookbackDays = 60 } = {}) {
  const stock = stockFromInput(stockInput);
  const to = todayInTimeZone(config.timeZone);
  const from = dateDaysBefore(to, Math.min(60, Math.max(20, Number(lookbackDays) || 60)));
  const raw = await fetchKlines({
    symbol: stock.tvSymbol,
    yfSymbol: stock.yfSymbol,
    interval,
    from,
    to,
    countBack: 1_800
  });
  if (raw.source === 'sample') {
    throw new Error('Day-trade research requires real intraday candles; sample daily data cannot be used.');
  }
  const candles = enrichCandles(raw.candles.filter(isRegularIdxSession));
  if (candles.length < 200) {
    throw new Error(`Day-trade research needs at least 200 regular-session candles; ${candles.length} were available.`);
  }
  const latest = candles.at(-1);
  const sessionDates = [...new Set(candles.map((candle) => candle.date))];
  const calibration = calibrateSignals(candles, {
    from: candles[0].date,
    to: latest.date,
    lookAhead: 4
  });

  return {
    symbol: stock.tvSymbol,
    yfSymbol: stock.yfSymbol,
    stock,
    interval,
    source: raw.source,
    sourceAttempts: raw.attempts || [],
    warnings: raw.warnings || [],
    historyWindow: {
      from: candles[0].date,
      to: latest.date,
      candleCount: candles.length,
      sessionCount: sessionDates.length
    },
    fetchedAt: new Date().toISOString(),
    latest,
    currentSignals: detectSignals(candles, candles.length - 1),
    calibration,
    candles
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

function buildMarketStructure(candles) {
  if (candles.length < 21) {
    return {
      trend: 'neutral',
      recentHigh: null,
      recentLow: null,
      breakOfStructure: 'none',
      trendChange: 'none'
    };
  }
  const latest = candles.at(-1);
  const previous = candles.at(-2);
  const recent20 = candles.slice(-21, -1);
  const recentHigh = Math.max(...recent20.map((candle) => candle.high).filter(Number.isFinite));
  const recentLow = Math.min(...recent20.map((candle) => candle.low).filter(Number.isFinite));
  const maTrend = [latest?.sma20, latest?.sma50].every(Number.isFinite)
    ? latest.sma20 > latest.sma50 ? 'uptrend' : latest.sma20 < latest.sma50 ? 'downtrend' : 'neutral'
    : 'neutral';
  const breakOfStructure = [previous?.close, latest?.close, recentHigh, recentLow].every(Number.isFinite)
    ? previous.close <= recentHigh && latest.close > recentHigh
      ? 'bullish'
      : previous.close >= recentLow && latest.close < recentLow
        ? 'bearish'
        : 'none'
    : 'none';
  const trendChange = [previous?.close, previous?.sma50, previous?.sma20, latest?.close, latest?.sma50, latest?.sma20].every(Number.isFinite)
    ? previous.close <= previous.sma50 && latest.close > latest.sma50 && latest.sma20 > previous.sma20
      ? 'bullish'
      : previous.close >= previous.sma50 && latest.close < latest.sma50 && latest.sma20 < previous.sma20
        ? 'bearish'
        : 'none'
    : 'none';

  return {
    trend: maTrend,
    recentHigh: round(recentHigh),
    recentLow: round(recentLow),
    breakOfStructure,
    trendChange
  };
}

export function buildPriceTargets(candles, structure = buildMarketStructure(candles)) {
  if (!candles.length) {
    return {
      buyTarget: null,
      sellTarget: null,
      stopLoss: null,
      riskReward: null,
      basis: 'No candle data'
    };
  }
  const latest = candles.at(-1);
  const recent20 = candles.slice(-20);
  const recent63 = candles.slice(-63);
  const recentHigh = Math.max(...recent20.map((candle) => candle.high).filter(Number.isFinite));
  const recentLow = Math.min(...recent20.map((candle) => candle.low).filter(Number.isFinite));
  const swingHigh = Math.max(...recent63.map((candle) => candle.high).filter(Number.isFinite));
  const swingLow = Math.min(...recent63.map((candle) => candle.low).filter(Number.isFinite));
  const atr = Number.isFinite(latest.atr14) ? latest.atr14 : latest.close * 0.025;
  const support = Number.isFinite(structure.recentLow) ? structure.recentLow : recentLow;
  const resistance = Number.isFinite(structure.recentHigh) ? structure.recentHigh : recentHigh;
  const range = Math.max(atr, resistance - support, latest.close * 0.015);
  const pullbackTarget = latest.close > support
    ? Math.max(support, latest.close - Math.min(range * 0.382, atr * 1.15))
    : latest.close;
  const breakoutTarget = latest.close + Math.max(atr * 1.8, range * 0.618);
  const sellTarget = Math.max(resistance, swingHigh, breakoutTarget);
  const stopLoss = Math.min(swingLow, pullbackTarget - (atr * 1.1));
  const risk = Math.max(0, pullbackTarget - stopLoss);
  const reward = Math.max(0, sellTarget - pullbackTarget);

  return {
    buyTarget: round(pullbackTarget),
    sellTarget: round(sellTarget),
    stopLoss: round(stopLoss),
    riskReward: risk > 0 ? round(reward / risk) : null,
    basis: `${structure.trend || 'neutral'} | support ${round(support)} | resistance ${round(resistance)}`
  };
}

function maxDate(a, b) {
  return a > b ? a : b;
}

function dateMonthsBefore(dateString, months) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

function dateDaysBefore(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function isRegularIdxSession(candle) {
  if (!Number.isFinite(candle?.time)) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(new Date(candle.time * 1000));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const minutes = (Number(values.hour) * 60) + Number(values.minute);
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 59;
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
