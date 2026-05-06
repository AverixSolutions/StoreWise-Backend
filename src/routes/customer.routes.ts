// backend/src/routes/customer.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.use(verifyToken);

function getLicenseId(req: Request): string {
  return (req as any).user?.licenseId ?? "";
}

// GET /api/customers
router.get("/", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const {
    q = "",
    page = "1",
    pageSize = "50",
  } = req.query as Record<string, string>;

  const pg = Math.max(1, Number(page));
  const ps = Math.max(1, Number(pageSize));

  const where: any = {
    licenseId,
    deletedAt: null,
  };

  if (q.trim()) {
    where.OR = [
      { name: { contains: q.trim(), mode: "insensitive" } },
      { phone: { contains: q.trim() } },
      { code: { contains: q.trim() } },
    ];
  }

  try {
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (pg - 1) * ps,
        take: ps,
        select: {
          id: true,
          code: true,
          codeNumber: true,
          name: true,
          phone: true,
          email: true,
          gstin: true,
          category: true,
          city: true,
          state: true,
          openingBalance: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.customer.count({ where }),
    ]);
    res.json({ success: true, customers, total, page: pg, pageSize: ps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/distincts
router.get("/distincts", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const [nameRows, categoryRows, cityRows, stateRows] = await Promise.all([
      prisma.customer.findMany({
        where: { licenseId, deletedAt: null },
        select: { name: true },
        distinct: ["name"],
        orderBy: { name: "asc" },
      }),
      prisma.customer.findMany({
        where: { licenseId, deletedAt: null, category: { not: null } },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      }),
      prisma.customer.findMany({
        where: { licenseId, deletedAt: null, city: { not: null } },
        select: { city: true },
        distinct: ["city"],
        orderBy: { city: "asc" },
      }),
      prisma.customer.findMany({
        where: { licenseId, deletedAt: null, state: { not: null } },
        select: { state: true },
        distinct: ["state"],
        orderBy: { state: "asc" },
      }),
    ]);
    res.json({
      names: nameRows.map((r) => r.name).filter(Boolean),
      categories: categoryRows.map((r) => r.category).filter(Boolean),
      cities: cityRows.map((r) => r.city).filter(Boolean),
      states: stateRows.map((r) => r.state).filter(Boolean),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/next-code
router.get("/next-code", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const maxRow = await prisma.customer.findFirst({
      where: { licenseId },
      orderBy: { codeNumber: "desc" },
      select: { codeNumber: true },
    });
    const nextCodeNumber = (maxRow?.codeNumber ?? 0) + 1;
    res.json({
      nextCodeNumber,
      suggestedCode: `C${String(nextCodeNumber).padStart(5, "0")}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/count
router.get("/count", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { q = "" } = req.query as Record<string, string>;
  const where: any = { licenseId, deletedAt: null };
  if (q.trim()) {
    where.OR = [
      { name: { contains: q.trim(), mode: "insensitive" } },
      { phone: { contains: q.trim() } },
    ];
  }
  try {
    const count = await prisma.customer.count({ where });
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
router.get("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { id } = req.params;
  try {
    const customer = await prisma.customer.findFirst({
      where: { id, licenseId, deletedAt: null },
    });
    if (!customer)
      return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, customer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post("/", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const {
    name,
    phone,
    email,
    gstin,
    category,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    openingBalance = 0,
    notes,
  } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    const maxRow = await prisma.customer.findFirst({
      where: { licenseId },
      orderBy: { codeNumber: "desc" },
      select: { codeNumber: true },
    });
    const codeNumber = (maxRow?.codeNumber ?? 0) + 1;
    const code = `C${String(codeNumber).padStart(5, "0")}`;
    const now = new Date();

    const customer = await prisma.customer.create({
      data: {
        licenseId,
        code,
        codeNumber,
        name,
        phone: phone || null,
        email: email || null,
        gstin: gstin || null,
        category: category || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        openingBalance: Number(openingBalance || 0),
        notes: notes || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Create opening balance transaction if non-zero
    if (Number(openingBalance || 0) !== 0) {
      await prisma.customerTransaction.create({
        data: {
          id: require("crypto").randomUUID(),
          licenseId,
          customerId: customer.id,
          kind: "OPENING",
          refId: null,
          refNo: null,
          date: now,
          amount: Math.abs(Number(openingBalance)),
          sign: Number(openingBalance) >= 0 ? 1 : -1,
          notes: "Opening Balance",
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    res.json({ success: true, id: customer.id, code, codeNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id
router.put("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { id } = req.params;
  const {
    name,
    phone,
    email,
    gstin,
    category,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    openingBalance = 0,
    notes,
  } = req.body;

  try {
    const now = new Date();
    await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        gstin: gstin || null,
        category: category || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        openingBalance: Number(openingBalance || 0),
        notes: notes || null,
        updatedAt: now,
      },
    });

    // Replace opening balance transaction
    await prisma.customerTransaction.deleteMany({
      where: { customerId: id, licenseId, kind: "OPENING" },
    });
    if (Number(openingBalance || 0) !== 0) {
      await prisma.customerTransaction.create({
        data: {
          id: require("crypto").randomUUID(),
          licenseId,
          customerId: id,
          kind: "OPENING",
          refId: null,
          refNo: null,
          date: now,
          amount: Math.abs(Number(openingBalance)),
          sign: Number(openingBalance) >= 0 ? 1 : -1,
          notes: "Opening Balance",
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { id } = req.params;
  try {
    await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
