import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'MASTER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const numbers = await prisma.twilioNumber.findMany({
      include: { assignedTo: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(numbers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Twilio numbers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'MASTER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { phoneNumber, accountSid, authToken, assignedToId } = await request.json();

    if (!phoneNumber || !accountSid || !authToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newNumber = await prisma.twilioNumber.create({
      data: {
        phoneNumber,
        accountSid,
        authToken,
        assignedToId: assignedToId || null,
      },
      include: { assignedTo: { select: { username: true } } },
    });

    return NextResponse.json(newNumber, { status: 201 });
  } catch (error) {
    console.error('Failed to add Twilio number:', error);
    return NextResponse.json({ error: 'Failed to add Twilio number' }, { status: 500 });
  }
}
