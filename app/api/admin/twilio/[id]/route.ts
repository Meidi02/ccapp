import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = request.headers.get('x-user-role');
  if (role !== 'MASTER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await prisma.twilioNumber.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete Twilio number' }, { status: 500 });
  }
}
