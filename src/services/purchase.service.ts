// backend/src/services/purchase.service.ts
// Prisma port of the SQLite purchase logic.
// Handles: create/update/delete with batch stock management + ledger entries.
// Holds: CRUD against PurchaseHold table.

import { PrismaClient, TaxPercent } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePurchaseBatchNo(
  billNo: string | null | undefined,
  purchaseDate: string | Date,
): string {
  const rawBill = String(billNo || "NO-BILL")
    .trim()
    .replace(/[^\w-]/g, "");
  const d =
    purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `PB-${rawBill}-${dd}-${mm}-${yyyy}`;
}

function toTaxPercent(v: string): TaxPercent {
  const valid: TaxPercent[] = ["NT", "P5", "P12", "P18", "P28"];
  return valid.includes(v as TaxPercent) ? (v as TaxPercent) : "NT";
}

async function getNextSlNo(tx: any, licenseId: string): Promise<number> {
  const agg = await tx.purchase.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return (agg._max.slNo ?? 0) + 1;
}

async function getNextHoldNo(tx: any, licenseId: string): Promise<number> {
  const agg = await tx.purchaseHold.aggregate({
    where: { licenseId },
    _max: { holdNo: true },
  });
  return (agg._max.holdNo ?? 0) + 1;
}

// Resolve or create a ProductBatch for a purchase item.
// Simplified compared to SQLite version — no barcode sequence, just identity matching.
async function resolveOrCreateBatch(
  tx: any,
  {
    licenseId,
    productId,
    barcode,
    mrp,
    salePrice,
    costPrice,
    batchNo,
    purchaseBatchNo,
    purchaseId,
    mfgDate,
    expiryDate,
    receivedAt,
  }: {
    licenseId: string;
    productId: string;
    barcode?: string | null;
    mrp?: number | null;
    salePrice?: number | null;
    costPrice?: number | null;
    batchNo?: string | null;
    purchaseBatchNo?: string | null;
    purchaseId?: string | null;
    mfgDate?: string | null;
    expiryDate?: string | null;
    receivedAt?: Date;
  },
) {
  // 1. If barcode provided, check if it already exists (must be same product)
  if (barcode) {
    const existing = await tx.productBatch.findFirst({
      where: { licenseId, barcode, deletedAt: null },
    });
    if (existing) {
      if (existing.productId !== productId) {
        throw new Error(
          `BARCODE_IN_USE: Barcode ${barcode} already belongs to another product`,
        );
      }
      return existing;
    }
  }

  // 2. Try to find by purchaseBatchNo + identity fields (group merge)
  if (purchaseBatchNo) {
    const existing = await tx.productBatch.findFirst({
      where: {
        licenseId,
        productId,
        purchaseBatchNo,
        deletedAt: null,
        ...(barcode !== undefined ? { barcode: barcode ?? null } : {}),
        mrp: mrp ?? null,
        salePrice: salePrice ?? null,
        batchNo: batchNo ?? null,
        mfgDate: mfgDate ?? null,
        expiryDate: expiryDate ?? null,
      },
    });
    if (existing) return existing;
  }

  // 3. Create new batch
  return tx.productBatch.create({
    data: {
      id: uuidv4(),
      licenseId,
      productId,
      barcode: barcode ?? null,
      mrp: mrp != null ? mrp : null,
      salePrice: salePrice != null ? salePrice : null,
      costPrice: costPrice != null ? costPrice : null,
      batchNo: batchNo ?? null,
      purchaseBatchNo: purchaseBatchNo ?? null,
      purchaseId: purchaseId ?? null,
      mfgDate: mfgDate ?? null,
      expiryDate: expiryDate ?? null,
      receivedAt: receivedAt ?? new Date(),
      stock: 0,
      isSystemGeneratedBarcode: false,
    },
  });
}

// Bump batch stock by delta and recompute product.stock as SUM
async function bumpBatchAndProductStock(
  tx: any,
  batchId: string,
  productId: string,
  delta: number,
) {
  await tx.productBatch.update({
    where: { id: batchId },
    data: { stock: { increment: delta } },
  });

  const agg = await tx.productBatch.aggregate({
    where: { productId, deletedAt: null },
    _sum: { stock: true },
  });

  await tx.product.update({
    where: { id: productId },
    data: {
      stock: agg._sum.stock ?? 0,
      updatedAt: new Date(),
      isSynced: false,
      syncedAt: null,
    },
  });
}

// ── CREATE PURCHASE ───────────────────────────────────────────────────────────

export interface CreatePurchaseInput {
  licenseId: string;
  billNo?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  purchaseType?: "CASH" | "CREDIT";
  purchaseDate?: string | Date;
  entryTime?: string | Date | null;
  discount?: number;
}

export interface PurchaseItemInput {
  productId: string;
  barcode?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number | null;
  taxPercent: string;
  taxAmount?: number;
  discount?: number;
  discountType?: "ABS" | "PCT";
  salePrice?: number | null;
  profit?: number | null;
  totalCost?: number;
  billedValue?: number;
  effectiveUnitValue?: number;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  isFree?: boolean | number;
  profitPercent?: number;
}

export async function createPurchase(
  purchase: CreatePurchaseInput,
  items: PurchaseItemInput[],
) {
  const { licenseId } = purchase;
  const now = new Date();
  const purchaseDate = purchase.purchaseDate
    ? new Date(purchase.purchaseDate)
    : now;
  const purchaseBatchNo = makePurchaseBatchNo(purchase.billNo, purchaseDate);
  const newId = uuidv4();

  let totalAmount = 0;

  const result = await prisma.$transaction(async (tx) => {
    const slNo = await getNextSlNo(tx, licenseId);

    // Validate supplier exists if CREDIT
    let validSupplierId: string | null = null;
    if (purchase.supplierId) {
      const sup = await tx.supplier.findFirst({
        where: { id: purchase.supplierId, licenseId, deletedAt: null },
      });
      validSupplierId = sup ? purchase.supplierId : null;
    }

    if (purchase.purchaseType === "CREDIT" && !validSupplierId) {
      throw new Error("Supplier is required for CREDIT purchases.");
    }

    // Insert purchase header (totalAmount=0 first, updated after items)
    await tx.purchase.create({
      data: {
        id: newId,
        slNo,
        licenseId,
        billNo: purchase.billNo ?? null,
        supplierId: validSupplierId,
        supplierName: purchase.supplierName ?? null,
        department: purchase.department ?? null,
        debitAccount: purchase.debitAccount ?? null,
        natureOfEntry: purchase.natureOfEntry ?? null,
        purchaseType: purchase.purchaseType ?? "CREDIT",
        purchaseBatchNo,
        purchaseDate,
        entryTime: purchase.entryTime
          ? new Date(purchase.entryTime as string)
          : now,
        totalAmount: 0,
        discount: purchase.discount ?? 0,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });

    // Process each item
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const isFree = Boolean(item.isFree);
      const qty = Number(item.quantity || 0);
      const taxPct =
        item.taxPercent === "NT"
          ? 0
          : Number(String(item.taxPercent).replace("P", "")) || 0;

      const taxAmount = isFree ? 0 : item.rate * qty * (taxPct / 100);
      const totalCost = isFree ? 0 : item.rate * qty + taxAmount;

      let salePrice = item.salePrice != null ? Number(item.salePrice) : null;
      if ((item.profitPercent ?? 0) > 0 && !isFree) {
        const basePerUnit = item.rate + taxAmount / Math.max(1, qty);
        salePrice =
          Math.round(
            basePerUnit * (1 + (Number(item.profitPercent) || 0) / 100) * 100,
          ) / 100;
      }

      const discountAbs =
        item.discountType === "PCT"
          ? totalCost * (Math.max(0, Math.min(100, item.discount ?? 0)) / 100)
          : (item.discount ?? 0);

      const billedValue = isFree ? 0 : Math.max(0, totalCost - discountAbs);
      const effectiveUnitValue = isFree ? 0 : billedValue / Math.max(1, qty);
      const profit =
        salePrice != null
          ? salePrice - (item.rate + taxAmount / Math.max(1, qty))
          : null;

      if (!isFree) totalAmount += billedValue;

      // Resolve / create batch
      const batch = await resolveOrCreateBatch(tx, {
        licenseId,
        productId: item.productId,
        barcode: item.barcode?.trim() || null,
        mrp: item.mrp ?? null,
        salePrice: salePrice ?? null,
        costPrice: item.rate,
        batchNo: purchaseBatchNo,
        purchaseBatchNo,
        purchaseId: newId,
        mfgDate: item.mfgDate ?? null,
        expiryDate: item.expiryDate ?? null,
        receivedAt: purchaseDate,
      });

      // Bump stock
      if (!isFree) {
        await bumpBatchAndProductStock(tx, batch.id, item.productId, qty);
      }

      // Insert item
      await tx.purchaseItem.create({
        data: {
          id: uuidv4(),
          purchaseId: newId,
          productId: item.productId,
          barcode: batch.barcode ?? item.barcode?.trim() ?? null,
          quantity: qty,
          unit: item.unit,
          rate: item.rate,
          mrp: item.mrp ?? null,
          taxPercent: toTaxPercent(item.taxPercent),
          taxAmount,
          discount: discountAbs,
          discountType: item.discountType ?? "ABS",
          salePrice: salePrice ?? null,
          profit: profit ?? null,
          totalCost,
          billedValue,
          effectiveUnitValue,
          batchNo: purchaseBatchNo,
          batchId: batch.id,
          purchaseBatchNo,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineNo: item.lineNo ?? idx + 1,
          isFree,
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    const grandAmount = Math.max(0, totalAmount - (purchase.discount ?? 0));

    // Update purchase totalAmount
    await tx.purchase.update({
      where: { id: newId },
      data: { totalAmount, updatedAt: now },
    });

    // Supplier ledger (CREDIT)
    if (purchase.purchaseType === "CREDIT" && validSupplierId) {
      await tx.supplierTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          supplierId: validSupplierId,
          kind: "PURCHASE",
          refId: newId,
          refNo: purchase.billNo ?? null,
          date: purchaseDate,
          amount: grandAmount,
          sign: 1,
          notes: "Purchase",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    // Cash ledger (CASH)
    if (purchase.purchaseType === "CASH") {
      await tx.cashTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          kind: "PURCHASE",
          refId: newId,
          refNo: purchase.billNo ?? null,
          date: purchaseDate,
          amount: grandAmount,
          sign: -1,
          notes: "Purchase (Cash)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    return { purchaseId: newId, slNo, totalAmount, grandAmount };
  });

  return { success: true, ...result };
}

// ── UPDATE PURCHASE ───────────────────────────────────────────────────────────

export async function updatePurchase(
  licenseId: string,
  id: string,
  header: Omit<CreatePurchaseInput, "licenseId">,
  items: PurchaseItemInput[],
) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findFirst({
      where: { id, licenseId },
      include: { items: { where: { deletedAt: null } } },
    });
    if (!existing) throw new Error("Purchase not found");

    const purchaseDate = header.purchaseDate
      ? new Date(header.purchaseDate as string)
      : existing.purchaseDate;
    const purchaseBatchNo = makePurchaseBatchNo(
      header.billNo ?? existing.billNo,
      purchaseDate,
    );

    // Reverse stock from old items
    for (const it of existing.items) {
      if (!it.isFree && it.batchId) {
        await bumpBatchAndProductStock(
          tx,
          it.batchId,
          it.productId,
          -Number(it.quantity),
        );
      }
    }

    // Soft-delete old batches linked to this purchase
    await tx.productBatch.updateMany({
      where: { purchaseId: id, deletedAt: null },
      data: { deletedAt: now, updatedAt: now },
    });

    // Delete old items
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

    // Validate supplier
    let validSupplierId: string | null = null;
    const supplierId = header.supplierId ?? existing.supplierId ?? null;
    if (supplierId) {
      const sup = await tx.supplier.findFirst({
        where: { id: supplierId, licenseId, deletedAt: null },
      });
      validSupplierId = sup ? supplierId : null;
    }

    let totalAmount = 0;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const isFree = Boolean(item.isFree);
      const qty = Number(item.quantity || 0);
      const taxPct =
        item.taxPercent === "NT"
          ? 0
          : Number(String(item.taxPercent).replace("P", "")) || 0;
      const taxAmount = isFree ? 0 : item.rate * qty * (taxPct / 100);
      const totalCost = isFree ? 0 : item.rate * qty + taxAmount;

      let salePrice = item.salePrice != null ? Number(item.salePrice) : null;
      if ((item.profitPercent ?? 0) > 0 && !isFree) {
        const base = item.rate + taxAmount / Math.max(1, qty);
        salePrice =
          Math.round(base * (1 + Number(item.profitPercent) / 100) * 100) / 100;
      }

      const discountAbs =
        item.discountType === "PCT"
          ? totalCost * (Math.max(0, Math.min(100, item.discount ?? 0)) / 100)
          : (item.discount ?? 0);
      const billedValue = isFree ? 0 : Math.max(0, totalCost - discountAbs);
      const effectiveUnitValue = isFree ? 0 : billedValue / Math.max(1, qty);
      const profit =
        salePrice != null
          ? salePrice - (item.rate + taxAmount / Math.max(1, qty))
          : null;

      if (!isFree) totalAmount += billedValue;

      const batch = await resolveOrCreateBatch(tx, {
        licenseId,
        productId: item.productId,
        barcode: item.barcode?.trim() || null,
        mrp: item.mrp ?? null,
        salePrice: salePrice ?? null,
        costPrice: item.rate,
        batchNo: purchaseBatchNo,
        purchaseBatchNo,
        purchaseId: id,
        mfgDate: item.mfgDate ?? null,
        expiryDate: item.expiryDate ?? null,
        receivedAt: purchaseDate,
      });

      if (!isFree) {
        await bumpBatchAndProductStock(tx, batch.id, item.productId, qty);
      }

      await tx.purchaseItem.create({
        data: {
          id: uuidv4(),
          purchaseId: id,
          productId: item.productId,
          barcode: batch.barcode ?? item.barcode?.trim() ?? null,
          quantity: qty,
          unit: item.unit,
          rate: item.rate,
          mrp: item.mrp ?? null,
          taxPercent: toTaxPercent(item.taxPercent),
          taxAmount,
          discount: discountAbs,
          discountType: item.discountType ?? "ABS",
          salePrice: salePrice ?? null,
          profit: profit ?? null,
          totalCost,
          billedValue,
          effectiveUnitValue,
          batchNo: purchaseBatchNo,
          batchId: batch.id,
          purchaseBatchNo,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineNo: item.lineNo ?? idx + 1,
          isFree,
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    const grandAmount = Math.max(
      0,
      totalAmount - Number(header.discount ?? existing.discount ?? 0),
    );

    await tx.purchase.update({
      where: { id },
      data: {
        billNo: header.billNo ?? existing.billNo,
        purchaseBatchNo,
        supplierId: validSupplierId,
        supplierName: header.supplierName ?? existing.supplierName,
        department: header.department ?? existing.department,
        debitAccount: header.debitAccount ?? existing.debitAccount,
        natureOfEntry: header.natureOfEntry ?? existing.natureOfEntry,
        purchaseDate,
        entryTime: header.entryTime
          ? new Date(header.entryTime as string)
          : existing.entryTime,
        discount: Number(header.discount ?? existing.discount ?? 0),
        totalAmount,
        purchaseType: header.purchaseType ?? (existing.purchaseType as any),
        updatedAt: now,
        isSynced: false,
      },
    });

    // Rebuild ledger
    await tx.supplierTransaction.deleteMany({
      where: { licenseId, kind: "PURCHASE", refId: id },
    });
    await tx.cashTransaction.deleteMany({
      where: { licenseId, kind: "PURCHASE", refId: id },
    });

    const purchaseType = header.purchaseType ?? existing.purchaseType;

    if (purchaseType === "CREDIT" && validSupplierId) {
      await tx.supplierTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          supplierId: validSupplierId,
          kind: "PURCHASE",
          refId: id,
          refNo: header.billNo ?? existing.billNo,
          date: purchaseDate,
          amount: grandAmount,
          sign: 1,
          notes: "Purchase",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    if (purchaseType === "CASH") {
      await tx.cashTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          kind: "PURCHASE",
          refId: id,
          refNo: header.billNo ?? existing.billNo,
          date: purchaseDate,
          amount: grandAmount,
          sign: -1,
          notes: "Purchase (Cash)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }
  });

  return { success: true };
}

// ── DELETE PURCHASE ───────────────────────────────────────────────────────────

export async function deletePurchase(licenseId: string, id: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.findFirst({
      where: { id, licenseId },
      include: { items: { where: { deletedAt: null } } },
    });
    if (!p) throw new Error("Purchase not found");

    // Reverse stock
    for (const it of p.items) {
      if (!it.isFree && it.batchId) {
        await bumpBatchAndProductStock(
          tx,
          it.batchId,
          it.productId,
          -Number(it.quantity),
        );
      }
    }

    // Soft-delete batches
    await tx.productBatch.updateMany({
      where: { purchaseId: id, deletedAt: null },
      data: { deletedAt: now, updatedAt: now },
    });

    // Soft-delete purchase + items
    await tx.purchase.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now, isSynced: false },
    });
    await tx.purchaseItem.updateMany({
      where: { purchaseId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false },
    });

    // Delete ledger entries
    await tx.supplierTransaction.deleteMany({
      where: { licenseId, kind: "PURCHASE", refId: id },
    });
    await tx.cashTransaction.deleteMany({
      where: { licenseId, kind: "PURCHASE", refId: id },
    });
  });

  return { success: true, deletedAt: now.toISOString() };
}

// ── LIST PURCHASES ────────────────────────────────────────────────────────────

export async function listPurchases(
  licenseId: string,
  filters: {
    q?: string;
    supplierId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    page?: number;
    pageSize?: number;
    includeDeleted?: boolean;
  } = {},
) {
  const {
    q = "",
    supplierId = null,
    dateFrom = null,
    dateTo = null,
    page = 1,
    pageSize = 50,
    includeDeleted = false,
  } = filters;

  const where: any = { licenseId };
  if (!includeDeleted) where.deletedAt = null;
  if (supplierId) where.supplierId = supplierId;
  if (dateFrom)
    where.purchaseDate = {
      ...(where.purchaseDate || {}),
      gte: new Date(dateFrom),
    };
  if (dateTo)
    where.purchaseDate = {
      ...(where.purchaseDate || {}),
      lt: new Date(dateTo),
    };
  if (q?.trim()) {
    where.OR = [
      { billNo: { contains: q.trim(), mode: "insensitive" } },
      { supplierName: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where,
      orderBy: [{ purchaseDate: "desc" }, { slNo: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slNo: true,
        billNo: true,
        supplierId: true,
        supplierName: true,
        purchaseDate: true,
        entryTime: true,
        totalAmount: true,
        discount: true,
        purchaseType: true,
        isSynced: true,
        deletedAt: true,
        syncedAt: true,
      },
    }),
  ]);

  return {
    success: true,
    total,
    page,
    pageSize,
    rows: rows.map((r) => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      discount: Number(r.discount ?? 0),
    })),
  };
}

// ── GET PURCHASE FULL ─────────────────────────────────────────────────────────

export async function getPurchaseFull(licenseId: string, id: string) {
  const p = await prisma.purchase.findFirst({
    where: { id, licenseId },
    include: {
      items: {
        where: { deletedAt: null },
        orderBy: [{ lineNo: "asc" }],
        include: { product: { select: { name: true, code: true } } },
      },
    },
  });

  if (!p) return { success: false, error: "Not found" };

  return {
    success: true,
    purchase: {
      ...p,
      totalAmount: Number(p.totalAmount),
      discount: Number(p.discount ?? 0),
    },
    items: p.items.map((it) => ({
      ...it,
      productName: it.product?.name ?? null,
      productCode: it.product?.code ?? null,
      rate: Number(it.rate),
      mrp: it.mrp != null ? Number(it.mrp) : null,
      taxAmount: Number(it.taxAmount),
      discount: Number(it.discount ?? 0),
      salePrice: it.salePrice != null ? Number(it.salePrice) : null,
      profit: it.profit != null ? Number(it.profit) : null,
      totalCost: Number(it.totalCost),
      billedValue: it.billedValue != null ? Number(it.billedValue) : null,
      effectiveUnitValue:
        it.effectiveUnitValue != null ? Number(it.effectiveUnitValue) : null,
      isFree: it.isFree ? 1 : 0,
    })),
  };
}

// ── PEEK NEXT SLNO ────────────────────────────────────────────────────────────

export async function peekNextSlNo(licenseId: string) {
  const agg = await prisma.purchase.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return { nextSlNo: (agg._max.slNo ?? 0) + 1 };
}

// ── HOLDS ─────────────────────────────────────────────────────────────────────

export async function savePurchaseHold(payload: {
  id?: string;
  licenseId: string;
  userId?: string;
  title?: string | null;
  header: any;
  rows: any[];
}) {
  const now = new Date();

  if (payload.id) {
    const existing = await prisma.purchaseHold.findFirst({
      where: { id: payload.id, deletedAt: null },
    });
    if (!existing) return { success: false, error: "NOT_FOUND" };

    await prisma.purchaseHold.update({
      where: { id: payload.id },
      data: {
        title: payload.title !== undefined ? payload.title : existing.title,
        headerJson:
          payload.header !== undefined
            ? JSON.stringify(payload.header)
            : existing.headerJson,
        rowsJson:
          payload.rows !== undefined
            ? JSON.stringify(payload.rows)
            : existing.rowsJson,
        updatedAt: now,
      },
    });

    return { success: true, id: payload.id, holdNo: null, updated: true };
  }

  await prisma.$transaction(async (tx) => {
    const holdNo = await getNextHoldNo(tx, payload.licenseId);
    await tx.purchaseHold.create({
      data: {
        id: uuidv4(),
        licenseId: payload.licenseId,
        userId: payload.userId ?? null,
        holdNo,
        title: payload.title ?? null,
        headerJson: JSON.stringify(payload.header || {}),
        rowsJson: JSON.stringify(payload.rows || []),
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });
    return holdNo;
  });

  // Fetch back the created hold to get holdNo
  const created = await prisma.purchaseHold.findFirst({
    where: { licenseId: payload.licenseId, deletedAt: null },
    orderBy: { holdNo: "desc" },
  });

  return { success: true, id: created!.id, holdNo: created!.holdNo };
}

export async function listPurchaseHolds(
  licenseId: string,
  pagination: { page?: number; pageSize?: number } = {},
) {
  const { page = 1, pageSize = 50 } = pagination;

  const [total, rows] = await Promise.all([
    prisma.purchaseHold.count({ where: { licenseId, deletedAt: null } }),
    prisma.purchaseHold.findMany({
      where: { licenseId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        holdNo: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return { holds: rows, total };
}

export async function getPurchaseHold(licenseId: string, id: string) {
  const row = await prisma.purchaseHold.findFirst({
    where: { id, licenseId, deletedAt: null },
  });
  if (!row) return { success: false, error: "NOT_FOUND" };

  return {
    success: true,
    hold: {
      id: row.id,
      holdNo: row.holdNo,
      title: row.title,
      header: JSON.parse(row.headerJson),
      rows: JSON.parse(row.rowsJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  };
}

export async function deletePurchaseHold(licenseId: string, id: string) {
  await prisma.purchaseHold.updateMany({
    where: { id, licenseId },
    data: { deletedAt: new Date() },
  });
  return { success: true };
}

export async function peekNextHoldNo(licenseId: string) {
  const agg = await prisma.purchaseHold.aggregate({
    where: { licenseId },
    _max: { holdNo: true },
  });
  return { nextHoldNo: (agg._max.holdNo ?? 0) + 1 };
}
