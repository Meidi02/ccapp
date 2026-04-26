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

    // Fetch credentials
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "GMAIL_SENDER_EMAIL",
            "GMAIL_APP_PASSWORD",
            "GMAIL_SENDER_NAME"
          ],
        },
      },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const twilioSid = settingsMap.TWILIO_ACCOUNT_SID;
    const twilioToken = settingsMap.TWILIO_AUTH_TOKEN;
    const gmailEmail = settingsMap.GMAIL_SENDER_EMAIL;
    const gmailAppPassword = settingsMap.GMAIL_APP_PASSWORD;
    const gmailName = settingsMap.GMAIL_SENDER_NAME;

    if (!twilioSid || !twilioToken || !gmailEmail || !gmailAppPassword) {
      return NextResponse.json(
        {
          error:
            "Missing Twilio or Gmail credentials. Both are required for the Email-to-SMS fallback.",
        },
        { status: 400 }
      );
    }

    const client = twilio(twilioSid, twilioToken);

    // 1. Look up the carrier using Twilio
    let carrierName = "";
    try {
      const lookupResult = await client.lookups.v1.phoneNumbers(to).fetch({ type: ['carrier'] });
      carrierName = lookupResult.carrier?.name || "";
    } catch (err: any) {
      console.warn("Twilio Lookup Failed:", err.message);
      return NextResponse.json({ error: "Failed to verify phone number carrier." }, { status: 400 });
    }

    if (!carrierName) {
      return NextResponse.json({ error: "Could not determine mobile carrier for this number." }, { status: 400 });
    }

    // 2. Map carrier name to SMS gateway
    const carrierMap: Record<string, string> = {
      "at&t": "txt.att.net",
      "verizon": "vtext.com",
      "t-mobile": "tmomail.net",
      "sprint": "messaging.sprintpcs.com",
      "virgin mobile": "vmobl.com",
      "us cellular": "email.uscc.net",
      "cricket": "sms.cricketwireless.net",
      "boost mobile": "sms.myboostmobile.com",
      "metropcs": "mymetropcs.com",
      "mint mobile": "tmomail.net"
    };

    let gateway = "";
    const cName = carrierName.toLowerCase();
    for (const [key, domain] of Object.entries(carrierMap)) {
      if (cName.includes(key)) {
        gateway = domain;
        break;
      }
    }

    if (!gateway) {
      return NextResponse.json({ error: `Unsupported carrier for Email-to-SMS: ${carrierName}` }, { status: 400 });
    }

    // 3. Format the target email address
    // Extract the last 10 digits
    const cleanPhone = to.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: "Invalid US phone number format." }, { status: 400 });
    }
    const targetEmail = `${cleanPhone}@${gateway}`;

    // Log the intended route for debugging
    await prisma.systemLog.create({
      data: {
        level: "INFO",
        source: "EMAIL_TO_SMS",
        message: `Attempting to send SMS to ${to}. Detected Carrier: ${carrierName}. Sending email to: ${targetEmail}`
      }
    });

    // 4. Send the email
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailEmail,
        pass: gmailAppPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"${gmailName || 'ColdCall'}" <${gmailEmail}>`,
      to: targetEmail,
      subject: "", // SMS messages usually omit subjects, or put them in parentheses
      text: body,
    });

    // Log success
    await prisma.systemLog.create({
      data: {
        level: "INFO",
        source: "EMAIL_TO_SMS",
        message: `Nodemailer successfully handed off email to SMTP server for ${targetEmail}. Message ID: ${info.messageId}`
      }
    });

    // 5. Log the message
    const smsLog = await prisma.smsLog.create({
      data: {
        leadId: leadId || "",
        leadName: leadName || "",
        leadPhone: to,
        body,
        status: "sent",
        twilioSid: info.messageId || "email-to-sms", // Store Nodemailer messageId
        direction: "outbound",
      },
    });

    return NextResponse.json({
      success: true,
      messageSid: info.messageId,
      status: "sent",
      id: smsLog.id,
      carrier: carrierName,
      gateway: targetEmail
    });
  } catch (error) {
    console.error("Error sending Email-to-SMS:", error);
    const msg =
      error instanceof Error ? error.message : "Failed to send Email-to-SMS";
    
    // Log failure
    await prisma.systemLog.create({
      data: {
        level: "ERROR",
        source: "EMAIL_TO_SMS",
        message: `Failed to send Email-to-SMS. Error: ${msg}`
      }
    }).catch(() => {});

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
