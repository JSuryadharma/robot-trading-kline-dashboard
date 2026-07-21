const TV_WS_URL = 'wss://data.tradingview.com/socket.io/websocket';

function randomSession(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`;
}

function tvEnvelope(message) {
  return `~m~${Buffer.byteLength(message)}~m~${message}`;
}

function tvSend(ws, method, params) {
  ws.send(tvEnvelope(JSON.stringify({ m: method, p: params })));
}

function parseFrames(raw) {
  const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
  const frames = [];
  let cursor = 0;

  while (cursor < text.length) {
    if (!text.startsWith('~m~', cursor)) {
      frames.push(text.slice(cursor));
      break;
    }
    const lengthEnd = text.indexOf('~m~', cursor + 3);
    if (lengthEnd === -1) break;
    const length = Number(text.slice(cursor + 3, lengthEnd));
    const payloadStart = lengthEnd + 3;
    const payload = text.slice(payloadStart, payloadStart + length);
    frames.push(payload);
    cursor = payloadStart + length;
  }
  return frames;
}

function normalizeInterval(interval) {
  const value = String(interval).trim().toLowerCase();
  if (value === '1d' || value === 'd' || value === 'day') return 'D';
  if (value === '1w' || value === '1wk' || value === 'w') return 'W';
  if (value === '1mo' || value === 'm') return 'M';
  const minutes = value.match(/^(\d+)(m|min)?$/);
  if (minutes) return minutes[1];
  return interval;
}

function normalizeBar(item) {
  const value = Array.isArray(item) ? item : item?.v;
  if (!Array.isArray(value) || value.length < 5) return null;
  const [timestamp, open, high, low, close, volume = 0] = value;
  if (![timestamp, open, high, low, close].every(Number.isFinite)) return null;
  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  return {
    time: Math.floor(milliseconds / 1000),
    date: new Date(milliseconds).toISOString().slice(0, 10),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number.isFinite(volume) ? Number(volume) : 0
  };
}

function withinRange(candle, from, to) {
  return candle.date >= from && candle.date <= to;
}

export async function fetchTradingViewKlines({ symbol, interval, from, to, countBack: requestedCountBack, timeoutMs = 10_000 }) {
  if (typeof WebSocket !== 'function') {
    throw new Error('Node runtime does not expose a WebSocket client.');
  }

  const countBack = Number.isFinite(requestedCountBack)
    ? Math.max(260, Math.min(5_000, Math.round(requestedCountBack)))
    : Math.max(260, Math.ceil((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 90);
  const chartSession = randomSession('cs');
  const quoteSession = randomSession('qs');
  const tvInterval = normalizeInterval(interval);

  return new Promise((resolve, reject) => {
    let settled = false;
    let latestBars = [];
    let softFinishTimer = null;
    const ws = new WebSocket(TV_WS_URL);

    const timer = setTimeout(() => {
      finish(new Error(`TradingView timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function finish(error, payload) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(softFinishTimer);
      try {
        ws.close();
      } catch {
        // noop
      }
      if (error) reject(error);
      else resolve(payload);
    }

    function finishWithBars() {
      const candles = latestBars
        .map(normalizeBar)
        .filter(Boolean)
        .filter((candle) => withinRange(candle, from, to))
        .sort((a, b) => a.time - b.time);

      if (candles.length === 0) {
        finish(new Error('TradingView returned no candles for the requested range.'));
        return;
      }

      finish(null, {
        source: 'tradingview',
        warnings: [],
        candles
      });
    }

    ws.addEventListener('open', () => {
      tvSend(ws, 'set_auth_token', ['unauthorized_user_token']);
      tvSend(ws, 'chart_create_session', [chartSession, '']);
      tvSend(ws, 'quote_create_session', [quoteSession]);
      tvSend(ws, 'quote_set_fields', [
        quoteSession,
        'lp',
        'ch',
        'chp',
        'volume',
        'currency_code',
        'short_name',
        'exchange'
      ]);
      tvSend(ws, 'quote_add_symbols', [quoteSession, symbol]);
      tvSend(ws, 'quote_fast_symbols', [quoteSession, symbol]);
      tvSend(ws, 'resolve_symbol', [
        chartSession,
        'symbol_1',
        JSON.stringify({
          symbol,
          adjustment: 'splits',
          session: 'regular'
        })
      ]);
      tvSend(ws, 'create_series', [chartSession, 's1', 's1', 'symbol_1', tvInterval, countBack]);
    });

    ws.addEventListener('message', (event) => {
      for (const frame of parseFrames(event.data)) {
        if (frame.startsWith('~h~')) {
          ws.send(tvEnvelope(frame));
          continue;
        }

        let parsed;
        try {
          parsed = JSON.parse(frame);
        } catch {
          continue;
        }

        if (parsed.m === 'timescale_update') {
          const series = parsed.p?.[1]?.s1?.s;
          if (Array.isArray(series) && series.length > 0) {
            latestBars = series;
            clearTimeout(softFinishTimer);
            softFinishTimer = setTimeout(finishWithBars, 450);
          }
        }

        if (parsed.m === 'series_completed' && latestBars.length > 0) {
          finishWithBars();
        }

        if (parsed.m === 'critical_error' || parsed.m === 'symbol_error') {
          finish(new Error(`TradingView error for ${symbol}: ${JSON.stringify(parsed.p || [])}`));
        }
      }
    });

    ws.addEventListener('error', () => {
      finish(new Error(`TradingView websocket failed for ${symbol}.`));
    });
  });
}
