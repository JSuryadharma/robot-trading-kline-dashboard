import { config, todayInTimeZone } from './config.js';
import { fetchYFinanceKlines } from './datasources/yfinance.js';
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

function average(values) {
  const filtered = values.filter(Number.isFinite);
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}
