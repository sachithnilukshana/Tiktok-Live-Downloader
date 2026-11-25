import fs from 'node:fs/promises';
import path from 'node:path';

// Honour $STATE_DIR (set by Docker/Render) so state survives container restarts
// when a persistent volume is mounted at /data.
const stateDir = process.env.STATE_DIR || 'data';
const file = path.resolve(stateDir, 'state.json');
let state = { creators: [], recordings: [] };

export async function loadState() {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    state = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(state.creators)) state.creators = [];
    if (!Array.isArray(state.recordings)) state.recordings = [];
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    await saveState();
  }
  return state;
}
export function getState() { return state; }
export async function saveState() {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
}
export async function addCreator(username) {
  const clean = username.replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{2,24}$/.test(clean)) throw new Error('Enter a valid TikTok username (2–24 letters, numbers, dots or underscores).');
  if (state.creators.some(x => x.username === clean)) return false;
  state.creators.push({ username: clean, enabled: true, createdAt: new Date().toISOString() });
  await saveState();
  return true;
}
export async function removeCreator(username) {
  const clean = username.replace(/^@/, '').toLowerCase();
  const before = state.creators.length;
  state.creators = state.creators.filter(x => x.username !== clean);
  await saveState();
  return state.creators.length !== before;
}
export async function addRecording(recording) {
  state.recordings.unshift(recording);
  state.recordings = state.recordings.slice(0, 500);
  await saveState();
}
