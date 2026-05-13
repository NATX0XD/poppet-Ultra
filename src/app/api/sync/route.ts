import { NextRequest, NextResponse } from 'next/server';
import { loadState, saveScore, saveSkin } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { username, score, skinId } = await req.json();
    if (!username || typeof score !== 'number') {
      return NextResponse.json({ error: 'bad request' }, { status: 400 });
    }
    const state = await loadState();
    if (state.phase !== 'casual' && state.phase !== 'competitive' && state.phase !== 'ending') {
      return NextResponse.json({
        status: 'round_transition',
        reset_local: true,
      });
    }
    if (skinId) {
      await saveSkin(username, skinId);
    }
    const result = await saveScore(username, score);
    if (typeof result === 'object' && result !== null && 'error' in result) {
      return NextResponse.json({ 
        status: 'failed', 
        error: result.error, 
        message: result.message, 
        wipe_local: true 
      });
    }
    return NextResponse.json({ status: 'success', rank: result });
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
