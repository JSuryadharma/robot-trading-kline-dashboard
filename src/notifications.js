import { config } from './config.js';
import { readJson, writeJson } from './storage.js';
import crypto from 'node:crypto';

const NOTIFICATIONS_FILE = 'notifications.json';
const defaultNotifications = { items: [] };

export class NotificationCenter {
  constructor() {
    this.broadcast = null;
  }

  setBroadcast(fn) {
    this.broadcast = fn;
  }

  async list() {
    const state = await readJson(NOTIFICATIONS_FILE, defaultNotifications);
    return state.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async notify({ title, message, level = 'info', category = 'system', metadata = {}, telegram = true }) {
    const state = await readJson(NOTIFICATIONS_FILE, defaultNotifications);
    const item = {
      id: cryptoRandomId(),
      title,
      message,
      level,
      category,
      metadata,
      read: false,
      createdAt: new Date().toISOString()
    };
    state.items.unshift(item);
    state.items = state.items.slice(0, 160);
    await writeJson(NOTIFICATIONS_FILE, state);

    if (this.broadcast) {
      this.broadcast({ type: 'notification', payload: item });
    }

    if (telegram) {
      await this.sendTelegram(item);
    }
    return item;
  }

  async markRead(ids = []) {
    const state = await readJson(NOTIFICATIONS_FILE, defaultNotifications);
    const idSet = new Set(ids);
    for (const item of state.items) {
      if (idSet.size === 0 || idSet.has(item.id)) item.read = true;
    }
    await writeJson(NOTIFICATIONS_FILE, state);
    return state.items;
  }

  async sendTelegram(item) {
    if (!config.telegram.botToken || !config.telegram.chatId) return;
    const text = [
      `Robot Trading: ${item.title}`,
      item.message,
      `Level: ${item.level}`,
      `Time: ${item.createdAt}`
    ].join('\n');

    try {
      await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegram.chatId,
          text,
          disable_web_page_preview: true
        })
      });
    } catch (error) {
      console.warn('Telegram notification failed:', error.message);
    }
  }
}

function cryptoRandomId() {
  return crypto.randomBytes(12).toString('hex');
}
