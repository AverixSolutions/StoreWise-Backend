// backend/src/routes/sync.routes.ts
import { Router, Request, Response } from "express";
import { verifyToken } from "../controllers/auth.controller";
import { handlePush, handlePull, SyncableModel } from "../sync/engine";

const router = Router();

const ALLOWED_ENTITIES: SyncableModel[] = [
  "product",
  "supplier",
  "purchase",
  "purchaseItem",
  "sale",
  "saleItem",
  "customer",
  "category",
  "brand",
  "taxCategory",
  "shopSettings",
  "unit",
  "saleHold",
  "purchaseHold",
];

router.post(
  "/:entity/push",
  verifyToken,
  async (req: Request, res: Response) => {
    const { entity } = req.params;
    const { licenseId } = req.body;
    const userId = (req as any).user?.id;

    if (!ALLOWED_ENTITIES.includes(entity as SyncableModel))
      return res.status(400).json({ error: `Unknown entity: ${entity}` });
    if (!licenseId || licenseId !== (req as any).user?.licenseId)
      return res.status(403).json({ error: "License mismatch" });

    const records = req.body.records;
    if (!Array.isArray(records) || records.length === 0)
      return res.json({ results: [], pushedAt: new Date().toISOString() });
    if (records.length > 500)
      return res.status(400).json({ error: "Max 500 records per push" });

    try {
      const results = await handlePush(
        entity as SyncableModel,
        licenseId,
        records,
        userId,
      );
      res.json({ results, pushedAt: new Date().toISOString() });
    } catch (err: any) {
      console.error("[sync:push]", entity, err);
      res.status(500).json({ error: err.message || "Push failed" });
    }
  },
);

router.get(
  "/:entity/pull",
  verifyToken,
  async (req: Request, res: Response) => {
    const { entity } = req.params;
    const { since, licenseId, limit } = req.query as Record<string, string>;

    if (!ALLOWED_ENTITIES.includes(entity as SyncableModel))
      return res.status(400).json({ error: `Unknown entity: ${entity}` });
    if (!licenseId || licenseId !== (req as any).user?.licenseId)
      return res.status(403).json({ error: "License mismatch" });

    try {
      const result = await handlePull(
        entity as SyncableModel,
        licenseId,
        since || null,
        Number(limit) || 500,
      );
      res.json(result);
    } catch (err: any) {
      console.error("[sync:pull]", entity, err);
      res.status(500).json({ error: err.message || "Pull failed" });
    }
  },
);

export default router;
