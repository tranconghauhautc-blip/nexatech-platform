import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../lib/server-session';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    email: session.email,
    roles: session.roles,
  });
}
