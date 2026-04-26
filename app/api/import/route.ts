import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

// POST /api/import — import leads from CSV
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase(),
    });

    if (result.errors.length > 0) {
      return NextResponse.json(
        { error: "CSV parsing errors", details: result.errors },
        { status: 400 }
      );
    }

    // Map CSV columns to lead fields (flexible mapping)
    const columnMap: Record<string, string> = {
      first_name: "firstName",
      firstname: "firstName",
      "first name": "firstName",
      last_name: "lastName",
      lastname: "lastName",
      "last name": "lastName",
      email: "email",
      "email address": "email",
      phone: "phone",
      "phone number": "phone",
      phone_number: "phone",
      telephone: "phone",
      "business phone number": "phone",
      "business phone": "phone",
      company: "company",
      "company name": "company",
      business: "company",
      "business name": "company",
      casual_name: "casualName",
      casualname: "casualName",
      "casual name": "casualName",
      city: "city",
      location: "city",
      state: "state",
      province: "state",
      website: "website",
      url: "website",
      notes: "notes",
      note: "notes",
      disposition: "disposition",
      status: "disposition",
    };

    const leads = (result.data as Record<string, string>[]).map((row) => {
      const lead: Record<string, string> = {};

      for (const [csvCol, value] of Object.entries(row)) {
        const mappedField = columnMap[csvCol.toLowerCase()];
        if (mappedField && value) {
          lead[mappedField] = value.trim();
        }
      }

      // Ensure required field
      if (!lead.firstName) {
        // Try to split a 'name' or 'full_name' field
        const fullName =
          row["name"] || row["full_name"] || row["fullname"] || row["contact"] || "";
        if (fullName) {
          const parts = fullName.trim().split(/\s+/);
          lead.firstName = parts[0] || "Unknown";
          lead.lastName = parts.slice(1).join(" ");
        } else {
          lead.firstName = "Unknown";
        }
      }

      // Format Phone to E.164 (Twilio Format)
      if (lead.phone) {
        // Fix issues where spreadsheet exports big numbers as floats (e.g. 12143469105.0)
        let cleanedPhone = lead.phone.split('.')[0].replace(/\D/g, "");
        if (cleanedPhone.length === 10) {
          cleanedPhone = "+1" + cleanedPhone;
        } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith("1")) {
          cleanedPhone = "+" + cleanedPhone;
        } else if (cleanedPhone.length > 0 && !cleanedPhone.startsWith("+")) {
          cleanedPhone = "+" + cleanedPhone;
        }
        lead.phone = cleanedPhone;
      }

      // Handle Google URL explicitly
      const googleUrl = row["google url"] || row["google maps"] || row["google_url"] || "";
      if (googleUrl) {
        lead.googleUrl = googleUrl.trim();
      }

      // Auto-generate casualName if not provided
      if (!lead.casualName && lead.company) {
        lead.casualName = lead.company
          .replace(/\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Co\.?)\b/gi, "")
          .replace(/\b(Physical Therapy|Clinic|Center|Group|Associates)\b/gi, "")
          .trim();
      }

      return lead;
    });

    const projectId = formData.get("projectId") as string | null;
    const userId = request.headers.get("x-user-id");
    const role = request.headers.get("x-user-role");

    if (projectId) {
       const project = await prisma.project.findUnique({ where: { id: projectId } });
       if (!project || (project.userId !== userId && role !== 'MASTER')) {
         return NextResponse.json({ error: 'Unauthorized project access' }, { status: 401 });
       }
    }

    const created = await prisma.lead.createMany({
      data: leads.map((l) => ({
        firstName: l.firstName || "Unknown",
        lastName: l.lastName || "",
        email: l.email || "",
        phone: l.phone || "",
        company: l.company || "",
        casualName: l.casualName || "",
        city: l.city || "",
        state: l.state || "",
        website: l.website || "",
        googleUrl: l.googleUrl || "",
        notes: l.notes || "",
        disposition: l.disposition || "NEW",
        projectId: projectId || null,
      })),
    });

    return NextResponse.json(
      { imported: created.count, total: leads.length },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing CSV:", error);
    return NextResponse.json(
      { error: "Failed to import CSV" },
      { status: 500 }
    );
  }
}
