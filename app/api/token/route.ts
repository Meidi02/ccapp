import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

// GET /api/token — generate a Twilio Access Token for browser-based calling
export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "anonymous";
  const agentIdentity = `ccapp-agent-${userId}`;

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "TWILIO_ACCOUNT_SID",
            "TWILIO_API_KEY_SID",
            "TWILIO_API_KEY_SECRET",
            "TWILIO_TWIML_APP_SID",
          ],
        },
      },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const accountSid = settingsMap.TWILIO_ACCOUNT_SID;
    const apiKeySid = settingsMap.TWILIO_API_KEY_SID;
    const apiKeySecret = settingsMap.TWILIO_API_KEY_SECRET;
    const twimlAppSid = settingsMap.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      return NextResponse.json(
        {
          error:
            "Twilio Voice SDK credentials not configured. Go to Settings and add your API Key SID, API Key Secret, and TwiML App SID.",
        },
        { status: 400 }
      );
    }

    // Create an access token
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: agentIdentity,
      ttl: 3600, // 1 hour
    });

    // Create a Voice grant and add it to the token
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    return NextResponse.json({
      token: token.toJwt(),
      identity: agentIdentity,
    });
  } catch (error) {
    console.error("Error generating token:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
