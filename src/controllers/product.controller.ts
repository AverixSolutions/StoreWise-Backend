// src/controllers/product.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// CREATE PRODUCT
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      licenseId,
      name,
      brand,
      category,
      unit,
      tax,
      hsn,
      costPrice,
      salePrice,
    } = req.body;

    if (!licenseId || !name || !unit || !tax || !costPrice) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
    });

    if (
      !license ||
      !license.isActive ||
      new Date(license.activeUntil) < new Date()
    ) {
      return res.status(400).json({ error: "License is invalid or expired" });
    }

    const lastProduct = await prisma.product.findFirst({
      where: { licenseId },
      orderBy: { codeNumber: "desc" },
    });

    let nextCodeNumber = lastProduct ? lastProduct.codeNumber + 1 : 1;
    let nextCode = String(nextCodeNumber).padStart(5, "0");

    const product = await prisma.product.create({
      data: {
        licenseId,
        codeNumber: nextCodeNumber,
        code: nextCode,
        name,
        brand,
        category,
        unit,
        tax,
        hsn,
        costPrice,
        salePrice,
      },
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("❌ Product creation error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
};
