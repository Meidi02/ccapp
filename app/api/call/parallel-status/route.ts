import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const batchId = url.searchParams.get('batchId');
    const childId = url.searchParams.get('childId');

    const formData = await request.formData();
    const callStatus = formData.get('CallStatus')?.toString() || '';
    const callSid = formData.get('CallSid')?.toString() || '';
    const duration = parseInt(formData.get('DialCallDuration')?.toString() || '0');

    if (!batchId || !childId || !callSid) {
      return NextResponse.json({ success: true }); // Twilio requires 200 OK
    }

    // Update the CallLog for this specific call, but protect 'answered-human' and 'voicemail'
    const existingLog = await prisma.callLog.findFirst({ where: { callSid } });
    if (existingLog && (existingLog.status === 'answered-human' || existingLog.status === 'voicemail') && (callStatus === 'in-progress' || callStatus === 'completed')) {
      await prisma.callLog.updateMany({
        where: { callSid },
        data: { duration }, // Only update duration, keep status
      });
    } else {
      await prisma.callLog.updateMany({
        where: { callSid },
        data: { status: callStatus, duration },
      });
    }

    await prisma.systemLog.create({
      data: {
        level: 'INFO', source: 'TWILIO',
        message: `Status Webhook: Call ${callSid} status changed to ${callStatus}`,
        meta: { batchId, childId, callStatus, duration }
      }
    });

    // Note: We no longer cancel other calls here when status is 'answered' or 'in-progress'.
    // With AMD enabled, 'answered' just means the phone was picked up (could be voicemail).
    // Cancellation of other legs is now handled by /api/call/outbound-answered ONLY when a human is detected.

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Parallel status error:', error);
    await prisma.systemLog.create({
      data: {
        level: 'ERROR', source: 'BACKEND',
        message: `Status Webhook Error: ${error.message || error}`,
        meta: { error: error.message || String(error) }
      }
    }).catch(() => {});
    return NextResponse.json({ success: false }); // Always return 2xx or 500
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const batchId = url.searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
    }

    const allCalls = await prisma.callLog.findMany({
      where: { batchId }
    });

    const answeredCall = allCalls.find(c => c.status === 'answered-human');

    return NextResponse.json({ 
      answeredCall: answeredCall || null,
      allCalls 
    });
  } catch (error: any) {
    console.error('Poll batch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
