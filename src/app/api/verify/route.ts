import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboardMap } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ valid: false });
    }
    const db = getLeaderboardMap();
    // Player exists if they are in the DB (even with score 0 from registration)
    const exists = username in db;
    return NextResponse.json({ valid: exists });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
