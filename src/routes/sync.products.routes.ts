// src/routes/sync.products.routes.ts
import { Router } from "express";
import { verifyToken } from "../controllers/auth.controller";
import {
  bootstrapProducts,
  pushProducts,
} from "../controllers/sync.products.controller";

const router = Router();

router.get("/bootstrap", verifyToken, bootstrapProducts);
router.post("/push", verifyToken, pushProducts);

export default router;
