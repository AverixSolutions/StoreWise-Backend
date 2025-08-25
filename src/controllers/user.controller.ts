// src/controllers/user.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

// CREATE USER
export const createUser = async (req: Request, res: Response) => {
  try {
    const { userId, password, role, licenseId } = req.body;

    if (!licenseId) {
      return res.status(400).json({ error: "licenseId is required" });
    }

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: { users: true, roleLimits: true },
    });

    if (!license) {
      return res.status(404).json({ error: "License not found" });
    }

    if (new Date(license.activeUntil) < new Date()) {
      return res.status(400).json({ error: "License is expired" });
    }

    if (license.users.length >= license.maxUsers) {
      return res
        .status(400)
        .json({ error: "Max user limit reached for this license" });
    }

    const roleLimit = license.roleLimits.find((rl) => rl.role === role);
    if (roleLimit) {
      const existingRoleCount = license.users.filter(
        (u) => u.role === role
      ).length;
      if (existingRoleCount >= roleLimit.maxScreens) {
        return res
          .status(400)
          .json({ error: `Max ${role} limit reached for this license` });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        userId,
        password: hashedPassword,
        role,
        licenseId,
      },
    });

    res.json(user);
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
};

// GET ALL USERS
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({ include: { license: true } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// GET USER BY ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: { license: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

// UPDATE USER
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password, role, isActive } = req.body;

    const data: any = {};
    if (role) data.role = role;
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({ where: { id }, data });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
};

// DELETE USER
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
};
