import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/leads — list all leads, optionally filtered
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const disposition = searchParams.get("disposition");
    const search = searchParams.get("search");
    const projectId = searchParams.get("projectId");
    const userId = request.headers.get("x-user-id");
    const role = request.headers.get("x-user-role");

    const where: any = {};

    if (projectId) {
       const project = await prisma.project.findUnique({ where: { id: projectId } });
       if (!project || (project.userId !== userId && role !== 'MASTER')) {
         return NextResponse.json({ error: 'Unauthorized project access' }, { status: 401 });
       }
       where.projectId = projectId;
    } else {
       if (role !== 'MASTER') {
         where.project = { userId };
       }
    }

    if (disposition && disposition !== "ALL") {
      where.disposition = disposition;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { company: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

// POST /api/leads — create one or more leads
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (Array.isArray(body)) {
      const leads = await prisma.lead.createMany({
        data: body,
      });
      return NextResponse.json({ count: leads.count }, { status: 201 });
    }

    const lead = await prisma.lead.create({
      data: body,
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
