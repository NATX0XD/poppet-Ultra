import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { loadState, setGameState, getLeaderboardMap, resetAllScores } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const payload = await req.json();
    let delaySeconds = payload.delay_seconds ?? 5;
    delaySeconds = Math.max(0, Number(delaySeconds) || 5);

    const countdownUntil = Date.now() + delaySeconds * 1000;
    const currentState = loadState();

    resetAllScores(); // Wipe casual scores

    const newState = setGameState({
      phase: 'starting',
      countdown_until: countdownUntil,
      start_at: null,
      round_started_at: null,
      round_ended_at: null,
      round_id: (currentState.round_id || 0) + 1,
      round_start_scores: {}, // Since everyone starts from 0
      last_round_summary: null,
    });

    return NextResponse.json(newState);
  } catch (e) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
