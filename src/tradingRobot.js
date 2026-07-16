import { config } from './config.js';
import { readJson, writeJson } from './storage.js';

const STATE_FILE = 'trading-state.json';

function defaultState() {
  return {
    balance: config.initialBalance,
    initialBalance: config.initialBalance,
    realizedProfit: 0,
    positions: {},
    transactions: [],
    updatedAt: new Date().toISOString()
  };
}

export class TradingRobot {
  async getPortfolio() {
    return await readJson(STATE_FILE, defaultState());
  }

  async applyDecision(snapshot, decision, reason = 'auto', { execute = true } = {}) {
    const portfolio = await this.getPortfolio();
    const latest = snapshot.latest;
    if (!latest || !Number.isFinite(latest.close)) {
      return { portfolio, transaction: null, note: 'No price available.' };
    }
    if (!execute) {
      return { portfolio, transaction: null, note: 'Trade policy blocked execution.' };
    }

    let transaction = null;
    if (decision.action === 'BUY') {
      transaction = executeBuy(portfolio, snapshot.symbol, latest.close, reason);
    } else if (decision.action === 'SELL') {
      transaction = executeSell(portfolio, snapshot.symbol, latest.close, reason);
    }

    portfolio.updatedAt = new Date().toISOString();
    if (transaction) {
      portfolio.transactions.unshift(transaction);
      portfolio.transactions = portfolio.transactions.slice(0, 250);
      await writeJson(STATE_FILE, portfolio);
    } else {
      await writeJson(STATE_FILE, portfolio);
    }

    return { portfolio, transaction };
  }
}

function executeBuy(portfolio, symbol, price, reason) {
  const existing = portfolio.positions[symbol];
  if (existing?.quantity > 0) return null;

  const maxPortfolioValue = portfolio.initialBalance * config.maxPositionPct;
  const rawSpend = Math.min(portfolio.balance * config.tradeAllocationPct, maxPortfolioValue, portfolio.balance);
  const quantity = normalizeQuantity(rawSpend / price);
  const cost = roundMoney(quantity * price);

  if (quantity <= 0 || cost <= 0 || cost > portfolio.balance) return null;
  portfolio.balance = roundMoney(portfolio.balance - cost);
  portfolio.positions[symbol] = {
    symbol,
    quantity,
    averagePrice: price,
    invested: cost,
    openedAt: new Date().toISOString()
  };

  return {
    id: transactionId(),
    type: 'BUY',
    symbol,
    quantity,
    price,
    gross: cost,
    realizedProfit: 0,
    balanceAfter: portfolio.balance,
    reason,
    createdAt: new Date().toISOString()
  };
}

function executeSell(portfolio, symbol, price, reason) {
  const position = portfolio.positions[symbol];
  if (!position?.quantity) return null;

  const gross = roundMoney(position.quantity * price);
  const basis = roundMoney(position.quantity * position.averagePrice);
  const realizedProfit = roundMoney(gross - basis);
  portfolio.balance = roundMoney(portfolio.balance + gross);
  portfolio.realizedProfit = roundMoney((portfolio.realizedProfit || 0) + realizedProfit);
  delete portfolio.positions[symbol];

  return {
    id: transactionId(),
    type: 'SELL',
    symbol,
    quantity: position.quantity,
    price,
    gross,
    realizedProfit,
    balanceAfter: portfolio.balance,
    reason,
    createdAt: new Date().toISOString()
  };
}

function normalizeQuantity(rawQuantity) {
  const lotSize = Math.max(1, config.lotSize);
  if (lotSize === 1) return Math.floor(rawQuantity * 10000) / 10000;
  return Math.floor(rawQuantity / lotSize) * lotSize;
}

function transactionId() {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}
