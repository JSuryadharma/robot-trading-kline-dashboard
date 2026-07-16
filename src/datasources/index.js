import { fetchTradingViewKlines } from './tradingView.js';
import { fetchYFinanceKlines } from './yfinance.js';
import { generateSampleKlines } from './sample.js';

export async function fetchKlines({ symbol, yfSymbol, interval, from, to }) {
  const attempts = [];

  try {
    const result = await fetchTradingViewKlines({ symbol, interval, from, to });
    return {
      ...result,
      attempts: [{ source: 'tradingview', ok: true }]
    };
  } catch (error) {
    attempts.push({ source: 'tradingview', ok: false, error: error.message });
  }

  try {
    const result = await fetchYFinanceKlines({ symbol: yfSymbol, interval, from, to });
    return {
      ...result,
      warnings: [`TradingView failed: ${attempts[0].error}`, ...(result.warnings || [])],
      attempts: [...attempts, { source: 'yfinance', ok: true }]
    };
  } catch (error) {
    attempts.push({ source: 'yfinance', ok: false, error: error.message });
  }

  const sample = generateSampleKlines({ symbol, from, to });
  return {
    ...sample,
    warnings: [
      ...attempts.map((attempt) => `${attempt.source} failed: ${attempt.error}`),
      ...sample.warnings
    ],
    attempts
  };
}
