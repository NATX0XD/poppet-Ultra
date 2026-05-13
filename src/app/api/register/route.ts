import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboardMap, saveJson, loadJson } from '@/lib/db';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'leaderboard.json');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json({ success: false, message: 'ชื่อไม่ถูกต้อง' });
    }

    const safeUsername = username.trim();
    const data = loadJson<Record<string, number>>(DB_FILE, {});

    // If player already exists, that's fine, they are registered
    if (!(safeUsername in data)) {
      data[safeUsername] = 0;
      saveJson(DB_FILE, data);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: 'การลงทะเบียนล้มเหลว' });
  }
}
