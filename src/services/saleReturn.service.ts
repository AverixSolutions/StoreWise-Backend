// backend/src/services/saleReturn.service.ts
import { PrismaClient, TaxPercent } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

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

async function bumpBatchAndProductStock(
  tx: any,
  batchId: string,
  productId: string,
  delta: number,
) {
  await tx.productBatch.update({
    where: { id: batchId },
    data: {
      stock: { increment: delta },
      updatedAt: new Date(),
    },
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

async function adjustLegacyProductStock(
  tx: any,
  productId: string,
  delta: number,
) {
  await tx.product.update({
    where: { id: productId },
    data: {
      stock: { increment: delta },
      updatedAt: new Date(),
      isSynced: false,
      syncedAt: null,
    },
  });
}

function computeReturnAmounts(
  item: {
    rate: number;
    taxPercent: string;
    discountType?: "ABS" | "PCT";
    discount?: number;
    salePrice?: number | null;
    profitPercent?: number;
    isFree?: boolean;
  },
  quantity: number,
) {
  const qty = Math.max(0, Number(quantity || 0));
  const isFree = Boolean(item.isFree);
  const rate = Math.max(0, Number(item.rate || 0));
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
      ? totalCost *
        (Math.max(0, Math.min(100, Number(item.discount || 0))) / 100)
      : Math.max(0, Number(item.discount || 0));

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
      where: {
        id: item.batchId,
        licenseId,
        deletedAt: null,
      },
    });
    if (!batch) {
      throw new Error("Selected batch was not found.");
    }
    if (batch.productId !== item.productId) {
      throw new Error("Selected batch does not belong to the return product.");
    }
    return batch;
  }

  const hasIdentity = Boolean(
    item.batchNo || item.barcode || item.mfgDate || item.expiryDate,
  );
  if (!hasIdentity) return null;

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

  if (!batch) {
    throw new Error("Selected batch was not found.");
  }
  return batch;
}

async function getPreviouslyReturnedQuantity(
  tx: any,
  saleId: string,
  saleItemId: string,
  excludeReturnId?: string | null,
) {
  const rows = await tx.saleReturnItem.findMany({
    where: {
      saleItemId,
      deletedAt: null,
      saleReturn: {
        saleId,
        deletedAt: null,
        ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
      },
    },
    select: {
      quantity: true,
      appliedQuantity: true,
    },
  });

  return rows.reduce(
    (sum: number, row: any) =>
      sum + Number(row.appliedQuantity ?? row.quantity ?? 0),
    0,
  );
}

async function resolveLinkedSaleItem(
  tx: any,
  licenseId: string,
  saleId: string,
  item: SaleReturnItemInput,
  excludeReturnId?: string | null,
) {
  if (!item.saleItemId) {
    throw new Error("Source Sale item is required.");
  }

  const sourceItem = await tx.saleItem.findFirst({
    where: {
      id: item.saleItemId,
      saleId,
      deletedAt: null,
      sale: {
        licenseId,
        deletedAt: null,
      },
    },
  });

  if (!sourceItem) {
    throw new Error("Source Sale item was not found.");
  }

  if (sourceItem.productId !== item.productId) {
    throw new Error("Returned product does not match the source Sale item.");
  }

  const previouslyReturnedQuantity = await getPreviouslyReturnedQuantity(
    tx,
    saleId,
    sourceItem.id,
    excludeReturnId,
  );
  const soldQuantity = Math.max(0, Number(sourceItem.quantity || 0));
  const remainingReturnableQuantity = Math.max(
    0,
    soldQuantity - previouslyReturnedQuantity,
  );

  return {
    sourceItem,
    soldQuantity,
    previouslyReturnedQuantity,
    remainingReturnableQuantity,
  };
}

async function getSourceSale(tx: any, licenseId: string, saleId: string) {
  return tx.sale.findFirst({
    where: {
      id: saleId,
      licenseId,
      deletedAt: null,
    },
  });
}

function sourceDiscountPercent(item: any) {
  if (item?.isFree) return 0;
  const qty = Math.max(0, Number(item?.quantity || 0));
  const rate = Math.max(0, Number(item?.rate || 0));
  const taxPct =
    item?.taxPercent === "NT"
      ? 0
      : Number(String(item?.taxPercent || "").replace("P", "")) || 0;
  const gross = rate * qty * (1 + taxPct / 100);
  if (gross <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, (Number(item?.discount || 0) / gross) * 100),
  );
}

export async function getSaleReturnSource(
  licenseId: string,
  saleId: string,
  excludeReturnId?: string | null,
) {
  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      licenseId,
      deletedAt: null,
    },
  });

  if (!sale) {
    return { success: false, error: "Sale bill not found." };
  }

  const items = await prisma.saleItem.findMany({
    where: {
      saleId,
      deletedAt: null,
    },
    include: {
      product: true,
    },
    orderBy: {
      lineNo: "asc",
    },
  });

  const batchIds = items
    .map((item) => item.batchId)
    .filter((value): value is string => Boolean(value));
  const batches = batchIds.length
    ? await prisma.productBatch.findMany({
        where: {
          id: { in: batchIds },
          licenseId,
          deletedAt: null,
        },
        select: {
          id: true,
          stock: true,
        },
      })
    : [];
  const stockByBatch = new Map(
    batches.map((batch) => [batch.id, Number(batch.stock || 0)]),
  );

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const previouslyReturnedQuantity = await getPreviouslyReturnedQuantity(
        prisma,
        saleId,
        item.id,
        excludeReturnId,
      );
      const soldQuantity = Math.max(0, Number(item.quantity || 0));
      const remainingReturnableQuantity = Math.max(
        0,
        soldQuantity - previouslyReturnedQuantity,
      );

      return {
        ...item,
        productName: item.product?.name ?? null,
        productCode: item.product?.code ?? null,
        quantity: soldQuantity,
        rate: Number(item.rate),
        mrp: item.mrp != null ? Number(item.mrp) : null,
        taxAmount: Number(item.taxAmount),
        discount: Number(item.discount ?? 0),
        salePrice: item.salePrice != null ? Number(item.salePrice) : null,
        profit: item.profit != null ? Number(item.profit) : null,
        totalCost: Number(item.totalCost),
        billedValue: item.billedValue != null ? Number(item.billedValue) : null,
        effectiveUnitValue:
          item.effectiveUnitValue != null
            ? Number(item.effectiveUnitValue)
            : null,
        isFree: item.isFree ? 1 : 0,
        sourceDiscountPercent: sourceDiscountPercent(item),
        previouslyReturnedQuantity,
        remainingReturnableQuantity,
        currentBatchStock: item.batchId
          ? Math.max(0, stockByBatch.get(item.batchId) || 0)
          : Math.max(0, Number(item.product?.stock || 0)),
      };
    }),
  );

  return {
    success: true,
    sale: {
      ...sale,
      totalAmount: Number(sale.totalAmount),
      discount: Number(sale.discount ?? 0),
      offerSavings: Number(sale.offerSavings ?? 0),
    },
    items: enrichedItems,
  };
}

export interface CreateSaleReturnInput {
  licenseId: string;
  saleId?: string | null;
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
  saleItemId?: string | null;
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
  rateTypeId?: string | null;
  rateTypeCode?: string | null;
  rateTypeName?: string | null;
  rateSource?: "MASTER" | "CUSTOM" | "LEGACY";
}

async function resolveEffectiveHeader(
  tx: any,
  licenseId: string,
  header: CreateSaleReturnInput,
) {
  const saleId = header.saleId || null;
  const sourceSale = saleId ? await getSourceSale(tx, licenseId, saleId) : null;

  if (saleId && !sourceSale) {
    throw new Error("Source Sale bill was not found.");
  }

  const effectiveSaleType: "CASH" | "CREDIT" = sourceSale
    ? sourceSale.saleType === "CREDIT"
      ? "CREDIT"
      : "CASH"
    : header.saleType === "CREDIT"
      ? "CREDIT"
      : "CASH";

  const requestedCustomerId = sourceSale
    ? sourceSale.customerId
    : header.customerId || null;
  let validCustomerId: string | null = null;

  if (requestedCustomerId) {
    const customer = await tx.customer.findFirst({
      where: {
        id: requestedCustomerId,
        licenseId,
        ...(sourceSale ? {} : { deletedAt: null }),
      },
    });
    validCustomerId = customer ? requestedCustomerId : null;
  }

  if (effectiveSaleType === "CREDIT" && !validCustomerId) {
    throw new Error("Customer is required for CREDIT Sales Return.");
  }

  return {
    sourceSale,
    saleId,
    saleType: effectiveSaleType,
    customerId: validCustomerId,
    customerName: sourceSale
      ? (sourceSale.customerName ?? header.customerName ?? null)
      : (header.customerName ?? null),
    billNo: sourceSale
      ? (sourceSale.billNo ?? header.billNo ?? null)
      : (header.billNo ?? null),
  };
}

async function writeSaleReturnItems(
  tx: any,
  {
    licenseId,
    returnId,
    saleId,
    items,
    now,
    excludeReturnId,
  }: {
    licenseId: string;
    returnId: string;
    saleId: string | null;
    items: SaleReturnItemInput[];
    now: Date;
    excludeReturnId?: string | null;
  },
) {
  let totalAmount = 0;
  let savedItemCount = 0;
  const sourceMode = Boolean(saleId);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const requestedQty = Math.max(0, Number(item.quantity || 0));
    if (requestedQty <= 0) continue;

    let sourceItem: any = null;
    if (sourceMode && saleId) {
      const linked = await resolveLinkedSaleItem(
        tx,
        licenseId,
        saleId,
        item,
        excludeReturnId,
      );
      sourceItem = linked.sourceItem;

      if (requestedQty > linked.remainingReturnableQuantity) {
        throw new Error(
          `Row ${idx + 1}: only ${linked.remainingReturnableQuantity} can still be returned from this Sale item.`,
        );
      }
    }

    const productId = sourceItem?.productId || item.productId;
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        licenseId,
        deletedAt: null,
      },
    });
    if (!product) {
      throw new Error(`Row ${idx + 1}: product was not found.`);
    }

    const batch = await resolveReturnBatch(tx, licenseId, {
      ...item,
      productId,
      batchId: item.batchId ?? sourceItem?.batchId ?? null,
      batchNo: item.batchNo ?? sourceItem?.batchNo ?? null,
      barcode: item.barcode ?? sourceItem?.barcode ?? null,
      mfgDate: item.mfgDate ?? sourceItem?.mfgDate ?? null,
      expiryDate: item.expiryDate ?? sourceItem?.expiryDate ?? null,
    });

    const isFree = sourceMode
      ? Boolean(sourceItem?.isFree)
      : Boolean(item.isFree);

    const amounts = computeReturnAmounts(
      {
        rate: Number(item.rate || 0),
        taxPercent: String(item.taxPercent || sourceItem?.taxPercent || "NT"),
        discountType: item.discountType || "ABS",
        discount: Number(item.discount || 0),
        salePrice:
          item.salePrice != null
            ? Number(item.salePrice)
            : sourceItem?.salePrice != null
              ? Number(sourceItem.salePrice)
              : null,
        profitPercent: Number(item.profitPercent || 0),
        isFree,
      },
      requestedQty,
    );

    totalAmount += amounts.billedValue;

    if (batch) {
      await bumpBatchAndProductStock(tx, batch.id, productId, requestedQty);
    } else {
      await adjustLegacyProductStock(tx, productId, requestedQty);
    }

    await tx.saleReturnItem.create({
      data: {
        id: uuidv4(),
        returnId,
        saleItemId: sourceItem?.id ?? null,
        productId,
        barcode: item.barcode ?? sourceItem?.barcode ?? null,
        quantity: requestedQty,
        appliedQuantity: requestedQty,
        overReturnQuantity: 0,
        overReturnReason: null,
        unit: item.unit || sourceItem?.unit || "NOS",
        rate: Number(item.rate || 0),
        mrp: item.mrp ?? sourceItem?.mrp ?? null,
        taxPercent: toTaxPercent(
          String(item.taxPercent || sourceItem?.taxPercent || "NT"),
        ),
        taxAmount: amounts.taxAmount,
        discount: amounts.discountAbs,
        discountType: item.discountType ?? "ABS",
        salePrice:
          item.salePrice ?? sourceItem?.salePrice ?? amounts.salePrice ?? null,
        rateTypeId: item.rateTypeId ?? sourceItem?.rateTypeId ?? null,
        rateTypeCode:
          item.rateTypeCode?.trim() || sourceItem?.rateTypeCode || null,
        rateTypeName:
          item.rateTypeName?.trim() || sourceItem?.rateTypeName || null,
        rateSource: item.rateSource ?? sourceItem?.rateSource ?? "LEGACY",
        profit: item.profit ?? amounts.profit ?? null,
        totalCost: amounts.totalCost,
        billedValue: amounts.billedValue,
        effectiveUnitValue: amounts.effectiveUnitValue,
        batchNo: batch?.batchNo ?? item.batchNo ?? sourceItem?.batchNo ?? null,
        batchId: batch?.id ?? null,
        mfgDate: item.mfgDate ?? sourceItem?.mfgDate ?? null,
        expiryDate: item.expiryDate ?? sourceItem?.expiryDate ?? null,
        lineNo: sourceItem?.lineNo ?? item.lineNo ?? idx + 1,
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });

    savedItemCount += 1;
  }

  if (!savedItemCount) {
    throw new Error("Enter a return quantity for at least one item.");
  }

  return totalAmount;
}

async function createSaleReturnLedgers(
  tx: any,
  {
    licenseId,
    customerId,
    saleType,
    refId,
    refNo,
    date,
    amount,
    now,
  }: {
    licenseId: string;
    customerId: string | null;
    saleType: "CASH" | "CREDIT";
    refId: string;
    refNo: string | null;
    date: Date;
    amount: number;
    now: Date;
  },
) {
  if (saleType === "CREDIT" && customerId) {
    await tx.customerTransaction.create({
      data: {
        id: uuidv4(),
        licenseId,
        customerId,
        kind: "RETURN",
        refId,
        refNo,
        date,
        amount,
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
        refId,
        refNo,
        date,
        amount,
        sign: -1,
        notes: "Sale Return (Cash Refund)",
        createdAt: now,
        updatedAt: now,
        isSynced: false,
      },
    });
  }
}

async function tombstoneSaleReturnLedgers(
  tx: any,
  licenseId: string,
  id: string,
  now: Date,
) {
  await tx.customerTransaction.updateMany({
    where: { licenseId, kind: "RETURN", refId: id, deletedAt: null },
    data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
  });
  await tx.cashTransaction.updateMany({
    where: { licenseId, kind: "PAYMENT", refId: id, deletedAt: null },
    data: { deletedAt: now, updatedAt: now, isSynced: false, syncedAt: null },
  });
}

async function undoSaleReturnStock(tx: any, items: any[]) {
  for (const item of items) {
    const quantity = Math.max(
      0,
      Number(item.appliedQuantity ?? item.quantity ?? 0),
    );
    if (quantity <= 0) continue;

    if (item.batchId) {
      await bumpBatchAndProductStock(
        tx,
        item.batchId,
        item.productId,
        -quantity,
      );
    } else {
      await adjustLegacyProductStock(tx, item.productId, -quantity);
    }
  }
}

export async function createSaleReturn(
  header: CreateSaleReturnInput,
  items: SaleReturnItemInput[],
) {
  const { licenseId } = header;
  const now = new Date();
  const returnDate = header.returnDate ? new Date(header.returnDate) : now;
  const newId = uuidv4();

  const result = await prisma.$transaction(async (tx) => {
    const effective = await resolveEffectiveHeader(tx, licenseId, header);
    const slNo = await getNextSlNo(tx, licenseId);

    await tx.saleReturn.create({
      data: {
        id: newId,
        slNo,
        licenseId,
        saleId: effective.saleId,
        billNo: effective.billNo,
        customerId: effective.customerId,
        customerName: effective.customerName,
        department: header.department ?? null,
        debitAccount: header.debitAccount ?? null,
        natureOfEntry: header.natureOfEntry ?? null,
        saleType: effective.saleType,
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

    const totalAmount = await writeSaleReturnItems(tx, {
      licenseId,
      returnId: newId,
      saleId: effective.saleId,
      items,
      now,
    });

    await tx.saleReturn.update({
      where: { id: newId },
      data: {
        totalAmount,
        updatedAt: now,
      },
    });

    const grandAmount = Math.max(0, totalAmount - Number(header.discount || 0));

    await createSaleReturnLedgers(tx, {
      licenseId,
      customerId: effective.customerId,
      saleType: effective.saleType,
      refId: newId,
      refNo: effective.billNo,
      date: returnDate,
      amount: grandAmount,
      now,
    });

    return {
      returnId: newId,
      slNo,
      totalAmount: grandAmount,
    };
  });

  return { success: true, ...result };
}

export async function updateSaleReturn(
  licenseId: string,
  id: string,
  header: Omit<CreateSaleReturnInput, "licenseId">,
  items: SaleReturnItemInput[],
) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = (await tx.saleReturn.findFirst({
      where: { id, licenseId, deletedAt: null },
      include: { items: { where: { deletedAt: null } } },
    })) as any;

    if (!existing) {
      throw new Error("Sale return not found");
    }

    await undoSaleReturnStock(tx, existing.items);

    await tx.saleReturnItem.updateMany({
      where: { returnId: id, deletedAt: null },
      data: {
        deletedAt: now,
        updatedAt: now,
        isSynced: false,
        syncedAt: null,
      },
    });

    await tombstoneSaleReturnLedgers(tx, licenseId, id, now);

    const effective = await resolveEffectiveHeader(tx, licenseId, {
      ...header,
      licenseId,
    });

    const totalAmount = await writeSaleReturnItems(tx, {
      licenseId,
      returnId: id,
      saleId: effective.saleId,
      items,
      now,
      excludeReturnId: id,
    });

    const returnDate = header.returnDate
      ? new Date(header.returnDate as string)
      : existing.returnDate;
    const grandAmount = Math.max(
      0,
      totalAmount - Number(header.discount ?? existing.discount ?? 0),
    );

    await tx.saleReturn.update({
      where: { id },
      data: {
        saleId: effective.saleId,
        billNo: effective.billNo,
        customerId: effective.customerId,
        customerName: effective.customerName,
        department: header.department ?? existing.department,
        debitAccount: header.debitAccount ?? existing.debitAccount,
        natureOfEntry: header.natureOfEntry ?? existing.natureOfEntry,
        returnDate,
        entryTime: header.entryTime
          ? new Date(header.entryTime as string)
          : existing.entryTime,
        discount: header.discount ?? existing.discount,
        totalAmount,
        saleType: effective.saleType,
        updatedAt: now,
        isSynced: false,
        syncedAt: null,
        typeId: header.typeId ?? existing.typeId ?? null,
      },
    });

    await createSaleReturnLedgers(tx, {
      licenseId,
      customerId: effective.customerId,
      saleType: effective.saleType,
      refId: id,
      refNo: effective.billNo,
      date: returnDate,
      amount: grandAmount,
      now,
    });

    return { returnId: id, totalAmount: grandAmount };
  });

  return { success: true, ...result };
}

export async function deleteSaleReturn(licenseId: string, id: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const existing = (await tx.saleReturn.findFirst({
      where: { id, licenseId, deletedAt: null },
      include: { items: { where: { deletedAt: null } } },
    })) as any;

    if (!existing) {
      throw new Error("Sale return not found");
    }

    await undoSaleReturnStock(tx, existing.items);

    await tx.saleReturn.update({
      where: { id },
      data: {
        deletedAt: now,
        updatedAt: now,
        isSynced: false,
        syncedAt: null,
      },
    });

    await tx.saleReturnItem.updateMany({
      where: { returnId: id, deletedAt: null },
      data: {
        deletedAt: now,
        updatedAt: now,
        isSynced: false,
        syncedAt: null,
      },
    });

    await tombstoneSaleReturnLedgers(tx, licenseId, id, now);
  });

  return { success: true, deletedAt: now.toISOString() };
}

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
        saleId: true,
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
    returns: rows.map((row) => ({
      ...row,
      totalAmount: Number(row.totalAmount),
      discount: Number(row.discount ?? 0),
    })),
  };
}

export async function getSaleReturnFull(licenseId: string, id: string) {
  const saleReturn = await prisma.saleReturn.findFirst({
    where: { id, licenseId },
  });
  if (!saleReturn) {
    return { success: false, error: "Not found" };
  }

  const items = await prisma.saleReturnItem.findMany({
    where: { returnId: id, deletedAt: null },
    orderBy: { lineNo: "asc" },
  });

  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, code: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  return {
    success: true,
    saleReturn: {
      ...saleReturn,
      totalAmount: Number(saleReturn.totalAmount),
      discount: Number(saleReturn.discount ?? 0),
    },
    items: items.map((item) => ({
      ...item,
      productName: productMap.get(item.productId)?.name ?? null,
      productCode: productMap.get(item.productId)?.code ?? null,
      rate: Number(item.rate),
      mrp: item.mrp != null ? Number(item.mrp) : null,
      taxAmount: Number(item.taxAmount),
      discount: Number(item.discount ?? 0),
      salePrice: item.salePrice != null ? Number(item.salePrice) : null,
      profit: item.profit != null ? Number(item.profit) : null,
      totalCost: Number(item.totalCost),
      billedValue: item.billedValue != null ? Number(item.billedValue) : null,
      effectiveUnitValue:
        item.effectiveUnitValue != null
          ? Number(item.effectiveUnitValue)
          : null,
    })),
  };
}

export async function peekNextSaleReturnSlNo(licenseId: string) {
  const agg = await prisma.saleReturn.aggregate({
    where: { licenseId, deletedAt: null },
    _max: { slNo: true },
  });
  return { nextSlNo: (agg._max.slNo ?? 0) + 1 };
}
