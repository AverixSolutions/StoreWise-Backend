// backend/src/seed.ts
import { prisma } from "./src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  // ── Demo license (skip if exists) ────────────────────────────────────────
  const license = await prisma.license.upsert({
    where: { id: "demo-license" },
    update: {},
    create: {
      id: "demo-license",
      name: "KYNFLOW Demo",
      customerName: "Test Shop",
      customerPhone: "9999999999",
      amountPaid: 0,
      marginForUs: 0,
      marginForFranchise: 0,
      activeUntil: new Date("2027-01-01"),
      tier: "PRO",
    },
  });

  const hashed1 = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { userId: "admin" },
    update: {},
    create: {
      userId: "admin",
      password: hashed1,
      role: "ADMIN",
      licenseId: license.id,
    },
  });

  const hashed2 = await bcrypt.hash("manager123", 10);
  await prisma.user.upsert({
    where: { userId: "manager" },
    update: {},
    create: {
      userId: "manager",
      password: hashed2,
      role: "SUPERVISOR",
      licenseId: license.id,
    },
  });

  const hashed3 = await bcrypt.hash("staff123", 10);
  await prisma.user.upsert({
    where: { userId: "staff" },
    update: {},
    create: {
      userId: "staff",
      password: hashed3,
      role: "USER",
      licenseId: license.id,
    },
  });

  console.log("✅ Demo users seeded → licenseId:", license.id);

  // ── Grand license (real user) ─────────────────────────────────────────────
  const grandLicense = await prisma.license.upsert({
    where: { id: "grand-license" },
    update: {},
    create: {
      id: "grand-license",
      name: "KYNFLOW Grand",
      customerName: "Grand Shop",
      customerPhone: "9999999999",
      amountPaid: 0,
      marginForUs: 0,
      marginForFranchise: 0,
      activeUntil: new Date("2027-01-01"),
      tier: "PRO",
    },
  });

  const hashedGrand = await bcrypt.hash("grand123", 10);
  await prisma.user.upsert({
    where: { userId: "grand" },
    update: {},
    create: {
      userId: "grand",
      password: hashedGrand,
      role: "ADMIN",
      licenseId: grandLicense.id,
    },
  });

  console.log("✅ Grand user seeded → licenseId:", grandLicense.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
