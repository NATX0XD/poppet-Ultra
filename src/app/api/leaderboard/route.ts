import { NextResponse } from 'next/server';
import { getLeaderboardItems } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = (await getLeaderboardItems()).slice(0, 3);
  const leaderboard = items.map(([name, score]) => ({ name, score }));
  return NextResponse.json(leaderboard);
}
