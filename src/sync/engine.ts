// backend/src/sync/engine.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type SyncableModel =
  | "product"
  | "supplier"
  | "purchase"
  | "purchaseItem"
  | "sale"
  | "saleItem"
  | "cashTransaction"
  | "customer"
  | "category"
  | "brand"
  | "taxCategory"
  | "shopSettings"
  | "unit"
  | "saleHold"
  | "purchaseHold"
  | "transactionType"
  | "purchaseReturn" // ← added
  | "purchaseReturnItem" // ← added
  | "purchaseReturnHold" // ← added
  | "saleReturn" // ← added
  | "saleReturnItem" // ← added
  | "quotation"
  | "quotationItem"
  | "offer"
  | "offerTargetProduct";

// ── Field allow-lists ─────────────────────────────────────────────────────────

const PRODUCT_FIELDS = [
  "licenseId",
  "code",
  "codeNumber",
  "name",
  "brand",
  "category",
  "subcategory",
  "productName",
  "model",
  "size",
  "shortCode",
  "unit",
  "tax",
  "hsn",
  "costPrice",
  "salePrice",
  "stock",
  "imagePath",
  "imageFileName",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];
const SUPPLIER_FIELDS = [
  "licenseId",
  "code",
  "codeNumber",
  "name",
  "phone",
  "email",
  "gstin",
  "department",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "pincode",
  "category",
  "native",
  "language",
  "aadhaar",
  "pan",
  "license1",
  "license2",
  "settlementDays",
  "creditLimit",
  "openingBalance",
  "notes",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];
const CATEGORY_FIELDS = [
  "licenseId",
  "name",
  "parentId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];
const BRAND_FIELDS = [
  "licenseId",
  "name",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];
const TAX_CATEGORY_FIELDS = [
  "licenseId",
  "code",
  "name",
  "rate",
  "isInterstate",
  "cessRate",
  "calcMethod",
  "createdAt",
  "updatedAt",
  "isSynced",
  "syncedAt",
];
const SHOP_SETTINGS_FIELDS = [
  "shopName",
  "logoUrl",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "pincode",
  "mobile",
  "email",
  "gstin",
  "footerNote",
  "authorizedSignatory",
  "createdAt",
  "updatedAt",
  "isSynced",
  "syncedAt",
];
const UNIT_FIELDS = [
  "licenseId",
  "code",
  "label",
  "isDefault",
  "sortOrder",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];
const PURCHASE_FIELDS = [
  // NOTE: userId intentionally excluded — desktop userId is not a Neon UUID
  "slNo",
  "billNo",
  "licenseId",
  "supplierId",
  "supplierName",
  "department",
  "debitAccount",
  "natureOfEntry",
  "purchaseType",
  "purchaseBatchNo",
  "purchaseDate",
  "entryTime",
  "totalAmount",
  "discount",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];
const PURCHASE_ITEM_FIELDS = [
  // NOTE: no licenseId — PurchaseItem doesn't have that column in Neon
  "purchaseId",
  "productId",
  "barcode",
  "quantity",
  "unit",
  "rate",
  "mrp",
  "taxPercent",
  "taxAmount",
  "discount",
  "discountType",
  "salePrice",
  "profit",
  "totalCost",
  "billedValue",
  "batchNo",
  "batchId",
  "purchaseBatchNo",
  "mfgDate",
  "expiryDate",
  "lineNo",
  "isFree",
  "effectiveUnitValue",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const SALE_FIELDS = [
  "slNo",
  "billNo",
  "userId",
  "licenseId",
  "typeId",
  "customerId",
  "customerName",
  "department",
  "debitAccount",
  "natureOfEntry",
  "saleType",
  "saleDate",
  "entryTime",
  "totalAmount",
  "discount",
  "offerSummaryJson",
  "offerSavings",
  "offerOverridesJson",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const SALE_ITEM_FIELDS = [
  "saleId",
  "productId",
  "barcode",
  "quantity",
  "unit",
  "rate",
  "mrp",
  "taxPercent",
  "taxAmount",
  "discount",
  "discountType",
  "salePrice",
  "profit",
  "totalCost",
  "billedValue",
  "batchNo",
  "batchId",
  "mfgDate",
  "expiryDate",
  "lineNo",
  "isFree",
  "effectiveUnitValue",
  "originalRate",
  "originalSalePrice",
  "appliedRate",
  "offerId",
  "offerName",
  "offerType",
  "offerDiscountAmount",
  "offerMeta",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const SALE_HOLD_FIELDS = [
  "licenseId",
  "userId",
  "holdNo",
  "title",
  "headerJson",
  "rowsJson",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const PURCHASE_HOLD_FIELDS = [
  "licenseId",
  "userId",
  "holdNo",
  "title",
  "headerJson",
  "rowsJson",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const TRANSACTION_TYPE_FIELDS = [
  "licenseId",
  "name",
  "code",
  "category",
  "isDefault",
  "sortOrder",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

// ← added
const PURCHASE_RETURN_FIELDS = [
  "slNo",
  "billNo",
  "userId",
  "licenseId",
  "supplierId",
  "supplierName",
  "department",
  "debitAccount",
  "natureOfEntry",
  "purchaseType",
  "returnDate",
  "entryTime",
  "totalAmount",
  "discount",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

// ← added
const PURCHASE_RETURN_ITEM_FIELDS = [
  "returnId",
  "productId",
  "barcode",
  "quantity",
  "unit",
  "rate",
  "mrp",
  "taxPercent",
  "taxAmount",
  "discount",
  "discountType",
  "salePrice",
  "profit",
  "totalCost",
  "billedValue",
  "effectiveUnitValue",
  "batchNo",
  "batchId",
  "mfgDate",
  "expiryDate",
  "lineNo",
  "appliedQuantity",
  "overReturnQuantity",
  "overReturnReason",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

// ← added
const SALE_RETURN_FIELDS = [
  "slNo",
  "billNo",
  "userId",
  "licenseId",
  "typeId",
  "customerId",
  "customerName",
  "department",
  "debitAccount",
  "natureOfEntry",
  "saleType",
  "returnDate",
  "entryTime",
  "totalAmount",
  "discount",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

// ← added
const SALE_RETURN_ITEM_FIELDS = [
  "returnId",
  "productId",
  "barcode",
  "quantity",
  "unit",
  "rate",
  "mrp",
  "taxPercent",
  "taxAmount",
  "discount",
  "discountType",
  "salePrice",
  "profit",
  "totalCost",
  "billedValue",
  "effectiveUnitValue",
  "batchNo",
  "batchId",
  "mfgDate",
  "expiryDate",
  "lineNo",
  "appliedQuantity",
  "overReturnQuantity",
  "overReturnReason",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

// ← added
const QUOTATION_FIELDS = [
  "slNo",
  "quotationNo",
  "userId",
  "licenseId",
  "customerId",
  "customerName",
  "department",
  "debitAccount",
  "natureOfEntry",
  "quotationDate",
  "entryTime",
  "totalAmount",
  "discount",
  "status",
  "notes",
  "convertedSaleId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const OFFER_FIELDS = [
  "licenseId",
  "name",
  "type",
  "isActive",
  "applyScope",
  "priority",
  "startsAt",
  "endsAt",
  "timeStart",
  "timeEnd",
  "minQty",
  "maxQty",
  "fixedUnitPrice",
  "discountPercent",
  "discountAmount",
  "triggerKind",
  "triggerScope",
  "minAmount",
  "maxAmount",
  "unit",
  "benefitTarget",
  "benefitKind",
  "benefitQtyMode",
  "fixedBenefitQty",
  "maxBenefitQty",
  "maxBenefitAmount",
  "customerRequired",
  "oncePerBill",
  "notes",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const OFFER_TARGET_PRODUCT_FIELDS = [
  "licenseId",
  "offerId",
  "productId",
  "targetRole",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const QUOTATION_ITEM_FIELDS = [
  "quotationId",
  "productId",
  "barcode",
  "quantity",
  "unit",
  "rate",
  "mrp",
  "taxPercent",
  "taxAmount",
  "discount",
  "discountType",
  "salePrice",
  "profit",
  "totalCost",
  "billedValue",
  "effectiveUnitValue",
  "batchNo",
  "batchId",
  "mfgDate",
  "expiryDate",
  "lineNo",
  "isFree",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const CASH_TRANSACTION_FIELDS = [
  "licenseId",
  "kind",
  "refId",
  "refNo",
  "date",
  "amount",
  "sign",
  "notes",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

const PURCHASE_RETURN_HOLD_FIELDS = [
  "licenseId",
  "userId",
  "holdNo",
  "title",
  "headerJson",
  "rowsJson",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];

// ── Registry ──────────────────────────────────────────────────────────────────

const ENTITY_FIELDS: Partial<Record<SyncableModel, string[]>> = {
  product: PRODUCT_FIELDS,
  supplier: SUPPLIER_FIELDS,
  category: CATEGORY_FIELDS,
  brand: BRAND_FIELDS,
  taxCategory: TAX_CATEGORY_FIELDS,
  shopSettings: SHOP_SETTINGS_FIELDS,
  unit: UNIT_FIELDS,
  purchase: PURCHASE_FIELDS,
  purchaseItem: PURCHASE_ITEM_FIELDS,
  sale: SALE_FIELDS,
  saleItem: SALE_ITEM_FIELDS,
  saleHold: SALE_HOLD_FIELDS,
  purchaseHold: PURCHASE_HOLD_FIELDS,
  transactionType: TRANSACTION_TYPE_FIELDS,
  purchaseReturn: PURCHASE_RETURN_FIELDS, // ← added
  purchaseReturnItem: PURCHASE_RETURN_ITEM_FIELDS, // ← added
  purchaseReturnHold: PURCHASE_RETURN_HOLD_FIELDS, // ← added
  saleReturn: SALE_RETURN_FIELDS, // ← added
  saleReturnItem: SALE_RETURN_ITEM_FIELDS, // ← added
  quotation: QUOTATION_FIELDS,
  quotationItem: QUOTATION_ITEM_FIELDS,
  cashTransaction: CASH_TRANSACTION_FIELDS,
  offer: OFFER_FIELDS,
  offerTargetProduct: OFFER_TARGET_PRODUCT_FIELDS,
};

const BOOLEAN_FIELDS: Partial<Record<SyncableModel, string[]>> = {
  taxCategory: ["isInterstate"],
  unit: ["isDefault"],
  purchaseItem: ["isFree"],
  saleItem: ["isFree"],
  quotationItem: ["isFree"],
  transactionType: ["isDefault"],
  offer: ["isActive", "customerRequired", "oncePerBill"],
};

const COMPOSITE_CODE_ENTITIES: SyncableModel[] = ["unit", "taxCategory"];
const COMPOSITE_HOLD_ENTITIES: SyncableModel[] = [
  "saleHold",
  "purchaseHold",
  "purchaseReturnHold", // ← added
];

// Entities where the Prisma model has no licenseId column — can't use generic
// licenseId-based select or FK guard
const NO_LICENSE_ID_ENTITIES: SyncableModel[] = [
  "purchaseItem",
  "saleItem",
  "quotationItem",
  "purchaseReturnItem", // ← added
  "saleReturnItem", // ← added
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripFields(entity: SyncableModel, data: Record<string, any>) {
  const allowed = ENTITY_FIELDS[entity];
  if (!allowed) return data;
  const boolFields = BOOLEAN_FIELDS[entity] ?? [];
  return Object.fromEntries(
    Object.entries(data)
      .filter(([k]) => allowed.includes(k))
      .map(([k, v]) => [k, boolFields.includes(k) ? Boolean(v) : v]),
  );
}

function getPrismaModelName(entity: SyncableModel): string {
  if (entity === "unit") return "unitMaster";
  return entity;
}

function getDelegate(tx: any, entity: SyncableModel) {
  const modelName = getPrismaModelName(entity);
  const delegate = tx[modelName];
  if (!delegate)
    throw new Error(
      `Unknown sync entity: ${entity} (prisma model: ${modelName})`,
    );
  return delegate;
}

function isHoldEntity(entity: SyncableModel): boolean {
  return COMPOSITE_HOLD_ENTITIES.includes(entity);
}

function getUpsertWhere(
  entity: SyncableModel,
  data: any,
  isShopSettings: boolean,
): any {
  if (isShopSettings) return { licenseId: data.licenseId };
  if (COMPOSITE_CODE_ENTITIES.includes(entity)) {
    return { licenseId_code: { licenseId: data.licenseId, code: data.code } };
  }
  if (isHoldEntity(entity)) {
    return {
      licenseId_holdNo: { licenseId: data.licenseId, holdNo: data.holdNo },
    };
  }
  return { id: data.id };
}

// ── Push ──────────────────────────────────────────────────────────────────────

export type PushRecord = {
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
  [key: string]: any;
};

export type PushResult = {
  id: string;
  accepted: boolean;
  serverUpdatedAt: string;
};

export async function handlePush(
  entity: SyncableModel,
  licenseId: string,
  records: PushRecord[],
  cloudUserId?: string, // ✅ 4th parameter — cloud user UUID injected into sale records
): Promise<PushResult[]> {
  const serverNow = new Date().toISOString();
  const isShopSettings = entity === "shopSettings";
  const isComposite = COMPOSITE_CODE_ENTITIES.includes(entity);
  const isPurchaseItem = entity === "purchaseItem";
  const isSaleItem = entity === "saleItem";
  const isPurchaseReturnItem = entity === "purchaseReturnItem"; // ← added
  const isSaleReturnItem = entity === "saleReturnItem"; // ← added
  const isQuotationItem = entity === "quotationItem";
  const noLicenseId = NO_LICENSE_ID_ENTITIES.includes(entity);
  const results: PushResult[] = [];
  const prismaModelName = getPrismaModelName(entity);

  // ── purchaseItem: skip records whose parent purchase doesn't exist yet ──────
  let validRecords = records;
  if (isPurchaseItem) {
    const purchaseIds = [
      ...new Set(records.map((r) => r.purchaseId).filter(Boolean)),
    ];
    const existingPurchases = await prisma.purchase.findMany({
      where: { id: { in: purchaseIds }, licenseId },
      select: { id: true },
    });
    const validPurchaseIds = new Set(existingPurchases.map((p) => p.id));

    validRecords = records.filter((r) => {
      if (!validPurchaseIds.has(r.purchaseId)) {
        results.push({ id: r.id, accepted: false, serverUpdatedAt: serverNow });
        return false;
      }
      return true;
    });
  }

  // ── saleItem: skip records whose parent sale doesn't exist yet ──────
  if (isSaleItem) {
    const saleIds = [...new Set(records.map((r) => r.saleId).filter(Boolean))];
    const existingSales = await prisma.sale.findMany({
      where: { id: { in: saleIds }, licenseId },
      select: { id: true },
    });
    const validSaleIds = new Set(existingSales.map((s) => s.id));

    validRecords = validRecords.filter((r) => {
      if (!validSaleIds.has(r.saleId)) {
        results.push({ id: r.id, accepted: false, serverUpdatedAt: serverNow });
        return false;
      }
      return true;
    });
  }

  // ← added: purchaseReturnItem: skip records whose parent purchaseReturn doesn't exist yet
  if (isPurchaseReturnItem) {
    const returnIds = [
      ...new Set(records.map((r) => r.returnId).filter(Boolean)),
    ];
    const existingReturns = await prisma.purchaseReturn.findMany({
      where: { id: { in: returnIds }, licenseId },
      select: { id: true },
    });
    const validReturnIds = new Set(existingReturns.map((r) => r.id));

    validRecords = validRecords.filter((r) => {
      if (!validReturnIds.has(r.returnId)) {
        results.push({ id: r.id, accepted: false, serverUpdatedAt: serverNow });
        return false;
      }
      return true;
    });
  }

  // ← added: saleReturnItem: skip records whose parent saleReturn doesn't exist yet
  if (isSaleReturnItem) {
    const returnIds = [
      ...new Set(records.map((r) => r.returnId).filter(Boolean)),
    ];
    const existingReturns = await prisma.saleReturn.findMany({
      where: { id: { in: returnIds }, licenseId },
      select: { id: true },
    });
    const validReturnIds = new Set(existingReturns.map((r) => r.id));

    validRecords = validRecords.filter((r) => {
      if (!validReturnIds.has(r.returnId)) {
        results.push({ id: r.id, accepted: false, serverUpdatedAt: serverNow });
        return false;
      }
      return true;
    });
  }

  if (isQuotationItem) {
    const quotationIds = [
      ...new Set(records.map((r) => r.quotationId).filter(Boolean)),
    ];
    const existingQuotations = await prisma.quotation.findMany({
      where: { id: { in: quotationIds }, licenseId },
      select: { id: true },
    });
    const validQuotationIds = new Set(existingQuotations.map((q) => q.id));

    validRecords = validRecords.filter((r) => {
      if (!validQuotationIds.has(r.quotationId)) {
        results.push({ id: r.id, accepted: false, serverUpdatedAt: serverNow });
        return false;
      }
      return true;
    });
  }

  if (validRecords.length === 0) return results;

  // ── Pre-fetch existing records ────────────────────────────────────────────
  let existingMap = new Map<string, any>();

  if (isShopSettings) {
    const existing = await prisma.shopSettings.findUnique({
      where: { licenseId },
      select: { licenseId: true, updatedAt: true },
    });
    if (existing) existingMap.set(licenseId, existing);
  } else if (isComposite || isHoldEntity(entity)) {
    // Use holdNo for hold entities, code for composite code entities
    const keys = isHoldEntity(entity)
      ? validRecords.map((r) => r.holdNo)
      : validRecords.map((r) => r.code).filter(Boolean);

    const existing = isHoldEntity(entity)
      ? await (prisma as any)[prismaModelName].findMany({
          where: { licenseId, holdNo: { in: keys } },
          select: {
            id: true,
            updatedAt: true,
            licenseId: true,
            holdNo: true,
          },
        })
      : await (prisma as any)[prismaModelName].findMany({
          where: { licenseId, code: { in: keys } },
          select: { id: true, updatedAt: true, licenseId: true, code: true },
        });

    const byKey = isHoldEntity(entity)
      ? new Map(existing.map((r: any) => [r.holdNo, r]))
      : new Map(existing.map((r: any) => [r.code, r]));

    for (const record of validRecords) {
      const lookupKey = isHoldEntity(entity) ? record.holdNo : record.code;
      const found = byKey.get(lookupKey);
      if (found) existingMap.set(record.id, found);
    }
  } else if (noLicenseId) {
    // PurchaseItem/SaleItem/PurchaseReturnItem have no licenseId column
    const existing = await (prisma as any)[prismaModelName].findMany({
      where: { id: { in: validRecords.map((r) => r.id) } },
      select: { id: true, updatedAt: true },
    });
    existingMap = new Map(existing.map((r: any) => [r.id, r]));
  } else {
    const existing = await (prisma as any)[prismaModelName].findMany({
      where: { id: { in: validRecords.map((r) => r.id) } },
      select: { id: true, updatedAt: true, licenseId: true },
    });
    existingMap = new Map(existing.map((r: any) => [r.id, r]));
  }

  // ── Decide create vs update ───────────────────────────────────────────────
  const toCreate: any[] = [];
  const toUpdate: { where: any; data: any; resultId: string }[] = [];

  for (const record of validRecords) {
    const key = isShopSettings ? licenseId : record.id;
    const existing = existingMap.get(key);

    // Security: reject cross-license writes (skip for models without licenseId)
    if (
      !isShopSettings &&
      !noLicenseId &&
      existing &&
      existing.licenseId !== licenseId
    ) {
      continue;
    }

    const safeUpdatedAt =
      record.updatedAt && !Number.isNaN(new Date(record.updatedAt).getTime())
        ? new Date(record.updatedAt).toISOString()
        : serverNow;

    const safeCreatedAt =
      record.createdAt && !Number.isNaN(new Date(record.createdAt).getTime())
        ? new Date(record.createdAt).toISOString()
        : safeUpdatedAt;

    const incomingTs = new Date(safeUpdatedAt).getTime();

    const existingTs =
      existing?.updatedAt &&
      !Number.isNaN(new Date(existing.updatedAt).getTime())
        ? new Date(existing.updatedAt).getTime()
        : 0;

    const stripped = stripFields(entity, {
      ...record,
      createdAt: safeCreatedAt,
      updatedAt: safeUpdatedAt,
      isSynced: true,
      syncedAt: serverNow,
    });

    if (!existing) {
      if (isShopSettings) {
        toCreate.push({
          licenseId,
          ...stripped,
          updatedAt: stripped.updatedAt || serverNow,
          createdAt: stripped.createdAt || serverNow,
          isSynced: true,
          syncedAt: serverNow,
        });
      } else {
        const { id, ...rest } = stripped;

        let createData: any = {
          id: record.id,
          ...rest,
          ...(noLicenseId ? {} : { licenseId }),
          isSynced: true,
          syncedAt: serverNow,
        };

        // ✅ Inject cloud user UUID for sale records — overwrites any incoming
        // desktop userId which is not a valid Neon UUID
        if ((entity === "sale" || entity === "quotation") && cloudUserId) {
          createData.userId = cloudUserId;
        }

        toCreate.push(createData);
      }
      results.push({ id: key, accepted: true, serverUpdatedAt: serverNow });
    } else if (incomingTs > existingTs) {
      let updateData: any = {
        ...stripped,
        isSynced: true,
        syncedAt: serverNow,
      };

      // ✅ Also overwrite userId on update to keep cloud UUID consistent
      if ((entity === "sale" || entity === "quotation") && cloudUserId) {
        updateData.userId = cloudUserId;
      }

      toUpdate.push({
        where: isShopSettings ? { licenseId } : { id: existing.id },
        data: updateData,
        resultId: key,
      });
      results.push({ id: key, accepted: true, serverUpdatedAt: serverNow });
    } else {
      results.push({
        id: key,
        accepted: false,
        serverUpdatedAt:
          existing.updatedAt instanceof Date
            ? existing.updatedAt.toISOString()
            : existing.updatedAt,
      });
    }
  }

  // ── Single transaction ────────────────────────────────────────────────────

  // Categories must be created parent-first to avoid FK violations
  if (entity === "category") {
    toCreate.sort((a, b) => {
      const aIsChild = a.parentId ? 1 : 0;
      const bIsChild = b.parentId ? 1 : 0;
      if (aIsChild !== bIsChild) return aIsChild - bIsChild;
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });
  }

  if (toCreate.length > 0 || toUpdate.length > 0) {
    await prisma.$transaction(async (tx) => {
      const delegate = getDelegate(tx, entity);

      for (const data of toCreate) {
        await delegate.upsert({
          where: getUpsertWhere(entity, data, isShopSettings),
          create: data,
          update: data,
        });
      }

      for (const { where, data } of toUpdate) {
        await delegate.update({ where, data });
      }
    });
  }

  return results;
}

// ── Pull ──────────────────────────────────────────────────────────────────────

export async function handlePull(
  entity: SyncableModel,
  licenseId: string,
  since: string | null,
  limit = 500,
): Promise<{ records: any[]; hasMore: boolean; pulledAt: string }> {
  const pulledAt = new Date().toISOString();

  if (entity === "shopSettings") {
    const record = await prisma.shopSettings.findUnique({
      where: { licenseId },
    });
    return { records: record ? [record] : [], hasMore: false, pulledAt };
  }

  const prismaModelName = getPrismaModelName(entity);

  if (entity === "taxCategory") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await (prisma as any).taxCategory.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
      include: { components: true, defaults: true },
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "purchase") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.purchase.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "purchaseItem") {
    // purchaseItem has no licenseId — scope through parent purchase
    const where: any = {
      purchase: { licenseId },
      ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
    };
    const records = await prisma.purchaseItem.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "sale") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.sale.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "saleItem") {
    const where: any = {
      sale: { licenseId },
      ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
    };
    const records = await prisma.saleItem.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "saleHold") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.saleHold.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "purchaseHold") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.purchaseHold.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "transactionType") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.transactionType.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  // ← added
  if (entity === "purchaseReturn") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.purchaseReturn.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  // ← added
  if (entity === "purchaseReturnItem") {
    // purchaseReturnItem has no licenseId — scope through parent purchaseReturn
    const where: any = {
      purchaseReturn: { licenseId },
      ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
    };
    const records = await prisma.purchaseReturnItem.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  // ← added
  if (entity === "saleReturn") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.saleReturn.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  // ← added
  if (entity === "saleReturnItem") {
    // saleReturnItem has no licenseId — scope through parent saleReturn
    const where: any = {
      saleReturn: { licenseId },
      ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
    };
    const records = await prisma.saleReturnItem.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  // ← added
  if (entity === "quotation") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.quotation.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "quotationItem") {
    const where: any = {
      quotation: { licenseId },
      ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
    };
    const records = await prisma.quotationItem.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  if (entity === "purchaseReturnHold") {
    const where: any = { licenseId };
    if (since) where.updatedAt = { gt: new Date(since) };
    const records = await prisma.purchaseReturnHold.findMany({
      where,
      orderBy: { updatedAt: "asc" },
      take: limit + 1,
    });
    const hasMore = records.length > limit;
    if (hasMore) records.pop();
    return { records, hasMore, pulledAt };
  }

  // Generic path for all other entities
  const where: any = { licenseId };
  if (since) where.updatedAt = { gt: new Date(since) };

  const records = await (prisma as any)[prismaModelName].findMany({
    where,
    orderBy: { updatedAt: "asc" },
    take: limit + 1,
  });
  const hasMore = records.length > limit;
  if (hasMore) records.pop();
  return { records, hasMore, pulledAt };
}
