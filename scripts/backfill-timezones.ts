import { prisma } from '../lib/prisma';
import { inferTimezone } from '../lib/timezone';

async function main() {
  console.log("Starting Timezone Backfill...");

  // Get all leads
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      city: true,
      phone: true,
      timezone: true
    }
  });

  console.log(`Found ${leads.length} leads in the database.`);

  let updatedCount = 0;
  let noChangeCount = 0;

  for (const lead of leads) {
    const inferred = inferTimezone(lead.city || "", lead.phone || "");
    
    // Only update if it's different (or currently empty)
    if (lead.timezone !== inferred) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { timezone: inferred }
      });
      updatedCount++;
      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount} leads so far...`);
      }
    } else {
      noChangeCount++;
    }
  }

  console.log(`\nBackfill Complete!`);
  console.log(`Successfully updated: ${updatedCount} leads`);
  console.log(`Skipped (already correct): ${noChangeCount} leads`);
}

main()
  .catch((e) => {
    console.error("Error during backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
