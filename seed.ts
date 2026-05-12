// backend/src/seed.ts
import { prisma } from "./src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  // ── Demo license → barcode enabled ───────────────────────────────────────
  const license = await prisma.license.upsert({
    where: { id: "demo-license" },
    update: {
      name: "KYNFLOW Demo Barcode",
      barcodeEnabled: true,
    },
    create: {
      id: "demo-license",
      name: "KYNFLOW Demo Barcode",
      customerName: "Test Shop",
      customerPhone: "9999999999",
      amountPaid: 0,
      marginForUs: 0,
      marginForFranchise: 0,
      activeUntil: new Date("2027-01-01"),
      tier: "PRO",
      barcodeEnabled: true,
    },
  });

  const hashed1 = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { userId: "admin" },
    update: {
      licenseId: license.id,
    },
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
    update: {
      licenseId: license.id,
    },
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
    update: {
      licenseId: license.id,
    },
    create: {
      userId: "staff",
      password: hashed3,
      role: "USER",
      licenseId: license.id,
    },
  });

  console.log(
    "✅ Demo users seeded → licenseId:",
    license.id,
    "barcodeEnabled=true",
  );

  // ── Grand license → barcode disabled ─────────────────────────────────────
  const grandLicense = await prisma.license.upsert({
    where: { id: "grand-license" },
    update: {
      name: "KYNFLOW Grand Test",
      barcodeEnabled: false,
    },
    create: {
      id: "grand-license",
      name: "KYNFLOW Grand Test",
      customerName: "Grand Shop",
      customerPhone: "9999999999",
      amountPaid: 0,
      marginForUs: 0,
      marginForFranchise: 0,
      activeUntil: new Date("2027-01-01"),
      tier: "PRO",
      barcodeEnabled: false,
    },
  });

  const hashedGrand = await bcrypt.hash("grand123", 10);
  await prisma.user.upsert({
    where: { userId: "grand" },
    update: {
      licenseId: grandLicense.id,
    },
    create: {
      userId: "grand",
      password: hashedGrand,
      role: "ADMIN",
      licenseId: grandLicense.id,
    },
  });

  console.log(
    "✅ Grand user seeded → licenseId:",
    grandLicense.id,
    "barcodeEnabled=false",
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
