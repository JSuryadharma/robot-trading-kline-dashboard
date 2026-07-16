function seededRandom(seedText) {
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSampleKlines({ symbol, from, to }) {
  const random = seededRandom(`${symbol}:${from}:${to}`);
  const candles = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  let price = symbol.includes('BBCA') ? 9200 : 1000;
  let dayIndex = 0;

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    if (day === 0 || day === 6) continue;

    const wave = Math.sin(dayIndex / 18) * 0.011 + Math.sin(dayIndex / 47) * 0.018;
    const noise = (random() - 0.48) * 0.026;
    const drift = 0.00025;
    const open = price * (1 + (random() - 0.5) * 0.012);
    const close = Math.max(50, price * (1 + drift + wave + noise));
    const high = Math.max(open, close) * (1 + random() * 0.014);
    const low = Math.min(open, close) * (1 - random() * 0.014);
    const volume = Math.round(45_000_000 + random() * 45_000_000 + Math.abs(close - open) * 120_000);

    candles.push({
      time: Math.floor(cursor.getTime() / 1000),
      date: cursor.toISOString().slice(0, 10),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume
    });
    price = close;
    dayIndex += 1;
  }

  return {
    source: 'sample',
    warnings: ['TradingView and yfinance/Yahoo did not return data. Showing deterministic sample data for development.'],
    candles
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
