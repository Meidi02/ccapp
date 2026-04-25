import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role');
  if (role !== 'MASTER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'] } }
    });
    const sid = settings.find(s => s.key === 'TWILIO_ACCOUNT_SID')?.value;
    const token = settings.find(s => s.key === 'TWILIO_AUTH_TOKEN')?.value;

    if (!sid || !token) {
      return NextResponse.json({ error: 'Master Twilio credentials not configured' }, { status: 400 });
    }

    const { baseUrl } = await request.json();
    if (!baseUrl) {
      return NextResponse.json({ error: 'Base URL required' }, { status: 400 });
    }

    const client = twilio(sid, token);
    const domainName = `ccapp-sip-${sid.toLowerCase()}.sip.twilio.com`;
    const voiceUrl = `${baseUrl}/api/call/sip-inbound`;

    // Check if it exists
    const domains = await client.sip.domains.list({ limit: 20 });
    let domain = domains.find(d => d.domainName === domainName);

    if (domain) {
      // Update voice url just in case
      domain = await client.sip.domains(domain.sid).update({ voiceUrl });
    } else {
      // Create it
      domain = await client.sip.domains.create({
        domainName,
        friendlyName: 'CCAPP Parallel Dialer SIP Bridge',
        voiceUrl,
        voiceMethod: 'POST',
      });
    }

    return NextResponse.json({ success: true, domainName: domain.domainName });
  } catch (error: any) {
    console.error('Failed to provision SIP bridge:', error);
    return NextResponse.json({ error: error.message || 'Failed to provision SIP bridge' }, { status: 500 });
  }
}
