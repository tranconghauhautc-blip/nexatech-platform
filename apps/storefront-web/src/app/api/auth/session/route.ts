import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      email: session.email,
      fullName: session.fullName,
      roles: session.roles,
    },
  });
}
