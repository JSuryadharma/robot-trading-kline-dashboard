import { config } from './config.js';

export const defaultUniverse = [
  { code: 'BBCA', yfSymbol: 'BBCA.JK', tvSymbol: 'IDX:BBCA', name: 'Bank Central Asia' },
  { code: 'BBRI', yfSymbol: 'BBRI.JK', tvSymbol: 'IDX:BBRI', name: 'Bank Rakyat Indonesia' },
  { code: 'BMRI', yfSymbol: 'BMRI.JK', tvSymbol: 'IDX:BMRI', name: 'Bank Mandiri' },
  { code: 'ANTM', yfSymbol: 'ANTM.JK', tvSymbol: 'IDX:ANTM', name: 'Aneka Tambang' },
  { code: 'TLKM', yfSymbol: 'TLKM.JK', tvSymbol: 'IDX:TLKM', name: 'Telkom Indonesia' },
  { code: 'ASII', yfSymbol: 'ASII.JK', tvSymbol: 'IDX:ASII', name: 'Astra International' },
  { code: 'UNTR', yfSymbol: 'UNTR.JK', tvSymbol: 'IDX:UNTR', name: 'United Tractors' },
  { code: 'ADRO', yfSymbol: 'ADRO.JK', tvSymbol: 'IDX:ADRO', name: 'Adaro Energy' },
  { code: 'AMMN', yfSymbol: 'AMMN.JK', tvSymbol: 'IDX:AMMN', name: 'Amman Mineral' },
  { code: 'BRPT', yfSymbol: 'BRPT.JK', tvSymbol: 'IDX:BRPT', name: 'Barito Pacific' },
  { code: 'INCO', yfSymbol: 'INCO.JK', tvSymbol: 'IDX:INCO', name: 'Vale Indonesia' },
  { code: 'MDKA', yfSymbol: 'MDKA.JK', tvSymbol: 'IDX:MDKA', name: 'Merdeka Copper Gold' },
  { code: 'PGAS', yfSymbol: 'PGAS.JK', tvSymbol: 'IDX:PGAS', name: 'Perusahaan Gas Negara' },
  { code: 'BBNI', yfSymbol: 'BBNI.JK', tvSymbol: 'IDX:BBNI', name: 'Bank Negara Indonesia' },
  { code: 'GOTO', yfSymbol: 'GOTO.JK', tvSymbol: 'IDX:GOTO', name: 'GoTo Gojek Tokopedia' }
];

export function defaultStock() {
  return stockFromParts(config.symbol, config.yfSymbol);
}

export function stockFromInput(input) {
  if (typeof input === 'object' && input?.yfSymbol) {
    return stockFromParts(input.tvSymbol, input.yfSymbol, input.name);
  }

  const raw = String(input || '').trim().toUpperCase();
  if (!raw) return defaultStock();
  const match = defaultUniverse.find((stock) => stock.yfSymbol === raw || stock.code === raw || stock.tvSymbol === raw);
  if (match) return { ...match };

  if (raw.includes(':')) {
    const [exchange, code] = raw.split(':');
    return stockFromParts(`${exchange}:${code}`, `${code}.JK`);
  }

  const yfSymbol = raw.endsWith('.JK') ? raw : `${raw}.JK`;
  return stockFromParts(`IDX:${yfSymbol.replace(/\.JK$/, '')}`, yfSymbol);
}

export function normalizeStockList(items) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    const stock = stockFromInput(item);
    if (!stock.yfSymbol || seen.has(stock.yfSymbol)) continue;
    seen.add(stock.yfSymbol);
    output.push(stock);
  }
  return output;
}

export function stockFromParts(tvSymbol, yfSymbol, name = '') {
  const normalizedYf = String(yfSymbol || '').trim().toUpperCase();
  const code = normalizedYf.replace(/\.JK$/, '').replace(/^IDX:/, '');
  return {
    code,
    yfSymbol: normalizedYf || `${code}.JK`,
    tvSymbol: String(tvSymbol || `IDX:${code}`).trim().toUpperCase(),
    name: name || code
  };
}

export function symbolsToText(stocks) {
  return normalizeStockList(stocks).map((stock) => stock.yfSymbol).join(', ');
}

export function parseSymbolText(text) {
  return String(text || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function monthsAgoDate(months, date = new Date()) {
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  cursor.setUTCMonth(cursor.getUTCMonth() - months);
  return cursor.toISOString().slice(0, 10);
}
