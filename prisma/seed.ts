import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD are required.");
  }

  const existingAdminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (existingAdminCount === 0) {
    await prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(password, 12),
        role: "ADMIN",
        mustChangePassword: true,
      },
    });
    console.log(`Admin "${username}" created. Change the password at first login.`);
  } else {
    console.log("An admin already exists. Skipping admin creation.");
  }

  // Optional demo programs & sections for development/preview (never in production)
  if (process.env.SEED_DEMO_DATA === "true" && process.env.NODE_ENV !== "production") {
    const programs = [
      {
        code: "BSIT",
        name: "Bachelor of Science in Information Technology",
        description: "College of Engineering and Information Technology",
      },
      {
        code: "BSCS",
        name: "Bachelor of Science in Computer Science",
        description: "College of Engineering and Information Technology",
      },
      {
        code: "BSCPE",
        name: "Bachelor of Science in Computer Engineering",
        description: "College of Engineering and Information Technology",
      },
    ];

    for (const p of programs) {
      const program = await prisma.program.upsert({
        where: { code: p.code },
        update: {},
        create: p,
      });

      for (const yearLevel of [1, 2, 3, 4]) {
        for (const sectionName of ["A", "B"]) {
          await prisma.section.upsert({
            where: {
              programId_yearLevel_name_schoolYear: {
                programId: program.id,
                yearLevel,
                name: sectionName,
                schoolYear: "2026-2027",
              },
            },
            update: {},
            create: {
              programId: program.id,
              yearLevel,
              name: sectionName,
              schoolYear: "2026-2027",
              capacity: 40,
            },
          });
        }
      }
    }
    console.log("Seeded demo CEIT programs (BSIT, BSCS, BSCPE) and sections for SY 2026-2027.");
  }
}

main().finally(() => prisma.$disconnect());
