// backend/src/routes/purchaseReturn.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import {
  createPurchaseReturn,
  updatePurchaseReturn,
  deletePurchaseReturn,
  listPurchaseReturns,
  getPurchaseReturnFull,
  peekNextPurchaseReturnSlNo,
  savePurchaseReturnHold,
  listPurchaseReturnHolds,
  getPurchaseReturnHold,
  deletePurchaseReturnHold,
  peekNextPurchaseReturnHoldNo,
} from "../services/purchaseReturn.service";

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

// GET /api/purchase-returns/next-slno?licenseId=xxx
router.get("/next-slno", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    const result = await peekNextPurchaseReturnSlNo(licenseId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// ── Holds ───────────────────────────────────────────────────────────────────

// GET /api/purchase-returns/holds/next-no?licenseId=xxx
router.get("/holds/next-no", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    res.json(await peekNextPurchaseReturnHoldNo(licenseId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase-returns/holds?licenseId=xxx&page=&pageSize=
router.get("/holds", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    res.json(
      await listPurchaseReturnHolds(licenseId, {
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
      }),
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase-returns/holds/:id
router.get("/holds/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await getPurchaseReturnHold(licenseId, req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/purchase-returns/holds
router.post("/holds", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const payload = { ...req.body, licenseId };
  try {
    res.json(await savePurchaseReturnHold(payload));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/purchase-returns/holds/:id
router.delete("/holds/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    res.json(await deletePurchaseReturnHold(licenseId, req.params.id));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Root list ────────────────────────────────────────────────────────────────

// GET /api/purchase-returns?licenseId=xxx&q=&supplierId=&dateFrom=&dateTo=&page=&pageSize=
router.get("/", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    const result = await listPurchaseReturns(licenseId, {
      q: req.query.q as string,
      supplierId: (req.query.supplierId as string) || null,
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

// GET /api/purchase-returns/:id
router.get("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await getPurchaseReturnFull(licenseId, req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// POST /api/purchase-returns
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
    const result = await createPurchaseReturn(header, items);
    res.status(201).json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status =
      msg.includes("Supplier") || msg.includes("stock") ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// PUT /api/purchase-returns/:id
router.put("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { id } = req.params;
  const { header, items } = req.body;

  if (!header || !Array.isArray(items)) {
    return res.status(400).json({ error: "header and items required" });
  }

  try {
    const result = await updatePurchaseReturn(licenseId, id, header, items);
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// DELETE /api/purchase-returns/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await deletePurchaseReturn(licenseId, req.params.id);
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

export default router;
