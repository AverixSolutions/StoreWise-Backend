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

async function getPreviouslyReturnedQuantity(
  tx: any,
  purchaseId: string,
  purchaseItemId: string,
  excludeReturnId?: string | null,
) {
  const rows = await tx.purchaseReturnItem.findMany({
    where: {
      purchaseItemId,
      deletedAt: null,
      purchaseReturn: {
        purchaseId,
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

async function resolveLinkedPurchaseItem(
  tx: any,
  licenseId: string,
  purchaseId: string,
  item: PurchaseReturnItemInput,
  excludeReturnId?: string | null,
) {
  if (!item.purchaseItemId) {
    throw new Error("Source Purchase item is required.");
  }

  const sourceItem = await tx.purchaseItem.findFirst({
    where: {
      id: item.purchaseItemId,
      purchaseId,
      deletedAt: null,
      purchase: {
        licenseId,
        deletedAt: null,
      },
    },
  });

  if (!sourceItem) {
    throw new Error("Source Purchase item was not found.");
  }

  if (sourceItem.productId !== item.productId) {
    throw new Error(
      "Returned product does not match the source Purchase item.",
    );
  }

  const previouslyReturnedQuantity = await getPreviouslyReturnedQuantity(
    tx,
    purchaseId,
    sourceItem.id,
    excludeReturnId,
  );
  const purchasedQuantity = Number(sourceItem.quantity || 0);
  const remainingReturnableQuantity = Math.max(
    0,
    purchasedQuantity - previouslyReturnedQuantity,
  );

  return {
    sourceItem,
    purchasedQuantity,
    previouslyReturnedQuantity,
    remainingReturnableQuantity,
  };
}

export async function getPurchaseReturnSource(
  licenseId: string,
  purchaseId: string,
  excludeReturnId?: string | null,
) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      id: purchaseId,
      licenseId,
      deletedAt: null,
    },
  });

  if (!purchase) {
    return { success: false, error: "Purchase bill not found." };
  }

  if (!purchase.supplierId) {
    return {
      success: false,
      error: "The selected Purchase bill does not have a supplier.",
    };
  }

  const items = await prisma.purchaseItem.findMany({
    where: {
      purchaseId,
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
        purchaseId,
        item.id,
        excludeReturnId,
      );
      const purchasedQuantity = Number(item.quantity || 0);
      const remainingReturnableQuantity = Math.max(
        0,
        purchasedQuantity - previouslyReturnedQuantity,
      );

      return {
        ...item,
        productName: item.product?.name ?? null,
        productCode: item.product?.code ?? null,
        quantity: purchasedQuantity,
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
        previouslyReturnedQuantity,
        remainingReturnableQuantity,
        availableStock: item.isFree
          ? remainingReturnableQuantity
          : item.batchId
            ? Math.max(0, stockByBatch.get(item.batchId) || 0)
            : Math.max(0, Number(item.product?.stock || 0)),
      };
    }),
  );

  return {
    success: true,
    purchase: {
      ...purchase,
      totalAmount: Number(purchase.totalAmount),
      discount: Number(purchase.discount ?? 0),
    },
    items: enrichedItems,
  };
}

async function writePurchaseReturnItems(
  tx: any,
  {
    licenseId,
    returnId,
    purchaseId,
    items,
    now,
    excludeReturnId,
  }: {
    licenseId: string;
    returnId: string;
    purchaseId: string | null;
    items: PurchaseReturnItemInput[];
    now: Date;
    excludeReturnId?: string | null;
  },
) {
  let totalAmount = 0;
  let savedItemCount = 0;
  const sourceMode = Boolean(purchaseId);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const requestedQty = Number(item.quantity || 0);
    if (requestedQty <= 0) continue;

    let sourceItem: any = null;
    let linked: any = null;

    if (sourceMode && purchaseId) {
      linked = await resolveLinkedPurchaseItem(
        tx,
        licenseId,
        purchaseId,
        item,
        excludeReturnId,
      );
      sourceItem = linked.sourceItem;

      if (requestedQty > linked.remainingReturnableQuantity) {
        throw new Error(
          `Row ${idx + 1}: only ${linked.remainingReturnableQuantity} can still be returned from this Purchase item.`,
        );
      }
    }

    const productId = sourceItem?.productId || item.productId;
    const product = await tx.product.findFirst({
      where: { id: productId, licenseId, deletedAt: null },
    });
    if (!product) {
      throw new Error(`Row ${idx + 1}: product was not found.`);
    }

    const isFree = sourceMode
      ? Boolean(sourceItem?.isFree)
      : Boolean(item.isFree);

    const hasBatchIdentity = Boolean(
      item.batchId ||
      item.batchNo ||
      item.barcode ||
      item.mfgDate ||
      item.expiryDate,
    );

    const batch =
      !isFree && hasBatchIdentity
        ? await resolveReturnBatch(tx, licenseId, {
            ...item,
            productId,
          })
        : null;

    const availableStock = isFree
      ? Number.POSITIVE_INFINITY
      : batch
        ? Math.max(0, Number(batch.stock || 0))
        : Math.max(0, Number(product.stock || 0));

    if (!isFree && requestedQty > availableStock) {
      throw new Error(
        `Row ${idx + 1}: only ${availableStock} is available in the selected ${batch ? "batch" : "product stock"}.`,
      );
    }

    const sourceQuantity = sourceItem
      ? Math.max(1, Number(sourceItem.quantity || 0))
      : 1;
    const proportionalDiscount = sourceItem
      ? (Number(sourceItem.discount || 0) / sourceQuantity) * requestedQty
      : Number(item.discount || 0);

    const amounts = computeReturnAmounts(
      sourceItem
        ? {
            rate: Number(sourceItem.rate || 0),
            taxPercent: String(sourceItem.taxPercent || "NT"),
            quantity: requestedQty,
            discountType: "ABS",
            discount: proportionalDiscount,
            salePrice:
              item.salePrice != null
                ? Number(item.salePrice)
                : sourceItem.salePrice != null
                  ? Number(sourceItem.salePrice)
                  : null,
            isFree,
          }
        : {
            rate: Number(item.rate || 0),
            taxPercent: String(item.taxPercent || "NT"),
            quantity: requestedQty,
            discountType: item.discountType || "ABS",
            discount: Number(item.discount || 0),
            salePrice: item.salePrice != null ? Number(item.salePrice) : null,
            profitPercent: Number(item.profitPercent || 0),
            isFree,
          },
      requestedQty,
    );

    totalAmount += amounts.billedValue;

    if (!isFree) {
      if (batch) {
        await reverseBatchAndProductStock(
          tx,
          batch.id,
          productId,
          -requestedQty,
        );
      } else {
        await adjustLegacyProductStock(tx, productId, -requestedQty);
      }
    }

    await tx.purchaseReturnItem.create({
      data: {
        id: uuidv4(),
        returnId,
        purchaseItemId: sourceItem?.id ?? null,
        productId,
        barcode: item.barcode ?? sourceItem?.barcode ?? null,
        quantity: requestedQty,
        appliedQuantity: requestedQty,
        overReturnQuantity: 0,
        overReturnReason: null,
        unit: sourceItem?.unit ?? item.unit,
        isFree,
        rate: sourceItem?.rate ?? item.rate,
        mrp: item.mrp ?? sourceItem?.mrp ?? null,
        taxPercent: sourceItem?.taxPercent ?? toTaxPercent(item.taxPercent),
        taxAmount: amounts.taxAmount,
        discount: amounts.discountAbs,
        discountType: sourceItem ? "ABS" : (item.discountType ?? "ABS"),
        salePrice:
          item.salePrice ?? sourceItem?.salePrice ?? amounts.salePrice ?? null,
        sellingRatesJson:
          item.sellingRatesJson ?? sourceItem?.sellingRatesJson ?? null,
        profit: sourceItem?.profit ?? item.profit ?? amounts.profit ?? null,
        totalCost: amounts.totalCost,
        billedValue: amounts.billedValue,
        effectiveUnitValue: amounts.effectiveUnitValue,
        batchNo: item.batchNo ?? sourceItem?.batchNo ?? null,
        batchId: isFree ? null : (batch?.id ?? null),
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

// ── CREATE PURCHASE RETURN ───────────────────────────────────────────────────

export interface CreatePurchaseReturnInput {
  licenseId: string;
  purchaseId?: string | null;
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
  purchaseItemId?: string | null;
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
  sellingRatesJson?: string | null;
}

export async function createPurchaseReturn(
  header: CreatePurchaseReturnInput,
  items: PurchaseReturnItemInput[],
) {
  const { licenseId } = header;
  const now = new Date();
  const returnDate = header.returnDate ? new Date(header.returnDate) : now;
  const newId = uuidv4();

  const result = await prisma.$transaction(async (tx) => {
    let purchaseId = header.purchaseId ?? null;
    let supplierId = header.supplierId ?? null;
    let supplierName = header.supplierName ?? null;
    let billNo = header.billNo ?? null;
    let purchaseType = header.purchaseType === "CREDIT" ? "CREDIT" : "CASH";

    if (purchaseId) {
      const sourcePurchase = await tx.purchase.findFirst({
        where: { id: purchaseId, licenseId, deletedAt: null },
      });
      if (!sourcePurchase) {
        throw new Error("Source Purchase bill not found.");
      }
      if (!sourcePurchase.supplierId) {
        throw new Error("The source Purchase bill does not have a supplier.");
      }
      if (supplierId && supplierId !== sourcePurchase.supplierId) {
        throw new Error(
          "The selected Purchase bill does not belong to this supplier.",
        );
      }

      purchaseId = sourcePurchase.id;
      supplierId = sourcePurchase.supplierId;
      supplierName = sourcePurchase.supplierName ?? supplierName;
      billNo =
        sourcePurchase.billNo ??
        billNo ??
        `Purchase #${sourcePurchase.slNo ?? ""}`;
      purchaseType =
        sourcePurchase.purchaseType === "CASH" || purchaseType === "CASH"
          ? "CASH"
          : "CREDIT";
    } else {
      if (supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: supplierId, licenseId, deletedAt: null },
        });
        if (!supplier) {
          throw new Error("Selected supplier was not found.");
        }
      }
      if (purchaseType === "CREDIT" && !supplierId) {
        throw new Error("Select a supplier for CREDIT Purchase Return.");
      }
    }

    const slNo = await getNextSlNo(tx, licenseId);

    await tx.purchaseReturn.create({
      data: {
        id: newId,
        slNo,
        licenseId,
        purchaseId,
        billNo,
        supplierId,
        supplierName,
        department: header.department ?? null,
        debitAccount: header.debitAccount ?? null,
        natureOfEntry: header.natureOfEntry ?? null,
        purchaseType,
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

    const totalAmount = await writePurchaseReturnItems(tx, {
      licenseId,
      returnId: newId,
      purchaseId,
      items,
      now,
      excludeReturnId: null,
    });

    const grandAmount = Math.max(0, totalAmount - (header.discount ?? 0));

    await tx.purchaseReturn.update({
      where: { id: newId },
      data: { totalAmount, updatedAt: now },
    });

    if (purchaseType === "CREDIT" && supplierId) {
      await tx.supplierTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          supplierId,
          kind: "RETURN",
          refId: newId,
          refNo: billNo,
          date: returnDate,
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
          refId: newId,
          refNo: billNo,
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
    })) as any;

    if (!existing) throw new Error("Purchase return not found");

    let purchaseId = header.purchaseId ?? existing.purchaseId ?? null;
    let supplierId = header.supplierId ?? existing.supplierId ?? null;
    let supplierName = header.supplierName ?? existing.supplierName ?? null;
    let billNo = header.billNo ?? existing.billNo ?? null;
    let purchaseType =
      header.purchaseType === "CREDIT"
        ? "CREDIT"
        : header.purchaseType === "CASH"
          ? "CASH"
          : existing.purchaseType;

    if (purchaseId) {
      const sourcePurchase = await tx.purchase.findFirst({
        where: { id: purchaseId, licenseId, deletedAt: null },
      });
      if (!sourcePurchase) {
        throw new Error("Source Purchase bill not found.");
      }
      if (!sourcePurchase.supplierId) {
        throw new Error("The source Purchase bill does not have a supplier.");
      }
      if (supplierId && supplierId !== sourcePurchase.supplierId) {
        throw new Error(
          "The selected Purchase bill does not belong to this supplier.",
        );
      }

      purchaseId = sourcePurchase.id;
      supplierId = sourcePurchase.supplierId;
      supplierName = sourcePurchase.supplierName ?? supplierName;
      billNo =
        sourcePurchase.billNo ??
        billNo ??
        `Purchase #${sourcePurchase.slNo ?? ""}`;
      purchaseType =
        sourcePurchase.purchaseType === "CASH" || purchaseType === "CASH"
          ? "CASH"
          : "CREDIT";
    } else {
      if (supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: supplierId, licenseId, deletedAt: null },
        });
        if (!supplier) {
          throw new Error("Selected supplier was not found.");
        }
      }
      if (purchaseType === "CREDIT" && !supplierId) {
        throw new Error("Select a supplier for CREDIT Purchase Return.");
      }
    }

    for (const item of existing.items) {
      const applied = Number(item.appliedQuantity ?? item.quantity ?? 0);
      if (applied <= 0 || item.isFree) continue;
      if (item.batchId) {
        await reverseBatchAndProductStock(
          tx,
          item.batchId,
          item.productId,
          applied,
        );
      } else {
        await adjustLegacyProductStock(tx, item.productId, applied);
      }
    }

    await tx.purchaseReturnItem.deleteMany({ where: { returnId: id } });

    const totalAmount = await writePurchaseReturnItems(tx, {
      licenseId,
      returnId: id,
      purchaseId,
      items,
      now,
      excludeReturnId: id,
    });
    const grandAmount = Math.max(
      0,
      totalAmount - (header.discount ?? existing.discount ?? 0),
    );

    await tx.purchaseReturn.update({
      where: { id },
      data: {
        purchaseId,
        billNo,
        supplierId,
        supplierName,
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
        purchaseType,
        updatedAt: now,
        isSynced: false,
        typeId: header.typeId ?? existing.typeId ?? null,
      },
    });

    await tx.supplierTransaction.deleteMany({
      where: { licenseId, kind: "RETURN", refId: id },
    });
    await tx.cashTransaction.deleteMany({
      where: { licenseId, kind: "RECEIPT", refId: id },
    });

    const txDate = header.returnDate
      ? new Date(header.returnDate as string)
      : existing.returnDate;

    if (purchaseType === "CREDIT" && supplierId) {
      await tx.supplierTransaction.create({
        data: {
          id: uuidv4(),
          licenseId,
          supplierId,
          kind: "RETURN",
          refId: id,
          refNo: billNo,
          date: txDate,
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
          refNo: billNo,
          date: txDate,
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

    // Reverse the Purchase Return stock effect using the batch/product
    // that was actually saved on the Return item.
    for (const it of p.items) {
      const applied = Number(it.appliedQuantity ?? it.quantity ?? 0);
      if (applied <= 0 || it.isFree) continue;
      if (it.batchId) {
        await reverseBatchAndProductStock(
          tx,
          it.batchId,
          it.productId,
          applied,
        );
      } else {
        await adjustLegacyProductStock(tx, it.productId, applied);
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
        purchaseId: true,
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
