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

    // Update the CallLog for this specific call
    await prisma.callLog.updateMany({
      where: { callSid },
      data: { status: callStatus, duration },
    });

    // If this call was answered, we need to cancel the other ringing calls in the batch
    if (callStatus === 'answered' || callStatus === 'in-progress') {
      console.log(`[Parallel Status] Call ${callSid} was answered. Canceling other calls in batch ${batchId}.`);
      
      const otherCalls = await prisma.callLog.findMany({
        where: {
          batchId,
          status: 'initiated', // Only cancel calls that are still ringing/initiated
          callSid: { not: callSid },
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
              console.log(`[Parallel Status] Successfully canceled ${otherCall.callSid}`);
              
              // Update DB to reflect cancellation
              await prisma.callLog.updateMany({
                where: { callSid: otherCall.callSid },
                data: { status: 'canceled' }
              });
              break; // Stop trying credentials once successful
            } catch (e: any) {
              // Expected if the credential doesn't own this CallSid
              if (e.status !== 404 && e.code !== 20404) {
                console.error(`[Parallel Status] Error canceling ${otherCall.callSid}:`, e.message);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Parallel status error:', error);
    return NextResponse.json({ success: false }); // Always return 2xx or 500
  }
}
