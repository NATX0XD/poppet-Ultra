import { NextRequest, NextResponse } from 'next/server';
import { saveScore, saveSkin } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { username, score, skinId } = await req.json();
    if (!username || typeof score !== 'number') {
      return NextResponse.json({ error: 'bad request' }, { status: 400 });
    }
    if (skinId) {
      saveSkin(username, skinId);
    }
    const result = saveScore(username, score);
    if (typeof result === 'object' && result !== null && 'error' in result) {
      return NextResponse.json({ 
        status: 'failed', 
        error: result.error, 
        message: result.message, 
        wipe_local: true 
      });
    }
    return NextResponse.json({ status: 'success', rank: result });
  } catch (e) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
