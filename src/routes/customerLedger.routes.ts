// backend/src/routes/customerLedger.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import {
  getCustomerLedger,
  getCustomerOutstandingSales,
  createCustomerReceipt,
  listReceipts,
  markCustomerChequeReceived,
} from "../services/customerLedger.service";

const router = Router();
router.use(verifyToken);

function getLicenseId(req: Request): string {
  return (req as any).user?.licenseId ?? "";
}

router.get("/customer-ledger", async (req, res) => {
  const licenseId = getLicenseId(req);
  const { customerId, dateFrom, dateTo, page, pageSize } = req.query;
  if (!customerId || typeof customerId !== "string")
    return res.status(400).json({ error: "customerId required" });
  try {
    const result = await getCustomerLedger({
      licenseId,
      customerId,
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

router.get("/customer-outstanding-sales", async (req, res) => {
  const licenseId = getLicenseId(req);
  const { customerId, q, page, pageSize } = req.query;
  if (!customerId || typeof customerId !== "string")
    return res.status(400).json({ error: "customerId required" });
  try {
    const result = await getCustomerOutstandingSales({
      licenseId,
      customerId,
      q: q ? String(q) : "",
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/customer-receipts", async (req, res) => {
  const licenseId = getLicenseId(req);
  const {
    customerId,
    amount,
    date,
    mode,
    notes,
    allocations,
    chequeNo,
    chequeIssueDate,
    chequeClearanceDate,
  } = req.body;
  if (!customerId || !amount || !date || !mode)
    return res.status(400).json({ error: "Missing required fields" });
  if (mode === "CHEQUE" && !chequeClearanceDate)
    return res.status(400).json({ error: "Cheque clearance date is required" });
  try {
    const result = await createCustomerReceipt({
      licenseId,
      customerId,
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

router.post("/customer-cheque/mark-received", async (req, res) => {
  const licenseId = getLicenseId(req);
  const { txId } = req.body;
  if (!txId) return res.status(400).json({ error: "txId required" });
  try {
    const result = await markCustomerChequeReceived(licenseId, txId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/receipts", async (req, res) => {
  const licenseId = getLicenseId(req);
  const { customerId, q, dateFrom, dateTo, page, pageSize } = req.query;
  try {
    const result = await listReceipts({
      licenseId,
      customerId: customerId ? String(customerId) : null,
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
