// backend/src/routes/supplier.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const router = Router();
const prisma = new PrismaClient();

router.use(verifyToken);

function getLicenseId(req: Request): string {
  return (req as any).user?.licenseId ?? "";
}

// GET /api/suppliers
router.get("/", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const {
    q = "",
    page = "1",
    pageSize = "50",
  } = req.query as Record<string, string>;
  try {
    const where: any = { licenseId, deletedAt: null };
    if (q.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: "insensitive" } },
        { phone: { contains: q.trim(), mode: "insensitive" } },
      ];
    }
    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
    ]);
    res.json({ suppliers, total });
  } catch (err: any) {
    console.error("[supplier:list]", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/suppliers
router.post("/", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const payload = req.body;
  const now = new Date();
  try {
    // Get next code number
    const agg = await prisma.supplier.aggregate({
      where: { licenseId, deletedAt: null },
      _max: { codeNumber: true },
    });
    let codeNumber = (agg._max.codeNumber ?? 0) + 1;
    let code = `SUP${String(codeNumber).padStart(5, "0")}`;

    while (true) {
      const existing = await prisma.supplier.findFirst({
        where: { licenseId, code },
        select: { id: true },
      });
      if (!existing) break;
      codeNumber++;
      code = `SUP${String(codeNumber).padStart(5, "0")}`;
    }

    const supplier = await prisma.supplier.create({
      data: {
        id: uuidv4(),
        licenseId,
        code: code,
        codeNumber: codeNumber,
        name: String(payload.name),
        phone: payload.phone || null,
        email: payload.email || null,
        gstin: payload.gstin || null,
        department: payload.department || null,
        addressLine1: payload.addressLine1 || null,
        addressLine2: payload.addressLine2 || null,
        city: payload.city || null,
        state: payload.state || null,
        pincode: payload.pincode || null,
        category: payload.category || null,
        native: payload.native || null,
        language: payload.language || null,
        aadhaar: payload.aadhaar || null,
        pan: payload.pan || null,
        license1: payload.license1 || null,
        license2: payload.license2 || null,
        settlementDays:
          payload.settlementDays != null
            ? Number(payload.settlementDays)
            : null,
        creditLimit:
          payload.creditLimit != null ? Number(payload.creditLimit) : null,
        openingBalance: Number(payload.openingBalance ?? 0),
        notes: payload.notes || null,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });

    res.status(201).json({
      success: true,
      id: supplier.id,
      code: supplier.code,
      codeNumber: supplier.codeNumber,
    });
  } catch (err: any) {
    console.error("[supplier:create]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/suppliers/:id
router.put("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { id } = req.params;
  const payload = req.body;
  try {
    await prisma.supplier.updateMany({
      where: { id, licenseId },
      data: {
        name: String(payload.name),
        phone: payload.phone || null,
        email: payload.email || null,
        gstin: payload.gstin || null,
        department: payload.department || null,
        addressLine1: payload.addressLine1 || null,
        addressLine2: payload.addressLine2 || null,
        city: payload.city || null,
        state: payload.state || null,
        pincode: payload.pincode || null,
        category: payload.category || null,
        native: payload.native || null,
        language: payload.language || null,
        aadhaar: payload.aadhaar || null,
        pan: payload.pan || null,
        license1: payload.license1 || null,
        license2: payload.license2 || null,
        settlementDays:
          payload.settlementDays != null
            ? Number(payload.settlementDays)
            : null,
        creditLimit:
          payload.creditLimit != null ? Number(payload.creditLimit) : null,
        notes: payload.notes || null,
        updatedAt: new Date(),
        isSynced: false,
        syncedAt: null,
      },
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("[supplier:update]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/suppliers/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    await prisma.supplier.updateMany({
      where: { id: req.params.id, licenseId },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
        isSynced: false,
        syncedAt: null,
      },
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("[supplier:delete]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
