import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'leaderboard.json');
const STATE_FILE = path.join(process.cwd(), 'game_state.json');
const SKINS_FILE = path.join(process.cwd(), 'skins.json');

const LEADERBOARD_KEY = 'popcat:leaderboard';
const STATE_KEY = 'popcat:game-state';
const SKINS_KEY = 'popcat:skins';

const memoryJsonStore = new Map<string, unknown>();
const runtimeJsonDir = path.join('/tmp', 'popcat-data');
const mutableJsonFiles = new Set([DB_FILE, STATE_FILE, SKINS_FILE]);

export const ADMIN_SESSION = 'popcat_admin_session_token';
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

const lastSyncMap = new Map<string, { time: number; score: number }>();

function getRuntimeJsonPath(filePath: string) {
  if (!mutableJsonFiles.has(filePath)) {
    return filePath;
  }
  return path.join(runtimeJsonDir, path.basename(filePath));
}

function loadJson<T>(filePath: string, defaultValue: T): T {
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
      return parsed as T;
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
        // Best-effort cache for read-only deploy targets.
      }
      return parsed as T;
    }
  } catch {
    // Fall through to the default value.
  }

  memoryJsonStore.set(runtimePath, defaultValue);
  memoryJsonStore.set(filePath, defaultValue);
  return defaultValue;
}

function writeJsonFile(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function saveJson(filePath: string, data: unknown) {
  const runtimePath = getRuntimeJsonPath(filePath);
  memoryJsonStore.set(runtimePath, data);
  memoryJsonStore.set(filePath, data);

  try {
    writeJsonFile(runtimePath, data);
  } catch {
    // Keep the in-memory copy when the filesystem is not writable.
  }

  try {
    if (runtimePath !== filePath) {
      writeJsonFile(filePath, data);
    }
  } catch {
    // Local source file writes are optional.
  }
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function usingRedis() {
  return getRedisConfig() !== null;
}

async function redisCommand<T>(command: Array<string | number>): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) {
    return null;
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });

  const payload = (await response.json()) as { result?: T; error?: string };
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Redis request failed with status ${response.status}`);
  }

  return payload.result ?? null;
}

async function readStore<T>(redisKey: string, filePath: string, defaultValue: T): Promise<T> {
  if (usingRedis()) {
    const raw = await redisCommand<string>(['GET', redisKey]);
    if (!raw) {
      return defaultValue;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  return loadJson(filePath, defaultValue);
}

async function writeStore(redisKey: string, filePath: string, data: unknown) {
  if (usingRedis()) {
    await redisCommand(['SET', redisKey, JSON.stringify(data)]);
    return;
  }

  saveJson(filePath, data);
}

async function readLeaderboardData() {
  return readStore<Record<string, number>>(LEADERBOARD_KEY, DB_FILE, {});
}

async function writeLeaderboardData(data: Record<string, number>) {
  await writeStore(LEADERBOARD_KEY, DB_FILE, data);
}

async function readSkinsData() {
  return readStore<Record<string, string>>(SKINS_KEY, SKINS_FILE, {});
}

async function writeSkinsData(data: Record<string, string>) {
  await writeStore(SKINS_KEY, SKINS_FILE, data);
}

async function readStateData() {
  return readStore<GameState>(STATE_KEY, STATE_FILE, DEFAULT_STATE);
}

async function writeStateData(data: GameState) {
  await writeStore(STATE_KEY, STATE_FILE, data);
}

export async function registerPlayer(username: string) {
  const data = await readLeaderboardData();
  if (!(username in data)) {
    data[username] = 0;
    await writeLeaderboardData(data);
  }
}

export async function saveSkin(username: string, skinId: string) {
  const data = await readSkinsData();
  data[username] = skinId;
  await writeSkinsData(data);
}

export async function getPlayerSkins(): Promise<Record<string, string>> {
  return readSkinsData();
}

export async function loadState(): Promise<GameState> {
  const state = { ...DEFAULT_STATE, ...(await readStateData()) };
  let changed = false;
  const nowMs = Date.now();

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
    if (Number.isNaN(countdown)) {
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
        state.last_round_summary = await buildRoundSummary(state.round_start_scores);
        const clearedScores = await readLeaderboardData();
        for (const key of Object.keys(clearedScores)) {
          clearedScores[key] = 0;
        }
        await writeLeaderboardData(clearedScores);
        lastSyncMap.clear();
        changed = true;
      }
    }
  }

  if (changed) {
    await writeStateData(state);
  }

  return state;
}

export async function setGameState(updates: Partial<GameState>): Promise<GameState> {
  const state = await loadState();
  const newState = { ...state, ...updates };
  await writeStateData(newState);
  return newState;
}

export async function getLeaderboardItems(): Promise<Array<[string, number]>> {
  const data = await readLeaderboardData();
  return Object.entries(data).sort((a, b) => b[1] - a[1]);
}

export async function getLeaderboardMap(): Promise<Record<string, number>> {
  const items = await getLeaderboardItems();
  const result: Record<string, number> = {};

  for (const [name, score] of items) {
    result[name] = Number(score);
  }

  return result;
}

export async function buildRoundSummary(startScores: Record<string, number>): Promise<RoundSummary> {
  const [currentScores, skins] = await Promise.all([
    getLeaderboardMap(),
    getPlayerSkins(),
  ]);
  const names = Array.from(new Set([...Object.keys(startScores || {}), ...Object.keys(currentScores)]));

  const players: { name: string; score: number }[] = [];
  for (const name of names) {
    const prev = Number(startScores[name] || 0);
    const curr = Number(currentScores[name] || 0);
    const gained = curr - prev;
    if (gained > 0) {
      players.push({ name, score: gained });
    }
  }

  players.sort((a, b) => b.score - a.score);

  return {
    total_players: players.length,
    total_points: players.reduce((sum, player) => sum + player.score, 0),
    players,
    top3: players.slice(0, 3).map((player) => ({
      ...player,
      skin: skins[player.name] || '1',
    })),
  };
}

export async function saveScore(username: string, score: number): Promise<number | { error: string; message: string }> {
  const data = await readLeaderboardData();
  const currentDbScore = Number(data[username] || 0);
  const now = Date.now();

  if (!(username in data)) {
    return { error: 'player_deleted', message: '⚠️ ชื่อผู้ใช้ของคุณไม่มีอยู่ในระบบหรืออาจถูก Admin ลบออกแล้ว! กรุณาลงชื่อเข้าเล่นใหม่' };
  }

  const prev = lastSyncMap.get(username);
  if (prev) {
    const timeDiffSeconds = (now - prev.time) / 1000;
    const scoreDiff = score - prev.score;

    if (scoreDiff > 0) {
      const cps = scoreDiff / (timeDiffSeconds || 0.1);

      if (scoreDiff > 400 && currentDbScore > 0) {
        data[username] = 0;
        await writeLeaderboardData(data);
        lastSyncMap.set(username, { time: now, score: 0 });
        return { error: 'cheat_detected', message: '🚨 ตรวจพบคะแนนพุ่งกระฉูดระดับสั่นสะเทือนกาแล็กซี! ขอยึดคืนทั้งหมดเหลือ 0 คะแนนนะจ๊ะเด็กดื้อ 😉' };
      }

      if (cps > 65 && timeDiffSeconds > 0.5) {
        data[username] = 0;
        await writeLeaderboardData(data);
        lastSyncMap.set(username, { time: now, score: 0 });
        return { error: 'cheat_detected', message: '🚀 โถๆ... นิ้วทำด้วยไอพ่นนาซ่าเหรอจ๊ะ? เร็วทะลุโลกเกินมนุษย์ โดนล้างแต้มเป็น 0 ทันที!' };
      }
    }
  }

  const nextScore = Math.max(currentDbScore, score);
  lastSyncMap.set(username, { time: now, score: nextScore });
  data[username] = nextScore;
  await writeLeaderboardData(data);

  const sortedScores = Object.values(data).sort((a, b) => b - a);
  return sortedScores.indexOf(nextScore) + 1;
}

export async function deletePlayer(username: string) {
  const [scores, skins] = await Promise.all([
    readLeaderboardData(),
    readSkinsData(),
  ]);

  delete scores[username];
  delete skins[username];
  lastSyncMap.delete(username);

  await Promise.all([
    writeLeaderboardData(scores),
    writeSkinsData(skins),
  ]);
}

export async function resetPlayerScore(username: string) {
  const data = await readLeaderboardData();
  if (username in data) {
    data[username] = 0;
    await writeLeaderboardData(data);
    lastSyncMap.delete(username);
  }
}

export async function resetAllScores() {
  const data = await readLeaderboardData();
  for (const key of Object.keys(data)) {
    data[key] = 0;
  }
  await writeLeaderboardData(data);
  lastSyncMap.clear();
}
