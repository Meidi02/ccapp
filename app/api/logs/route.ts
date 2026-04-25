import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    await prisma.systemLog.create({
      data: {
        level: data.level || 'INFO',
        source: data.source || 'FRONTEND',
        message: data.message || 'Unknown event',
        meta: data.meta || null,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to write log", error);
    return NextResponse.json({ error: 'Failed to write log' }, { status: 500 });
  }
}
