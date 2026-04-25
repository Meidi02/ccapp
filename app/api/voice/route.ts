import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

// POST /api/voice — TwiML webhook called by Twilio for both outbound and inbound calls
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;
    const direction = formData.get("Direction") as string;

    const twiml = new VoiceResponse();

    // Get the Twilio phone number from settings
    const phoneSetting = await prisma.setting.findFirst({
      where: { key: "TWILIO_PHONE_NUMBER" },
    });
    const twilioNumber = phoneSetting?.value || "";

    // Determine if this is a true INBOUND call from a real phone number
    // Calls from the browser (WebRTC) also have Direction: "inbound", but their From is "client:ccapp-agent"
    const isFromClient = from && from.startsWith("client:");
    
    // It's a real inbound call if it's NOT from the client AND the destination is our Twilio number
    const isRealInbound =
      !isFromClient &&
      to && twilioNumber && to.replace(/\s/g, "") === twilioNumber.replace(/\s/g, "");

    if (isRealInbound) {
      // Route true incoming call to the browser client (caller hears ringing)
      const dial = twiml.dial({
        callerId: from || twilioNumber,
        record: "record-from-answer-dual",
        recordingStatusCallback: `${getBaseUrl(request)}/api/recording-status`,
        recordingStatusCallbackMethod: "POST",
        recordingStatusCallbackEvent: ["completed"],
      });
      dial.client("ccapp-agent");
    } else if (isFromClient && to && to.startsWith("ParallelDial_")) {
      // OUTBOUND call from browser specifically to initiate parallel dial conference
      const childId = to.split("_")[1];
      const dial = twiml.dial();
      dial.conference({
        startConferenceOnEnter: true,
        endConferenceOnExit: true, // End conference when agent leaves
      }, `AgentRoom_${childId}`);

      await prisma.systemLog.create({
        data: {
          level: "INFO", source: "TWILIO",
          message: `Voice Webhook: Generated ParallelDial conference TwiML for child ${childId}`,
          meta: { to, from, twiml: twiml.toString() }
        }
      });
    } else if (to) {
      // OUTBOUND call from the browser — dial the target number
      const host = request.headers.get("host") || "";
      const protocol = host.includes("localhost") ? "http" : "https";
      const baseUrl = `${protocol}://${host}`;

      const dial = twiml.dial({
        callerId: twilioNumber,
        record: "record-from-answer-dual",
        recordingStatusCallback: `${baseUrl}/api/recording-status`,
        recordingStatusCallbackMethod: "POST",
        recordingStatusCallbackEvent: ["completed"],
      });
      dial.number(to);
    } else {
      twiml.say("No phone number specified.");
    }

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    console.error("Error in voice webhook:", error);
    
    await prisma.systemLog.create({
      data: { level: "ERROR", source: "TWILIO", message: `Voice Webhook Error: ${error?.message || String(error)}` }
    }).catch(() => {});

    const twiml = new VoiceResponse();
    twiml.say("An error occurred. Please try again.");

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

// Helper to derive base URL from request
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

// Also handle GET for Twilio webhook verification
export async function GET() {
  const twiml = new VoiceResponse();
  twiml.say("This is the CCAPP voice webhook.");

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
