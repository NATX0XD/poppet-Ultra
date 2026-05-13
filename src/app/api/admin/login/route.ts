import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_PASSWORD, ADMIN_SESSION } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (password === ADMIN_PASSWORD) {
      const response = NextResponse.json({ status: 'ok' });
      response.cookies.set('popcat_admin', ADMIN_SESSION, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
      return response;
    }
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
