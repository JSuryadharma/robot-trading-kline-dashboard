import test from 'node:test';
import assert from 'node:assert/strict';
import { runDayTradeBacktraceResearch } from '../src/dayTradeBacktrace.js';
import { enrichCandles } from '../src/indicators.js';

test('day-trade research uses intraday validation and never holds overnight', () => {
  const candles = enrichCandles(intradayCandles(45));
  const report = runDayTradeBacktraceResearch({
    snapshot: {
      symbol: 'IDX:TEST',
      yfSymbol: 'TEST.JK',
      source: 'test',
      interval: '15m',
      candles
    },
    newsItems: candles
      .filter((_, index) => index % (26 * 7) === 0)
      .map((candle) => ({ publishedDate: candle.date, title: 'Profit growth and strong contract win' })),
    settings: {
      dayTrade: {
        minScore: 44,
        takeProfitPct: 1.8,
        stopLossPct: 1.2,
        maxHoldBars: 8,
        parameterWeights: {}
      }
    },
    range: 'auto',
    applyAdjustments: false
  });

  assert.equal(report.mode, 'day-trade');
  assert.equal(report.interval, '15m');
  assert.ok(report.sessionCount <= 60);
  assert.ok(report.split.validationSessions >= 5);
  assert.ok(report.rangeComparisons.length >= 2);
  assert.ok(report.optimized.tradeCount > 0);
  assert.equal(report.adjustment.applied, false);
  assert.ok(report.trades.every((trade) => trade.entryDate === trade.exitDate));
  assert.match(report.newsCoverage.method, /prior day/);
});

function intradayCandles(sessionCount) {
  const candles = [];
  const cursor = new Date('2026-03-02T00:00:00Z');
  let session = 0;
  let previousClose = 100;
  while (session < sessionCount) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      for (let bar = 0; bar < 26; bar += 1) {
        const timestamp = new Date(cursor);
        timestamp.setUTCHours(2, bar * 15, 0, 0);
        const drift = session % 6 < 4 ? 0.12 : -0.18;
        const wave = Math.sin((session * 26 + bar) / 5) * 0.36;
        const open = previousClose;
        const close = Math.max(40, open + drift + wave);
        candles.push({
          time: Math.floor(timestamp.getTime() / 1000),
          date: timestamp.toISOString().slice(0, 10),
          open,
          high: Math.max(open, close) + 0.22,
          low: Math.min(open, close) - 0.22,
          close,
          volume: 1_000_000 + ((bar % 8) * 140_000)
        });
        previousClose = close;
      }
      session += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return candles;
}
