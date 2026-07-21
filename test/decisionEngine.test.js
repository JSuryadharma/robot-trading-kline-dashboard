import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDecision } from '../src/decisionEngine.js';

const portfolio = { positions: {} };

test('LM Studio news changes the final auto-trade score in both directions', () => {
  const neutral = makeDecision(snapshot(), portfolio, { newsAnalysis: analysis('neutral', 0) });
  const positive = makeDecision(snapshot(), portfolio, { newsAnalysis: analysis('positive', 18) });
  const negative = makeDecision(snapshot(), portfolio, { newsAnalysis: analysis('negative', -18) });

  assert.equal(neutral.newsScore, 0);
  assert.equal(positive.newsScore, 14);
  assert.equal(negative.newsScore, -14);
  assert.equal(positive.score, neutral.technicalScore + 14);
  assert.equal(negative.score, neutral.technicalScore - 14);
  assert.deepEqual(positive.scoreBreakdown, {
    technical: neutral.technicalScore,
    news: 14,
    final: positive.score
  });
});

test('news without source headlines cannot affect auto trade', () => {
  const decision = makeDecision(snapshot(), portfolio, {
    newsAnalysis: analysis('positive', 18, { headlineCount: 0, items: [] })
  });

  assert.equal(decision.newsScore, 0);
  assert.equal(decision.score, decision.technicalScore);
});

test('local fallback news has lower influence than LM Studio news', () => {
  const lmStudio = makeDecision(snapshot(), portfolio, { newsAnalysis: analysis('positive', 18) });
  const fallback = makeDecision(snapshot(), portfolio, {
    newsAnalysis: analysis('positive', 18, {
      mode: 'local-fallback',
      engine: { label: 'Local fallback', usedLmStudio: false }
    })
  });

  assert.ok(fallback.newsScore > 0);
  assert.ok(fallback.newsScore < lmStudio.newsScore);
});

test('adaptive news weight changes the applied contribution without changing the raw verdict', () => {
  const decision = makeDecision(snapshot(), portfolio, {
    newsAnalysis: analysis('positive', 18),
    tradePolicy: { parameterWeights: { news: 0.5 } }
  });

  assert.equal(decision.newsRawScore, 18);
  assert.equal(decision.newsScore, 7);
  assert.equal(decision.newsBaseScore, 14);
  assert.equal(decision.parameters.find((item) => item.name === 'AI News Verdict').score, 7);
  assert.equal(decision.parameters.find((item) => item.name === 'AI News Verdict').weight, 0.5);
  assert.equal(decision.scoreBreakdown.news, 7);
  assert.equal(decision.score, decision.technicalScore + 7);
});

test('completed previous candle performance contributes to the technical score', () => {
  const input = snapshot();
  input.latest = {
    ...input.latest,
    open: 96,
    high: 101,
    low: 95,
    close: 100,
    changePct: 2,
    volume: 1_500_000,
    volumeSma20: 1_000_000
  };
  input.candles[input.candles.length - 2] = {
    ...input.candles.at(-2),
    close: 98
  };

  const decision = makeDecision(input, portfolio, { newsAnalysis: analysis('neutral', 0) });
  const candleParameter = decision.parameters.find((item) => item.name === 'Previous candle performance');

  assert.ok(candleParameter.score > 0);
  assert.match(candleParameter.value, /Completed candle/);
  assert.equal(decision.parameterWeights.candle, 1);
});

test('configured auto-trade stop loss triggers SELL protection', () => {
  const input = snapshot();
  input.latest = { ...input.latest, close: 96 };
  const positionedPortfolio = {
    positions: {
      [input.symbol]: { quantity: 1, averagePrice: 100 }
    }
  };
  const decision = makeDecision(input, positionedPortfolio, {
    newsAnalysis: analysis('neutral', 0),
    tradePolicy: { stopLossPct: 3, takeProfitPct: 7 }
  });

  assert.equal(decision.action, 'SELL');
  assert.equal(decision.verdict, 'Stop-loss protection');
});

function snapshot() {
  const latest = {
    date: '2026-07-20',
    close: 100,
    sma5: 103,
    sma20: 100,
    sma50: 96,
    sma200: 90,
    rsi14: 56,
    stochK: 60,
    stochD: 52,
    macdHistogram: 1,
    atrPct: 2.2,
    bbUpper: 112,
    bbLower: 88,
    volume: 1_400_000,
    volumeSma20: 1_000_000,
    changePct: 1.5
  };
  const candles = Array.from({ length: 7 }, (_, index) => ({
    ...latest,
    date: `2026-07-${String(14 + index).padStart(2, '0')}`,
    sma20: 94 + index
  }));
  return {
    symbol: 'IDX:TEST',
    latest,
    candles,
    currentSignals: [],
    calibration: {
      records: [],
      bullishEdge: 0,
      bearishEdge: 0
    }
  };
}

function analysis(verdict, score, overrides = {}) {
  return {
    verdict,
    score,
    confidencePercentage: 100,
    headlineCount: 4,
    items: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }, { title: 'Four' }],
    dateRange: { from: '2026-07-17', to: '2026-07-20' },
    selectedPeriod: '3d',
    mode: 'lmstudio',
    engine: { label: 'LM Studio', usedLmStudio: true },
    ...overrides
  };
}
