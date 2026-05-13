import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'leaderboard.json');
const STATE_FILE = path.join(process.cwd(), 'game_state.json');

const SKINS_FILE = path.join(process.cwd(), 'skins.json');
const memoryJsonStore = new Map<string, unknown>();
const runtimeJsonDir = path.join('/tmp', 'popcat-data');
const mutableJsonFiles = new Set([DB_FILE, STATE_FILE, SKINS_FILE]);

function getRuntimeJsonPath(filePath: string) {
  if (!mutableJsonFiles.has(filePath)) {
    return filePath;
  }
  return path.join(runtimeJsonDir, path.basename(filePath));
}

export const ADMIN_SESSION = 'popcat_admin_session_token'; // Simple session token for demo
export const ADMIN_PASSWORD = process.env.POPCAT_ADMIN_PASSWORD || '@TCT_KMUTNB#PopCat_Ops^2026!';

export type GamePhase = 'casual' | 'starting' | 'competitive' | 'ending' | 'summary';

export interface RoundSummary {
  total_players: number;
  total_points: number;
  players: { name: string; score: number }[];
  top3: { name: string; score: number; skin: string }[];
}

export interface GameState {
  phase: GamePhase;
  countdown_until: number | null;
  start_at: number | null;
  round_id: number;
  round_started_at: number | null;
  round_ended_at: number | null;
  round_start_scores: Record<string, number>;
  last_round_summary: RoundSummary | null;
}

const DEFAULT_STATE: GameState = {
  phase: 'casual',
  countdown_until: null,
  start_at: null,
  round_id: 0,
  round_started_at: null,
  round_ended_at: null,
  round_start_scores: {},
  last_round_summary: null,
};

export function loadJson<T>(filePath: string, defaultValue: T): T {
  const runtimePath = getRuntimeJsonPath(filePath);
  if (memoryJsonStore.has(runtimePath)) {
    return memoryJsonStore.get(runtimePath) as T;
  }
  if (memoryJsonStore.has(filePath)) {
    return memoryJsonStore.get(filePath) as T;
  }

  try {
    if (fs.existsSync(runtimePath)) {
      const data = fs.readFileSync(runtimePath, 'utf-8');
      const parsed = JSON.parse(data);
      memoryJsonStore.set(runtimePath, parsed);
      memoryJsonStore.set(filePath, parsed);
      return parsed;
    }

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      memoryJsonStore.set(runtimePath, parsed);
      memoryJsonStore.set(filePath, parsed);
      try {
        fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
        fs.writeFileSync(runtimePath, JSON.stringify(parsed, null, 2), 'utf-8');
      } catch {
        // Runtime path is best-effort; fallback remains in-memory.
      }
      return parsed;
    }
  } catch {}

  memoryJsonStore.set(runtimePath, defaultValue);
  memoryJsonStore.set(filePath, defaultValue);
  return defaultValue;
}

function writeJsonFile(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function saveJson(filePath: string, data: unknown) {
  const runtimePath = getRuntimeJsonPath(filePath);
  memoryJsonStore.set(runtimePath, data);
  memoryJsonStore.set(filePath, data);

  try {
    writeJsonFile(runtimePath, data);
  } catch {
    // Deploy targets with read-only project directories still keep the live runtime state.
  }
  try {
    if (runtimePath !== filePath) {
      writeJsonFile(filePath, data);
    }
  } catch {
    // Best-effort only; the runtime copy already carries the current state.
  }
}

export function saveSkin(username: string, skinId: string) {
  const data = loadJson<Record<string, string>>(SKINS_FILE, {});
  data[username] = skinId;
  saveJson(SKINS_FILE, data);
}

export function getPlayerSkins(): Record<string, string> {
  return loadJson<Record<string, string>>(SKINS_FILE, {});
}

export function loadState(): GameState {
  const state = { ...DEFAULT_STATE, ...loadJson(STATE_FILE, DEFAULT_STATE) };
  let changed = false;
  const nowMs = Date.now();

  // Backward compatibility: If it has 'running' from old state, convert it to phase
  if ('running' in state) {
    const legacyState = state as GameState & { running?: boolean };
    if (legacyState.running && state.phase === 'casual') {
      state.phase = 'competitive';
    }
    delete legacyState.running;
    changed = true;
  }

  if (typeof state.round_start_scores !== 'object' || state.round_start_scores === null) {
    state.round_start_scores = {};
    changed = true;
  }

  if (state.countdown_until !== null) {
    const countdown = Number(state.countdown_until);
    if (isNaN(countdown)) {
      state.countdown_until = null;
      changed = true;
    } else if (nowMs >= countdown) {
      if (state.phase === 'starting') {
        state.phase = 'competitive';
        state.start_at = countdown;
        state.round_started_at = countdown;
        state.countdown_until = null;
        changed = true;
      } else if (state.phase === 'ending') {
        state.phase = 'summary';
        state.round_ended_at = countdown;
        state.countdown_until = null;
        state.last_round_summary = buildRoundSummary(state.round_start_scores);
        changed = true;
      }
    }
  }

  if (changed) {
    saveJson(STATE_FILE, state);
  }
  return state;
}

export function setGameState(updates: Partial<GameState>): GameState {
  const state = loadState();
  const newState = { ...state, ...updates };
  saveJson(STATE_FILE, newState);
  return newState;
}

export function getLeaderboardItems(): [string, number][] {
  const data = loadJson<Record<string, number>>(DB_FILE, {});
  return Object.entries(data).sort((a, b) => b[1] - a[1]);
}

export function getLeaderboardMap(): Record<string, number> {
  const items = getLeaderboardItems();
  const res: Record<string, number> = {};
  for (const [name, score] of items) {
    res[name] = Number(score);
  }
  return res;
}

export function buildRoundSummary(startScores: Record<string, number>) {
  const currentScores = getLeaderboardMap();
  const start = startScores || {};
  const names = Array.from(new Set([...Object.keys(start), ...Object.keys(currentScores)]));
  
  const players: { name: string; score: number }[] = [];
  for (const name of names) {
    const prev = Number(start[name] || 0);
    const curr = Number(currentScores[name] || 0);
    const gained = curr - prev;
    if (gained > 0) {
      players.push({ name, score: gained });
    }
  }

  players.sort((a, b) => b.score - a.score);

  const top3 = players.slice(0, 3).map(p => ({
    ...p,
    skin: getPlayerSkins()[p.name] || '1'
  }));

  return {
    total_players: players.length,
    total_points: players.reduce((sum, p) => sum + p.score, 0),
    players,
    top3,
  };
}

// In-memory cache to prevent rate limit / cheating via F12 hacks
const lastSyncMap = new Map<string, { time: number; score: number }>();

export function saveScore(username: string, score: number): number | { error: string; message: string } {
  const data = loadJson<Record<string, number>>(DB_FILE, {});
  const currentDbScore = Number(data[username] || 0);
  const now = Date.now();

  // Prevent auto-resurrection! If player is not in DB, they were likely deleted by Admin!
  if (!(username in data)) {
    return { error: 'player_deleted', message: '⚠️ ชื่อผู้ใช้ของคุณไม่มีอยู่ในระบบหรืออาจถูก Admin ลบออกแล้ว! กรุณาลงชื่อเข้าเล่นใหม่' };
  }

  const prev = lastSyncMap.get(username);
  if (prev) {
    const timeDiffSeconds = (now - prev.time) / 1000;
    const scoreDiff = score - prev.score;

    // Only check if score is going up (not reset)
    if (scoreDiff > 0) {
      const cps = scoreDiff / (timeDiffSeconds || 0.1);

      // Giant jump: only flag if DB score wasn't recently wiped (currentDbScore > 0 means no fresh reset)
      if (scoreDiff > 400 && currentDbScore > 0) {
        data[username] = 0;
        saveJson(DB_FILE, data);
        lastSyncMap.set(username, { time: now, score: 0 });
        return { error: 'cheat_detected', message: '🚨 ตรวจพบคะแนนพุ่งกระฉูดระดับสั่นสะเทือนกาแล็กซี! ขอยึดคืนทั้งหมดเหลือ 0 คะแนนนะจ๊ะเด็กดื้อ 😉' };
      }

      if (cps > 65 && timeDiffSeconds > 0.5) {
        data[username] = 0;
        saveJson(DB_FILE, data);
        lastSyncMap.set(username, { time: now, score: 0 });
        return { error: 'cheat_detected', message: '🚀 โถๆ... นิ้วทำด้วยไอพ่นนาซ่าเหรอจ๊ะ? เร็วทะลุโลกเกินมนุษย์ โดนล้างแต้มเป็น 0 ทันที!' };
      }
    }
  }

  lastSyncMap.set(username, { time: now, score: Math.max(currentDbScore, score) });
  data[username] = Math.max(currentDbScore, score);
  saveJson(DB_FILE, data);

  const sortedScores = Object.values(data).sort((a, b) => b - a);
  return sortedScores.indexOf(data[username]) + 1;
}

export function deletePlayer(username: string) {
  const data = loadJson<Record<string, number>>(DB_FILE, {});
  delete data[username];
  saveJson(DB_FILE, data);
}

export function resetPlayerScore(username: string) {
  const data = loadJson<Record<string, number>>(DB_FILE, {});
  if (username in data) {
    data[username] = 0;
    saveJson(DB_FILE, data);
    lastSyncMap.delete(username);
  }
}

export function resetAllScores() {
  const data = loadJson<Record<string, number>>(DB_FILE, {});
  for (const key of Object.keys(data)) {
    data[key] = 0;
  }
  saveJson(DB_FILE, data);
  lastSyncMap.clear();
}
