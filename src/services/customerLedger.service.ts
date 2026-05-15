// backend/src/services/customerLedger.service.ts
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

export async function getCustomerLedger(params: {
  licenseId: string;
  customerId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const {
    licenseId,
    customerId,
    dateFrom = null,
    dateTo = null,
    page = 1,
    pageSize = 50,
  } = params;

  const where: any = {
    licenseId,
    customerId,
    deletedAt: null,
    kind: { in: ["OPENING", "SALE", "RETURN", "RECEIPT", "ADJUSTMENT"] },
  };
  if (dateFrom) where.date = { gte: new Date(dateFrom) };
  if (dateTo) where.date = { ...(where.date || {}), lt: new Date(dateTo) };

  const [rows, total] = await Promise.all([
    prisma.customerTransaction.findMany({
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
        paymentMode: true,
        chequeNo: true,
        chequeIssueDate: true,
        chequeClearanceDate: true,
      },
    }),
    prisma.customerTransaction.count({ where }),
  ]);

  // Balance excludes pending cheques
  const balanceAgg = await prisma.customerTransaction.aggregate({
    where: {
      licenseId,
      customerId,
      deletedAt: null,
      kind: { in: ["OPENING", "SALE", "RETURN", "RECEIPT", "ADJUSTMENT"] },
      AND: [
        {
          OR: [
            { kind: { not: "RECEIPT" } },
            { paymentStatus: "CLEARED" },
            { paymentStatus: null },
          ],
        },
      ],
    },
    _sum: { amount: true },
  });

  // sign is stored separately — we need weighted sum
  const signedRows = await prisma.customerTransaction.findMany({
    where: {
      licenseId,
      customerId,
      deletedAt: null,
      kind: { in: ["OPENING", "SALE", "RETURN", "RECEIPT", "ADJUSTMENT"] },
      AND: [
        {
          OR: [
            { kind: { not: "RECEIPT" } },
            { paymentStatus: "CLEARED" },
            { paymentStatus: null },
          ],
        },
      ],
    },
    select: { amount: true, sign: true },
  });

  const balance = signedRows.reduce(
    (sum, r) => sum + Number(r.amount) * Number(r.sign),
    0,
  );

  return { success: true, rows, total, openingBalance: 0, balance };
}

export async function getCustomerOutstandingSales(params: {
  licenseId: string;
  customerId: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const { licenseId, customerId, q = "", page = 1, pageSize = 50 } = params;

  const where: any = {
    licenseId,
    customerId,
    deletedAt: null,
    saleType: "CREDIT",
  };
  if (q) {
    where.OR = [
      { billNo: { contains: q, mode: "insensitive" } },
      { slNo: { equals: isNaN(Number(q)) ? undefined : Number(q) } },
    ];
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { saleDate: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      slNo: true,
      billNo: true,
      saleDate: true,
      totalAmount: true,
      discount: true,
      saleType: true,
    },
  });

  const rows = await Promise.all(
    sales.map(async (s) => {
      const paidAgg = await prisma.customerBillSettlement.aggregate({
        where: { licenseId, saleId: s.id },
        _sum: { amount: true },
      });
      const grandAmount = Math.max(
        0,
        Number(s.totalAmount) - Number(s.discount ?? 0),
      );
      const paidAmount = Number(paidAgg._sum.amount ?? 0);
      const remainingDue = Math.max(0, grandAmount - paidAmount);
      return {
        id: s.id,
        slNo: s.slNo,
        billNo: s.billNo,
        saleDate: s.saleDate,
        totalAmount: Number(s.totalAmount),
        discount: Number(s.discount ?? 0),
        saleType: s.saleType,
        grandAmount,
        paidAmount,
        remainingDue,
      };
    }),
  );

  const total = await prisma.sale.count({ where });
  return { success: true, rows: rows.filter((r) => r.remainingDue > 0), total };
}

export async function createCustomerReceipt(payload: {
  licenseId: string;
  customerId: string;
  amount: number;
  date: string;
  mode: "CASH" | "BANK" | "CHEQUE";
  notes?: string | null;
  chequeNo?: string | null;
  chequeIssueDate?: string | null;
  chequeClearanceDate?: string | null;
  allocations?: Array<{ saleId: string; amount: number }>;
}) {
  const {
    licenseId,
    customerId,
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
  const txId = uuidv4();
  const isCheque = mode === "CHEQUE";
  const paymentStatus = isCheque ? "PENDING_CHEQUE" : null;
  const allocSum = allocations.reduce((s, a) => s + a.amount, 0);
  if (allocSum > amount)
    throw new Error("Allocated amount exceeds receipt amount");

  await prisma.$transaction(async (tx) => {
    await tx.customerTransaction.create({
      data: {
        id: txId,
        licenseId,
        customerId,
        kind: "RECEIPT",
        refId: txId,
        refNo: null,
        date: new Date(date),
        amount,
        sign: -1,
        notes: notes || (isCheque ? "Cheque Receipt" : "Receipt"),
        paymentStatus,
        paymentMode: mode,
        chequeNo,
        chequeIssueDate: chequeIssueDate ? new Date(chequeIssueDate) : null,
        chequeClearanceDate: chequeClearanceDate
          ? new Date(chequeClearanceDate)
          : null,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });

    for (const a of allocations) {
      await tx.customerBillSettlement.create({
        data: {
          id: uuidv4(),
          licenseId,
          customerId,
          receiptTxId: txId,
          saleId: a.saleId,
          amount: a.amount,
          createdAt: now,
        },
      });
    }

    if (!isCheque) {
      await tx.cashTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          kind: "RECEIPT",
          refId: txId,
          refNo: null,
          date: new Date(date),
          amount,
          sign: 1,
          notes:
            mode === "CASH"
              ? "Customer Receipt (Cash)"
              : "Customer Receipt (Bank)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }
  });

  return { success: true, id: txId, paymentStatus };
}

export async function markCustomerChequeReceived(
  licenseId: string,
  txId: string,
) {
  const tx = await prisma.customerTransaction.findFirst({
    where: { id: txId, licenseId, kind: "RECEIPT" },
  });
  if (!tx) throw new Error("Transaction not found");
  if (tx.paymentStatus !== "PENDING_CHEQUE")
    throw new Error("Transaction is not a pending cheque");

  const now = new Date();
  await prisma.$transaction(async (prisma) => {
    await prisma.customerTransaction.update({
      where: { id: txId },
      data: {
        paymentStatus: "CLEARED",
        paymentMode: tx.paymentMode ?? "CHEQUE",
        updatedAt: now,
        isSynced: false,
        syncedAt: null,
      },
    });
    await prisma.cashTransaction.create({
      data: {
        id: uuidv4(),
        licenseId,
        kind: "RECEIPT",
        refId: txId,
        refNo: tx.chequeNo,
        date: now,
        amount: Number(tx.amount),
        sign: 1,
        notes: `Cheque Cleared${tx.chequeNo ? ` - ${tx.chequeNo}` : ""}`,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });
  });
  return { success: true };
}

export async function listReceipts(params: {
  licenseId: string;
  customerId?: string | null;
  q?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const {
    licenseId,
    customerId = null,
    q = "",
    dateFrom = null,
    dateTo = null,
    page = 1,
    pageSize = 50,
  } = params;

  const where: any = { licenseId, kind: "RECEIPT", deletedAt: null };
  if (customerId) where.customerId = customerId;
  if (dateFrom) where.date = { gte: new Date(dateFrom) };
  if (dateTo) where.date = { ...(where.date || {}), lt: new Date(dateTo) };

  let rows = await prisma.customerTransaction.findMany({
    where,
    orderBy: { date: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { customer: { select: { name: true } } },
  });

  if (q) {
    const lowerQ = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.customer?.name?.toLowerCase().includes(lowerQ) ?? false) ||
        (r.notes?.toLowerCase().includes(lowerQ) ?? false),
    );
  }

  const rowsWithAlloc = await Promise.all(
    rows.map(async (r) => {
      const allocAgg = await prisma.customerBillSettlement.aggregate({
        where: { licenseId, receiptTxId: r.id },
        _sum: { amount: true },
      });
      const allocated = Number(allocAgg._sum.amount ?? 0);

      const bills = await prisma.customerBillSettlement.findMany({
        where: { licenseId, receiptTxId: r.id },
        select: {
          saleId: true,
          sale: { select: { billNo: true, slNo: true } },
        },
      });

      const rawMode = String((r as any).paymentMode || "").toUpperCase();
      let mode: "CASH" | "BANK" | "CHEQUE" =
        rawMode === "BANK" || rawMode === "CHEQUE" ? (rawMode as any) : "CASH";

      if (!(r as any).paymentMode) {
        if (
          r.chequeNo ||
          r.chequeIssueDate ||
          r.chequeClearanceDate ||
          r.paymentStatus === "PENDING_CHEQUE"
        ) {
          mode = "CHEQUE";
        } else if (r.notes?.toLowerCase().includes("bank")) {
          mode = "BANK";
        }
      }

      return {
        id: r.id,
        customerId: r.customerId,
        customerName: r.customer?.name ?? "",
        date: r.date.toISOString(),
        amount: Number(r.amount),
        mode,
        paymentStatus: r.paymentStatus ?? null,
        paymentMode: mode,
        notes: r.notes,
        allocated,
        unallocated: Math.max(0, Number(r.amount) - allocated),
        bills: bills.map((b) => ({
          saleId: b.saleId,
          billRef: b.sale?.billNo ?? (b.sale?.slNo ? `SL-${b.sale.slNo}` : ""),
        })),
      };
    }),
  );

  const total = await prisma.customerTransaction.count({ where });
  return { success: true, rows: rowsWithAlloc, total };
}
