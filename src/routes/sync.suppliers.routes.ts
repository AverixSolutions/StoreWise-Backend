// src/routes/sync.suppliers.routes.ts
import {
  bootstrapSuppliers,
  pushSuppliers,
} from "../controllers/sync.suppliers.controller";
import { Router } from "express";
import { verifyToken } from "../controllers/auth.controller";

const router = Router();

router.get("/bootstrap", verifyToken, bootstrapSuppliers);
router.post("/push", verifyToken, pushSuppliers);

export default router;
