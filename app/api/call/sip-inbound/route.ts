import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const childId = formData.get('SipHeader_X-Child-Id') || 'unknown';
    const leadId = formData.get('SipHeader_X-Lead-Id') || 'unknown';

    console.log(`[SIP Inbound] Received SIP call for child ${childId}, lead ${leadId}`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    // Drop the caller into the agent's conference room
    const dial = response.dial();
    dial.conference({
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
    }, `AgentRoom_${childId}`);

    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('SIP inbound error:', error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred bridging the call.');
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
