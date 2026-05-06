// backend/src/services/sale.service.ts
import { PrismaClient, TaxPercent } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTaxPercent(v: string): TaxPercent {
  const valid: TaxPercent[] = ["NT", "P5", "P12", "P18", "P28"];
  return valid.includes(v as TaxPercent) ? (v as TaxPercent) : "NT";
}

async function getNextSlNo(tx: any, licenseId: string): Promise<number> {
  const agg = await tx.sale.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return (agg._max.slNo ?? 0) + 1;
}

async function getNextHoldNo(tx: any, licenseId: string): Promise<number> {
  const agg = await tx.saleHold.aggregate({
    where: { licenseId },
    _max: { holdNo: true },
  });
  return (agg._max.holdNo ?? 0) + 1;
}

// Bump batch stock by delta and recompute product.stock as SUM of all batches.
// delta is negative when selling (stock goes down), positive when reversing.
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaleCreateInput {
  licenseId: string;
  billNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  saleType?: "CASH" | "CREDIT";
  saleDate?: string | Date;
  entryTime?: string | Date | null;
  discount?: number;
  typeId?: string | null;
}

export interface SaleItemInput {
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
}

// ── CREATE SALE ───────────────────────────────────────────────────────────────

export async function createSale(
  sale: SaleCreateInput,
  items: SaleItemInput[],
) {
  const { licenseId } = sale;
  const now = new Date();
  const saleDate = sale.saleDate ? new Date(sale.saleDate) : now;
  const newId = uuidv4();
  let totalAmount = 0;

  const result = await prisma.$transaction(async (tx) => {
    const slNo = await getNextSlNo(tx, licenseId);

    // Validate customer exists if CREDIT
    let validCustomerId: string | null = null;
    if (sale.customerId) {
      const cust = await tx.customer.findFirst({
        where: { id: sale.customerId, licenseId, deletedAt: null },
      });
      validCustomerId = cust ? sale.customerId : null;
    }

    await tx.sale.create({
      data: {
        id: newId,
        slNo,
        licenseId,
        billNo: sale.billNo ?? null,
        customerId: validCustomerId,
        customerName: sale.customerName ?? null,
        department: sale.department ?? null,
        debitAccount: sale.debitAccount ?? null,
        natureOfEntry: sale.natureOfEntry ?? null,
        saleType: sale.saleType === "CASH" ? "CASH" : "CREDIT",
        saleDate,
        entryTime: sale.entryTime ? new Date(sale.entryTime as string) : now,
        totalAmount: 0,
        discount: sale.discount ?? 0,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
        typeId: sale.typeId ?? null,
      },
    });

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

      const discountAbs =
        item.discountType === "PCT"
          ? totalCost * (Math.max(0, Math.min(100, item.discount ?? 0)) / 100)
          : (item.discount ?? 0);

      const billedValue = isFree ? 0 : Math.max(0, totalCost - discountAbs);
      const effectiveUnitValue = isFree ? 0 : billedValue / Math.max(1, qty);

      const salePrice = item.salePrice != null ? Number(item.salePrice) : null;
      const profit =
        salePrice != null
          ? salePrice - (item.rate + taxAmount / Math.max(1, qty))
          : null;

      if (!isFree) totalAmount += billedValue;

      // Resolve batchId — prefer explicit, then look up by identity fields
      let resolvedBatchId = item.batchId ?? null;
      if (
        !resolvedBatchId &&
        (item.batchNo || item.barcode || item.mfgDate || item.expiryDate)
      ) {
        const batch = await tx.productBatch.findFirst({
          where: {
            licenseId,
            productId: item.productId,
            deletedAt: null,
            ...(item.batchNo !== undefined
              ? { batchNo: item.batchNo ?? null }
              : {}),
            ...(item.barcode !== undefined
              ? { barcode: item.barcode ?? null }
              : {}),
            ...(item.mfgDate !== undefined
              ? { mfgDate: item.mfgDate ?? null }
              : {}),
            ...(item.expiryDate !== undefined
              ? { expiryDate: item.expiryDate ?? null }
              : {}),
          },
        });
        resolvedBatchId = batch?.id ?? null;
      }

      // Deduct stock
      if (!isFree && qty > 0) {
        if (resolvedBatchId) {
          const batchRow = await tx.productBatch.findUnique({
            where: { id: resolvedBatchId },
            select: { stock: true },
          });
          if (!batchRow) {
            throw new Error(`Batch not found for product ${item.productId}`);
          }
          if (Number(batchRow.stock ?? 0) < qty) {
            throw new Error(
              `Insufficient batch stock for product ${item.productId}. ` +
                `Available: ${Number(batchRow.stock ?? 0)}, Required: ${qty}`,
            );
          }
          await bumpBatchAndProductStock(
            tx,
            resolvedBatchId,
            item.productId,
            -qty,
          );
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: qty },
              updatedAt: now,
              isSynced: false,
              syncedAt: null,
            },
          });
        }
      }

      await tx.saleItem.create({
        data: {
          id: uuidv4(),
          saleId: newId,
          productId: item.productId,
          barcode: item.barcode ?? null,
          quantity: qty,
          unit: item.unit,
          rate: item.rate,
          mrp: item.mrp ?? null,
          taxPercent: toTaxPercent(item.taxPercent),
          taxAmount,
          discount: discountAbs,
          discountType: item.discountType ?? "ABS",
          salePrice,
          profit,
          totalCost,
          billedValue,
          effectiveUnitValue,
          batchNo: item.batchNo ?? null,
          batchId: resolvedBatchId,
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

    const grandAmount = Math.max(0, totalAmount - (sale.discount ?? 0));

    await tx.sale.update({
      where: { id: newId },
      data: { totalAmount, updatedAt: now },
    });

    // Customer ledger (CREDIT → receivable increases)
    if (sale.saleType !== "CASH" && validCustomerId) {
      await tx.customerTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          customerId: validCustomerId,
          kind: "SALE",
          refId: newId,
          refNo: sale.billNo ?? null,
          date: saleDate,
          amount: grandAmount,
          sign: 1,
          notes: "Sale",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    // Cash ledger (CASH)
    if (sale.saleType === "CASH") {
      await tx.cashTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          kind: "SALE",
          refId: newId,
          refNo: sale.billNo ?? null,
          date: saleDate,
          amount: grandAmount,
          sign: 1,
          notes: "Sale (Cash)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    return { saleId: newId, slNo, totalAmount, grandAmount };
  });

  return { success: true, ...result };
}

// ── UPDATE SALE ───────────────────────────────────────────────────────────────

export async function updateSale(
  licenseId: string,
  id: string,
  header: Omit<SaleCreateInput, "licenseId">,
  items: SaleItemInput[],
) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: { id, licenseId },
      include: { items: { where: { deletedAt: null } } },
    });
    if (!existing) throw new Error("Sale not found");

    const saleDate = header.saleDate
      ? new Date(header.saleDate as string)
      : existing.saleDate;

    // Reverse stock from old items
    for (const it of existing.items) {
      if (!it.isFree) {
        if (it.batchId) {
          await bumpBatchAndProductStock(
            tx,
            it.batchId,
            it.productId,
            Number(it.quantity), // add back
          );
        } else {
          await tx.product.update({
            where: { id: it.productId },
            data: {
              stock: { increment: Number(it.quantity) },
              updatedAt: now,
              isSynced: false,
              syncedAt: null,
            },
          });
        }
      }
    }

    // Delete old items
    await tx.saleItem.deleteMany({ where: { saleId: id } });

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

      const discountAbs =
        item.discountType === "PCT"
          ? totalCost * (Math.max(0, Math.min(100, item.discount ?? 0)) / 100)
          : (item.discount ?? 0);

      const billedValue = isFree ? 0 : Math.max(0, totalCost - discountAbs);
      const effectiveUnitValue = isFree ? 0 : billedValue / Math.max(1, qty);
      const salePrice = item.salePrice != null ? Number(item.salePrice) : null;
      const profit =
        salePrice != null
          ? salePrice - (item.rate + taxAmount / Math.max(1, qty))
          : null;

      if (!isFree) totalAmount += billedValue;

      let resolvedBatchId = item.batchId ?? null;
      if (
        !resolvedBatchId &&
        (item.batchNo || item.barcode || item.mfgDate || item.expiryDate)
      ) {
        const batch = await tx.productBatch.findFirst({
          where: {
            licenseId,
            productId: item.productId,
            deletedAt: null,
            ...(item.batchNo !== undefined
              ? { batchNo: item.batchNo ?? null }
              : {}),
            ...(item.barcode !== undefined
              ? { barcode: item.barcode ?? null }
              : {}),
            ...(item.mfgDate !== undefined
              ? { mfgDate: item.mfgDate ?? null }
              : {}),
            ...(item.expiryDate !== undefined
              ? { expiryDate: item.expiryDate ?? null }
              : {}),
          },
        });
        resolvedBatchId = batch?.id ?? null;
      }

      if (!isFree && qty > 0) {
        if (resolvedBatchId) {
          const batchRow = await tx.productBatch.findUnique({
            where: { id: resolvedBatchId },
            select: { stock: true },
          });
          if (!batchRow)
            throw new Error(`Batch not found for product ${item.productId}`);
          if (Number(batchRow.stock ?? 0) < qty) {
            throw new Error(
              `Insufficient batch stock for product ${item.productId}. ` +
                `Available: ${Number(batchRow.stock ?? 0)}, Required: ${qty}`,
            );
          }
          await bumpBatchAndProductStock(
            tx,
            resolvedBatchId,
            item.productId,
            -qty,
          );
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: qty },
              updatedAt: now,
              isSynced: false,
              syncedAt: null,
            },
          });
        }
      }

      await tx.saleItem.create({
        data: {
          id: uuidv4(),
          saleId: id,
          productId: item.productId,
          barcode: item.barcode ?? null,
          quantity: qty,
          unit: item.unit,
          rate: item.rate,
          mrp: item.mrp ?? null,
          taxPercent: toTaxPercent(item.taxPercent),
          taxAmount,
          discount: discountAbs,
          discountType: item.discountType ?? "ABS",
          salePrice,
          profit,
          totalCost,
          billedValue,
          effectiveUnitValue,
          batchNo: item.batchNo ?? null,
          batchId: resolvedBatchId,
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

    await tx.sale.update({
      where: { id },
      data: {
        billNo: header.billNo ?? existing.billNo,
        customerId: validCustomerId,
        customerName: header.customerName ?? existing.customerName,
        department: header.department ?? existing.department,
        debitAccount: header.debitAccount ?? existing.debitAccount,
        natureOfEntry: header.natureOfEntry ?? existing.natureOfEntry,
        saleDate,
        entryTime: header.entryTime
          ? new Date(header.entryTime as string)
          : existing.entryTime,
        discount: Number(header.discount ?? existing.discount ?? 0),
        totalAmount,
        saleType: header.saleType ?? (existing.saleType as any),
        updatedAt: now,
        isSynced: false,
        typeId: header.typeId ?? null,
      },
    });

    // Rebuild ledger
    await tx.customerTransaction.deleteMany({
      where: { licenseId, kind: "SALE", refId: id },
    });
    await tx.cashTransaction.deleteMany({
      where: { licenseId, kind: "SALE", refId: id },
    });

    const saleType = header.saleType ?? existing.saleType;

    if (saleType !== "CASH" && validCustomerId) {
      await tx.customerTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          customerId: validCustomerId,
          kind: "SALE",
          refId: id,
          refNo: header.billNo ?? existing.billNo,
          date: saleDate,
          amount: grandAmount,
          sign: 1,
          notes: "Sale",
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
          kind: "SALE",
          refId: id,
          refNo: header.billNo ?? existing.billNo,
          date: saleDate,
          amount: grandAmount,
          sign: 1,
          notes: "Sale (Cash)",
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }
  });

  return { success: true };
}

// ── DELETE SALE ───────────────────────────────────────────────────────────────

export async function deleteSale(licenseId: string, id: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const s = await tx.sale.findFirst({
      where: { id, licenseId },
      include: { items: { where: { deletedAt: null } } },
    });
    if (!s) throw new Error("Sale not found");

    // Reverse stock (add back what was deducted)
    for (const it of s.items) {
      if (!it.isFree) {
        if (it.batchId) {
          await bumpBatchAndProductStock(
            tx,
            it.batchId,
            it.productId,
            Number(it.quantity),
          );
        } else {
          await tx.product.update({
            where: { id: it.productId },
            data: {
              stock: { increment: Number(it.quantity) },
              updatedAt: now,
              isSynced: false,
              syncedAt: null,
            },
          });
        }
      }
    }

    await tx.sale.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now, isSynced: false },
    });
    await tx.saleItem.updateMany({
      where: { saleId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false },
    });

    await tx.customerTransaction.deleteMany({
      where: { licenseId, kind: "SALE", refId: id },
    });
    await tx.cashTransaction.deleteMany({
      where: { licenseId, kind: "SALE", refId: id },
    });
  });

  return { success: true, deletedAt: now.toISOString() };
}

// ── LIST SALES ────────────────────────────────────────────────────────────────

export async function listSales(
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
  if (dateFrom)
    where.saleDate = { ...(where.saleDate || {}), gte: new Date(dateFrom) };
  if (dateTo)
    where.saleDate = { ...(where.saleDate || {}), lt: new Date(dateTo) };
  if (q?.trim()) {
    where.OR = [
      { billNo: { contains: q.trim(), mode: "insensitive" } },
      { customerName: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: [{ saleDate: "desc" }, { slNo: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slNo: true,
        billNo: true,
        customerId: true,
        customerName: true,
        saleDate: true,
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
    rows: rows.map((r) => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      discount: Number(r.discount ?? 0),
    })),
  };
}

// ── GET SALE FULL ─────────────────────────────────────────────────────────────

export async function getSaleFull(licenseId: string, id: string) {
  const s = await prisma.sale.findFirst({
    where: { id, licenseId },
    include: {
      items: {
        where: { deletedAt: null },
        orderBy: [{ lineNo: "asc" }],
        include: { product: { select: { name: true, code: true } } },
      },
    },
  });

  if (!s) return { success: false, error: "Not found" };

  return {
    success: true,
    sale: {
      ...s,
      totalAmount: Number(s.totalAmount),
      discount: Number(s.discount ?? 0),
    },
    items: s.items.map((it) => ({
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
  const agg = await prisma.sale.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return { nextSlNo: (agg._max.slNo ?? 0) + 1 };
}

// ── HOLDS ─────────────────────────────────────────────────────────────────────

export async function saveSaleHold(payload: {
  id?: string;
  licenseId: string;
  userId?: string;
  title?: string | null;
  header: any;
  rows: any[];
}) {
  const now = new Date();

  if (payload.id) {
    const existing = await prisma.saleHold.findFirst({
      where: { id: payload.id, deletedAt: null },
    });
    if (!existing) return { success: false, error: "NOT_FOUND" };

    await prisma.saleHold.update({
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
    await tx.saleHold.create({
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
  });

  const created = await prisma.saleHold.findFirst({
    where: { licenseId: payload.licenseId, deletedAt: null },
    orderBy: { holdNo: "desc" },
  });

  return { success: true, id: created!.id, holdNo: created!.holdNo };
}

export async function listSaleHolds(
  licenseId: string,
  pagination: { page?: number; pageSize?: number } = {},
) {
  const { page = 1, pageSize = 50 } = pagination;

  const [total, rows] = await Promise.all([
    prisma.saleHold.count({ where: { licenseId, deletedAt: null } }),
    prisma.saleHold.findMany({
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

export async function getSaleHold(licenseId: string, id: string) {
  const row = await prisma.saleHold.findFirst({
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

export async function deleteSaleHold(licenseId: string, id: string) {
  const now = new Date();
  await prisma.saleHold.updateMany({
    where: { id, licenseId },
    data: {
      deletedAt: now,
      updatedAt: now,
      isSynced: true,
      syncedAt: now,
    },
  });
  return { success: true };
}

export async function peekNextHoldNo(licenseId: string) {
  const agg = await prisma.saleHold.aggregate({
    where: { licenseId },
    _max: { holdNo: true },
  });
  return { nextHoldNo: (agg._max.holdNo ?? 0) + 1 };
}
