import { config, todayInTimeZone } from './config.js';
import { fetchYFinanceKlines } from './datasources/yfinance.js';
import { buildPriceTargets } from './marketData.js';
import { monthsAgoDate, normalizeStockList } from './symbols.js';

export async function rankTopPerformers(symbols, { months = 3, limit = 10 } = {}) {
  const stocks = normalizeStockList(symbols);
  const from = monthsAgoDate(months);
  const to = todayInTimeZone(config.timeZone);
  const results = [];

  for (const stock of stocks) {
    try {
      const raw = await fetchYFinanceKlines({
        symbol: stock.yfSymbol,
        interval: '1D',
        from,
        to,
        timeoutMs: 7_500
      });
      const candles = raw.candles.filter((candle) => candle.close > 0);
      if (candles.length < 2) throw new Error('Not enough candles for 3M ranking.');
      const first = candles[0];
      const latest = candles.at(-1);
      const performance3m = ((latest.close - first.close) / first.close) * 100;
      const high3m = Math.max(...candles.map((candle) => candle.high));
      const low3m = Math.min(...candles.map((candle) => candle.low));
      const avgVolume20 = average(candles.slice(-20).map((candle) => candle.volume));
      const priceTargets = buildPriceTargets(candles);

      results.push({
        stock,
        symbol: stock.yfSymbol,
        tvSymbol: stock.tvSymbol,
        name: stock.name,
        latestDate: latest.date,
        latestClose: round(latest.close),
        performance3m: round(performance3m),
        high3m: round(high3m),
        low3m: round(low3m),
        avgVolume20: round(avgVolume20),
        priceTargets,
        buyTarget: priceTargets.buyTarget,
        sellTarget: priceTargets.sellTarget,
        stopLoss: priceTargets.stopLoss,
        source: 'yfinance'
      });
    } catch (error) {
      results.push({
        stock,
        symbol: stock.yfSymbol,
        tvSymbol: stock.tvSymbol,
        name: stock.name,
        error: error.message,
        performance3m: -Infinity,
        source: 'none'
      });
    }
  }

  return results
    .sort((a, b) => b.performance3m - a.performance3m)
    .map((item, index) => ({ ...item, rank: index + 1 }))
    .slice(0, limit);
}

export async function buildWeeklyTradingPlan(symbols, { limit = 10 } = {}) {
  const stocks = normalizeStockList(symbols);
  const from = daysAgoDate(21);
  const to = todayInTimeZone(config.timeZone);
  const results = [];

  for (const stock of stocks) {
    try {
      const raw = await fetchYFinanceKlines({
        symbol: stock.yfSymbol,
        interval: '1D',
        from,
        to,
        timeoutMs: 7_500
      });
      const candles = raw.candles.filter((candle) => candle.close > 0);
      if (candles.length < 2) throw new Error('Not enough candles for weekly trading plan.');

      const latest = candles.at(-1);
      const previous = candles.at(-2);
      const weekBase = candles.at(-6) || candles[0];
      const recentWeek = candles.slice(-5);
      const weekHigh = Math.max(...recentWeek.map((candle) => candle.high));
      const weekLow = Math.min(...recentWeek.map((candle) => candle.low));
      const avgVolume5 = average(recentWeek.map((candle) => candle.volume));
      const diff1d = latest.close - previous.close;
      const diff1w = latest.close - weekBase.close;
      const performance1d = (diff1d / previous.close) * 100;
      const performance1w = (diff1w / weekBase.close) * 100;
      const rangePosition = weekHigh === weekLow ? 50 : ((latest.close - weekLow) / (weekHigh - weekLow)) * 100;
      const planScore = (performance1w * 0.72) + (performance1d * 0.22) + (rangePosition * 0.04);
      const priceTargets = buildPriceTargets(candles);

      results.push({
        stock,
        symbol: stock.yfSymbol,
        tvSymbol: stock.tvSymbol,
        name: stock.name,
        latestDate: latest.date,
        latestClose: round(latest.close),
        diff1d: round(diff1d),
        diff1w: round(diff1w),
        performance1d: round(performance1d),
        performance1w: round(performance1w),
        weekHigh: round(weekHigh),
        weekLow: round(weekLow),
        avgVolume5: round(avgVolume5),
        rangePosition: round(rangePosition),
        planScore: round(planScore),
        plan: weeklyPlanLabel(performance1d, performance1w, rangePosition),
        buyTarget: priceTargets.buyTarget,
        sellTarget: priceTargets.sellTarget,
        source: 'yfinance'
      });
    } catch (error) {
      results.push({
        stock,
        symbol: stock.yfSymbol,
        tvSymbol: stock.tvSymbol,
        name: stock.name,
        error: error.message,
        performance1d: -Infinity,
        performance1w: -Infinity,
        planScore: -Infinity,
        plan: 'Data unavailable',
        source: 'none'
      });
    }
  }

  return results
    .sort((a, b) => b.planScore - a.planScore || b.performance1w - a.performance1w || b.performance1d - a.performance1d)
    .map((item, index) => ({ ...item, rank: index + 1 }))
    .slice(0, limit);
}

function weeklyPlanLabel(performance1d, performance1w, rangePosition) {
  if (performance1w >= 4 && performance1d >= 0 && rangePosition >= 55) return 'Momentum candidate';
  if (performance1w >= 2 && performance1d < 0) return 'Pullback watch';
  if (performance1w >= 1 && rangePosition >= 70) return 'Breakout watch';
  if (performance1w <= -2) return 'Weak this week';
  return 'Neutral watch';
}

function daysAgoDate(days, date = new Date()) {
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  cursor.setUTCDate(cursor.getUTCDate() - days);
  return cursor.toISOString().slice(0, 10);
}

function average(values) {
  const filtered = values.filter(Number.isFinite);
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}
