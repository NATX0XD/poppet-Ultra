import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { deletePlayer } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { username } = await req.json();
    if (!username) {
      return NextResponse.json({ error: 'bad request' }, { status: 400 });
    }
    await deletePlayer(username);
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
