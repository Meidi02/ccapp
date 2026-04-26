import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const { batchId, answeredCallSid, childId } = await request.json();

    if (!batchId || !answeredCallSid || !childId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    console.log(`[Cancel Others] Human answered call ${answeredCallSid}. Canceling other calls in batch ${batchId}.`);
    
    const otherCalls = await prisma.callLog.findMany({
      where: {
        batchId,
        status: 'initiated', // Only cancel calls that are still ringing/initiated
        callSid: { not: answeredCallSid },
      }
    });

    if (otherCalls.length > 0) {
      // Fetch credentials to cancel calls
      const assignedNumbers = await prisma.twilioNumber.findMany({ where: { assignedToId: childId } });
      
      for (const otherCall of otherCalls) {
        // Attempt to cancel using available credentials
        for (const numConfig of assignedNumbers) {
          try {
            const client = twilio(numConfig.accountSid, numConfig.authToken);
            await client.calls(otherCall.callSid).update({ status: 'canceled' });
            console.log(`[Cancel Others] Successfully canceled ${otherCall.callSid}`);
            
            // Update DB to reflect cancellation
            await prisma.callLog.updateMany({
              where: { callSid: otherCall.callSid },
              data: { status: 'canceled' }
            });

            await prisma.systemLog.create({
              data: {
                level: 'INFO', source: 'BACKEND',
                message: `Canceled ringing call ${otherCall.callSid} because batch ${batchId} was answered by a human.`,
                meta: { callSid: otherCall.callSid, batchId }
              }
            });
            break; // Stop trying credentials once successful
          } catch (e: any) {
            // Expected if the credential doesn't own this CallSid
            if (e.status !== 404 && e.code !== 20404) {
              console.error(`[Cancel Others] Error canceling ${otherCall.callSid}:`, e.message);
              await prisma.systemLog.create({
                data: {
                  level: 'ERROR', source: 'TWILIO',
                  message: `Failed to cancel call ${otherCall.callSid}: ${e.message}`,
                  meta: { error: e.message }
                }
              }).catch(() => {});
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Cancel others error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
