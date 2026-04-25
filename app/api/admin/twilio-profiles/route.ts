import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'MASTER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const profiles = await prisma.twilioAccountProfile.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(profiles);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'MASTER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { name, accountSid, authToken } = await request.json();
    
    if (!name || !accountSid || !authToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const profile = await prisma.twilioAccountProfile.create({
      data: { name, accountSid, authToken }
    });

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
