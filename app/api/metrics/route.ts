import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const timeRange = searchParams.get("timeRange") || "all";
    const userId = request.headers.get("x-user-id");
    const role = request.headers.get("x-user-role");

    // Access control
    let projectFilter: any = {};
    if (projectId) {
       const project = await prisma.project.findUnique({ where: { id: projectId } });
       if (!project || (project.userId !== userId && role !== 'MASTER')) {
         return NextResponse.json({ error: 'Unauthorized project access' }, { status: 401 });
       }
       projectFilter = { projectId };
    } else {
       if (role !== 'MASTER') {
         projectFilter = { project: { userId } };
       }
    }

    // Time filter
    let timeFilter: any = {};
    const now = new Date();
    if (timeRange === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      timeFilter = { gte: today };
    } else if (timeRange === 'week') {
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      timeFilter = { gte: weekAgo };
    } else if (timeRange === 'month') {
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
      timeFilter = { gte: monthAgo };
    }

    // Fetch grouped dispositions
    const leadWhere = {
      ...projectFilter,
      ...(Object.keys(timeFilter).length > 0 && { updatedAt: timeFilter }),
    };

    const dispositionsRaw = await prisma.lead.groupBy({
      by: ['disposition'],
      where: leadWhere,
      _count: {
        disposition: true,
      },
    });

    const formattedDispositions = dispositionsRaw.map(d => ({
      name: d.disposition,
      value: d._count.disposition,
    }));

    // Fetch Total Dials (CallLog where lead matches projectFilter and time matches timeFilter)
    const callLogWhere = {
      ...(Object.keys(timeFilter).length > 0 && { startedAt: timeFilter }),
      lead: {
        ...projectFilter
      }
    };

    // Note: Since Prisma's relational filtering works for some queries, we need to ensure the schema has relations defined. 
    // Wait, earlier I didn't add relation for CallLog to Lead. Let me just count calls whose leadId is in the leads matching the project filter.
    const matchingLeads = await prisma.lead.findMany({
      where: projectFilter,
      select: { id: true }
    });
    
    const leadIds = matchingLeads.map(l => l.id);

    const callLogFinalWhere = {
      ...(Object.keys(timeFilter).length > 0 && { startedAt: timeFilter }),
      leadId: { in: leadIds }
    };

    const totalDials = await prisma.callLog.count({
      where: callLogFinalWhere
    });

    return NextResponse.json({
      dispositions: formattedDispositions,
      totalDials,
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
