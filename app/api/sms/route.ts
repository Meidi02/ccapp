import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

// GET /api/sms — fetch SMS history (optionally filtered by leadId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");

    const where = leadId ? { leadId } : {};

    const messages = await prisma.smsLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching SMS logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch SMS history" },
      { status: 500 }
    );
  }
}

// POST /api/sms — send an SMS via Twilio and log it
export async function POST(request: NextRequest) {
  try {
    const { to, body, leadId, leadName } = await request.json();

    if (!to || !body) {
      return NextResponse.json(
        { error: "Phone number and message body are required" },
        { status: 400 }
      );
    }

    // Get ClickSend settings
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "CLICKSEND_USERNAME",
            "CLICKSEND_API_KEY",
          ],
        },
      },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const username = settingsMap.CLICKSEND_USERNAME;
    const apiKey = settingsMap.CLICKSEND_API_KEY;

    if (!username || !apiKey) {
      return NextResponse.json(
        {
          error:
            "ClickSend credentials not configured. Go to Admin Settings to add your ClickSend Username and API Key.",
        },
        { status: 400 }
      );
    }

    // Prepare ClickSend payload
    const payload = {
      messages: [
        {
          to: to,
          body: body,
          source: "coldcall_app"
        }
      ]
    };

    // Base64 encode credentials for Basic Auth
    const authString = Buffer.from(`${username}:${apiKey}`).toString('base64');

    // Send SMS via ClickSend
    const clicksendRes = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify(payload)
    });

    if (!clicksendRes.ok) {
      const errorText = await clicksendRes.text();
      throw new Error(`ClickSend API error: ${clicksendRes.status} ${errorText}`);
    }

    const clicksendData = await clicksendRes.json();
    
    // Check if the message was accepted
    if (clicksendData.http_code !== 200 || !clicksendData.data || !clicksendData.data.messages || clicksendData.data.messages.length === 0) {
      throw new Error(`ClickSend delivery failed: ${JSON.stringify(clicksendData)}`);
    }

    const messageResult = clicksendData.data.messages[0];

    // Log the message
    const smsLog = await prisma.smsLog.create({
      data: {
        leadId: leadId || "",
        leadName: leadName || "",
        leadPhone: to,
        body,
        status: messageResult.status || "sent",
        twilioSid: messageResult.message_id || "", // Reusing twilioSid column to store ClickSend message_id
        direction: "outbound",
      },
    });

    return NextResponse.json({
      success: true,
      messageSid: messageResult.message_id,
      status: messageResult.status,
      id: smsLog.id,
    });
  } catch (error) {
    console.error("Error sending SMS:", error);
    const msg =
      error instanceof Error ? error.message : "Failed to send SMS";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
