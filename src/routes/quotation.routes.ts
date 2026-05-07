// backend/src/routes/quotation.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import {
  createQuotation,
  updateQuotation,
  deleteQuotation,
  listQuotations,
  getQuotationFull,
  peekNextQuotationSlNo,
  convertQuotationToSale,
} from "../services/quotation.service";

const router = Router();

router.use(verifyToken);

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

// GET /api/quotations/next-slno?licenseId=xxx
router.get("/next-slno", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    res.json(await peekNextQuotationSlNo(licenseId));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// GET /api/quotations?licenseId=xxx&q=&status=&customerId=&dateFrom=&dateTo=&page=&pageSize=
router.get("/", async (req: Request, res: Response) => {
  const licenseId = req.query.licenseId as string;
  if (!guardLicense(req, res, licenseId)) return;
  try {
    const result = await listQuotations(licenseId, {
      q: req.query.q as string,
      customerId: (req.query.customerId as string) || null,
      status: (req.query.status as string) || null,
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

// GET /api/quotations/:id
router.get("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await getQuotationFull(licenseId, req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed" });
  }
});

// POST /api/quotations
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
    const result = await createQuotation(header, items);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed" });
  }
});

// PUT /api/quotations/:id
router.put("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { id } = req.params;
  const { header, items } = req.body;
  if (!header || !Array.isArray(items)) {
    return res.status(400).json({ error: "header and items required" });
  }
  try {
    const result = await updateQuotation(licenseId, id, header, items);
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status = msg.includes("not found") ? 404 : msg.includes("converted") ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// DELETE /api/quotations/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await deleteQuotation(licenseId, req.params.id);
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

// POST /api/quotations/:id/convert
router.post("/:id/convert", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  try {
    const result = await convertQuotationToSale(
      licenseId,
      req.params.id,
      req.body ?? {},
    );
    res.json(result);
  } catch (err: any) {
    const msg = err.message || "Failed";
    const status =
      msg.includes("not found") ? 404
      : msg.includes("Insufficient") || msg.includes("already converted") ? 400
      : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

export default router;
