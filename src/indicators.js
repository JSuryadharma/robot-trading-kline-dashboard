export const signalDefinitions = {
  golden_ma_5_20: { label: 'MA-5 crossed above MA-20', direction: 'bullish' },
  death_ma_5_20: { label: 'MA-5 crossed below MA-20', direction: 'bearish' },
  price_reclaims_ma20: { label: 'Close reclaimed MA-20', direction: 'bullish' },
  price_loses_ma20: { label: 'Close lost MA-20', direction: 'bearish' },
  rsi_rebound_30: { label: 'RSI rebounded from oversold', direction: 'bullish' },
  rsi_fades_70: { label: 'RSI faded from overbought', direction: 'bearish' },
  stoch_bull_cross: { label: 'Stochastic bull cross', direction: 'bullish' },
  stoch_bear_cross: { label: 'Stochastic bear cross', direction: 'bearish' },
  macd_bull_cross: { label: 'MACD crossed above signal', direction: 'bullish' },
  macd_bear_cross: { label: 'MACD crossed below signal', direction: 'bearish' },
  lower_band_reversal: { label: 'Reversal from lower Bollinger Band', direction: 'bullish' },
  upper_band_rejection: { label: 'Rejection near upper Bollinger Band', direction: 'bearish' }
};

export function enrichCandles(candles) {
  const sorted = candles.slice().sort((a, b) => a.time - b.time);
  const closes = sorted.map((candle) => candle.close);
  const highs = sorted.map((candle) => candle.high);
  const lows = sorted.map((candle) => candle.low);
  const volumes = sorted.map((candle) => candle.volume || 0);

  const sma5 = sma(closes, 5);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma100 = sma(closes, 100);
  const sma200 = sma(closes, 200);
  const volumeSma20 = sma(volumes, 20);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = closes.map((_, index) => valueOrNull(ema12[index]) === null || valueOrNull(ema26[index]) === null ? null : ema12[index] - ema26[index]);
  const macdSignal = ema(macd, 9);
  const macdHistogram = macd.map((value, index) => valueOrNull(value) === null || valueOrNull(macdSignal[index]) === null ? null : value - macdSignal[index]);
  const rsi14 = rsi(closes, 14);
  const stochastic = stoch(highs, lows, closes, 14, 3);
  const atr14 = atr(sorted, 14);
  const bollinger = bollingerBands(closes, 20, 2);

  return sorted.map((candle, index) => ({
    ...candle,
    change: index === 0 ? null : round(candle.close - sorted[index - 1].close),
    changePct: index === 0 ? null : round(((candle.close - sorted[index - 1].close) / sorted[index - 1].close) * 100),
    sma5: roundOrNull(sma5[index]),
    sma20: roundOrNull(sma20[index]),
    sma50: roundOrNull(sma50[index]),
    sma100: roundOrNull(sma100[index]),
    sma200: roundOrNull(sma200[index]),
    volumeSma20: roundOrNull(volumeSma20[index]),
    ema12: roundOrNull(ema12[index]),
    ema26: roundOrNull(ema26[index]),
    macd: roundOrNull(macd[index]),
    macdSignal: roundOrNull(macdSignal[index]),
    macdHistogram: roundOrNull(macdHistogram[index]),
    rsi14: roundOrNull(rsi14[index]),
    stochK: roundOrNull(stochastic.k[index]),
    stochD: roundOrNull(stochastic.d[index]),
    atr14: roundOrNull(atr14[index]),
    atrPct: valueOrNull(atr14[index]) === null ? null : round((atr14[index] / candle.close) * 100),
    bbMiddle: roundOrNull(bollinger.middle[index]),
    bbUpper: roundOrNull(bollinger.upper[index]),
    bbLower: roundOrNull(bollinger.lower[index])
  }));
}

export function detectSignals(candles, index = candles.length - 1) {
  if (index <= 0 || index >= candles.length) return [];
  const previous = candles[index - 1];
  const current = candles[index];
  const signals = [];

  addCross(signals, 'golden_ma_5_20', previous.sma5, previous.sma20, current.sma5, current.sma20, 'up');
  addCross(signals, 'death_ma_5_20', previous.sma5, previous.sma20, current.sma5, current.sma20, 'down');
  addCross(signals, 'price_reclaims_ma20', previous.close, previous.sma20, current.close, current.sma20, 'up');
  addCross(signals, 'price_loses_ma20', previous.close, previous.sma20, current.close, current.sma20, 'down');
  addCross(signals, 'macd_bull_cross', previous.macd, previous.macdSignal, current.macd, current.macdSignal, 'up');
  addCross(signals, 'macd_bear_cross', previous.macd, previous.macdSignal, current.macd, current.macdSignal, 'down');

  if (isFiniteNumber(previous.rsi14) && isFiniteNumber(current.rsi14)) {
    if (previous.rsi14 < 30 && current.rsi14 >= 30) pushSignal(signals, 'rsi_rebound_30');
    if (previous.rsi14 > 70 && current.rsi14 <= 70) pushSignal(signals, 'rsi_fades_70');
  }

  if ([previous.stochK, previous.stochD, current.stochK, current.stochD].every(isFiniteNumber)) {
    if (previous.stochK <= previous.stochD && current.stochK > current.stochD && current.stochK < 35) {
      pushSignal(signals, 'stoch_bull_cross');
    }
    if (previous.stochK >= previous.stochD && current.stochK < current.stochD && current.stochK > 65) {
      pushSignal(signals, 'stoch_bear_cross');
    }
  }

  if ([previous.close, previous.bbLower, current.close, current.bbLower].every(isFiniteNumber)) {
    if (previous.close < previous.bbLower && current.close > current.bbLower) pushSignal(signals, 'lower_band_reversal');
  }
  if ([previous.close, previous.bbUpper, current.close, current.bbUpper].every(isFiniteNumber)) {
    if (previous.close > previous.bbUpper && current.close < current.bbUpper) pushSignal(signals, 'upper_band_rejection');
  }

  return signals;
}

function pushSignal(signals, id) {
  const definition = signalDefinitions[id];
  signals.push({
    id,
    label: definition.label,
    direction: definition.direction
  });
}

function addCross(signals, id, previousA, previousB, currentA, currentB, direction) {
  if (![previousA, previousB, currentA, currentB].every(isFiniteNumber)) return;
  if (direction === 'up' && previousA <= previousB && currentA > currentB) pushSignal(signals, id);
  if (direction === 'down' && previousA >= previousB && currentA < currentB) pushSignal(signals, id);
}

function sma(values, period) {
  const output = Array(values.length).fill(null);
  let sum = 0;
  let finiteCount = 0;
  const queue = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    queue.push(value);
    if (isFiniteNumber(value)) {
      sum += value;
      finiteCount += 1;
    }
    if (queue.length > period) {
      const removed = queue.shift();
      if (isFiniteNumber(removed)) {
        sum -= removed;
        finiteCount -= 1;
      }
    }
    if (queue.length === period && finiteCount === period) output[index] = sum / period;
  }
  return output;
}

function ema(values, period) {
  const output = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let previous = null;
  let seed = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!isFiniteNumber(value)) {
      output[index] = previous;
      continue;
    }
    if (previous === null) {
      seed.push(value);
      if (seed.length === period) {
        previous = seed.reduce((sum, item) => sum + item, 0) / period;
        output[index] = previous;
      }
      continue;
    }
    previous = (value - previous) * multiplier + previous;
    output[index] = previous;
  }
  return output;
}

function rsi(values, period) {
  const output = Array(values.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  for (let index = 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (index <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (index === period) {
        avgGain /= period;
        avgLoss /= period;
        output[index] = rsiFromAverages(avgGain, avgLoss);
      }
      continue;
    }

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    output[index] = rsiFromAverages(avgGain, avgLoss);
  }
  return output;
}

function rsiFromAverages(avgGain, avgLoss) {
  if (avgLoss === 0) return 100;
  const relativeStrength = avgGain / avgLoss;
  return 100 - (100 / (1 + relativeStrength));
}

function stoch(highs, lows, closes, period, smooth) {
  const k = Array(closes.length).fill(null);
  for (let index = period - 1; index < closes.length; index += 1) {
    const highWindow = highs.slice(index - period + 1, index + 1);
    const lowWindow = lows.slice(index - period + 1, index + 1);
    const highest = Math.max(...highWindow);
    const lowest = Math.min(...lowWindow);
    if (highest === lowest) {
      k[index] = 50;
    } else {
      k[index] = ((closes[index] - lowest) / (highest - lowest)) * 100;
    }
  }
  return { k, d: sma(k, smooth) };
}

function atr(candles, period) {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
  return sma(trueRanges, period);
}

function bollingerBands(values, period, deviationMultiplier) {
  const middle = sma(values, period);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);

  for (let index = period - 1; index < values.length; index += 1) {
    const window = values.slice(index - period + 1, index + 1);
    const mean = middle[index];
    const variance = window.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / period;
    const deviation = Math.sqrt(variance);
    upper[index] = mean + deviation * deviationMultiplier;
    lower[index] = mean - deviation * deviationMultiplier;
  }

  return { middle, upper, lower };
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function valueOrNull(value) {
  return isFiniteNumber(value) ? value : null;
}

function roundOrNull(value) {
  return isFiniteNumber(value) ? round(value) : null;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
