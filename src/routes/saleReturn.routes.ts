// backend/src/routes/saleReturn.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import {
  createSaleReturn,
  updateSaleReturn,
  deleteSaleReturn,
  listSaleReturns,
  getSaleReturnFull,
  peekNextSaleReturnSlNo,
} from "../services/saleReturn.service";

const router = Router();

router.use(verifyToken);

// ── License guard helpers ─────────────────────────────────────────────────────

function getLicenseId(req: Request): string {
  return (req as any).user?.licenseId ?? "";
}

function guardLicense(req: Request, res: Response, licenseId: string): boolean {
  if (!licenseId || licenseId !== getLicenseId(req)) {
    res.status(403).json({ error: "License mismatch" });
    return false;
  }
  return true;
}

// ── Static / special paths ───────────────────────────────────────────────────

// GET /api/sale-returns/next-slno?licenseId=xxx
router.get("/next-slno", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    const result = await peekNextSaleReturnSlNo(licenseId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// ── Root list ────────────────────────────────────────────────────────────────

// GET /api/sale-returns?licenseId=xxx&q=&customerId=&dateFrom=&dateTo=&page=&pageSize=
router.get("/", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    const result = await listSaleReturns(licenseId, {
      q: req.query.q as string,
      customerId: (req.query.customerId as string) || null,
      dateFrom: (req.query.dateFrom as string) || null,
      dateTo: (req.query.dateTo as string) || null,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
      includeDeleted: req.query.includeDeleted === "true",
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// ── Dynamic :id routes ───────────────────────────────────────────────────────

// GET /api/sale-returns/:id
router.get("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await getSaleReturnFull(licenseId, req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// POST /api/sale-returns
router.post("/", async (req: Request, res: Response) => {
  const { header, items } = req.body;
  if (!header?.licenseId) {
    return res.status(400).json({ error: "licenseId required" });
  }
  if (!guardLicense(req, res, header.licenseId)) return;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  try {
    const result = await createSaleReturn(header, items);
    res.status(201).json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status =
      msg.includes("Customer") || msg.includes("stock") ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// PUT /api/sale-returns/:id
router.put("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { id } = req.params;
  const { header, items } = req.body;

  if (!header || !Array.isArray(items)) {
    return res.status(400).json({ error: "header and items required" });
  }

  try {
    const result = await updateSaleReturn(licenseId, id, header, items);
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// DELETE /api/sale-returns/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await deleteSaleReturn(licenseId, req.params.id);
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

export default router;
