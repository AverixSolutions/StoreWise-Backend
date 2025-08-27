// src/controllers/license.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { nanoid } from "nanoid";

// CREATE LICENSE
export const createLicense = async (req: Request, res: Response) => {
  try {
    const {
      name,
      maxUsers = 1,
      activeUntil,
      roleLimits,
      customerName,
      customerPhone,
      amountPaid,
      saleType = "DIRECT",
      franchiseId,
    } = req.body;

    if (!customerName || !customerPhone || !amountPaid) {
      return res
        .status(400)
        .json({ error: "Customer details and amount are required" });
    }

    if (saleType === "FRANCHISE") {
      if (!franchiseId) {
        return res
          .status(400)
          .json({ error: "Franchise ID is required for FRANCHISE sales" });
      }

      const franchise = await prisma.franchise.findUnique({
        where: { id: franchiseId },
      });
      if (!franchise) {
        return res.status(404).json({ error: "Franchise not found" });
      }
    }

    const expiryDate = activeUntil
      ? new Date(activeUntil)
      : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

    const defaultRoleLimits = [
      { role: "ADMIN", maxScreens: 1 },
      { role: "SUPERVISOR", maxScreens: 1 },
      { role: "USER", maxScreens: 1 },
    ];

    const finalRoleLimits =
      roleLimits?.length > 0 ? roleLimits : defaultRoleLimits;

    const licenseId = `AVX-SW-${new Date().getFullYear()}-${nanoid(
      6
    ).toUpperCase()}`;

    let marginForUs = amountPaid;
    let marginForFranchise = 0;

    if (saleType === "FRANCHISE" && franchiseId) {
      marginForUs = Number((Number(amountPaid) * 0.4).toFixed(2));
      marginForFranchise = Number((Number(amountPaid) * 0.6).toFixed(2));
    }

    const license = await prisma.license.create({
      data: {
        id: licenseId,
        name,
        maxUsers,
        activeUntil: expiryDate,
        saleType,
        customerName,
        customerPhone,
        amountPaid,
        franchiseId: saleType === "FRANCHISE" ? franchiseId : null,
        marginForUs,
        marginForFranchise,
        roleLimits: {
          create: finalRoleLimits.map((rl: any) => ({
            role: rl.role,
            maxScreens: rl.maxScreens,
          })),
        },
      },
      include: { roleLimits: true, franchise: true },
    });

    res.json(license);
  } catch (err) {
    console.error("❌ Error creating license:", err);
    res.status(500).json({ error: "Failed to create license" });
  }
};

// GET ALL LICENSES
export const getLicenses = async (req: Request, res: Response) => {
  try {
    const licenses = await prisma.license.findMany({
      include: { users: true, roleLimits: true, franchise: true },
    });
    res.json(licenses);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch licenses" });
  }
};

// GET LICENSE BY ID
export const getLicenseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const license = await prisma.license.findUnique({
      where: { id },
      include: { users: true, roleLimits: true, franchise: true },
    });

    if (!license) return res.status(404).json({ error: "License not found" });

    res.json(license);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch license" });
  }
};

// UPDATE LICENSE
export const updateLicense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      maxUsers,
      activeUntil,
      roleLimits,
      customerName,
      customerPhone,
      amountPaid,
      saleType,
      franchiseId,
    } = req.body;

    if (saleType === "FRANCHISE") {
      if (!franchiseId) {
        return res
          .status(400)
          .json({ error: "Franchise ID is required for FRANCHISE sales" });
      }

      const franchise = await prisma.franchise.findUnique({
        where: { id: franchiseId },
      });
      if (!franchise) {
        return res.status(404).json({ error: "Franchise not found" });
      }
    }

    let marginForUs: any = undefined;
    let marginForFranchise: any = undefined;

    if (amountPaid && saleType) {
      if (saleType === "DIRECT") {
        marginForUs = amountPaid;
        marginForFranchise = 0;
      } else if (saleType === "FRANCHISE" && franchiseId) {
        marginForUs = (Number(amountPaid) * 0.4).toFixed(2) as any;
        marginForFranchise = (Number(amountPaid) * 0.6).toFixed(2) as any;
      }
    }

    const license = await prisma.license.update({
      where: { id },
      data: {
        name,
        maxUsers,
        activeUntil: activeUntil ? new Date(activeUntil) : undefined,
        customerName,
        customerPhone,
        amountPaid,
        saleType,
        franchiseId: saleType === "FRANCHISE" ? franchiseId : null,
        marginForUs,
        marginForFranchise,
        roleLimits: roleLimits
          ? {
              deleteMany: {},
              create: roleLimits.map((rl: any) => ({
                role: rl.role,
                maxScreens: rl.maxScreens,
              })),
            }
          : undefined,
      },
      include: { roleLimits: true, franchise: true },
    });

    res.json(license);
  } catch (err) {
    res.status(500).json({ error: "Failed to update license" });
  }
};

// DELETE LICENSE
export const deleteLicense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.license.delete({ where: { id } });
    res.json({ message: "License deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete license" });
  }
};
