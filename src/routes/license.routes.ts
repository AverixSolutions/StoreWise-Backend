// src/routes/license.routes.ts
import { Router } from "express";
import {
  createLicense,
  getLicenseById,
  getLicenses,
  updateLicense,
  deleteLicense,
} from "../controllers/license.controller";

const router = Router();

router.post("/", createLicense);
router.get("/", getLicenses);
router.get("/:id", getLicenseById);
router.put("/:id", updateLicense);
router.delete("/:id", deleteLicense);

export default router;
