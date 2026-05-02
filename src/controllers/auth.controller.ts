// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

// LOGIN
export const login = async (req: Request, res: Response) => {
  try {
    const { userId, password, deviceInfo, role } = req.body;

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

    if (role !== user.role) {
      return res
        .status(400)
        .json({ error: "Selected role does not match user role" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ error: "Invalid credentials" });

    // Payload updated with tier
    const payload = {
      id: user.id,
      role: user.role,
      licenseId: user.licenseId,
      licenseName: user.license?.name,
      tier: user.license?.tier,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "90d" });

    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
      req.socket.remoteAddress;

    const userAgent = req.headers["user-agent"] || "unknown";

    const session = await prisma.session.upsert({
      where: {
        userId_deviceInfo: {
          userId: user.id,
          deviceInfo: deviceInfo || userAgent,
        },
      },
      update: {
        revoked: false,
        ip,
      },
      create: {
        userId: user.id,
        deviceInfo: deviceInfo || userAgent,
        ip,
      },
    });

    res.json({
      token,
      sessionId: session.id,
      user: {
        id: user.id,
        userId: user.userId,
        role: user.role,
        licenseId: user.licenseId,
        licenseName: user.license?.name,
        tier: user.license?.tier, // Added tier to response
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

// LOGOUT
export const logout = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { revoked: true },
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("❌ Logout error:", err);
    res.status(500).json({ error: "Logout failed" });
  }
};

// VERIFY TOKEN
export const verifyToken = async (req: any, res: Response, next: Function) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded: any = jwt.verify(token, env.JWT_SECRET);
    const session = await prisma.session.findFirst({
      where: { userId: decoded.id, revoked: false },
    });

    if (!session) {
      return res.status(401).json({ error: "Session expired or revoked" });
    }

    req.user = decoded;
    req.session = session;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};
