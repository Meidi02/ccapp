import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const childId = url.searchParams.get('childId') || 'unknown';
    const leadId = url.searchParams.get('leadId') || 'unknown';
    const masterSip = url.searchParams.get('masterSip');
    // Parse Twilio AMD results
    const formData = await request.formData();
    const answeredBy = formData.get('AnsweredBy')?.toString() || 'unknown';
    const callSid = formData.get('CallSid')?.toString() || '';
    const batchId = url.searchParams.get('batchId') || '';
    
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    console.log(`[Outbound Answered] Lead ${leadId} answered by: ${answeredBy}`);

    // If it's a machine, hang up this leg. Do NOT cancel the other calls in the batch.
    if (answeredBy === 'machine_start' || answeredBy === 'machine_end_beep' || answeredBy === 'machine_end_silence' || answeredBy === 'machine_end_other') {
      await prisma.callLog.updateMany({
        where: { callSid },
        data: { status: 'voicemail' }
      });
      response.hangup();
      return new NextResponse(response.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // It's a human (or unknown, which we assume is human for safety)
    if (batchId && callSid) {
      const alreadyAnswered = await prisma.callLog.findFirst({
        where: {
          batchId,
          status: 'answered-human',
          callSid: { not: callSid }
        }
      });

      if (alreadyAnswered) {
        console.log(`[Outbound Answered] Lead ${leadId} answered, but batch ${batchId} already has a connected human. Hanging up to prevent double connect.`);
        response.hangup();
        return new NextResponse(response.toString(), {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      // Mark this call as the winner
      await prisma.callLog.updateMany({
        where: { callSid },
        data: { status: 'answered-human' }
      });
    }

    if (!masterSip) {
      response.say('System error. Missing SIP domain.');
    } else {
      const useConference = url.searchParams.get('useConference') === 'true';
      if (useConference) {
        console.log(`[Outbound Answered] Lead ${leadId} answered. Joining Conference directly (Same Account).`);
        const dial = response.dial();
        dial.conference({
          endConferenceOnExit: false,
        }, `AgentRoom_${childId}`);
      } else {
        console.log(`[Outbound Answered] Lead ${leadId} answered. Forwarding to SIP: ${masterSip}`);
        const dial = response.dial();
        dial.sip(`sip:AgentRoom_${childId}@${masterSip}?X-Child-Id=${childId}&X-Lead-Id=${leadId}`);
      }
    }

    // Fire off async cancellation of other calls since we found our human
    if (batchId && callSid) {
      fetch(`${url.origin}/api/call/cancel-others`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, answeredCallSid: callSid, childId })
      }).catch(e => console.error("Failed to trigger cancel-others:", e));
    }

    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('Outbound answered error:', error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred connecting your call.');
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
