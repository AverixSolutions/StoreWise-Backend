// backend/src/services/purchaseReturn.service.ts
import { PrismaClient, TaxPercent } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTaxPercent(v: string): TaxPercent {
  const valid: TaxPercent[] = ["NT", "P5", "P12", "P18", "P28"];
  return valid.includes(v as TaxPercent) ? (v as TaxPercent) : "NT";
}

async function getNextSlNo(tx: any, licenseId: string): Promise<number> {
  const agg = await tx.purchaseReturn.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return (agg._max.slNo ?? 0) + 1;
}

async function getNextHoldNo(tx: any, licenseId: string): Promise<number> {
  const agg = await tx.purchaseReturnHold.aggregate({
    where: { licenseId },
    _max: { holdNo: true },
  });
  return (agg._max.holdNo ?? 0) + 1;
}

// Reverse stock (increase stock for the batch)
async function reverseBatchAndProductStock(
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

// Compute amounts for an item, with applied quantity (limited by available stock)
function computeReturnAmounts(
  item: {
    rate: number;
    taxPercent: string;
    quantity: number;
    discountType?: "ABS" | "PCT";
    discount?: number;
    salePrice?: number | null;
    profitPercent?: number;
    isFree?: boolean;
  },
  appliedQty: number,
) {
  const isFree = Boolean(item.isFree);
  const qty = appliedQty;
  const rate = Number(item.rate);
  const taxPct =
    item.taxPercent === "NT"
      ? 0
      : Number(String(item.taxPercent).replace("P", "")) || 0;

  const taxAmount = isFree ? 0 : rate * qty * (taxPct / 100);
  const totalCost = isFree ? 0 : rate * qty + taxAmount;

  let salePrice = item.salePrice != null ? Number(item.salePrice) : null;
  if ((item.profitPercent ?? 0) > 0 && !isFree) {
    const basePerUnit = rate + taxAmount / Math.max(1, qty);
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
      ? salePrice - (rate + taxAmount / Math.max(1, qty))
      : null;

  return {
    taxAmount,
    totalCost,
    salePrice,
    discountAbs,
    billedValue,
    effectiveUnitValue,
    profit,
  };
}

// Resolve batch for return (must exist, no creation)
async function resolveReturnBatch(
  tx: any,
  licenseId: string,
  item: {
    productId: string;
    batchId?: string | null;
    batchNo?: string | null;
    barcode?: string | null;
    mfgDate?: string | null;
    expiryDate?: string | null;
  },
) {
  if (item.batchId) {
    const batch = await tx.productBatch.findFirst({
      where: { id: item.batchId, licenseId, deletedAt: null },
    });
    if (batch && batch.productId === item.productId) return batch;
  }

  // Try to find by identity
  const batch = await tx.productBatch.findFirst({
    where: {
      licenseId,
      productId: item.productId,
      deletedAt: null,
      ...(item.batchNo ? { batchNo: item.batchNo } : {}),
      ...(item.barcode ? { barcode: item.barcode } : {}),
      ...(item.mfgDate ? { mfgDate: item.mfgDate } : {}),
      ...(item.expiryDate ? { expiryDate: item.expiryDate } : {}),
    },
  });
  if (!batch) throw new Error(`Batch not found for product ${item.productId}`);
  return batch;
}

// ── CREATE PURCHASE RETURN ───────────────────────────────────────────────────

export interface CreatePurchaseReturnInput {
  licenseId: string;
  billNo?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  purchaseType?: "CASH" | "CREDIT";
  returnDate?: string | Date;
  entryTime?: string | Date | null;
  discount?: number;
  typeId?: string | null;
}

export interface PurchaseReturnItemInput {
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
  batchId?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  lineNo?: number;
  isFree?: boolean | number;
  profitPercent?: number;
}

export async function createPurchaseReturn(
  header: CreatePurchaseReturnInput,
  items: PurchaseReturnItemInput[],
) {
  const { licenseId } = header;
  const now = new Date();
  const returnDate = header.returnDate ? new Date(header.returnDate) : now;
  const newId = uuidv4();

  let totalAmount = 0;

  const result = await prisma.$transaction(async (tx) => {
    const slNo = await getNextSlNo(tx, licenseId);

    // Validate supplier exists if CREDIT
    let validSupplierId: string | null = null;
    if (header.supplierId) {
      const sup = await tx.supplier.findFirst({
        where: { id: header.supplierId, licenseId, deletedAt: null },
      });
      validSupplierId = sup ? header.supplierId : null;
    }

    if (header.purchaseType === "CREDIT" && !validSupplierId) {
      throw new Error("Supplier is required for CREDIT returns.");
    }

    // Create header
    await tx.purchaseReturn.create({
      data: {
        id: newId,
        slNo,
        licenseId,
        billNo: header.billNo ?? null,
        supplierId: validSupplierId,
        supplierName: header.supplierName ?? null,
        department: header.department ?? null,
        debitAccount: header.debitAccount ?? null,
        natureOfEntry: header.natureOfEntry ?? null,
        purchaseType: header.purchaseType ?? "CREDIT",
        returnDate,
        entryTime: header.entryTime
          ? new Date(header.entryTime as string)
          : now,
        totalAmount: 0,
        discount: header.discount ?? 0,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
        typeId: header.typeId ?? null,
      },
    });

    // Process items
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const requestedQty = Number(item.quantity || 0);
      if (requestedQty === 0) continue;

      // Find batch (must exist)
      let batch = null;
      try {
        batch = await resolveReturnBatch(tx, licenseId, item);
      } catch (err) {
        throw new Error(`Row ${idx + 1}: ${(err as Error).message}`);
      }

      const availableStock = batch.stock;
      const appliedQty = Math.min(requestedQty, availableStock);
      const overQty = requestedQty - appliedQty;

      if (appliedQty === 0 && requestedQty > 0) {
        throw new Error(
          `Row ${idx + 1}: No stock available for return of this batch.`,
        );
      }

      // Convert isFree to boolean
      const isFree = Boolean(item.isFree);
      const computeItem = {
        rate: item.rate,
        taxPercent: item.taxPercent,
        quantity: appliedQty,
        discountType: item.discountType,
        discount: item.discount,
        salePrice: item.salePrice,
        profitPercent: item.profitPercent,
        isFree,
      };
      const amounts = computeReturnAmounts(computeItem, appliedQty);
      const {
        taxAmount,
        totalCost,
        salePrice,
        discountAbs,
        billedValue,
        effectiveUnitValue,
        profit,
      } = amounts;

      totalAmount += billedValue;

      // Increase stock (reverse the purchase)
      await reverseBatchAndProductStock(
        tx,
        batch.id,
        item.productId,
        appliedQty,
      );

      // Create return item
      await tx.purchaseReturnItem.create({
        data: {
          id: uuidv4(),
          returnId: newId,
          productId: item.productId,
          barcode: item.barcode ?? null,
          quantity: requestedQty,
          appliedQuantity: appliedQty,
          overReturnQuantity: overQty,
          overReturnReason: overQty > 0 ? "Insufficient stock" : null,
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
          batchNo: batch.batchNo,
          batchId: batch.id,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineNo: item.lineNo ?? idx + 1,
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    const grandAmount = Math.max(0, totalAmount - (header.discount ?? 0));

    // Update header totalAmount
    await tx.purchaseReturn.update({
      where: { id: newId },
      data: { totalAmount, updatedAt: now },
    });

    // Ledger entries (opposite sign compared to purchase)
    if (header.purchaseType === "CREDIT" && validSupplierId) {
      // We owe the supplier less -> negative amount (we receive money)
      await tx.supplierTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          supplierId: validSupplierId,
          kind: "RETURN",
          refId: newId,
          refNo: header.billNo ?? null,
          date: returnDate,
          amount: grandAmount,
          sign: -1, // decreases payable
          notes: "Purchase Return",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    if (header.purchaseType === "CASH") {
      // Cash inflow (positive sign for cash transactions)
      await tx.cashTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          kind: "RECEIPT",
          refId: newId,
          refNo: header.billNo ?? null,
          date: returnDate,
          amount: grandAmount,
          sign: 1,
          notes: "Purchase Return (Cash)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    return { returnId: newId, slNo, totalAmount: grandAmount };
  });

  return { success: true, ...result };
}

// ── UPDATE PURCHASE RETURN ───────────────────────────────────────────────────

export async function updatePurchaseReturn(
  licenseId: string,
  id: string,
  header: Omit<CreatePurchaseReturnInput, "licenseId">,
  items: PurchaseReturnItemInput[],
) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = (await tx.purchaseReturn.findFirst({
      where: { id, licenseId },
      include: { items: { where: { deletedAt: null } } },
    })) as any; // type assertion to avoid missing items property

    if (!existing) throw new Error("Purchase return not found");

    // Reverse stock from current items (add back the previously returned stock)
    for (const it of existing.items) {
      const applied = it.appliedQuantity ?? it.quantity;
      if (applied > 0 && it.batchId) {
        // Negative delta because we are undoing the return (removing stock)
        await reverseBatchAndProductStock(
          tx,
          it.batchId,
          it.productId,
          -applied,
        );
      }
    }

    // Delete old items
    await tx.purchaseReturnItem.deleteMany({ where: { returnId: id } });

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

    // Process updated items
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const requestedQty = Number(item.quantity || 0);
      if (requestedQty === 0) continue;

      let batch = null;
      try {
        batch = await resolveReturnBatch(tx, licenseId, item);
      } catch (err) {
        throw new Error(`Row ${idx + 1}: ${(err as Error).message}`);
      }

      const availableStock = batch.stock;
      const appliedQty = Math.min(requestedQty, availableStock);
      const overQty = requestedQty - appliedQty;

      if (appliedQty === 0 && requestedQty > 0) {
        throw new Error(`Row ${idx + 1}: No stock available for return.`);
      }

      const isFree = Boolean(item.isFree);
      const computeItem = {
        rate: item.rate,
        taxPercent: item.taxPercent,
        quantity: appliedQty,
        discountType: item.discountType,
        discount: item.discount,
        salePrice: item.salePrice,
        profitPercent: item.profitPercent,
        isFree,
      };
      const amounts = computeReturnAmounts(computeItem, appliedQty);
      const {
        taxAmount,
        totalCost,
        salePrice,
        discountAbs,
        billedValue,
        effectiveUnitValue,
        profit,
      } = amounts;

      totalAmount += billedValue;

      await reverseBatchAndProductStock(
        tx,
        batch.id,
        item.productId,
        appliedQty,
      );

      await tx.purchaseReturnItem.create({
        data: {
          id: uuidv4(),
          returnId: id,
          productId: item.productId,
          barcode: item.barcode ?? null,
          quantity: requestedQty,
          appliedQuantity: appliedQty,
          overReturnQuantity: overQty,
          overReturnReason: overQty > 0 ? "Insufficient stock" : null,
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
          batchNo: batch.batchNo,
          batchId: batch.id,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineNo: item.lineNo ?? idx + 1,
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    const grandAmount = Math.max(0, totalAmount - (header.discount ?? 0));

    // Update header
    await tx.purchaseReturn.update({
      where: { id },
      data: {
        billNo: header.billNo ?? existing.billNo,
        supplierId: validSupplierId,
        supplierName: header.supplierName ?? existing.supplierName,
        department: header.department ?? existing.department,
        debitAccount: header.debitAccount ?? existing.debitAccount,
        natureOfEntry: header.natureOfEntry ?? existing.natureOfEntry,
        returnDate: header.returnDate
          ? new Date(header.returnDate as string)
          : existing.returnDate,
        entryTime: header.entryTime
          ? new Date(header.entryTime as string)
          : existing.entryTime,
        discount: header.discount ?? existing.discount,
        totalAmount,
        purchaseType: header.purchaseType ?? (existing.purchaseType as any),
        updatedAt: now,
        isSynced: false,
        typeId: header.typeId ?? null,
      },
    });

    // Delete old ledger entries
    await tx.supplierTransaction.deleteMany({
      where: { licenseId, kind: "RETURN", refId: id },
    });
    await tx.cashTransaction.deleteMany({
      where: { licenseId, kind: "RECEIPT", refId: id },
    });

    // Recreate ledger
    const purchaseType = header.purchaseType ?? existing.purchaseType;

    if (purchaseType === "CREDIT" && validSupplierId) {
      await tx.supplierTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          supplierId: validSupplierId,
          kind: "RETURN",
          refId: id,
          refNo: header.billNo ?? existing.billNo,
          date: header.returnDate
            ? new Date(header.returnDate as string)
            : existing.returnDate,
          amount: grandAmount,
          sign: -1,
          notes: "Purchase Return",
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
          kind: "RECEIPT",
          refId: id,
          refNo: header.billNo ?? existing.billNo,
          date: header.returnDate
            ? new Date(header.returnDate as string)
            : existing.returnDate,
          amount: grandAmount,
          sign: 1,
          notes: "Purchase Return (Cash)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }
  });

  return { success: true };
}

// ── DELETE PURCHASE RETURN ───────────────────────────────────────────────────

export async function deletePurchaseReturn(licenseId: string, id: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Fetch purchase return with items
    const p = (await tx.purchaseReturn.findFirst({
      where: { id, licenseId },
      include: { items: { where: { deletedAt: null } } },
    })) as any;
    if (!p) throw new Error("Purchase return not found");

    // Reverse stock effect (remove the stock that was added by this return)
    for (const it of p.items) {
      const applied = it.appliedQuantity ?? it.quantity;
      if (applied > 0 && it.batchId) {
        // we need to decrease the stock by the same amount
        await reverseBatchAndProductStock(
          tx,
          it.batchId,
          it.productId,
          -applied,
        );
      }
    }

    // Soft-delete
    await tx.purchaseReturn.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now, isSynced: false },
    });
    await tx.purchaseReturnItem.updateMany({
      where: { returnId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false },
    });

    // Delete ledger
    await tx.supplierTransaction.deleteMany({
      where: { licenseId, kind: "RETURN", refId: id },
    });
    await tx.cashTransaction.deleteMany({
      where: { licenseId, kind: "RECEIPT", refId: id },
    });
  });

  return { success: true, deletedAt: now.toISOString() };
}

// ── LIST PURCHASE RETURNS ────────────────────────────────────────────────────

export async function listPurchaseReturns(
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
  if (dateFrom) where.returnDate = { gte: new Date(dateFrom) };
  if (dateTo) where.returnDate = { lt: new Date(dateTo) };
  if (q?.trim()) {
    where.OR = [
      { billNo: { contains: q.trim(), mode: "insensitive" } },
      { supplierName: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.purchaseReturn.count({ where }),
    prisma.purchaseReturn.findMany({
      where,
      orderBy: [{ returnDate: "desc" }, { slNo: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slNo: true,
        billNo: true,
        supplierId: true,
        supplierName: true,
        returnDate: true,
        entryTime: true,
        totalAmount: true,
        discount: true,
        purchaseType: true,
        isSynced: true,
        deletedAt: true,
        syncedAt: true,
        typeId: true,
      },
    }),
  ]);

  return {
    success: true,
    total,
    page,
    pageSize,
    returns: rows.map((r) => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      discount: Number(r.discount ?? 0),
    })),
  };
}

// ── GET FULL PURCHASE RETURN ─────────────────────────────────────────────────

export async function getPurchaseReturnFull(licenseId: string, id: string) {
  const p = await prisma.purchaseReturn.findFirst({
    where: { id, licenseId },
  });
  if (!p) return { success: false, error: "Not found" };

  // Fetch items separately with product details
  const items = await prisma.purchaseReturnItem.findMany({
    where: { returnId: id, deletedAt: null },
    orderBy: { lineNo: "asc" },
    include: { product: true },
  });

  return {
    success: true,
    purchaseReturn: {
      ...p,
      totalAmount: Number(p.totalAmount),
      discount: Number(p.discount ?? 0),
    },
    items: items.map((it) => ({
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

// ── PEEK NEXT SLNO ───────────────────────────────────────────────────────────

export async function peekNextPurchaseReturnSlNo(licenseId: string) {
  const agg = await prisma.purchaseReturn.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return { nextSlNo: (agg._max.slNo ?? 0) + 1 };
}

// ── HOLDS ─────────────────────────────────────────────────────────────────────

export async function savePurchaseReturnHold(payload: {
  id?: string;
  licenseId: string;
  userId?: string;
  title?: string | null;
  header: any;
  rows: any[];
}) {
  const now = new Date();

  if (payload.id) {
    const existing = await prisma.purchaseReturnHold.findFirst({
      where: { id: payload.id, deletedAt: null },
    });
    if (!existing) return { success: false, error: "NOT_FOUND" };

    await prisma.purchaseReturnHold.update({
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
        isSynced: true,
        syncedAt: now,
      },
    });

    return { success: true, id: payload.id, holdNo: null, updated: true };
  }

  await prisma.$transaction(async (tx) => {
    const holdNo = await getNextHoldNo(tx, payload.licenseId);
    await tx.purchaseReturnHold.create({
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
        isSynced: true,
        syncedAt: now,
      },
    });
    return holdNo;
  });

  const created = await prisma.purchaseReturnHold.findFirst({
    where: { licenseId: payload.licenseId, deletedAt: null },
    orderBy: { holdNo: "desc" },
  });

  return { success: true, id: created!.id, holdNo: created!.holdNo };
}

export async function listPurchaseReturnHolds(
  licenseId: string,
  pagination: { page?: number; pageSize?: number } = {},
) {
  const { page = 1, pageSize = 50 } = pagination;

  const [total, rows] = await Promise.all([
    prisma.purchaseReturnHold.count({ where: { licenseId, deletedAt: null } }),
    prisma.purchaseReturnHold.findMany({
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

export async function getPurchaseReturnHold(licenseId: string, id: string) {
  const row = await prisma.purchaseReturnHold.findFirst({
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

export async function deletePurchaseReturnHold(licenseId: string, id: string) {
  const now = new Date();
  await prisma.purchaseReturnHold.updateMany({
    where: { id, licenseId },
    data: { deletedAt: now, updatedAt: now, isSynced: true, syncedAt: now },
  });
  return { success: true };
}

export async function peekNextPurchaseReturnHoldNo(licenseId: string) {
  const agg = await prisma.purchaseReturnHold.aggregate({
    where: { licenseId },
    _max: { holdNo: true },
  });
  return { nextHoldNo: (agg._max.holdNo ?? 0) + 1 };
}
