// backend/src/services/supplierLedger.service.ts
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ─── Helper: compute running balance (exclude pending cheques) ───────────────
async function computeOpeningAndBalance(
  licenseId: string,
  supplierId: string,
  dateFrom?: string | null,
  dateTo?: string | null,
): Promise<{ openingBalance: number; balance: number }> {
  // Opening balance sum before dateFrom, excluding pending cheques
  const whereBefore: any = {
    licenseId,
    supplierId,
    deletedAt: null,
    kind: { in: ["OPENING", "PURCHASE", "PAYMENT", "ADJUSTMENT"] },
    AND: [
      {
        OR: [
          { kind: { not: "PAYMENT" } },
          { paymentStatus: "CLEARED" },
          { paymentStatus: null },
        ],
      },
    ],
  };
  if (dateFrom) whereBefore.date = { lt: new Date(dateFrom) };

  const openingSum = await prisma.supplierTransaction.aggregate({
    where: whereBefore,
    _sum: { amount: true },
  });
  const openingBalance = Number(openingSum._sum.amount ?? 0);

  // Current balance = opening + sum of transactions in filtered range (excluding pending cheques)
  const rangeWhere: any = {
    licenseId,
    supplierId,
    deletedAt: null,
    kind: { in: ["OPENING", "PURCHASE", "PAYMENT", "ADJUSTMENT"] },
    AND: [
      {
        OR: [
          { kind: { not: "PAYMENT" } },
          { paymentStatus: "CLEARED" },
          { paymentStatus: null },
        ],
      },
    ],
  };
  if (dateFrom) rangeWhere.date = { gte: new Date(dateFrom) };
  if (dateTo) rangeWhere.date = { lt: new Date(dateTo) };

  const rangeSum = await prisma.supplierTransaction.aggregate({
    where: rangeWhere,
    _sum: { amount: true },
  });
  const balance = openingBalance + Number(rangeSum._sum.amount ?? 0);

  return { openingBalance, balance };
}

// ─── GET SUPPLIER LEDGER (with cheque fields) ────────────────────────────────
export async function getSupplierLedger(params: {
  licenseId: string;
  supplierId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const {
    licenseId,
    supplierId,
    dateFrom = null,
    dateTo = null,
    page = 1,
    pageSize = 50,
  } = params;

  const where: any = {
    licenseId,
    supplierId,
    deletedAt: null,
    kind: { in: ["OPENING", "PURCHASE", "PAYMENT", "ADJUSTMENT"] },
  };
  if (dateFrom) where.date = { gte: new Date(dateFrom) };
  if (dateTo) where.date = { lt: new Date(dateTo) };

  const [rows, total] = await Promise.all([
    prisma.supplierTransaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        kind: true,
        refId: true,
        refNo: true,
        date: true,
        amount: true,
        sign: true,
        notes: true,
        createdAt: true,
        paymentStatus: true,
        chequeNo: true,
        chequeIssueDate: true,
        chequeClearanceDate: true,
      },
    }),
    prisma.supplierTransaction.count({ where }),
  ]);

  const { openingBalance, balance } = await computeOpeningAndBalance(
    licenseId,
    supplierId,
    dateFrom,
    dateTo,
  );

  return {
    success: true,
    rows,
    total,
    openingBalance,
    balance,
  };
}

// ─── GET OUTSTANDING BILLS (unchanged) ───────────────────────────────────────
export async function getSupplierOutstandingBills(params: {
  licenseId: string;
  supplierId: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const { licenseId, supplierId, q = "", page = 1, pageSize = 50 } = params;

  const where: any = {
    licenseId,
    supplierId,
    deletedAt: null,
    purchaseType: "CREDIT",
  };
  if (q) {
    where.OR = [
      { billNo: { contains: q, mode: "insensitive" } },
      { slNo: { equals: isNaN(Number(q)) ? undefined : Number(q) } },
    ];
  }

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { purchaseDate: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      slNo: true,
      billNo: true,
      purchaseDate: true,
      totalAmount: true,
      discount: true,
      purchaseType: true,
    },
  });

  const rows = await Promise.all(
    purchases.map(async (p) => {
      const paidAgg = await prisma.supplierBillSettlement.aggregate({
        where: { licenseId, purchaseId: p.id },
        _sum: { amount: true },
      });
      const grandAmount = Math.max(
        0,
        Number(p.totalAmount) - Number(p.discount ?? 0),
      );
      const paidAmount = Number(paidAgg._sum.amount ?? 0);
      const remainingDue = Math.max(0, grandAmount - paidAmount);
      return {
        id: p.id,
        slNo: p.slNo,
        billNo: p.billNo,
        purchaseDate: p.purchaseDate,
        totalAmount: Number(p.totalAmount),
        discount: Number(p.discount ?? 0),
        purchaseType: p.purchaseType,
        grandAmount,
        paidAmount,
        remainingDue,
      };
    }),
  );

  const total = await prisma.purchase.count({ where });
  return {
    success: true,
    rows: rows.filter((r) => r.remainingDue > 0),
    total,
  };
}

// ─── CREATE SUPPLIER PAYMENT (with CHEQUE mode) ──────────────────────────────
export async function createSupplierPayment(payload: {
  licenseId: string;
  supplierId: string;
  amount: number;
  date: string;
  mode: "CASH" | "BANK" | "CHEQUE";
  notes?: string | null;
  chequeNo?: string | null;
  chequeIssueDate?: string | null;
  chequeClearanceDate?: string | null;
  allocations?: Array<{ purchaseId: string; amount: number }>;
}) {
  const {
    licenseId,
    supplierId,
    amount,
    date,
    mode,
    notes,
    chequeNo = null,
    chequeIssueDate = null,
    chequeClearanceDate = null,
    allocations = [],
  } = payload;

  if (amount <= 0) throw new Error("Amount must be positive");
  if (mode === "CHEQUE" && !chequeClearanceDate)
    throw new Error("Cheque clearance date is required");

  const now = new Date();
  const paymentDate = new Date(date);
  const txId = uuidv4();
  const isCheque = mode === "CHEQUE";
  const paymentStatus = isCheque ? "PENDING_CHEQUE" : "CLEARED";

  const allocSum = allocations.reduce((s, a) => s + a.amount, 0);
  if (allocSum > amount)
    throw new Error("Allocated amount exceeds payment amount");

  for (const a of allocations) {
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: a.purchaseId,
        licenseId,
        supplierId,
        deletedAt: null,
        purchaseType: "CREDIT",
      },
      select: { totalAmount: true, discount: true },
    });
    if (!purchase)
      throw new Error(`Purchase ${a.purchaseId} not found or not credit`);
    const paidAgg = await prisma.supplierBillSettlement.aggregate({
      where: { licenseId, purchaseId: a.purchaseId, deletedAt: null },
      _sum: { amount: true },
    });
    const grand = Math.max(
      0,
      Number(purchase.totalAmount) - Number(purchase.discount ?? 0),
    );
    const paid = Number(paidAgg._sum.amount ?? 0);
    const remaining = grand - paid;
    if (a.amount > remaining + 1e-6)
      throw new Error(
        `Allocation for purchase ${a.purchaseId} exceeds remaining due`,
      );
  }

  await prisma.$transaction(async (tx) => {
    // Supplier transaction (with cheque fields)
    await tx.supplierTransaction.create({
      data: {
        id: txId,
        licenseId,
        supplierId,
        kind: "PAYMENT",
        refId: txId,
        refNo: null,
        date: paymentDate,
        amount: amount,
        sign: -1,
        notes: notes || (isCheque ? "Cheque Payment" : "Payment"),
        paymentStatus,
        chequeNo: chequeNo,
        chequeIssueDate: chequeIssueDate ? new Date(chequeIssueDate) : null,
        chequeClearanceDate: chequeClearanceDate
          ? new Date(chequeClearanceDate)
          : null,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });

    // Bill settlements
    for (const a of allocations) {
      await tx.supplierBillSettlement.create({
        data: {
          id: uuidv4(),
          licenseId,
          supplierId,
          paymentTxId: txId,
          purchaseId: a.purchaseId,
          amount: a.amount,
          createdAt: now,
        },
      });
    }

    // Cash transaction only for CASH/BANK; cheque waits for clearance
    if (!isCheque && (mode === "CASH" || mode === "BANK")) {
      await tx.cashTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          kind: "PAYMENT",
          refId: txId,
          refNo: null,
          date: paymentDate,
          amount: amount,
          sign: -1,
          notes:
            mode === "CASH"
              ? "Supplier Payment (Cash)"
              : "Supplier Payment (Bank)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }
  });

  return { success: true, id: txId, paymentStatus };
}

// ─── MARK CHEQUE AS RECEIVED (CLEARED) ───────────────────────────────────────
export async function markChequeReceived(licenseId: string, txId: string) {
  const tx = await prisma.supplierTransaction.findFirst({
    where: { id: txId, licenseId, kind: "PAYMENT" },
  });
  if (!tx) throw new Error("Transaction not found");
  if (tx.paymentStatus !== "PENDING_CHEQUE")
    throw new Error("Transaction is not a pending cheque");

  const now = new Date();
  await prisma.$transaction(async (prisma) => {
    // Update status to CLEARED
    await prisma.supplierTransaction.update({
      where: { id: txId },
      data: {
        paymentStatus: "CLEARED",
        updatedAt: now,
        isSynced: false,
      },
    });

    // Insert cash transaction (cheque cleared through bank)
    await prisma.cashTransaction.create({
      data: {
        id: uuidv4(),
        licenseId,
        kind: "PAYMENT",
        refId: txId,
        refNo: tx.chequeNo,
        date: now,
        amount: Number(tx.amount),
        sign: -1,
        notes: `Cheque Cleared${tx.chequeNo ? ` - ${tx.chequeNo}` : ""}`,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });
  });
  return { success: true };
}

// ─── LIST PAYMENTS (with cheque status and filters) ──────────────────────────
export async function listPayments(params: {
  licenseId: string;
  supplierId?: string | null;
  q?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const {
    licenseId,
    supplierId = null,
    q = "",
    dateFrom = null,
    dateTo = null,
    page = 1,
    pageSize = 50,
  } = params;

  const where: any = {
    licenseId,
    kind: "PAYMENT",
    deletedAt: null,
  };
  if (supplierId) where.supplierId = supplierId;
  if (dateFrom) where.date = { gte: new Date(dateFrom) };
  if (dateTo) where.date = { lt: new Date(dateTo) };

  let rows = await prisma.supplierTransaction.findMany({
    where,
    orderBy: { date: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      supplier: { select: { name: true } },
    },
  });

  if (q) {
    const lowerQ = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.supplier?.name?.toLowerCase().includes(lowerQ) ?? false) ||
        (r.notes?.toLowerCase().includes(lowerQ) ?? false),
    );
  }

  const rowsWithAlloc = await Promise.all(
    rows.map(async (r) => {
      const allocAgg = await prisma.supplierBillSettlement.aggregate({
        where: { licenseId, paymentTxId: r.id },
        _sum: { amount: true },
      });
      const allocated = Number(allocAgg._sum.amount ?? 0);
      const bills = await prisma.supplierBillSettlement.findMany({
        where: { licenseId, paymentTxId: r.id },
        select: {
          purchaseId: true,
          purchase: { select: { billNo: true, slNo: true } },
        },
      });
      const billRefs = bills.map((b) => ({
        purchaseId: b.purchaseId,
        billRef:
          b.purchase?.billNo ??
          (b.purchase?.slNo ? `SL-${b.purchase.slNo}` : ""),
      }));
      // Determine mode from notes and cheque flag
      let mode: "CASH" | "BANK" | "CHEQUE" = "CASH";
      if (r.notes?.includes("Bank")) mode = "BANK";
      else if (r.chequeNo || r.paymentStatus) mode = "CHEQUE";

      const paymentStatus = r.paymentStatus ?? null;
      return {
        id: r.id,
        supplierId: r.supplierId,
        supplierName: r.supplier?.name ?? "",
        date: r.date.toISOString(),
        amount: Number(r.amount),
        mode,
        paymentStatus,
        notes: r.notes,
        allocated,
        unallocated: Math.max(0, Number(r.amount) - allocated),
        bills: billRefs,
      };
    }),
  );

  const total = await prisma.supplierTransaction.count({ where });
  return {
    success: true,
    rows: rowsWithAlloc,
    total,
  };
}
