import path from 'node:path';

const rootDir = process.cwd();

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

export const config = {
  rootDir,
  dataDir: path.join(rootDir, 'data'),
  publicDir: path.join(rootDir, 'public'),
  port: numberFromEnv('PORT', 3000),
  timeZone: process.env.ROBOT_TIMEZONE || 'Asia/Jakarta',
  symbol: process.env.TV_SYMBOL || 'IDX:BBCA',
  yfSymbol: process.env.YF_SYMBOL || 'BBCA.JK',
  interval: process.env.KLINE_INTERVAL || '1D',
  historyFrom: process.env.HISTORY_FROM || '2025-06-01',
  historyTo: process.env.HISTORY_TO || '2026-06-01',
  initialBalance: numberFromEnv('INITIAL_BALANCE', 5_000_000),
  tradeAllocationPct: numberFromEnv('TRADE_ALLOCATION_PCT', 0.75),
  maxPositionPct: numberFromEnv('MAX_POSITION_PCT', 0.85),
  lotSize: numberFromEnv('LOT_SIZE', 100),
  criticalHours: listFromEnv('CRITICAL_HOURS', ['09:00', '11:00', '13:00', '15:30']),
  auth: {
    defaultUsername: process.env.ROBOT_USERNAME || 'admin',
    defaultPassword: process.env.ROBOT_PASSWORD || 'admin123',
    sessionDays: numberFromEnv('SESSION_DAYS', 7)
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || ''
  },
  email: {
    gmailUser: process.env.GMAIL_USER || 'jsuryadharma9@gmail.com',
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
    gmailTo: process.env.GMAIL_TO || 'jsuryadharma9@gmail.com'
  },
  ai: {
    mode: process.env.AI_ADVISOR_MODE || 'local',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    lmStudioBaseUrl: process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1',
    lmStudioModel: process.env.LMSTUDIO_MODEL || 'qwen/qwen3.5-9b',
    lmStudioApiKey: process.env.LMSTUDIO_API_KEY || '',
    lmStudioTimeoutMs: numberFromEnv('LMSTUDIO_TIMEOUT_MS', 30_000),
    lmStudioMaxTokens: numberFromEnv('LMSTUDIO_MAX_TOKENS', 1_600),
    lmStudioReasoningEffort: process.env.LMSTUDIO_REASONING_EFFORT || 'none'
  }
};

export function todayInTimeZone(timeZone = config.timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function currentClockInTimeZone(timeZone = config.timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`
  };
}
