import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await prisma.dialerConfig.findUnique({
      where: { userId },
    });
    return NextResponse.json(config || { maxParallelDials: 1 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dialer config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { maxParallelDials } = await request.json();
    
    // Validate value between 1 and 10
    const value = Math.max(1, Math.min(10, Number(maxParallelDials) || 1));

    const config = await prisma.dialerConfig.upsert({
      where: { userId },
      update: { maxParallelDials: value },
      create: { userId, maxParallelDials: value },
    });
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update dialer config' }, { status: 500 });
  }
}
