// backend/src/routes/sync/saleReturn.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../../controllers/auth.controller";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();
router.use(verifyToken);

function getLicenseId(req: Request): string {
  return (req as any).user?.licenseId ?? "";
}

// POST /api/sync/saleReturn/push
router.post("/push", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { records = [] } = req.body;
  const now = new Date();
  const results: any[] = [];

  for (const r of records) {
    if (r.licenseId !== licenseId) {
      results.push({ id: r.id, accepted: false, reason: "license mismatch" });
      continue;
    }
    try {
      await prisma.saleReturn.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          licenseId: r.licenseId,
          slNo: r.slNo ?? null,
          billNo: r.billNo ?? null,
          userId: r.userId ?? null,
          customerId: r.customerId ?? null,
          customerName: r.customerName ?? null,
          department: r.department ?? null,
          debitAccount: r.debitAccount ?? null,
          natureOfEntry: r.natureOfEntry ?? null,
          saleType: r.saleType ?? "CREDIT",
          returnDate: new Date(r.returnDate),
          entryTime: r.entryTime ? new Date(r.entryTime) : now,
          totalAmount: Number(r.totalAmount || 0),
          discount: Number(r.discount || 0),
          createdAt: r.createdAt ? new Date(r.createdAt) : now,
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : now,
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          isSynced: true,
          syncedAt: now,
        },
        update: {
          slNo: r.slNo ?? null,
          billNo: r.billNo ?? null,
          customerId: r.customerId ?? null,
          customerName: r.customerName ?? null,
          department: r.department ?? null,
          debitAccount: r.debitAccount ?? null,
          natureOfEntry: r.natureOfEntry ?? null,
          saleType: r.saleType ?? "CREDIT",
          returnDate: new Date(r.returnDate),
          entryTime: r.entryTime ? new Date(r.entryTime) : now,
          totalAmount: Number(r.totalAmount || 0),
          discount: Number(r.discount || 0),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : now,
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          isSynced: true,
          syncedAt: now,
        },
      });
      results.push({
        id: r.id,
        accepted: true,
        serverUpdatedAt: now.toISOString(),
      });
    } catch (err: any) {
      console.error("[saleReturn push] failed for", r.id, err.message);
      results.push({ id: r.id, accepted: false, reason: err.message });
    }
  }
  res.json({ results, pushedAt: now.toISOString() });
});

// GET /api/sync/saleReturn/pull
router.get("/pull", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const since = req.query.since as string | undefined;
  const PAGE_SIZE = 200;
  try {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.saleReturn.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: PAGE_SIZE + 1,
    });
    const hasMore = records.length > PAGE_SIZE;
    const page = records.slice(0, PAGE_SIZE);
    const lastRecord = page.length > 0 ? page[page.length - 1] : null;
    const pulledAt =
      lastRecord?.updatedAt?.toISOString() ?? since ?? new Date().toISOString();
    res.json({ records: page, hasMore, pulledAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/saleReturn/items/push
router.post("/items/push", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { records = [] } = req.body;
  const now = new Date();
  const results: any[] = [];

  for (const r of records) {
    try {
      // verify parent belongs to this license
      const parent = await prisma.saleReturn.findFirst({
        where: { id: r.returnId, licenseId },
        select: { id: true },
      });
      if (!parent) {
        results.push({ id: r.id, accepted: false, reason: "parent not found" });
        continue;
      }
      await prisma.saleReturnItem.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          returnId: r.returnId,
          productId: r.productId,
          barcode: r.barcode ?? null,
          quantity: Number(r.quantity || 0),
          unit: r.unit,
          rate: Number(r.rate || 0),
          mrp: r.mrp != null ? Number(r.mrp) : null,
          taxPercent: r.taxPercent,
          taxAmount: Number(r.taxAmount || 0),
          discount: Number(r.discount || 0),
          discountType: r.discountType ?? "ABS",
          salePrice: r.salePrice != null ? Number(r.salePrice) : null,
          profit: r.profit != null ? Number(r.profit) : null,
          totalCost: Number(r.totalCost || 0),
          billedValue: Number(r.billedValue || 0),
          effectiveUnitValue:
            r.effectiveUnitValue != null ? Number(r.effectiveUnitValue) : null,
          batchNo: r.batchNo ?? null,
          batchId: r.batchId ?? null,
          mfgDate: r.mfgDate ?? null,
          expiryDate: r.expiryDate ?? null,
          lineNo: r.lineNo ?? null,
          appliedQuantity: Number(r.appliedQuantity || 0),
          overReturnQuantity: Number(r.overReturnQuantity || 0),
          overReturnReason: r.overReturnReason ?? null,
          createdAt: r.createdAt ? new Date(r.createdAt) : now,
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : now,
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          isSynced: true,
          syncedAt: now,
        },
        update: {
          quantity: Number(r.quantity || 0),
          unit: r.unit,
          rate: Number(r.rate || 0),
          mrp: r.mrp != null ? Number(r.mrp) : null,
          taxPercent: r.taxPercent,
          taxAmount: Number(r.taxAmount || 0),
          discount: Number(r.discount || 0),
          discountType: r.discountType ?? "ABS",
          salePrice: r.salePrice != null ? Number(r.salePrice) : null,
          profit: r.profit != null ? Number(r.profit) : null,
          totalCost: Number(r.totalCost || 0),
          billedValue: Number(r.billedValue || 0),
          effectiveUnitValue:
            r.effectiveUnitValue != null ? Number(r.effectiveUnitValue) : null,
          batchNo: r.batchNo ?? null,
          batchId: r.batchId ?? null,
          mfgDate: r.mfgDate ?? null,
          expiryDate: r.expiryDate ?? null,
          lineNo: r.lineNo ?? null,
          appliedQuantity: Number(r.appliedQuantity || 0),
          overReturnQuantity: Number(r.overReturnQuantity || 0),
          overReturnReason: r.overReturnReason ?? null,
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : now,
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          isSynced: true,
          syncedAt: now,
        },
      });
      results.push({
        id: r.id,
        accepted: true,
        serverUpdatedAt: now.toISOString(),
      });
    } catch (err: any) {
      console.error("[saleReturnItem push] failed for", r.id, err.message);
      results.push({ id: r.id, accepted: false, reason: err.message });
    }
  }
  res.json({ results, pushedAt: now.toISOString() });
});

// GET /api/sync/saleReturn/items/pull
router.get("/items/pull", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const since = req.query.since as string | undefined;
  const PAGE_SIZE = 500;
  try {
    const where: any = { saleReturn: { licenseId } };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.saleReturnItem.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: PAGE_SIZE + 1,
    });
    const hasMore = records.length > PAGE_SIZE;
    const page = records.slice(0, PAGE_SIZE);
    const lastRecord = page.length > 0 ? page[page.length - 1] : null;
    const pulledAt =
      lastRecord?.updatedAt?.toISOString() ?? since ?? new Date().toISOString();
    res.json({ records: page, hasMore, pulledAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
