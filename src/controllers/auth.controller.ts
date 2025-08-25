// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

// LOGIN
export const login = async (req: Request, res: Response) => {
  try {
    const { userId, password, deviceInfo } = req.body;

    const user = await prisma.user.findUnique({
      where: { userId },
      include: { license: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isActive)
      return res.status(403).json({ error: "User is inactive" });
    if (!user.license || new Date(user.license.activeUntil) < new Date()) {
      return res.status(403).json({ error: "License is invalid or expired" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ error: "Invalid credentials" });

    // 🔑 JWT payload
    const payload = { id: user.id, role: user.role, licenseId: user.licenseId };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo: deviceInfo || "unknown",
        ip: req.ip,
      },
    });

    res.json({ token, user, sessionId: session.id });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

// LOGOUT
export const logout = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    await prisma.session.update({
      where: { id: sessionId },
      data: { revoked: true },
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
};

// VERIFY TOKEN
export const verifyToken = (req: any, res: Response, next: Function) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};
