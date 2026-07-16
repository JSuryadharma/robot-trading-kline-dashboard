import crypto from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './storage.js';

const USERS_FILE = 'users.json';
const SESSIONS_FILE = 'sessions.json';

const defaultUsers = { users: [] };
const defaultSessions = { sessions: [] };

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120_000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, record) {
  const candidate = hashPassword(password, record.salt);
  return crypto.timingSafeEqual(Buffer.from(candidate.hash, 'hex'), Buffer.from(record.hash, 'hex'));
}

export async function initAuth() {
  const users = await readJson(USERS_FILE, defaultUsers);
  if (!users.users.some((user) => user.username === config.auth.defaultUsername)) {
    const password = hashPassword(config.auth.defaultPassword);
    users.users.push({
      username: config.auth.defaultUsername,
      ...password,
      createdAt: new Date().toISOString()
    });
    await writeJson(USERS_FILE, users);
  }
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export async function login(username, password) {
  const users = await readJson(USERS_FILE, defaultUsers);
  const user = users.users.find((item) => item.username === username);
  if (!user || !verifyPassword(password, user)) {
    return null;
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + config.auth.sessionDays * 24 * 60 * 60 * 1000;
  const sessions = await readJson(SESSIONS_FILE, defaultSessions);
  sessions.sessions = sessions.sessions.filter((session) => session.expiresAt > Date.now());
  sessions.sessions.push({ token, username, expiresAt, createdAt: new Date().toISOString() });
  await writeJson(SESSIONS_FILE, sessions);

  return {
    token,
    username,
    expiresAt
  };
}

export async function logout(token) {
  if (!token) return;
  const sessions = await readJson(SESSIONS_FILE, defaultSessions);
  sessions.sessions = sessions.sessions.filter((session) => session.token !== token);
  await writeJson(SESSIONS_FILE, sessions);
}

export async function authenticateRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.rt_session;
  if (!token) return null;
  const sessions = await readJson(SESSIONS_FILE, defaultSessions);
  const session = sessions.sessions.find((item) => item.token === token && item.expiresAt > Date.now());
  if (!session) return null;
  return { username: session.username, token };
}

export async function changePassword(username, oldPassword, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' };
  }
  const users = await readJson(USERS_FILE, defaultUsers);
  const user = users.users.find((item) => item.username === username);
  if (!user || !verifyPassword(oldPassword, user)) {
    return { ok: false, error: 'Current password is incorrect.' };
  }
  const password = hashPassword(newPassword);
  user.salt = password.salt;
  user.hash = password.hash;
  user.updatedAt = new Date().toISOString();
  await writeJson(USERS_FILE, users);
  return { ok: true };
}

export function sessionCookie(session) {
  const maxAge = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));
  return `rt_session=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export const clearSessionCookie = 'rt_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
