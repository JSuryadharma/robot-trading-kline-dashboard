function toUnix(dateText, endOfDay = false) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return Math.floor(date.getTime() / 1000);
}

function finiteNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

export async function fetchYFinanceKlines({ symbol, interval, from, to, timeoutMs = 10_000 }) {
  const yahooInterval = normalizeInterval(interval);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set('period1', String(toUnix(from)));
  url.searchParams.set('period2', String(toUnix(to, true)));
  url.searchParams.set('interval', yahooInterval);
  url.searchParams.set('events', 'history');
  url.searchParams.set('includePrePost', 'false');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Yahoo chart API returned HTTP ${response.status}.`);
  }
  const body = await response.json();
  const result = body.chart?.result?.[0];
  const error = body.chart?.error;
  if (error) throw new Error(`Yahoo chart API error: ${error.description || error.code}`);
  if (!result?.timestamp?.length) throw new Error('Yahoo chart API returned no timestamps.');

  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp;
  const candles = timestamps.map((timestamp, index) => {
    const open = finiteNumber(quote.open?.[index]);
    const high = finiteNumber(quote.high?.[index]);
    const low = finiteNumber(quote.low?.[index]);
    const close = finiteNumber(quote.close?.[index]);
    if ([open, high, low, close].some((value) => value === null)) return null;
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    return {
      time: timestamp,
      date,
      open,
      high,
      low,
      close,
      volume: finiteNumber(quote.volume?.[index]) || 0
    };
  }).filter(Boolean);

  if (candles.length === 0) {
    throw new Error('Yahoo chart API returned no usable OHLCV candles.');
  }

  return {
    source: 'yfinance',
    warnings: [],
    meta: result.meta || {},
    candles
  };
}

function normalizeInterval(interval) {
  const value = String(interval).trim().toLowerCase();
  if (value === '1d' || value === 'd' || value === 'day') return '1d';
  if (value === '1w' || value === '1wk' || value === 'w') return '1wk';
  if (value === '1mo' || value === 'm') return '1mo';
  if (/^\d+$/.test(value)) return `${value}m`;
  return value;
}
