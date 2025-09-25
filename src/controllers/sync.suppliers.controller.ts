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
  creditLimit: z.string().nullable().optional(),
  openingBalance: z.string(),
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
    const { limit, cursor, updatedSince } = req.query;

    const take = Math.min(parseInt(String(limit ?? 200), 10) || 200, 1000);

    if (updatedSince) {
      const since = new Date(String(updatedSince));

      let pageFilter: any = {};
      if (cursor) {
        const [uIso, lastId] = String(cursor).split("::");
        const u = new Date(uIso);
        pageFilter = {
          OR: [
            { updatedAt: { gt: u } },
            { AND: [{ updatedAt: u }, { id: { gt: lastId } }] },
          ],
        };
      }

      const suppliers = await prisma.supplier.findMany({
        where: {
          licenseId,
          updatedAt: { gte: since },
          ...pageFilter,
        },
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take,
      });

      const nextCursor = suppliers.length
        ? `${suppliers[suppliers.length - 1].updatedAt.toISOString()}::${
            suppliers[suppliers.length - 1].id
          }`
        : undefined;

      return res.json({ serverTime: isoNow(), suppliers, nextCursor });
    } else {
      const suppliers = await prisma.supplier.findMany({
        where: { licenseId, deletedAt: null },
        orderBy: { id: "asc" },
        ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
        take,
      });

      const nextCursor = suppliers.length
        ? suppliers[suppliers.length - 1].id
        : undefined;

      return res.json({ serverTime: isoNow(), suppliers, nextCursor });
    }
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

    console.log("Received suppliers:", body.items);

    const results: Array<{
      id: string;
      status: "created" | "updated" | "skipped" | "conflict";
    }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const s of body.items) {
        try {
          if (s.licenseId !== licenseId) {
            results.push({ id: s.id, status: "skipped" });
            continue;
          }

          console.log("Processing supplier:", s.id);

          let target = await tx.supplier.findUnique({
            where: { id: s.id },
          });

          if (!target) {
            const byCode = s.code
              ? await tx.supplier.findFirst({
                  where: { licenseId: s.licenseId, code: s.code },
                })
              : null;
            const byCodeNumber =
              s.codeNumber != null
                ? await tx.supplier.findFirst({
                    where: { licenseId: s.licenseId, codeNumber: s.codeNumber },
                  })
                : null;
            target = byCode ?? byCodeNumber;
          }

          if (!target) {
            await tx.supplier.create({
              data: {
                id: s.id,
                licenseId: s.licenseId,
                code: s.code ?? null,
                codeNumber: s.codeNumber ?? null,
                name: s.name,
                phone: s.phone ?? null,
                email: s.email ?? null,
                gstin: s.gstin ?? null,
                department: s.department ?? null,
                addressLine1: s.addressLine1 ?? null,
                addressLine2: s.addressLine2 ?? null,
                city: s.city ?? null,
                state: s.state ?? null,
                pincode: s.pincode ?? null,
                category: s.category ?? null,
                native: s.native ?? null,
                language: s.language ?? null,
                aadhaar: s.aadhaar ?? null,
                pan: s.pan ?? null,
                license1: s.license1 ?? null,
                license2: s.license2 ?? null,
                settlementDays: s.settlementDays ?? null,
                creditLimit: s.creditLimit ?? null,
                openingBalance: s.openingBalance,
                notes: s.notes ?? null,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                deletedAt: s.deletedAt ?? null,
              },
            });
            results.push({ id: s.id, status: "created" });
            continue;
          }

          const apply = shouldApplyLWW({
            incomingUpdatedAt: s.updatedAt,
            currentUpdatedAt: target.updatedAt,
            incomingDeletedAt: s.deletedAt ?? null,
            currentDeletedAt: (target as any).deletedAt ?? null,
          });

          if (!apply) {
            results.push({ id: s.id, status: "skipped" });
            continue;
          }

          await tx.supplier.update({
            where: { id: target.id },
            data: {
              code: s.code ?? null,
              codeNumber: s.codeNumber ?? null,
              name: s.name,
              phone: s.phone ?? null,
              email: s.email ?? null,
              gstin: s.gstin ?? null,
              department: s.department ?? null,
              addressLine1: s.addressLine1 ?? null,
              addressLine2: s.addressLine2 ?? null,
              city: s.city ?? null,
              state: s.state ?? null,
              pincode: s.pincode ?? null,
              category: s.category ?? null,
              native: s.native ?? null,
              language: s.language ?? null,
              aadhaar: s.aadhaar ?? null,
              pan: s.pan ?? null,
              license1: s.license1 ?? null,
              license2: s.license2 ?? null,
              settlementDays: s.settlementDays ?? null,
              creditLimit: s.creditLimit ?? null,
              openingBalance: s.openingBalance,
              notes: s.notes ?? null,
              updatedAt: s.updatedAt,
              deletedAt: s.deletedAt ?? null,
            },
          });
          results.push({ id: s.id, status: "updated" });
        } catch (err: any) {
          const code = err?.code || "";
          if (code === "P2002") {
            results.push({ id: s.id, status: "conflict" });
          } else {
            failed.push({ id: s.id, error: code || err?.message || "ERR" });
          }
        }
      }
    });

    console.log("Push result:", { results, failed });
    return res.json({ serverSyncedAt: isoNow(), results, failed });
  } catch (e: any) {
    console.error("pushSuppliers error", e);
    return res.status(500).json({ error: "Push suppliers failed" });
  }
}
