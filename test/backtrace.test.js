import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoricalNewsTimeline, runBacktraceResearch } from '../src/backtrace.js';
import { enrichCandles } from '../src/indicators.js';

test('historical news timeline never includes a future headline', () => {
  const candles = [{ date: '2026-01-02' }, { date: '2026-01-03' }];
  const timeline = buildHistoricalNewsTimeline(candles, [
    { publishedDate: '2026-01-03', title: 'Profit growth surged' }
  ]);

  assert.equal(timeline.byDate.get('2026-01-02').headlineCount, 0);
  assert.equal(timeline.byDate.get('2026-01-03').headlineCount, 1);
  assert.equal(timeline.byDate.get('2026-01-03').verdict, 'positive');
});

test('intraday news timeline excludes headlines dated on the trading session', () => {
  const timeline = buildHistoricalNewsTimeline([{ date: '2026-01-03' }], [
    { publishedDate: '2026-01-02', title: 'Profit growth surged' },
    { publishedDate: '2026-01-03', title: 'Contract win announced during market hours' }
  ], { lagDays: 1 });

  assert.equal(timeline.byDate.get('2026-01-03').headlineCount, 1);
  assert.equal(timeline.byDate.get('2026-01-03').dateRange.to, '2026-01-02');
});

test('back trace caps history at one year and returns walk-forward research', () => {
  const candles = enrichCandles(rawCandles(310));
  const newsItems = candles
    .filter((_, index) => index % 24 === 0)
    .map((candle, index) => ({
      publishedDate: candle.date,
      title: index % 2 ? 'Profit growth and contract win' : 'Risk warning and profit decline'
    }));
  const report = runBacktraceResearch({
    snapshot: {
      symbol: 'IDX:TEST',
      yfSymbol: 'TEST.JK',
      source: 'test',
      candles
    },
    newsItems,
    settings: {
      autoTrade: {
        minScore: 42,
        takeProfitPct: 5,
        parameterWeights: {}
      }
    },
    applyAdjustments: false
  });

  assert.ok(report.candleCount <= 252);
  assert.equal(report.selectedRange, '1y');
  assert.equal(report.timeframe, '1D');
  assert.ok(report.split.validationCandles >= 15);
  assert.equal(report.adjustment.applied, false);
  assert.equal(report.parameterComparison.length, 12);
  assert.equal(report.finalStrategy.name, 'Current live parameters');
  assert.equal(report.finalStrategy.minScore, 42);
  assert.equal(report.finalStrategy.stopLossPct, 4.5);
  assert.ok(Number.isFinite(report.recommendedStrategy.stopLossPct));
  assert.ok(report.final);
  assert.equal(report.technicalAssessment.name, 'Previous completed candle');
  assert.equal(report.technicalAssessment.timeframe, '1D');
  for (const key of ['candle', 'trend', 'momentum', 'volatility', 'volume', 'calibration', 'triggers']) {
    assert.ok(Number.isFinite(report.recommendedStrategy.parameterWeights[key]));
    assert.ok(Number.isFinite(report.finalStrategy.parameterWeights[key]));
  }
});

test('zero-trade validation is reported as inconclusive with entry diagnostics', () => {
  const report = runBacktraceResearch({
    snapshot: {
      symbol: 'IDX:DOWN',
      yfSymbol: 'DOWN.JK',
      source: 'test',
      candles: enrichCandles(decliningCandles(280))
    },
    newsItems: [],
    settings: {
      autoTrade: {
        minScore: 58,
        takeProfitPct: 7,
        parameterWeights: {}
      }
    },
    applyAdjustments: true
  });

  assert.equal(report.selectedRange, '1y');
  assert.equal(report.optimized.tradeCount, 0);
  assert.equal(report.final.tradeCount, 0);
  assert.equal(report.adjustment.baselineState, 'no validation entries');
  assert.equal(report.adjustment.applied, false);
  assert.match(report.adjustment.reason, /Win rate is not measurable yet/);
  assert.ok(report.optimized.diagnostics.executableSessions > 0);
});

function rawCandles(count) {
  const start = new Date('2025-01-01T00:00:00Z');
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const wave = Math.sin(index / 8) * 9;
    const close = 100 + (index * 0.08) + wave;
    const open = close - (Math.cos(index / 5) * 1.4);
    return {
      time: Math.floor(date.getTime() / 1000),
      date: date.toISOString().slice(0, 10),
      open,
      high: Math.max(open, close) + 1.8,
      low: Math.min(open, close) - 1.8,
      close,
      volume: 1_000_000 + ((index % 11) * 90_000)
    };
  });
}

function decliningCandles(count) {
  const start = new Date('2025-01-01T00:00:00Z');
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const close = 400 - (index * 0.7);
    return {
      time: Math.floor(date.getTime() / 1000),
      date: date.toISOString().slice(0, 10),
      open: close + 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000_000
    };
  });
}
