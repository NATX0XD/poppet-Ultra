import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getLeaderboardItems, getPlayerSkins, loadState } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const items = getLeaderboardItems();
  const skins = getPlayerSkins();
  const state = loadState();
  const startScores = state.round_start_scores || {};

  const players = items.map(([name, score], idx) => ({
    name,
    score: Number(score),
    rank: idx + 1,
    skin: skins[name] || 'default',
    roundScore: (state.phase === 'competitive' || state.phase === 'ending' || state.phase === 'summary')
      ? Math.max(0, Number(score) - Number(startScores[name] || 0))
      : null,
  }));

  return NextResponse.json({
    players,
    count: players.length,
    phase: state.phase,
  });
}
