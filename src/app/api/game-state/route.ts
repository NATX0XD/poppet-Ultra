import { NextResponse } from 'next/server';
import { loadState } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = loadState();
  return NextResponse.json(state);
}
