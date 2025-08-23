// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

interface JwtPayload {
  sub: string;
  role: "ADMIN" | "SUPERVISOR" | "USER";
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    req.user = {
      id: payload.sub,
      role: payload.role,
      userId: payload.userId,
    };

    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

export function authorize(roles: Array<"ADMIN" | "SUPERVISOR" | "USER">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
