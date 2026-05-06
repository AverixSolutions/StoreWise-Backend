// src/app.ts
import express from "express";
import cors from "cors";
import licenseRoutes from "./routes/license.routes";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import franchiseRoutes from "./routes/franchise.routes";
import syncRoutes from "./routes/sync.routes";
import uploadRoutes from "./routes/upload.routes";
import purchaseRoutes from "./routes/purchase.routes";
import supplierRoutes from "./routes/supplier.routes";
import saleRoutes from "./routes/sale.routes";
import supplierLedgerRoutes from "./routes/supplierLedger.routes";
import customerLedgerRoutes from "./routes/customerLedger.routes";
import supplierTransactionSyncRouter from "./routes/sync/supplierTransaction.routes";
import customerTransactionSyncRouter from "./routes/sync/customerTransaction.routes";
import purchaseReturnSyncRouter from "./routes/sync/purchaseReturn.routes";
import saleReturnRoutes from "./routes/saleReturn.routes";
import saleReturnSyncRouter from "./routes/sync/saleReturn.routes";
import customerRoutes from "./routes/customer.routes";

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
app.use("/api/sync/supplierTransaction", supplierTransactionSyncRouter);
app.use("/api/sync/customerTransaction", customerTransactionSyncRouter);
app.use("/api/sync/purchaseReturn", purchaseReturnSyncRouter);
app.use("/api/sync/saleReturn", saleReturnSyncRouter);
app.use("/api/sale-returns", saleReturnRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api", supplierLedgerRoutes);
app.use("/api", customerLedgerRoutes);
app.use("/api/customers", customerRoutes);

export default app;
