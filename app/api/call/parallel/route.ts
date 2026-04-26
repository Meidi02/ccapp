import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';
import crypto from 'crypto';

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { leadIds } = await request.json();
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Missing leadIds' }, { status: 400 });
    }

    const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } } });
    if (leads.length === 0) {
      return NextResponse.json({ error: 'No valid leads found' }, { status: 400 });
    }

    // Get dialer config
    const config = await prisma.dialerConfig.findUnique({ where: { userId } });
    const selectedCallerIds = config?.selectedCallerIds || [];

    // Get assigned numbers for this child
    let assignedNumbers = await prisma.twilioNumber.findMany({ where: { assignedToId: userId } });
    
    // Filter by selected caller IDs if the user has actively selected any
    if (selectedCallerIds.length > 0) {
      assignedNumbers = assignedNumbers.filter(num => selectedCallerIds.includes(num.id));
    }

    if (assignedNumbers.length === 0) {
      return NextResponse.json({ error: 'No valid Twilio numbers selected/assigned for this user' }, { status: 400 });
    }

    // Get Master SID for SIP Bridge
    const masterSidSetting = await prisma.setting.findUnique({ where: { key: 'TWILIO_ACCOUNT_SID' } });
    if (!masterSidSetting) {
      return NextResponse.json({ error: 'Master Twilio configuration missing' }, { status: 400 });
    }
    const masterSip = `ccapp-sip-${masterSidSetting.value.toLowerCase()}.sip.twilio.com`;

    const baseUrl = request.headers.get('origin') || 'https://ccapp.netlify.app';
    const batchId = crypto.randomUUID();

    const callResults = [];

    // Initiate calls
    await prisma.systemLog.create({
      data: {
        level: 'INFO', source: 'BACKEND',
        message: `Initiating parallel dial batch ${batchId} for ${leads.length} leads by user ${userId}`,
        meta: { leadIds, masterSip }
      }
    });

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      // Round-robin or random number assignment
      const numberConfig = assignedNumbers[i % assignedNumbers.length];
      
      const client = twilio(numberConfig.accountSid, numberConfig.authToken);

      try {
        const useConference = numberConfig.accountSid === masterSidSetting.value;
        const call = await client.calls.create({
          url: `${baseUrl}/api/call/outbound-answered?childId=${userId}&leadId=${lead.id}&masterSip=${masterSip}&useConference=${useConference}&batchId=${batchId}`,
          to: lead.phone,
          from: numberConfig.phoneNumber,
          statusCallback: `${baseUrl}/api/call/parallel-status?batchId=${batchId}&childId=${userId}`,
          statusCallbackEvent: ['completed', 'answered', 'busy', 'no-answer', 'canceled', 'failed'],
          machineDetection: 'Enable',
          machineDetectionTimeout: 15,
          asyncAmd: 'false',
        });

        // Log to database
        const log = await prisma.callLog.create({
          data: {
            leadId: lead.id,
            leadName: `${lead.firstName} ${lead.lastName}`.trim(),
            leadPhone: lead.phone,
            callSid: call.sid,
            status: 'initiated',
            batchId,
          }
        });

        callResults.push({ leadId: lead.id, callSid: call.sid, logId: log.id });
      } catch (callError: any) {
        console.error(`Failed to initiate call to ${lead.phone}:`, callError);
        await prisma.systemLog.create({
          data: {
            level: 'ERROR', source: 'TWILIO',
            message: `Failed to initiate call to ${lead.phone}: ${callError.message || callError}`,
            meta: { leadId: lead.id, error: callError }
          }
        });
      }
    }

    return NextResponse.json({ success: true, batchId, initiatedCalls: callResults.length });
  } catch (error: any) {
    console.error('Parallel dialer error:', error);
    await prisma.systemLog.create({
      data: {
        level: 'ERROR', source: 'BACKEND',
        message: `Parallel dialer outer error: ${error.message || error}`,
        meta: { error }
      }
    }).catch(() => {});
    return NextResponse.json({ error: error.message || 'Failed to start parallel dialing' }, { status: 500 });
  }
}
