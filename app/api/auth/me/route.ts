import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  const username = request.headers.get('x-user-username');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ userId, role, username });
}
