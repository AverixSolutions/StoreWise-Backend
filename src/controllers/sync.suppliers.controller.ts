// src/controllers/sync.suppliers.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";

const SupplierPayload = z.object({
  id: z.string().uuid(),
  licenseId: z.string().min(1),
  code: z.string().nullable().optional(),
  codeNumber: z.number().int().nullable().optional(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  native: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  aadhaar: z.string().nullable().optional(),
  pan: z.string().nullable().optional(),
  license1: z.string().nullable().optional(),
  license2: z.string().nullable().optional(),
  settlementDays: z.number().int().nullable().optional(),
  creditLimit: z.string().nullable().optional(), // string like products
  openingBalance: z.string(), // string
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

const isoNow = () => new Date().toISOString();
const ms = (x?: string | null) => (x ? new Date(x).getTime() : null);

function shouldApplyLWW(opts: {
  incomingUpdatedAt?: string | null;
  currentUpdatedAt?: Date | null;
  incomingDeletedAt?: string | null;
  currentDeletedAt?: Date | null;
}) {
  const iu = ms(opts.incomingUpdatedAt ?? null);
  const cu = opts.currentUpdatedAt ? opts.currentUpdatedAt.getTime() : null;
  const id = ms(opts.incomingDeletedAt ?? null);
  const cd = opts.currentDeletedAt ? opts.currentDeletedAt.getTime() : null;

  if (id !== null && (cd === null || id >= cd)) return true;
  if (id === null && iu !== null && (cu === null || iu >= cu)) return true;
  return false;
}

export async function bootstrapSuppliers(req: any, res: Response) {
  try {
    const licenseId = req.user.licenseId as string;

    const suppliers = await prisma.supplier.findMany({
      where: { licenseId, deletedAt: null },
      orderBy: [{ name: "asc" }],
    });

    return res.json({ serverTime: isoNow(), suppliers });
  } catch (e) {
    console.error("bootstrapSuppliers error", e);
    return res.status(500).json({ error: "Bootstrap suppliers failed" });
  }
}

export async function pushSuppliers(req: any, res: Response) {
  try {
    const licenseId = req.user.licenseId as string;
    const body = z
      .object({ items: z.array(SupplierPayload).max(2000) })
      .parse(req.body);

    await prisma.$transaction(async (tx) => {
      for (const s of body.items) {
        if (s.licenseId !== licenseId) continue;

        const existing = await tx.supplier.findUnique({ where: { id: s.id } });

        if (!existing) {
          await tx.supplier.create({
            data: {
              id: s.id,
              licenseId: s.licenseId,
              code: s.code,
              codeNumber: s.codeNumber ?? null,
              name: s.name,
              phone: s.phone,
              email: s.email,
              gstin: s.gstin,
              department: s.department,
              addressLine1: s.addressLine1,
              addressLine2: s.addressLine2,
              city: s.city,
              state: s.state,
              pincode: s.pincode,
              category: s.category,
              native: s.native,
              language: s.language,
              aadhaar: s.aadhaar,
              pan: s.pan,
              license1: s.license1,
              license2: s.license2,
              settlementDays: s.settlementDays,
              creditLimit: s.creditLimit,
              openingBalance: s.openingBalance,
              notes: s.notes,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              deletedAt: s.deletedAt ?? null,
            },
          });
          continue;
        }

        const apply = shouldApplyLWW({
          incomingUpdatedAt: s.updatedAt,
          currentUpdatedAt: existing.updatedAt,
          incomingDeletedAt: s.deletedAt ?? null,
          currentDeletedAt: (existing as any).deletedAt ?? null,
        });
        if (!apply) continue;

        await tx.supplier.update({
          where: { id: s.id },
          data: {
            code: s.code,
            codeNumber: s.codeNumber ?? null,
            name: s.name,
            phone: s.phone,
            email: s.email,
            gstin: s.gstin,
            department: s.department,
            addressLine1: s.addressLine1,
            addressLine2: s.addressLine2,
            city: s.city,
            state: s.state,
            pincode: s.pincode,
            category: s.category,
            native: s.native,
            language: s.language,
            aadhaar: s.aadhaar,
            pan: s.pan,
            license1: s.license1,
            license2: s.license2,
            settlementDays: s.settlementDays,
            creditLimit: s.creditLimit,
            openingBalance: s.openingBalance,
            notes: s.notes,
            updatedAt: s.updatedAt,
            deletedAt: s.deletedAt ?? null,
          },
        });
      }
    });

    return res.json({ serverSyncedAt: isoNow() });
  } catch (e: any) {
    console.error("pushSuppliers error", e);
    return res.status(500).json({ error: "Push suppliers failed" });
  }
}
