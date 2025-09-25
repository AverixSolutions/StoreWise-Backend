// src/controllers/sync.products.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";

const ProductPayload = z.object({
  id: z.string().uuid(),
  licenseId: z.string().min(1),
  code: z.string(),
  codeNumber: z.number().int().nonnegative(),
  barcode: z.string().nullable().optional(),
  name: z.string(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unit: z.enum(["KG", "NOS", "LTR", "MTR"]),
  tax: z.enum(["NT", "P5", "P12", "P18", "P28"]),
  hsn: z.string().nullable().optional(),
  costPrice: z.string(),
  salePrice: z.string().nullable().optional(),
  stock: z.number().int(),
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

export async function bootstrapProducts(req: any, res: Response) {
  try {
    const licenseId = req.user.licenseId as string;

    const products = await prisma.product.findMany({
      where: { licenseId, deletedAt: null },
      orderBy: [{ codeNumber: "asc" }],
    });

    return res.json({
      serverTime: isoNow(),
      products,
    });
  } catch (e) {
    console.error("bootstrapProducts error", e);
    return res.status(500).json({ error: "Bootstrap products failed" });
  }
}

export async function pushProducts(req: any, res: Response) {
  try {
    const licenseId = req.user.licenseId as string;
    const body = z
      .object({ items: z.array(ProductPayload).max(2000) })
      .parse(req.body);

    await prisma.$transaction(async (tx) => {
      for (const p of body.items) {
        if (p.licenseId !== licenseId) continue;

        const current = await tx.product.findUnique({
          where: { id: p.id },
        });

        if (!current) {
          const existingByCode = await tx.product.findFirst({
            where: { licenseId: p.licenseId, code: p.code },
          });

          if (!existingByCode) {
            await tx.product.create({
              data: {
                id: p.id,
                licenseId: p.licenseId,
                code: p.code,
                codeNumber: p.codeNumber,
                barcode: p.barcode ?? null,
                name: p.name,
                brand: p.brand ?? null,
                category: p.category ?? null,
                unit: p.unit,
                tax: p.tax,
                hsn: p.hsn ?? null,
                costPrice: p.costPrice,
                salePrice: p.salePrice ?? null,
                stock: p.stock,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                deletedAt: p.deletedAt ?? null,
              },
            });
            continue;
          }

          const apply = shouldApplyLWW({
            incomingUpdatedAt: p.updatedAt,
            currentUpdatedAt: existingByCode.updatedAt,
            incomingDeletedAt: p.deletedAt ?? null,
            currentDeletedAt: (existingByCode as any).deletedAt ?? null,
          });

          if (!apply) {
            continue;
          }

          await tx.product.update({
            where: { id: existingByCode.id },
            data: {
              barcode: p.barcode ?? null,
              codeNumber: p.codeNumber,
              name: p.name,
              brand: p.brand ?? null,
              category: p.category ?? null,
              unit: p.unit,
              tax: p.tax,
              hsn: p.hsn ?? null,
              costPrice: p.costPrice,
              salePrice: p.salePrice ?? null,
              stock: p.stock,
              updatedAt: p.updatedAt,
              deletedAt: p.deletedAt ?? null,
            },
          });
          continue;
        }

        const apply = shouldApplyLWW({
          incomingUpdatedAt: p.updatedAt,
          currentUpdatedAt: current.updatedAt,
          incomingDeletedAt: p.deletedAt ?? null,
          currentDeletedAt: (current as any).deletedAt ?? null,
        });

        if (!apply) continue;

        await tx.product.update({
          where: { id: p.id },
          data: {
            code: p.code,
            codeNumber: p.codeNumber,
            barcode: p.barcode ?? null,
            name: p.name,
            brand: p.brand ?? null,
            category: p.category ?? null,
            unit: p.unit,
            tax: p.tax,
            hsn: p.hsn ?? null,
            costPrice: p.costPrice,
            salePrice: p.salePrice ?? null,
            stock: p.stock,
            updatedAt: p.updatedAt,
            deletedAt: p.deletedAt ?? null,
          },
        });
      }
    });

    return res.json({ serverSyncedAt: isoNow() });
  } catch (e: any) {
    console.error("pushProducts error", e);
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Unique constraint violation", meta: e.meta });
    }
    return res.status(500).json({ error: "Push products failed" });
  }
}
