import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/settings — get all settings
export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      // Hide sensitive settings from children
      if (role !== 'MASTER' && (s.key.startsWith('TWILIO_') || s.key.includes('PASSWORD') || s.key.includes('SECRET') || s.key.includes('TOKEN'))) {
        continue;
      }
      settingsMap[s.key] = s.value;
    }
    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error("Error fetching settings:", error);
    const msg = error instanceof Error ? error.message : String(error);
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const host = dbUrl.replace(/^.*@/, "").replace(/[:\/].*$/, "");
    return NextResponse.json(
      { error: "Failed to fetch settings", detail: msg, db_host: host },
      { status: 500 }
    );
  }
}

// POST /api/settings — save settings (upsert)
export async function POST(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      if (role !== 'MASTER' && (key.startsWith('TWILIO_') || key.includes('PASSWORD') || key.includes('SECRET') || key.includes('TOKEN'))) {
        continue; // Skip sensitive keys for non-masters
      }

      await prisma.setting.upsert({
        where: { key },
        update: { value: value as string },
        create: { key, value: value as string },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to save settings", detail: msg },
      { status: 500 }
    );
  }
}
