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
  | "customer";

function getDelegate(entity: SyncableModel) {
  const map: Record<SyncableModel, any> = {
    product: prisma.product,
    supplier: prisma.supplier,
    purchase: prisma.purchase,
    purchaseItem: prisma.purchaseItem,
    sale: prisma.sale,
    saleItem: prisma.saleItem,
    customer: prisma.customer,
  };
  const delegate = map[entity];
  if (!delegate) throw new Error(`Unknown sync entity: ${entity}`);
  return delegate;
}

// ── Field whitelists — only known Prisma fields pass through ─────────────

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

const ENTITY_FIELDS: Partial<Record<SyncableModel, string[]>> = {
  product: PRODUCT_FIELDS,
  supplier: SUPPLIER_FIELDS,
};

function stripFields(entity: SyncableModel, data: Record<string, any>) {
  const allowed = ENTITY_FIELDS[entity];
  if (!allowed) return data;
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => allowed.includes(k)),
  );
}

// ── Types ────────────────────────────────────────────────────────────────

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

// ── Push ─────────────────────────────────────────────────────────────────

export async function handlePush(
  entity: SyncableModel,
  licenseId: string,
  records: PushRecord[],
): Promise<PushResult[]> {
  const delegate = getDelegate(entity);
  const results: PushResult[] = [];
  const serverNow = new Date().toISOString();

  for (const record of records) {
    try {
      const existing = await delegate.findUnique({
        where: { id: record.id },
        select: { id: true, updatedAt: true, licenseId: true },
      });

      if (existing && existing.licenseId !== licenseId) continue;

      const incomingUpdatedAt = new Date(record.updatedAt).getTime();
      const existingUpdatedAt = existing
        ? new Date(existing.updatedAt).getTime()
        : 0;

      if (!existing) {
        const { id, ...rest } = record;
        await delegate.create({
          data: {
            id,
            licenseId,
            ...stripFields(entity, rest),
            isSynced: true,
            syncedAt: serverNow,
          },
        });
        results.push({
          id: record.id,
          accepted: true,
          serverUpdatedAt: serverNow,
        });
      } else if (incomingUpdatedAt > existingUpdatedAt) {
        await delegate.update({
          where: { id: record.id },
          data: {
            ...stripFields(entity, record),
            isSynced: true,
            syncedAt: serverNow,
          },
        });
        results.push({
          id: record.id,
          accepted: true,
          serverUpdatedAt: serverNow,
        });
      } else {
        results.push({
          id: record.id,
          accepted: false,
          serverUpdatedAt: existing.updatedAt.toISOString(),
        });
      }
    } catch (err) {
      console.error(`[sync:push] Failed for ${entity}:${record.id}`, err);
    }
  }

  return results;
}

// ── Pull ─────────────────────────────────────────────────────────────────

export async function handlePull(
  entity: SyncableModel,
  licenseId: string,
  since: string | null,
  limit = 500,
): Promise<{ records: any[]; hasMore: boolean; pulledAt: string }> {
  const delegate = getDelegate(entity);
  const pulledAt = new Date().toISOString();

  const where: any = { licenseId };
  if (since) {
    where.updatedAt = { gt: new Date(since) };
  }

  const records = await delegate.findMany({
    where,
    orderBy: { updatedAt: "asc" },
    take: limit + 1,
  });

  const hasMore = records.length > limit;
  if (hasMore) records.pop();

  return { records, hasMore, pulledAt };
}
