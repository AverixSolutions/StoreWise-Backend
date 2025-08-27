// src/routes/franchise.routes.ts
import { Router } from "express";
import {
  createFranchise,
  getFranchises,
  getFranchiseById,
  updateFranchise,
  deleteFranchise,
} from "../controllers/franchise.controller";

const router = Router();

router.post("/", createFranchise);
router.get("/", getFranchises);
router.get("/:id", getFranchiseById);
router.put("/:id", updateFranchise);
router.delete("/:id", deleteFranchise);

export default router;
