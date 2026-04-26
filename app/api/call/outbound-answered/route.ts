import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const childId = url.searchParams.get('childId') || 'unknown';
    const leadId = url.searchParams.get('leadId') || 'unknown';
    const masterSip = url.searchParams.get('masterSip');

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

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
        // Forward via SIP to Master Account, attaching headers
        dial.sip(`sip:AgentRoom_${childId}@${masterSip}?X-Child-Id=${childId}&X-Lead-Id=${leadId}`);
      }
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
