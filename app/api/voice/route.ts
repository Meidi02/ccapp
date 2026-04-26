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

    await prisma.systemLog.create({
      data: {
        level: "INFO",
        source: "TWILIO",
        message: `Raw Voice Webhook Request`,
        meta: { to, from, direction, twilioNumber }
      }
    });

    // Determine if this is a true INBOUND call from a real phone number
    // Calls from the browser (WebRTC) also have Direction: "inbound", but their From is "client:ccapp-agent-xxx"
    const isFromClient = from && from.startsWith("client:");

    // 1. Identify the Caller ID to use for Outbound Calls
    let callerIdToUse = twilioNumber;
    let sourceClientId = "ccapp-agent";
    
    if (isFromClient) {
      const match = from.match(/^client:ccapp-agent-(.+)$/);
      if (match && match[1] !== "anonymous") {
        const userId = match[1];
        sourceClientId = `ccapp-agent-${userId}`;
        
        // Try DialerConfig first
        let foundCallerId = false;
        const dialerConfig = await prisma.dialerConfig.findUnique({ where: { userId } });
        if (dialerConfig && dialerConfig.selectedCallerIds && dialerConfig.selectedCallerIds.length > 0) {
          const selectedNum = await prisma.twilioNumber.findUnique({ where: { id: dialerConfig.selectedCallerIds[0] } });
          if (selectedNum) {
            callerIdToUse = selectedNum.phoneNumber;
            foundCallerId = true;
          }
        }
        
        if (!foundCallerId) {
          // Fallback to assigned number if no valid selected number
          const assignedNum = await prisma.twilioNumber.findFirst({ where: { assignedToId: userId } });
          if (assignedNum) callerIdToUse = assignedNum.phoneNumber;
        }
      }
    }

    // 2. Identify if it's a real inbound call
    let isRealInbound = false;
    let targetClientId = "ccapp-agent";
    
    if (!isFromClient && to) {
      if (twilioNumber && to.replace(/\s/g, "") === twilioNumber.replace(/\s/g, "")) {
        isRealInbound = true;
      } else {
        const toClean = to.replace(/\s/g, "").slice(-10);
        const matchingNum = await prisma.twilioNumber.findFirst({
          where: { phoneNumber: { endsWith: toClean } }
        });
        if (matchingNum) {
          isRealInbound = true;
          if (matchingNum.assignedToId) targetClientId = `ccapp-agent-${matchingNum.assignedToId}`;
        }
      }
    }

    if (isRealInbound) {
      // Route true incoming call to the browser client (caller hears ringing)
      const dial = twiml.dial({
        callerId: from || callerIdToUse,
        record: "record-from-answer-dual",
        recordingStatusCallback: `${getBaseUrl(request)}/api/recording-status`,
        recordingStatusCallbackMethod: "POST",
        recordingStatusCallbackEvent: ["completed"],
      });
      dial.client(targetClientId);
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
        callerId: callerIdToUse, // Use dynamically resolved caller ID
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
