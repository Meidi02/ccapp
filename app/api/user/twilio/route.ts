import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const numbers = await prisma.twilioNumber.findMany({
      where: { assignedToId: userId },
      select: { id: true, phoneNumber: true }, // ONLY send non-sensitive data
    });
    return NextResponse.json(numbers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch assigned Twilio numbers' }, { status: 500 });
  }
}
