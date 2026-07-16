import { config } from './config.js';
import { readJson, writeJson } from './storage.js';
import { defaultUniverse, normalizeStockList, stockFromInput } from './symbols.js';

const SETTINGS_FILE = 'settings.json';

const defaultSettings = {
  activeSymbol: 'BBCA.JK',
  selectedSymbols: ['BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'ANTM.JK'],
  rankingUniverse: defaultUniverse.map((stock) => stock.yfSymbol),
  aiCron: {
    enabled: true,
    times: ['09:00', '11:00', '13:00', '15:30'],
    symbolsMode: 'top10',
    minScoreToAutoTrade: 58,
    minConfidence: 'medium',
    emailEnabled: false
  },
  autoTrade: {
    enabled: true,
    runOnRefresh: false,
    minScore: 58,
    minConfidence: 'medium',
    takeProfitPct: 7
  },
  email: {
    enabled: false,
    gmailUser: config.email.gmailUser,
    gmailAppPassword: config.email.gmailAppPassword,
    gmailTo: config.email.gmailTo
  }
};

export async function readSettings() {
  const stored = await readJson(SETTINGS_FILE, defaultSettings);
  return normalizeSettings(deepMerge(defaultSettings, stored));
}

export async function updateSettings(input) {
  const current = await readSettings();
  const next = normalizeSettings({
    ...current,
    activeSymbol: input.activeSymbol ?? current.activeSymbol,
    selectedSymbols: input.selectedSymbols ?? current.selectedSymbols,
    rankingUniverse: input.rankingUniverse ?? current.rankingUniverse,
    aiCron: {
      ...current.aiCron,
      ...(input.aiCron || {})
    },
    autoTrade: {
      ...current.autoTrade,
      ...(input.autoTrade || {})
    },
    email: {
      ...current.email,
      ...(input.email || {}),
      gmailAppPassword: input.email?.gmailAppPassword ? input.email.gmailAppPassword : current.email.gmailAppPassword
    }
  });
  await writeJson(SETTINGS_FILE, next);
  return next;
}

export function publicSettings(settings) {
  return {
    ...settings,
    selectedSymbols: normalizeStockList(settings.selectedSymbols).map((stock) => stock.yfSymbol),
    rankingUniverse: normalizeStockList(settings.rankingUniverse).map((stock) => stock.yfSymbol),
    email: {
      ...settings.email,
      gmailAppPassword: '',
      gmailAppPasswordSet: Boolean(settings.email.gmailAppPassword)
    }
  };
}

export function stocksForMode(settings, ranking = []) {
  if (settings.aiCron.symbolsMode === 'selected') {
    return normalizeStockList(settings.selectedSymbols);
  }
  const top = ranking.slice(0, 10).map((item) => item.stock || item);
  return normalizeStockList(top.length ? top : settings.selectedSymbols);
}

function normalizeSettings(settings) {
  const selected = normalizeStockList(settings.selectedSymbols);
  const universe = normalizeStockList(settings.rankingUniverse);
  const active = stockFromInput(settings.activeSymbol || selected[0]?.yfSymbol || defaultSettings.activeSymbol);

  return {
    activeSymbol: active.yfSymbol,
    selectedSymbols: selected.length ? selected.map((stock) => stock.yfSymbol) : defaultSettings.selectedSymbols,
    rankingUniverse: universe.length ? universe.map((stock) => stock.yfSymbol) : defaultSettings.rankingUniverse,
    aiCron: {
      enabled: Boolean(settings.aiCron?.enabled),
      times: normalizeTimes(settings.aiCron?.times || config.criticalHours),
      symbolsMode: settings.aiCron?.symbolsMode === 'selected' ? 'selected' : 'top10',
      minScoreToAutoTrade: boundedNumber(settings.aiCron?.minScoreToAutoTrade, 0, 100, 58),
      minConfidence: normalizeConfidence(settings.aiCron?.minConfidence),
      emailEnabled: Boolean(settings.aiCron?.emailEnabled)
    },
    autoTrade: {
      enabled: Boolean(settings.autoTrade?.enabled),
      runOnRefresh: Boolean(settings.autoTrade?.runOnRefresh),
      minScore: boundedNumber(settings.autoTrade?.minScore, 0, 100, 58),
      minConfidence: normalizeConfidence(settings.autoTrade?.minConfidence),
      takeProfitPct: boundedNumber(settings.autoTrade?.takeProfitPct, 0.5, 40, 7)
    },
    email: {
      enabled: Boolean(settings.email?.enabled),
      gmailUser: String(settings.email?.gmailUser || ''),
      gmailAppPassword: String(settings.email?.gmailAppPassword || ''),
      gmailTo: String(settings.email?.gmailTo || '')
    }
  };
}

function normalizeTimes(times) {
  const list = Array.isArray(times) ? times : String(times || '').split(',');
  const seen = new Set();
  return list
    .map((time) => String(time).trim())
    .filter((time) => /^\d{1,2}:\d{2}$/.test(time))
    .map((time) => {
      const [hour, minute] = time.split(':');
      return `${hour.padStart(2, '0')}:${minute}`;
    })
    .filter((time) => {
      if (seen.has(time)) return false;
      seen.add(time);
      return true;
    })
    .sort();
}

function normalizeConfidence(value) {
  return ['low', 'medium', 'high'].includes(value) ? value : 'medium';
}

function boundedNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return structuredClone(base);
  const output = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(output[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}
