// backend/src/routes/supplierLedger.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import {
  getSupplierLedger,
  getSupplierOutstandingBills,
  createSupplierPayment,
  listPayments,
  markChequeReceived,
} from "../services/supplierLedger.service";

const router = Router();

router.use(verifyToken);

function getLicenseId(req: Request): string {
  return (req as any).user?.licenseId ?? "";
}

// GET /api/supplier-ledger
router.get("/supplier-ledger", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { supplierId, dateFrom, dateTo, page, pageSize } = req.query;
  if (!supplierId || typeof supplierId !== "string") {
    return res.status(400).json({ error: "supplierId required" });
  }
  try {
    const result = await getSupplierLedger({
      licenseId,
      supplierId,
      dateFrom: dateFrom ? String(dateFrom) : null,
      dateTo: dateTo ? String(dateTo) : null,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/supplier-outstanding-bills
router.get(
  "/supplier-outstanding-bills",
  async (req: Request, res: Response) => {
    const licenseId = getLicenseId(req);
    const { supplierId, q, page, pageSize } = req.query;
    if (!supplierId || typeof supplierId !== "string") {
      return res.status(400).json({ error: "supplierId required" });
    }
    try {
      const result = await getSupplierOutstandingBills({
        licenseId,
        supplierId,
        q: q ? String(q) : "",
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 50,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /api/supplier-payments (supports CHEQUE mode)
router.post("/supplier-payments", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const {
    supplierId,
    amount,
    date,
    mode,
    notes,
    allocations,
    chequeNo,
    chequeIssueDate,
    chequeClearanceDate,
  } = req.body;

  if (!supplierId || !amount || !date || !mode) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // For cheque mode, clearance date is required
  if (mode === "CHEQUE" && !chequeClearanceDate) {
    return res.status(400).json({ error: "Cheque clearance date is required" });
  }

  try {
    const result = await createSupplierPayment({
      licenseId,
      supplierId,
      amount,
      date,
      mode,
      notes: notes || null,
      allocations: allocations || [],
      chequeNo: chequeNo || null,
      chequeIssueDate: chequeIssueDate || null,
      chequeClearanceDate: chequeClearanceDate || null,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supplier-cheque/mark-received
router.post(
  "/supplier-cheque/mark-received",
  async (req: Request, res: Response) => {
    const licenseId = getLicenseId(req);
    const { txId } = req.body;
    if (!txId) {
      return res.status(400).json({ error: "txId required" });
    }
    try {
      const result = await markChequeReceived(licenseId, txId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/payments
router.get("/payments", async (req: Request, res: Response) => {
  const licenseId = getLicenseId(req);
  const { supplierId, q, dateFrom, dateTo, page, pageSize } = req.query;
  try {
    const result = await listPayments({
      licenseId,
      supplierId: supplierId ? String(supplierId) : null,
      q: q ? String(q) : "",
      dateFrom: dateFrom ? String(dateFrom) : null,
      dateTo: dateTo ? String(dateTo) : null,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
