// src/app.ts
import express from "express";
import cors from "cors";
import licenseRoutes from "./routes/license.routes";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import franchiseRoutes from "./routes/franchise.routes";
import syncRoutes from "./routes/sync.routes";
import uploadRoutes from "./routes/upload.routes";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Welcome to StoreWise Backend 🚀" });
});

app.use("/api/franchises", franchiseRoutes);
app.use("/api/license", licenseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/upload", uploadRoutes);

export default app;
