// backend/src/routes/purchase.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import {
  createPurchase,
  updatePurchase,
  deletePurchase,
  listPurchases,
  getPurchaseFull,
  peekNextSlNo,
  savePurchaseHold,
  listPurchaseHolds,
  getPurchaseHold,
  deletePurchaseHold,
  peekNextHoldNo,
} from "../services/purchase.service";

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

// ── Static / special paths first ─────────────────────────────────────────────

// GET /api/purchases/next-slno?licenseId=xxx
router.get("/next-slno", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    const result = await peekNextSlNo(licenseId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// ── Purchase holds ───────────────────────────────────────────────────────────

// GET /api/purchases/holds/next-no?licenseId=xxx
router.get("/holds/next-no", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    res.json(await peekNextHoldNo(licenseId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/purchases/holds?licenseId=xxx&page=&pageSize=
router.get("/holds", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    res.json(
      await listPurchaseHolds(licenseId, {
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
      }),
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/purchases/holds/:id
router.get("/holds/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await getPurchaseHold(licenseId, req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/purchases/holds
router.post("/holds", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const payload = { ...req.body, licenseId };
  try {
    res.json(await savePurchaseHold(payload));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/purchases/holds/:id
router.delete("/holds/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    res.json(await deletePurchaseHold(licenseId, req.params.id));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Root list (static) ──────────────────────────────────────────────────────

// GET /api/purchases?licenseId=xxx&q=&supplierId=&dateFrom=&dateTo=&page=&pageSize=
router.get("/", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    const result = await listPurchases(licenseId, {
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

// ── Dynamic :id routes (MUST come after all static paths) ────────────────────

// GET /api/purchases/:id
router.get("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await getPurchaseFull(licenseId, req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// POST /api/purchases
router.post("/", async (req: Request, res: Response) => {
  const { purchase, items } = req.body;
  if (!purchase?.licenseId) {
    return res.status(400).json({ error: "licenseId required" });
  }
  if (!guardLicense(req, res, purchase.licenseId)) return;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  try {
    const result = await createPurchase(purchase, items);
    res.status(201).json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status =
      msg.includes("Supplier") || msg.includes("BARCODE_IN_USE") ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// PUT /api/purchases/:id
router.put("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { id } = req.params;
  const { header, items } = req.body;

  if (!header || !Array.isArray(items)) {
    return res.status(400).json({ error: "header and items required" });
  }

  try {
    const result = await updatePurchase(licenseId, id, header, items);
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// DELETE /api/purchases/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await deletePurchase(licenseId, req.params.id);
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

export default router;
