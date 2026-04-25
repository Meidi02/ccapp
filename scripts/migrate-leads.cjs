const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting migration...');
  
  // 1. Create or get master user
  let masterUser = await prisma.user.findUnique({
    where: { username: 'meidi02' },
  });

  if (!masterUser) {
    console.log('Creating master user meidi02...');
    const passwordHash = await bcrypt.hash('meidi02', 10);
    masterUser = await prisma.user.create({
      data: {
        username: 'meidi02',
        passwordHash,
        role: 'MASTER',
      },
    });
  } else {
    console.log('Master user meidi02 already exists.');
  }

  // 2. Create or get "Main Project"
  let mainProject = await prisma.project.findFirst({
    where: { name: 'Main Project', userId: masterUser.id },
  });

  if (!mainProject) {
    console.log('Creating Main Project...');
    mainProject = await prisma.project.create({
      data: {
        name: 'Main Project',
        userId: masterUser.id,
      },
    });
  } else {
    console.log('Main Project already exists.');
  }

  // 3. Move all leads without a projectId to this project
  const updatedLeads = await prisma.lead.updateMany({
    where: { projectId: null },
    data: { projectId: mainProject.id },
  });

  console.log(`Migrated ${updatedLeads.count} leads to the Main Project.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
