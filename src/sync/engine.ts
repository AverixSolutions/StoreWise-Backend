// backend/src/sync/engine.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type SyncableModel =
  | "product"
  | "productBatch"
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
  | "purchaseReturn" // â† added
  | "purchaseReturnItem" // â† added
  | "purchaseReturnHold" // â† added
  | "saleReturn" // â† added
  | "saleReturnItem" // â† added
  | "quotation"
  | "quotationItem"
  | "offer"
  | "offerTargetProduct"
  | "rateType"
  | "productRate"
  | "productBatchRate";

// â”€â”€ Field allow-lists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
const PRODUCT_BATCH_FIELDS = [
  "licenseId",
  "productId",
  "barcode",
  "mrp",
  "salePrice",
  "costPrice",
  "batchNo",
  "purchaseBatchNo",
  "purchaseId",
  "mfgDate",
  "expiryDate",
  "receivedAt",
  "stock",
  "isSystemGeneratedBarcode",
  "createdAt",
  "updatedAt",
  "deletedAt",
];
const RATE_TYPE_FIELDS = [
  "licenseId",
  "code",
  "name",
  "isDefault",
  "isActive",
  "sortOrder",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];
const PRODUCT_RATE_FIELDS = [
  "licenseId",
  "productId",
  "rateTypeId",
  "amount",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isSynced",
  "syncedAt",
];
const PRODUCT_BATCH_RATE_FIELDS = [
  "licenseId",
  "productId",
  "batchId",
  "rateTypeId",
  "amount",
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
  // NOTE: userId intentionally excluded â€” desktop userId is not a Neon UUID
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
  // NOTE: no licenseId â€” PurchaseItem doesn't have that column in Neon
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
  "sellingRatesJson",
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
  "rateTypeId",
  "rateTypeCode",
  "rateTypeName",
  "rateSource",
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

// â† added
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

// â† added
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
  "sellingRatesJson",
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

// â† added
const SALE_RETURN_FIELDS = [
  "slNo",
  "saleId",
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

// â† added
const SALE_RETURN_ITEM_FIELDS = [
  "returnId",
  "saleItemId",
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
  "rateTypeId",
  "rateTypeCode",
  "rateTypeName",
  "rateSource",
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

// â† added
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
  "rateTypeId",
  "rateTypeCode",
  "rateTypeName",
  "rateSource",
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

// â”€â”€ Registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ENTITY_FIELDS: Partial<Record<SyncableModel, string[]>> = {
  product: PRODUCT_FIELDS,
  productBatch: PRODUCT_BATCH_FIELDS,
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
  purchaseReturn: PURCHASE_RETURN_FIELDS, // â† added
  purchaseReturnItem: PURCHASE_RETURN_ITEM_FIELDS, // â† added
  purchaseReturnHold: PURCHASE_RETURN_HOLD_FIELDS, // â† added
  saleReturn: SALE_RETURN_FIELDS, // â† added
  saleReturnItem: SALE_RETURN_ITEM_FIELDS, // â† added
  quotation: QUOTATION_FIELDS,
  quotationItem: QUOTATION_ITEM_FIELDS,
  cashTransaction: CASH_TRANSACTION_FIELDS,
  offer: OFFER_FIELDS,
  offerTargetProduct: OFFER_TARGET_PRODUCT_FIELDS,
  rateType: RATE_TYPE_FIELDS,
  productRate: PRODUCT_RATE_FIELDS,
  productBatchRate: PRODUCT_BATCH_RATE_FIELDS,
};

const BOOLEAN_FIELDS: Partial<Record<SyncableModel, string[]>> = {
  taxCategory: ["isInterstate"],
  unit: ["isDefault"],
  productBatch: ["isSystemGeneratedBarcode"],
  purchaseItem: ["isFree"],
  saleItem: ["isFree"],
  quotationItem: ["isFree"],
  transactionType: ["isDefault"],
  offer: ["isActive", "customerRequired", "oncePerBill"],
  rateType: ["isDefault", "isActive"],
};

const COMPOSITE_CODE_ENTITIES: SyncableModel[] = ["unit", "taxCategory"];
const COMPOSITE_HOLD_ENTITIES: SyncableModel[] = [
  "saleHold",
  "purchaseHold",
  "purchaseReturnHold", // â† added
];

// Entities where the Prisma model has no licenseId column â€” can't use generic
// licenseId-based select or FK guard
const NO_LICENSE_ID_ENTITIES: SyncableModel[] = [
  "purchaseItem",
  "saleItem",
  "quotationItem",
  "purchaseReturnItem",
  "saleReturnItem", // â† added
];

const NO_SYNC_STATUS_ENTITIES: SyncableModel[] = ["productBatch"];

function hasSyncStatusFields(entity: SyncableModel): boolean {
  return !NO_SYNC_STATUS_ENTITIES.includes(entity);
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

function normalizeSyncDateField(
  value: any,
  field: string,
  entity: SyncableModel,
) {
  if (value == null || value === "") return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const iso = `${trimmed}${
      field === "endsAt" ? "T23:59:59.999Z" : "T00:00:00.000Z"
    }`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      throw new Error(
        `Invalid ISO-8601 datetime for field ${field} on ${entity}: ${value}`,
      );
    }
    return date.toISOString();
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `Invalid ISO-8601 datetime for field ${field} on ${entity}: ${value}`,
    );
  }
  return date.toISOString();
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

// â”€â”€ Push â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  cloudUserId?: string, // âœ… 4th parameter â€” cloud user UUID injected into sale records
): Promise<PushResult[]> {
  const serverNow = new Date().toISOString();
  const isShopSettings = entity === "shopSettings";
  const isComposite = COMPOSITE_CODE_ENTITIES.includes(entity);
  const isPurchaseItem = entity === "purchaseItem";
  const isSaleItem = entity === "saleItem";
  const isProductBatch = entity === "productBatch";
  const isPurchaseReturnItem = entity === "purchaseReturnItem";
  const isSaleReturnItem = entity === "saleReturnItem";
  const isQuotationItem = entity === "quotationItem";
  const isRateType = entity === "rateType";
  const isRateValue = entity === "productRate" || entity === "productBatchRate";
  const noLicenseId = NO_LICENSE_ID_ENTITIES.includes(entity);
  const hasSyncStatus = hasSyncStatusFields(entity);
  const results: PushResult[] = [];
  const prismaModelName = getPrismaModelName(entity);

  // â”€â”€ purchaseItem: skip records whose parent purchase doesn't exist yet â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ saleItem: skip records whose parent sale doesn't exist yet â”€â”€â”€â”€â”€â”€
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

  // â† added: purchaseReturnItem: skip records whose parent purchaseReturn doesn't exist yet
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

  // â† added: saleReturnItem: skip records whose parent saleReturn doesn't exist yet
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

  if (isProductBatch) {
    const productIds = [
      ...new Set(validRecords.map((r) => r.productId).filter(Boolean)),
    ];

    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, licenseId },
      select: { id: true },
    });

    const validProductIds = new Set(existingProducts.map((p) => p.id));

    validRecords = validRecords.filter((r) => {
      if (!validProductIds.has(r.productId)) {
        results.push({ id: r.id, accepted: false, serverUpdatedAt: serverNow });
        return false;
      }

      return true;
    });
  }

  if (isRateValue) {
    validRecords = validRecords.flatMap((record) => {
      const amount =
        record.amount == null || record.amount === ""
          ? Number.NaN
          : Number(record.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        results.push({
          id: record.id,
          accepted: false,
          serverUpdatedAt: serverNow,
        });
        return [];
      }
      return [{ ...record, amount }];
    });
    const productIds = [
      ...new Set(validRecords.map((r) => r.productId).filter(Boolean)),
    ];
    const rateTypeIds = [
      ...new Set(validRecords.map((r) => r.rateTypeId).filter(Boolean)),
    ];
    const [products, rateTypes] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds }, licenseId },
        select: { id: true },
      }),
      prisma.rateType.findMany({
        where: { id: { in: rateTypeIds }, licenseId },
        select: { id: true },
      }),
    ]);
    const validProductIds = new Set(products.map((row) => row.id));
    const validRateTypeIds = new Set(rateTypes.map((row) => row.id));
    let validBatchProducts: Map<string, string> | null = null;
    if (entity === "productBatchRate") {
      const batchIds = [
        ...new Set(validRecords.map((r) => r.batchId).filter(Boolean)),
      ];
      const batches = await prisma.productBatch.findMany({
        where: { id: { in: batchIds }, licenseId },
        select: { id: true, productId: true },
      });
      validBatchProducts = new Map(
        batches.map((row) => [row.id, row.productId]),
      );
    }
    validRecords = validRecords.filter((record) => {
      const valid =
        validProductIds.has(record.productId) &&
        validRateTypeIds.has(record.rateTypeId) &&
        (!validBatchProducts ||
          validBatchProducts.get(record.batchId) === record.productId);
      if (!valid) {
        results.push({
          id: record.id,
          accepted: false,
          serverUpdatedAt: serverNow,
        });
      }
      return valid;
    });
  }

  if (isRateType) {
    validRecords = validRecords.map((record) => ({
      ...record,
      code: String(record.code ?? "")
        .trim()
        .toUpperCase(),
      name: String(record.name ?? "").trim(),
      isDefault:
        Boolean(record.isDefault) &&
        Boolean(record.isActive) &&
        !record.deletedAt,
    }));
    validRecords = validRecords.filter((record) => {
      const valid = Boolean(record.code) && Boolean(record.name);
      if (!valid) {
        results.push({
          id: record.id,
          accepted: false,
          serverUpdatedAt: serverNow,
        });
      }
      return valid;
    });
    const requestedDefaults = validRecords
      .filter((record) => record.isDefault)
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? 0).getTime() -
            new Date(a.updatedAt ?? 0).getTime() ||
          String(a.id).localeCompare(String(b.id)),
      );
    if (requestedDefaults.length > 1) {
      const winnerId = requestedDefaults[0].id;
      validRecords = validRecords.map((record) => ({
        ...record,
        isDefault: record.isDefault && record.id === winnerId,
      }));
    }
  }

  if (validRecords.length === 0) return results;

  // â”€â”€ Pre-fetch existing records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Decide create vs update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      normalizeSyncDateField(
        record.updatedAt ?? serverNow,
        "updatedAt",
        entity,
      ) || serverNow;

    const safeCreatedAt =
      normalizeSyncDateField(
        record.createdAt ?? safeUpdatedAt,
        "createdAt",
        entity,
      ) || safeUpdatedAt;

    const safeDeletedAt = normalizeSyncDateField(
      record.deletedAt,
      "deletedAt",
      entity,
    );

    const safeSyncedAt =
      normalizeSyncDateField(record.syncedAt, "syncedAt", entity) || serverNow;

    const safeStartsAt =
      entity === "offer"
        ? normalizeSyncDateField(record.startsAt, "startsAt", entity)
        : record.startsAt;

    const safeEndsAt =
      entity === "offer"
        ? normalizeSyncDateField(record.endsAt, "endsAt", entity)
        : record.endsAt;

    const incomingTs = new Date(safeUpdatedAt).getTime();

    const existingTs =
      existing?.updatedAt &&
      !Number.isNaN(new Date(existing.updatedAt).getTime())
        ? new Date(existing.updatedAt).getTime()
        : 0;

    const stripped = stripFields(entity, {
      ...record,
      startsAt: safeStartsAt,
      endsAt: safeEndsAt,
      createdAt: safeCreatedAt,
      updatedAt: safeUpdatedAt,
      deletedAt: safeDeletedAt,
      isSynced: true,
      syncedAt: safeSyncedAt,
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
          ...(hasSyncStatus ? { isSynced: true, syncedAt: serverNow } : {}),
        };

        // âœ… Inject cloud user UUID for sale records â€” overwrites any incoming
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
        ...(hasSyncStatus ? { isSynced: true, syncedAt: serverNow } : {}),
      };

      // âœ… Also overwrite userId on update to keep cloud UUID consistent
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

  // â”€â”€ Single transaction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

      const incomingDefault = isRateType
        ? [
            ...toCreate,
            ...toUpdate.map((entry) => ({
              id: entry.where.id,
              ...entry.data,
            })),
          ].find((data) => data.isDefault && data.isActive && !data.deletedAt)
        : null;
      if (incomingDefault) {
        await tx.rateType.updateMany({
          where: {
            licenseId,
            isDefault: true,
            NOT: { id: incomingDefault.id },
          },
          data: { isDefault: false, updatedAt: serverNow, isSynced: true },
        });
      }

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

      let resolvedRateTypeDefaultId: string | null = null;
      if (isRateType) {
        let currentDefault = await tx.rateType.findFirst({
          where: {
            licenseId,
            isDefault: true,
            isActive: true,
            deletedAt: null,
          },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        });
        if (!currentDefault) {
          currentDefault = await tx.rateType.findFirst({
            where: { licenseId, isActive: true, deletedAt: null },
            orderBy: [
              { sortOrder: "asc" },
              { updatedAt: "desc" },
              { id: "asc" },
            ],
          });
          if (currentDefault) {
            await tx.rateType.update({
              where: { id: currentDefault.id },
              data: {
                isDefault: true,
                updatedAt: serverNow,
                isSynced: true,
                syncedAt: serverNow,
              },
            });
          }
        }
        if (!currentDefault) {
          let fallback = await tx.rateType.findFirst({
            where: {
              licenseId,
              deletedAt: null,
              code: { equals: "RETAIL", mode: "insensitive" },
            },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          });
          fallback ??= await tx.rateType.findFirst({
            where: { licenseId, deletedAt: null },
            orderBy: [
              { sortOrder: "asc" },
              { updatedAt: "desc" },
              { id: "asc" },
            ],
          });
          fallback ??= await tx.rateType.findFirst({
            where: {
              licenseId,
              code: { equals: "RETAIL", mode: "insensitive" },
            },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          });
          if (fallback) {
            currentDefault = await tx.rateType.update({
              where: { id: fallback.id },
              data: {
                isDefault: true,
                isActive: true,
                deletedAt: null,
                updatedAt: serverNow,
                isSynced: true,
                syncedAt: serverNow,
              },
            });
          } else {
            currentDefault = await tx.rateType.create({
              data: {
                id: `retail-${licenseId}`,
                licenseId,
                code: "RETAIL",
                name: "Retail",
                isDefault: true,
                isActive: true,
                sortOrder: 0,
                createdAt: serverNow,
                updatedAt: serverNow,
                isSynced: true,
                syncedAt: serverNow,
              },
            });
          }
        }
        resolvedRateTypeDefaultId = currentDefault?.id ?? null;
      }

      if (entity === "productRate" || entity === "productBatchRate") {
        const currentDefault = await tx.rateType.findFirst({
          where: {
            licenseId,
            isDefault: true,
            isActive: true,
            deletedAt: null,
          },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        });
        if (currentDefault && entity === "productRate") {
          const productIds = new Set(
            [
              ...toCreate.map((row) => row.productId),
              ...toUpdate.map((entry) => entry.data.productId),
            ].filter(Boolean),
          );
          for (const productId of productIds) {
            const rate = await tx.productRate.findFirst({
              where: {
                licenseId,
                productId,
                rateTypeId: currentDefault.id,
                deletedAt: null,
              },
            });
            await tx.product.update({
              where: { id: productId },
              data: {
                salePrice: rate?.amount ?? null,
                updatedAt: serverNow,
                isSynced: true,
              },
            });
            await tx.productBatch.updateMany({
              where: {
                licenseId,
                productId,
                rates: {
                  none: {
                    rateTypeId: currentDefault.id,
                    deletedAt: null,
                  },
                },
              },
              data: {
                salePrice: rate?.amount ?? null,
                updatedAt: serverNow,
              },
            });
          }
        }
        if (currentDefault && entity === "productBatchRate") {
          const batchIds = new Set(
            [
              ...toCreate.map((row) => row.batchId),
              ...toUpdate.map((entry) => entry.data.batchId),
            ].filter(Boolean),
          );
          for (const batchId of batchIds) {
            const batch = await tx.productBatch.findUnique({
              where: { id: batchId },
            });
            if (!batch) continue;
            const batchRate = await tx.productBatchRate.findFirst({
              where: {
                licenseId,
                batchId,
                rateTypeId: currentDefault.id,
                deletedAt: null,
              },
            });
            const productRate = batchRate
              ? null
              : await tx.productRate.findFirst({
                  where: {
                    licenseId,
                    productId: batch.productId,
                    rateTypeId: currentDefault.id,
                    deletedAt: null,
                  },
                });
            await tx.productBatch.update({
              where: { id: batchId },
              data: {
                salePrice: batchRate?.amount ?? productRate?.amount ?? null,
                updatedAt: serverNow,
              },
            });
          }
        }
      }

      if (resolvedRateTypeDefaultId) {
        await tx.product.updateMany({
          where: { licenseId },
          data: { salePrice: null, updatedAt: serverNow, isSynced: true },
        });
        const productRates = await tx.productRate.findMany({
          where: {
            licenseId,
            rateTypeId: resolvedRateTypeDefaultId,
            deletedAt: null,
          },
          select: { productId: true, amount: true },
        });
        for (const rate of productRates) {
          await tx.product.update({
            where: { id: rate.productId },
            data: {
              salePrice: rate.amount,
              updatedAt: serverNow,
              isSynced: true,
            },
          });
        }
        await tx.productBatch.updateMany({
          where: { licenseId },
          data: { salePrice: null, updatedAt: serverNow },
        });
        const batchRates = await tx.productBatchRate.findMany({
          where: {
            licenseId,
            rateTypeId: resolvedRateTypeDefaultId,
            deletedAt: null,
          },
          select: { batchId: true, amount: true },
        });
        for (const rate of batchRates) {
          await tx.productBatch.update({
            where: { id: rate.batchId },
            data: { salePrice: rate.amount, updatedAt: serverNow },
          });
        }
        const batchesWithoutOverride = await tx.productBatch.findMany({
          where: {
            licenseId,
            rates: {
              none: {
                rateTypeId: resolvedRateTypeDefaultId,
                deletedAt: null,
              },
            },
          },
          select: { id: true, productId: true },
        });
        for (const batch of batchesWithoutOverride) {
          const productRate = productRates.find(
            (rate) => rate.productId === batch.productId,
          );
          if (productRate) {
            await tx.productBatch.update({
              where: { id: batch.id },
              data: { salePrice: productRate.amount, updatedAt: serverNow },
            });
          }
        }
      }
    });
  }

  return results;
}

// â”€â”€ Pull â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    // purchaseItem has no licenseId â€” scope through parent purchase
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

  // â† added
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

  // â† added
  if (entity === "purchaseReturnItem") {
    // purchaseReturnItem has no licenseId â€” scope through parent purchaseReturn
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

  // â† added
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

  // â† added
  if (entity === "saleReturnItem") {
    // saleReturnItem has no licenseId â€” scope through parent saleReturn
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

  // â† added
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
