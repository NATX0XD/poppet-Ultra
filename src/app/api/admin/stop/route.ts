import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { loadState, setGameState, buildRoundSummary, getLeaderboardMap } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  
  try {
    const payload = await req.json().catch(() => ({}));
    let delaySeconds = payload.end_delay_seconds ?? 5;
    delaySeconds = Math.max(0, Number(delaySeconds) || 5);

    const countdownUntil = Date.now() + delaySeconds * 1000;

    const stoppedState = setGameState({
      phase: 'ending',
      countdown_until: countdownUntil,
    });

    return NextResponse.json(stoppedState);
  } catch (e) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
