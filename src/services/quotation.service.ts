// backend/src/services/quotation.service.ts
import { PrismaClient, TaxPercent } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

function toTaxPercent(v: string): TaxPercent {
  const valid: TaxPercent[] = ["NT", "P5", "P12", "P18", "P28"];
  return valid.includes(v as TaxPercent) ? (v as TaxPercent) : "NT";
}

async function getNextQuotationSlNo(
  tx: any,
  licenseId: string,
): Promise<number> {
  const agg = await tx.quotation.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return (agg._max.slNo ?? 0) + 1;
}

function formatQuotationNo(slNo: number): string {
  return `QT-${String(slNo).padStart(4, "0")}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuotationCreateInput {
  licenseId: string;
  quotationNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  department?: string | null;
  debitAccount?: string | null;
  natureOfEntry?: string | null;
  quotationDate?: string | Date;
  entryTime?: string | Date | null;
  discount?: number;
  status?: string;
  notes?: string | null;
  typeId?: string | null;
}

export interface QuotationItemInput {
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

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function createQuotation(
  header: QuotationCreateInput,
  items: QuotationItemInput[],
) {
  const { licenseId } = header;
  const now = new Date();
  const quotationDate = header.quotationDate
    ? new Date(header.quotationDate)
    : now;
  const newId = uuidv4();
  let totalAmount = 0;

  const result = await prisma.$transaction(async (tx) => {
    const slNo = await getNextQuotationSlNo(tx, licenseId);
    const quotationNo = header.quotationNo || formatQuotationNo(slNo);

    let validCustomerId: string | null = null;
    if (header.customerId) {
      const cust = await tx.customer.findFirst({
        where: { id: header.customerId, licenseId, deletedAt: null },
      });
      validCustomerId = cust ? header.customerId : null;
    }

    await tx.quotation.create({
      data: {
        id: newId,
        slNo,
        licenseId,
        quotationNo,
        customerId: validCustomerId,
        customerName: header.customerName ?? null,
        department: header.department ?? null,
        debitAccount: header.debitAccount ?? null,
        natureOfEntry: header.natureOfEntry ?? null,
        quotationDate,
        entryTime: header.entryTime ? new Date(header.entryTime as string) : now,
        totalAmount: 0,
        discount: header.discount ?? 0,
        status: header.status ?? "DRAFT",
        notes: header.notes ?? null,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
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

      totalAmount += billedValue;

      await tx.quotationItem.create({
        data: {
          id: uuidv4(),
          quotationId: newId,
          productId: item.productId,
          barcode: item.barcode ?? null,
          quantity: qty,
          unit: item.unit,
          rate: item.rate,
          mrp: item.mrp ?? null,
          taxPercent: toTaxPercent(item.taxPercent),
          taxAmount,
          discount: item.discount ?? 0,
          discountType: item.discountType ?? null,
          salePrice: item.salePrice ?? null,
          profit: item.profit ?? null,
          totalCost,
          billedValue,
          batchNo: item.batchNo ?? null,
          batchId: item.batchId ?? null,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineNo: item.lineNo ?? idx + 1,
          effectiveUnitValue,
          isFree,
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    await tx.quotation.update({
      where: { id: newId },
      data: { totalAmount },
    });

    return { slNo, quotationNo, totalAmount };
  });

  return { success: true, id: newId, quotationId: newId, ...result };
}

// ── LIST ──────────────────────────────────────────────────────────────────────

export async function listQuotations(
  licenseId: string,
  filters: {
    q?: string;
    customerId?: string | null;
    status?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    page?: number;
    pageSize?: number;
    includeDeleted?: boolean;
  } = {},
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const where: any = {
    licenseId,
    ...(filters.includeDeleted ? {} : { deletedAt: null }),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          quotationDate: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lt: new Date(filters.dateTo) } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { quotationNo: { contains: filters.q, mode: "insensitive" } },
            { customerName: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      where,
      orderBy: [{ quotationDate: "desc" }, { slNo: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        slNo: true,
        quotationNo: true,
        customerId: true,
        customerName: true,
        department: true,
        debitAccount: true,
        natureOfEntry: true,
        quotationDate: true,
        entryTime: true,
        totalAmount: true,
        discount: true,
        status: true,
        notes: true,
        convertedSaleId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    }),
  ]);

  return { success: true, total, page, pageSize, rows };
}

// ── GET FULL ──────────────────────────────────────────────────────────────────

export async function getQuotationFull(licenseId: string, id: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id, licenseId },
  });
  if (!quotation) return { success: false, error: "Quotation not found" };

  const items = await prisma.quotationItem.findMany({
    where: { quotationId: id, deletedAt: null },
    orderBy: { lineNo: "asc" },
  });

  return { success: true, quotation, items };
}

// ── PEEK NEXT SL NO ───────────────────────────────────────────────────────────

export async function peekNextQuotationSlNo(licenseId: string) {
  const agg = await prisma.quotation.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  const nextSlNo = (agg._max.slNo ?? 0) + 1;
  return { nextSlNo, nextQuotationNo: formatQuotationNo(nextSlNo) };
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateQuotation(
  licenseId: string,
  id: string,
  header: Partial<QuotationCreateInput>,
  items: QuotationItemInput[],
) {
  const now = new Date();
  const existing = await prisma.quotation.findFirst({
    where: { id, licenseId, deletedAt: null },
  });
  if (!existing) throw new Error("Quotation not found");
  if (existing.status === "CONVERTED")
    throw new Error("Cannot edit a converted quotation");

  let totalAmount = 0;

  await prisma.$transaction(async (tx) => {
    await tx.quotationItem.updateMany({
      where: { quotationId: id },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
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

      totalAmount += billedValue;

      await tx.quotationItem.create({
        data: {
          id: uuidv4(),
          quotationId: id,
          productId: item.productId,
          barcode: item.barcode ?? null,
          quantity: qty,
          unit: item.unit,
          rate: item.rate,
          mrp: item.mrp ?? null,
          taxPercent: toTaxPercent(item.taxPercent),
          taxAmount,
          discount: item.discount ?? 0,
          discountType: item.discountType ?? null,
          salePrice: item.salePrice ?? null,
          profit: item.profit ?? null,
          totalCost,
          billedValue,
          batchNo: item.batchNo ?? null,
          batchId: item.batchId ?? null,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineNo: item.lineNo ?? idx + 1,
          effectiveUnitValue,
          isFree,
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    const quotationDate = header.quotationDate
      ? new Date(header.quotationDate)
      : undefined;

    await tx.quotation.update({
      where: { id },
      data: {
        ...(quotationDate ? { quotationDate } : {}),
        ...(header.customerId !== undefined
          ? { customerId: header.customerId }
          : {}),
        ...(header.customerName !== undefined
          ? { customerName: header.customerName }
          : {}),
        ...(header.department !== undefined
          ? { department: header.department }
          : {}),
        ...(header.debitAccount !== undefined
          ? { debitAccount: header.debitAccount }
          : {}),
        ...(header.natureOfEntry !== undefined
          ? { natureOfEntry: header.natureOfEntry }
          : {}),
        ...(header.discount !== undefined ? { discount: header.discount } : {}),
        ...(header.status !== undefined ? { status: header.status } : {}),
        ...(header.notes !== undefined ? { notes: header.notes } : {}),
        totalAmount,
        updatedAt: now,
        isSynced: false,
        syncedAt: null,
      },
    });
  });

  return { success: true, id };
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteQuotation(licenseId: string, id: string) {
  const existing = await prisma.quotation.findFirst({
    where: { id, licenseId, deletedAt: null },
  });
  if (!existing) throw new Error("Quotation not found");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });
    await tx.quotationItem.updateMany({
      where: { quotationId: id, deletedAt: null },
      data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
    });
  });

  return { success: true, id, deletedAt: now.toISOString() };
}

// ── CONVERT TO SALE ───────────────────────────────────────────────────────────

export async function convertQuotationToSale(
  licenseId: string,
  quotationId: string,
  overrides: {
    billNo?: string | null;
    saleType?: "CASH" | "CREDIT";
    saleDate?: string;
  } = {},
) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, licenseId, deletedAt: null },
    include: { items: { where: { deletedAt: null } } },
  });
  if (!quotation) throw new Error("Quotation not found");
  if (quotation.status === "CONVERTED")
    throw new Error("Quotation is already converted");

  const now = new Date();
  const saleDate = overrides.saleDate ? new Date(overrides.saleDate) : now;
  const saleType = overrides.saleType ?? "CASH";
  const saleId = uuidv4();

  await prisma.$transaction(async (tx) => {
    // Get next sale slNo
    const saleAgg = await tx.sale.aggregate({
      where: { licenseId, deletedAt: null },
      _max: { slNo: true },
    });
    const saleSlNo = (saleAgg._max.slNo ?? 0) + 1;

    let validCustomerId: string | null = null;
    if (quotation.customerId) {
      const cust = await tx.customer.findFirst({
        where: {
          id: quotation.customerId,
          licenseId,
          deletedAt: null,
        },
      });
      validCustomerId = cust ? quotation.customerId : null;
    }

    await tx.sale.create({
      data: {
        id: saleId,
        slNo: saleSlNo,
        licenseId,
        billNo: overrides.billNo ?? null,
        customerId: validCustomerId,
        customerName: quotation.customerName ?? null,
        department: quotation.department ?? null,
        debitAccount: quotation.debitAccount ?? null,
        natureOfEntry: quotation.natureOfEntry ?? null,
        saleType,
        saleDate,
        entryTime: now,
        totalAmount: quotation.totalAmount,
        discount: quotation.discount ?? 0,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });

    for (let idx = 0; idx < quotation.items.length; idx++) {
      const item = quotation.items[idx];
      const qty = item.quantity;
      const isFree = Boolean((item as any).isFree);

      // Deduct stock
      if (!isFree && qty > 0) {
        if (item.batchId) {
          const batchRow = await tx.productBatch.findUnique({
            where: { id: item.batchId },
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
          await tx.productBatch.update({
            where: { id: item.batchId },
            data: { stock: { increment: -qty } },
          });
          const agg = await tx.productBatch.aggregate({
            where: { productId: item.productId, deletedAt: null },
            _sum: { stock: true },
          });
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: agg._sum.stock ?? 0,
              updatedAt: now,
              isSynced: false,
              syncedAt: null,
            },
          });
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
          saleId,
          productId: item.productId,
          barcode: item.barcode ?? null,
          quantity: qty,
          unit: item.unit,
          rate: item.rate,
          mrp: item.mrp ?? null,
          taxPercent: item.taxPercent,
          taxAmount: item.taxAmount,
          discount: item.discount ?? 0,
          discountType: item.discountType ?? null,
          salePrice: item.salePrice ?? null,
          profit: (item as any).profit ?? null,
          totalCost: item.totalCost,
          billedValue: item.billedValue ?? null,
          batchNo: item.batchNo ?? null,
          batchId: item.batchId ?? null,
          mfgDate: item.mfgDate ?? null,
          expiryDate: item.expiryDate ?? null,
          lineNo: item.lineNo ?? idx + 1,
          isFree,
          effectiveUnitValue: item.effectiveUnitValue ?? null,
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    // Customer ledger entry for CREDIT sales
    const grandAmount = Math.max(
      0,
      Number(quotation.totalAmount) - Number(quotation.discount ?? 0),
    );

    if (saleType === "CREDIT" && validCustomerId) {
      await tx.customerTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          customerId: validCustomerId,
          kind: "SALE",
          refId: saleId,
          refNo: String(saleSlNo),
          date: saleDate,
          amount: grandAmount,
          sign: 1,
          notes: `Converted from quotation ${quotation.quotationNo}`,
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
          refId: saleId,
          refNo: overrides.billNo ?? String(saleSlNo),
          date: saleDate,
          amount: grandAmount,
          sign: 1,
          notes: `Sale (Cash, from quotation ${quotation.quotationNo})`,
          createdAt: now,
          updatedAt: now,
          isSynced: false,
        },
      });
    }

    // Mark quotation as CONVERTED
    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        status: "CONVERTED",
        convertedSaleId: saleId,
        updatedAt: now,
        isSynced: false,
        syncedAt: null,
      },
    });
  });

  return { success: true, saleId };
}
