import { NextRequest, NextResponse } from 'next/server';
import { registerPlayer } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json({ success: false, message: 'ชื่อไม่ถูกต้อง' });
    }

    const safeUsername = username.trim();
    await registerPlayer(safeUsername);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: 'การลงทะเบียนล้มเหลว' });
  }
}
