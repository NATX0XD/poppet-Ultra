import { NextRequest } from 'next/server';
import { ADMIN_SESSION } from './db';

export function isAdmin(req: NextRequest): boolean {
  const cookieToken = req.cookies.get('popcat_admin')?.value;
  return cookieToken === ADMIN_SESSION;
}
