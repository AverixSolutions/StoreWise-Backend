// backend/src/services/saleReturn.service.ts
import { PrismaClient, TaxPercent } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTaxPercent(v: string): TaxPercent {
  const valid: TaxPercent[] = ["NT", "P5", "P12", "P18", "P28"];
  return valid.includes(v as TaxPercent) ? (v as TaxPercent) : "NT";
}

async function getNextSlNo(tx: any, licenseId: string): Promise<number> {
  const agg = await tx.saleReturn.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return (agg._max.slNo ?? 0) + 1;
}

// Add stock back when a sale return is created (customer returns items → store gets stock)
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

// Compute amounts for an item
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

// ── CREATE SALE RETURN ────────────────────────────────────────────────────────

export interface CreateSaleReturnInput {
  licenseId: string;
  billNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  saleType?: "CASH" | "CREDIT";
  returnDate?: string | Date;
  entryTime?: string | Date | null;
  discount?: number;
  typeId?: string | null;
}

export interface SaleReturnItemInput {
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

export async function createSaleReturn(
  header: CreateSaleReturnInput,
  items: SaleReturnItemInput[],
) {
  const { licenseId } = header;
  const now = new Date();
  const returnDate = header.returnDate ? new Date(header.returnDate) : now;
  const newId = uuidv4();

  let totalAmount = 0;

  const result = await prisma.$transaction(async (tx) => {
    const slNo = await getNextSlNo(tx, licenseId);

    // Validate customer exists if CREDIT
    let validCustomerId: string | null = null;
    if (header.customerId) {
      const cust = await tx.customer.findFirst({
        where: { id: header.customerId, licenseId, deletedAt: null },
      });
      validCustomerId = cust ? header.customerId : null;
    }

    if (header.saleType === "CREDIT" && !validCustomerId) {
      throw new Error("Customer is required for CREDIT returns.");
    }

    // Create header
    await tx.saleReturn.create({
      data: {
        id: newId,
        slNo,
        licenseId,
        billNo: header.billNo ?? null,
        customerId: validCustomerId,
        customerName: header.customerName ?? null,
        department: header.department ?? null,
        debitAccount: header.debitAccount ?? null,
        natureOfEntry: header.natureOfEntry ?? null,
        saleType: header.saleType ?? "CREDIT",
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

      // Add stock back (customer returns item → store stock increases)
      await bumpBatchAndProductStock(tx, batch.id, item.productId, appliedQty);

      // Create return item
      await tx.saleReturnItem.create({
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
    await tx.saleReturn.update({
      where: { id: newId },
      data: { totalAmount, updatedAt: now },
    });

    // Ledger entries
    if (header.saleType === "CREDIT" && validCustomerId) {
      // Decreases receivable from customer (sign=-1)
      await tx.customerTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          customerId: validCustomerId,
          kind: "RETURN",
          refId: newId,
          refNo: header.billNo ?? null,
          date: returnDate,
          amount: grandAmount,
          sign: -1,
          notes: "Sale Return",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    if (header.saleType === "CASH") {
      // Cash refund (outflow, sign=-1)
      await tx.cashTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          kind: "PAYMENT",
          refId: newId,
          refNo: header.billNo ?? null,
          date: returnDate,
          amount: grandAmount,
          sign: -1,
          notes: "Sale Return (Cash Refund)",
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

// ── UPDATE SALE RETURN ────────────────────────────────────────────────────────

export async function updateSaleReturn(
  licenseId: string,
  id: string,
  header: Omit<CreateSaleReturnInput, "licenseId">,
  items: SaleReturnItemInput[],
) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = (await tx.saleReturn.findFirst({
      where: { id, licenseId },
      include: { items: { where: { deletedAt: null } } },
    })) as any;

    if (!existing) throw new Error("Sale return not found");

    // Undo stock additions from current items (remove the stock that was added)
    for (const it of existing.items) {
      const applied = it.appliedQuantity ?? it.quantity;
      if (applied > 0 && it.batchId) {
        await bumpBatchAndProductStock(tx, it.batchId, it.productId, -applied);
      }
    }

    // Tombstone old items so sync can propagate removals.
    await tx.saleReturnItem.updateMany({
      where: { returnId: id, deletedAt: null },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });

    // Validate customer
    let validCustomerId: string | null = null;
    const customerId = header.customerId ?? existing.customerId ?? null;
    if (customerId) {
      const cust = await tx.customer.findFirst({
        where: { id: customerId, licenseId, deletedAt: null },
      });
      validCustomerId = cust ? customerId : null;
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

      await bumpBatchAndProductStock(tx, batch.id, item.productId, appliedQty);

      await tx.saleReturnItem.create({
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
    await tx.saleReturn.update({
      where: { id },
      data: {
        billNo: header.billNo ?? existing.billNo,
        customerId: validCustomerId,
        customerName: header.customerName ?? existing.customerName,
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
        saleType: header.saleType ?? (existing.saleType as any),
        updatedAt: now,
        isSynced: false,
        typeId: header.typeId ?? null,
      },
    });

    // Delete old ledger entries
    await tx.customerTransaction.updateMany({
      where: { licenseId, kind: "RETURN", refId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });
    await tx.cashTransaction.updateMany({
      where: { licenseId, kind: "PAYMENT", refId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });

    // Recreate ledger
    const saleType = header.saleType ?? existing.saleType;

    if (saleType === "CREDIT" && validCustomerId) {
      await tx.customerTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          customerId: validCustomerId,
          kind: "RETURN",
          refId: id,
          refNo: header.billNo ?? existing.billNo,
          date: header.returnDate
            ? new Date(header.returnDate as string)
            : existing.returnDate,
          amount: grandAmount,
          sign: -1,
          notes: "Sale Return",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    if (saleType === "CASH") {
      await tx.cashTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          kind: "PAYMENT",
          refId: id,
          refNo: header.billNo ?? existing.billNo,
          date: header.returnDate
            ? new Date(header.returnDate as string)
            : existing.returnDate,
          amount: grandAmount,
          sign: -1,
          notes: "Sale Return (Cash Refund)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }
  });

  return { success: true };
}

// ── DELETE SALE RETURN ────────────────────────────────────────────────────────

export async function deleteSaleReturn(licenseId: string, id: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const p = (await tx.saleReturn.findFirst({
      where: { id, licenseId },
      include: { items: { where: { deletedAt: null } } },
    })) as any;
    if (!p) throw new Error("Sale return not found");

    // Undo stock additions (remove the stock that was added by this return)
    for (const it of p.items) {
      const applied = it.appliedQuantity ?? it.quantity;
      if (applied > 0 && it.batchId) {
        await bumpBatchAndProductStock(tx, it.batchId, it.productId, -applied);
      }
    }

    // Soft-delete
    await tx.saleReturn.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });
    await tx.saleReturnItem.updateMany({
      where: { returnId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });

    // Delete ledger
    await tx.customerTransaction.updateMany({
      where: { licenseId, kind: "RETURN", refId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });
    await tx.cashTransaction.updateMany({
      where: { licenseId, kind: "PAYMENT", refId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });
  });

  return { success: true, deletedAt: now.toISOString() };
}

// ── LIST SALE RETURNS ─────────────────────────────────────────────────────────

export async function listSaleReturns(
  licenseId: string,
  filters: {
    q?: string;
    customerId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    page?: number;
    pageSize?: number;
    includeDeleted?: boolean;
  } = {},
) {
  const {
    q = "",
    customerId = null,
    dateFrom = null,
    dateTo = null,
    page = 1,
    pageSize = 50,
    includeDeleted = false,
  } = filters;

  const where: any = { licenseId };
  if (!includeDeleted) where.deletedAt = null;
  if (customerId) where.customerId = customerId;
  if (dateFrom) where.returnDate = { gte: new Date(dateFrom) };
  if (dateTo) where.returnDate = { lt: new Date(dateTo) };
  if (q?.trim()) {
    where.OR = [
      { billNo: { contains: q.trim(), mode: "insensitive" } },
      { customerName: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.saleReturn.count({ where }),
    prisma.saleReturn.findMany({
      where,
      orderBy: [{ returnDate: "desc" }, { slNo: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slNo: true,
        billNo: true,
        customerId: true,
        customerName: true,
        returnDate: true,
        entryTime: true,
        totalAmount: true,
        discount: true,
        saleType: true,
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

// ── GET FULL SALE RETURN ──────────────────────────────────────────────────────

export async function getSaleReturnFull(licenseId: string, id: string) {
  const p = await prisma.saleReturn.findFirst({
    where: { id, licenseId },
  });
  if (!p) return { success: false, error: "Not found" };

  const items = await prisma.saleReturnItem.findMany({
    where: { returnId: id, deletedAt: null },
    orderBy: { lineNo: "asc" },
  });

  const productIds = [...new Set(items.map((it) => it.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, code: true },
  });
  const productMap = new Map(products.map((pr) => [pr.id, pr]));

  return {
    success: true,
    saleReturn: {
      ...p,
      totalAmount: Number(p.totalAmount),
      discount: Number(p.discount ?? 0),
    },
    items: items.map((it) => ({
      ...it,
      productName: productMap.get(it.productId)?.name ?? null,
      productCode: productMap.get(it.productId)?.code ?? null,
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
    })),
  };
}

// ── PEEK NEXT SLNO ────────────────────────────────────────────────────────────

export async function peekNextSaleReturnSlNo(licenseId: string) {
  const agg = await prisma.saleReturn.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return { nextSlNo: (agg._max.slNo ?? 0) + 1 };
}
