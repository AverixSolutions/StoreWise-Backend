// src/controllers/franchise.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// CREATE FRANCHISE
export const createFranchise = async (req: Request, res: Response) => {
  try {
    const { name, contactName, phone, email } = req.body;

    if (!email || !name || !contactName || !phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existing = await prisma.franchise.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const franchise = await prisma.franchise.create({
      data: { name, contactName, phone, email },
    });

    res.json(franchise);
  } catch (err) {
    console.error("❌ Error creating franchise:", err);
    res.status(500).json({ error: "Failed to create franchise" });
  }
};

// GET ALL FRANCHISES
export const getFranchises = async (req: Request, res: Response) => {
  try {
    const franchises = await prisma.franchise.findMany({
      include: { licenses: true },
    });
    res.json(franchises);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch franchises" });
  }
};

// GET FRANCHISE BY ID
export const getFranchiseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const franchise = await prisma.franchise.findUnique({
      where: { id },
      include: { licenses: true },
    });

    if (!franchise)
      return res.status(404).json({ error: "Franchise not found" });

    res.json(franchise);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch franchise" });
  }
};

// UPDATE FRANCHISE
export const updateFranchise = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contactName, phone, email } = req.body;

    if (email) {
      const existing = await prisma.franchise.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    const franchise = await prisma.franchise.update({
      where: { id },
      data: { name, contactName, phone, email },
    });

    res.json(franchise);
  } catch (err) {
    res.status(500).json({ error: "Failed to update franchise" });
  }
};

// DELETE FRANCHISE
export const deleteFranchise = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const licenses = await prisma.license.findMany({
      where: { franchiseId: id },
    });

    if (licenses.length > 0) {
      return res
        .status(400)
        .json({ error: "Cannot delete a franchise with active licenses" });
    }

    await prisma.franchise.delete({ where: { id } });
    res.json({ message: "Franchise deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete franchise" });
  }
};
