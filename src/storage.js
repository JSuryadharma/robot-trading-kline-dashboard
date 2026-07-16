import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export async function ensureDataDir() {
  await fs.mkdir(config.dataDir, { recursive: true });
}

export function dataPath(fileName) {
  return path.join(config.dataDir, fileName);
}

export async function readJson(fileName, fallback) {
  await ensureDataDir();
  try {
    const content = await fs.readFile(dataPath(fileName), 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(fallback);
    console.warn(`Could not read ${fileName}:`, error.message);
    return structuredClone(fallback);
  }
}

export async function writeJson(fileName, value) {
  await ensureDataDir();
  const target = dataPath(fileName);
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, target);
}

export function publicState(state) {
  return JSON.parse(JSON.stringify(state));
}
