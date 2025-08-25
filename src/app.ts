// src/app.ts
import express from "express";
import cors from "cors";
import licenseRoutes from "./routes/license.routes";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";

const app = express();
app.use(cors());
app.use(express.json());

// Base User Route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to StoreWise Backend 🚀" });
});

// License Route
app.use("/api/license", licenseRoutes);

// Add User Route
app.use("/api/users", userRoutes);

// Auth Routes
app.use("/api/auth", authRoutes);

export default app;
