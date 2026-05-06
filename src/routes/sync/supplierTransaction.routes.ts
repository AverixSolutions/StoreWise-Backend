// backend/src/routes/sync/supplierTransaction.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../../controllers/auth.controller";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.use(verifyToken);

function getLicenseId(req: Request): string {
  return (req as any).user?.licenseId ?? "";
}

// POST /api/sync/supplierTransaction/push
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
      await prisma.$transaction(async (tx) => {
        // Upsert the transaction
        await tx.supplierTransaction.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            licenseId: r.licenseId,
            supplierId: r.supplierId,
            kind: r.kind,
            refId: r.refId ?? null,
            refNo: r.refNo ?? null,
            date: new Date(r.date),
            amount: Number(r.amount),
            sign: Number(r.sign),
            notes: r.notes ?? null,
            paymentStatus: r.paymentStatus ?? null,
            chequeNo: r.chequeNo ?? null,
            chequeIssueDate: r.chequeIssueDate
              ? new Date(r.chequeIssueDate)
              : null,
            chequeClearanceDate: r.chequeClearanceDate
              ? new Date(r.chequeClearanceDate)
              : null,
            createdAt: r.createdAt ? new Date(r.createdAt) : now,
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : now,
            deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
            isSynced: true,
            syncedAt: now,
          },
          update: {
            supplierId: r.supplierId,
            kind: r.kind,
            refId: r.refId ?? null,
            refNo: r.refNo ?? null,
            date: new Date(r.date),
            amount: Number(r.amount),
            sign: Number(r.sign),
            notes: r.notes ?? null,
            paymentStatus: r.paymentStatus ?? null,
            chequeNo: r.chequeNo ?? null,
            chequeIssueDate: r.chequeIssueDate
              ? new Date(r.chequeIssueDate)
              : null,
            chequeClearanceDate: r.chequeClearanceDate
              ? new Date(r.chequeClearanceDate)
              : null,
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : now,
            deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
            isSynced: true,
            syncedAt: now,
          },
        });

        // Upsert embedded settlements (PAYMENT records carry these)
        const settlements: any[] = Array.isArray(r.settlements)
          ? r.settlements
          : [];
        for (const s of settlements) {
          // Check the purchase exists in this license before creating the settlement
          const purchaseExists = await tx.purchase.findFirst({
            where: { id: s.purchaseId, licenseId },
            select: { id: true },
          });
          if (!purchaseExists) continue; // purchase not synced yet — skip, will retry on next pull

          await tx.supplierBillSettlement.upsert({
            where: { id: s.id },
            create: {
              id: s.id,
              licenseId: licenseId,
              supplierId: r.supplierId,
              paymentTxId: r.id,
              purchaseId: s.purchaseId,
              amount: Number(s.amount),
              createdAt: s.createdAt ? new Date(s.createdAt) : now,
            },
            update: {
              amount: Number(s.amount),
            },
          });
        }
      });

      results.push({
        id: r.id,
        accepted: true,
        serverUpdatedAt: now.toISOString(),
      });
    } catch (err: any) {
      console.error("[supplierTransaction push] failed for", r.id, err.message);
      results.push({ id: r.id, accepted: false, reason: err.message });
    }
  }

  res.json({ results, pushedAt: now.toISOString() });
});

// GET /api/sync/supplierTransaction/pull
router.get("/pull", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const since = req.query.since as string | undefined;
  const PAGE_SIZE = 200;

  try {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };

    const records = await prisma.supplierTransaction.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: PAGE_SIZE + 1,
      include: {
        settlements: {
          select: {
            id: true,
            licenseId: true,
            supplierId: true,
            purchaseId: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    const hasMore = records.length > PAGE_SIZE;
    const page = records.slice(0, PAGE_SIZE);

    const pulledAt =
      page.length > 0
        ? page[page.length - 1].updatedAt.toISOString()
        : (since ?? new Date().toISOString());

    res.json({ records: page, hasMore, pulledAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
