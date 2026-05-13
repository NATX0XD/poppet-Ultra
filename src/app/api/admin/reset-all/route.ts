import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { resetAllScores } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  
  await resetAllScores();
  return NextResponse.json({ status: 'ok' });
}
