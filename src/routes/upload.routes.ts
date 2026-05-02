// backend/src/routes/upload.routes.ts
import { Router } from "express";
import { presignProductImage } from "../controllers/upload.controller";
import { verifyToken } from "../controllers/auth.controller";

const router = Router();

// POST /api/upload/product-image/presign
router.post("/product-image/presign", verifyToken, presignProductImage);

export default router;
