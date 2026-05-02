-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'USER');

-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('DIRECT', 'FRANCHISE');

-- CreateEnum
CREATE TYPE "TaxPercent" AS ENUM ('NT', 'P5', 'P12', 'P18', 'P28');

-- CreateEnum
CREATE TYPE "AccountNature" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "SupplierTxKind" AS ENUM ('OPENING', 'PURCHASE', 'RETURN', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CustomerTxKind" AS ENUM ('OPENING', 'SALE', 'RETURN', 'RECEIPT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CashTxKind" AS ENUM ('OPENING', 'PURCHASE', 'SALE', 'PAYMENT', 'RECEIPT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TaxComponent" AS ENUM ('CGST', 'SGST', 'IGST', 'CESS');

-- CreateEnum
CREATE TYPE "LicenseTier" AS ENUM ('PRO', 'LITE', 'WEB');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "licenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "activeUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "saleType" "SaleType" NOT NULL DEFAULT 'DIRECT',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "franchiseId" TEXT,
    "marginForUs" DECIMAL(10,2) NOT NULL,
    "marginForFranchise" DECIMAL(10,2) NOT NULL,
    "tier" "LicenseTier" NOT NULL DEFAULT 'PRO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Franchise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Franchise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseRoleLimit" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "maxScreens" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseRoleLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + '1 year'::interval),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "deviceInfo" TEXT,
    "ip" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "productName" TEXT,
    "model" TEXT,
    "size" TEXT,
    "shortCode" TEXT,
    "unit" TEXT NOT NULL,
    "tax" "TaxPercent" NOT NULL,
    "hsn" TEXT,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imagePath" TEXT,
    "imageFileName" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT,
    "mrp" DECIMAL(10,2),
    "salePrice" DECIMAL(10,2),
    "costPrice" DECIMAL(10,2),
    "batchNo" TEXT,
    "purchaseBatchNo" TEXT,
    "purchaseId" TEXT,
    "mfgDate" TEXT,
    "expiryDate" TEXT,
    "receivedAt" TIMESTAMP(3),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isSystemGeneratedBarcode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "slNo" INTEGER,
    "billNo" TEXT,
    "userId" TEXT,
    "licenseId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "department" TEXT,
    "debitAccount" TEXT,
    "natureOfEntry" TEXT,
    "purchaseType" TEXT,
    "purchaseBatchNo" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryTime" TIMESTAMP(3),
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2),
    "taxPercent" "TaxPercent" NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "discountType" TEXT,
    "salePrice" DECIMAL(10,2),
    "profit" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2) NOT NULL,
    "billedValue" DECIMAL(10,2),
    "batchNo" TEXT,
    "batchId" TEXT,
    "purchaseBatchNo" TEXT,
    "mfgDate" TEXT,
    "expiryDate" TEXT,
    "lineNo" INTEGER,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "effectiveUnitValue" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL,
    "slNo" INTEGER,
    "userId" TEXT,
    "licenseId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "billNo" TEXT,
    "department" TEXT,
    "debitAccount" TEXT,
    "natureOfEntry" TEXT,
    "purchaseType" TEXT,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryTime" TIMESTAMP(3),
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2),
    "taxPercent" "TaxPercent" NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "discountType" TEXT,
    "salePrice" DECIMAL(10,2),
    "profit" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2) NOT NULL,
    "billedValue" DECIMAL(10,2),
    "batchNo" TEXT,
    "batchId" TEXT,
    "mfgDate" TEXT,
    "expiryDate" TEXT,
    "lineNo" INTEGER,
    "effectiveUnitValue" DECIMAL(10,2),
    "appliedQuantity" INTEGER,
    "overReturnQuantity" INTEGER,
    "overReturnReason" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseHold" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "userId" TEXT,
    "holdNo" INTEGER NOT NULL,
    "title" TEXT,
    "headerJson" TEXT NOT NULL,
    "rowsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnHold" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "userId" TEXT,
    "holdNo" INTEGER NOT NULL,
    "title" TEXT,
    "headerJson" TEXT NOT NULL,
    "rowsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseReturnHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "slNo" INTEGER,
    "userId" TEXT,
    "licenseId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "billNo" TEXT,
    "department" TEXT,
    "debitAccount" TEXT,
    "natureOfEntry" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryTime" TIMESTAMP(3),
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "saleType" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2),
    "taxPercent" "TaxPercent" NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "discountType" TEXT,
    "salePrice" DECIMAL(10,2),
    "profit" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2) NOT NULL,
    "billedValue" DECIMAL(10,2),
    "batchNo" TEXT,
    "batchId" TEXT,
    "mfgDate" TEXT,
    "expiryDate" TEXT,
    "lineNo" INTEGER,
    "effectiveUnitValue" DECIMAL(10,2),
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL,
    "slNo" INTEGER,
    "userId" TEXT,
    "licenseId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "billNo" TEXT,
    "department" TEXT,
    "debitAccount" TEXT,
    "natureOfEntry" TEXT,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryTime" TIMESTAMP(3),
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "saleType" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "barcode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2),
    "taxPercent" "TaxPercent" NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "discountType" TEXT,
    "salePrice" DECIMAL(10,2),
    "profit" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2) NOT NULL,
    "billedValue" DECIMAL(10,2),
    "batchNo" TEXT,
    "batchId" TEXT,
    "mfgDate" TEXT,
    "expiryDate" TEXT,
    "lineNo" INTEGER,
    "effectiveUnitValue" DECIMAL(10,2),
    "appliedQuantity" INTEGER,
    "overReturnQuantity" INTEGER,
    "overReturnReason" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleHold" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "userId" TEXT,
    "holdNo" INTEGER NOT NULL,
    "title" TEXT,
    "headerJson" TEXT NOT NULL,
    "rowsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SaleHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "code" TEXT,
    "codeNumber" INTEGER,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "category" TEXT,
    "native" TEXT,
    "language" TEXT,
    "aadhaar" TEXT,
    "pan" TEXT,
    "license1" TEXT,
    "license2" TEXT,
    "settlementDays" INTEGER,
    "creditLimit" DECIMAL(12,2),
    "department" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierTransaction" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "kind" "SupplierTxKind" NOT NULL,
    "refId" TEXT,
    "refNo" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sign" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBillSettlement" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "paymentTxId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3),

    CONSTRAINT "SupplierBillSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "code" TEXT,
    "codeNumber" INTEGER,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "category" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTransaction" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "CustomerTxKind" NOT NULL,
    "refId" TEXT,
    "refNo" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sign" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "kind" "CashTxKind" NOT NULL,
    "refId" TEXT,
    "refNo" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sign" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parentId" TEXT,
    "nature" "AccountNature" NOT NULL,
    "section" TEXT,
    "sortOrder" INTEGER,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AccountGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "groupId" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "taxType" TEXT,
    "gstComponent" TEXT,
    "rate" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "narration" TEXT,
    "createdAt" TIMESTAMP(3),
    "postedBy" TEXT,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineNo" INTEGER,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingRule" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "taxMode" TEXT,
    "lineRole" TEXT NOT NULL,
    "accountSelector" TEXT NOT NULL,

    CONSTRAINT "PostingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountOpeningBalance" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fyStart" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "side" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "AccountOpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMeta" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "AccountMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCategory" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "isInterstate" BOOLEAN NOT NULL DEFAULT false,
    "cessRate" DECIMAL(5,2),
    "calcMethod" TEXT NOT NULL DEFAULT 'FIXED',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TaxCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCategoryComponent" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "component" "TaxComponent" NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TaxCategoryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCategoryDefault" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "salesAccountId" TEXT,
    "purchaseAccountId" TEXT,
    "salesReturnAccountId" TEXT,
    "purchaseReturnAccountId" TEXT,
    "outputCgstAccountId" TEXT,
    "outputSgstAccountId" TEXT,
    "outputIgstAccountId" TEXT,
    "inputCgstAccountId" TEXT,
    "inputSgstAccountId" TEXT,
    "inputIgstAccountId" TEXT,
    "cessAccountId" TEXT,
    "singleTaxAccountId" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TaxCategoryDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCodeMap" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "productTaxCode" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "TaxCodeMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "licenseId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "logoDataUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "footerNote" TEXT,
    "authorizedSignatory" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("licenseId")
);

-- CreateTable
CREATE TABLE "LabelPrinter" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "printerName" TEXT NOT NULL,
    "connectionType" TEXT,
    "host" TEXT,
    "port" INTEGER,
    "dpi" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabelPrinter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabelTemplate" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "templatePath" TEXT NOT NULL,
    "widthMm" DECIMAL(6,2),
    "heightMm" DECIMAL(6,2),
    "defaultPrinterId" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabelTemplateMapping" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "appField" TEXT NOT NULL,
    "externalField" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "LabelTemplateMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabelPrintJob" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "templateId" TEXT,
    "printerId" TEXT,
    "engine" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "errorText" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "LabelPrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 999,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_email_key" ON "Franchise"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseRoleLimit_licenseId_role_key" ON "LicenseRoleLimit"("licenseId", "role");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_userId_deviceInfo_key" ON "Session"("userId", "deviceInfo");

-- CreateIndex
CREATE INDEX "Product_licenseId_code_idx" ON "Product"("licenseId", "code");

-- CreateIndex
CREATE INDEX "Product_licenseId_name_idx" ON "Product"("licenseId", "name");

-- CreateIndex
CREATE INDEX "Product_isSynced_idx" ON "Product"("isSynced");

-- CreateIndex
CREATE UNIQUE INDEX "Product_licenseId_code_key" ON "Product"("licenseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_licenseId_codeNumber_key" ON "Product"("licenseId", "codeNumber");

-- CreateIndex
CREATE INDEX "ProductBatch_productId_deletedAt_idx" ON "ProductBatch"("productId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProductBatch_licenseId_barcode_idx" ON "ProductBatch"("licenseId", "barcode");

-- CreateIndex
CREATE INDEX "ProductBatch_productId_batchNo_expiryDate_mfgDate_mrp_saleP_idx" ON "ProductBatch"("productId", "batchNo", "expiryDate", "mfgDate", "mrp", "salePrice");

-- CreateIndex
CREATE INDEX "ProductBatch_licenseId_purchaseBatchNo_productId_deletedAt_idx" ON "ProductBatch"("licenseId", "purchaseBatchNo", "productId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProductBatch_purchaseId_productId_deletedAt_idx" ON "ProductBatch"("purchaseId", "productId", "deletedAt");

-- CreateIndex
CREATE INDEX "Category_licenseId_deletedAt_idx" ON "Category"("licenseId", "deletedAt");

-- CreateIndex
CREATE INDEX "Brand_licenseId_deletedAt_idx" ON "Brand"("licenseId", "deletedAt");

-- CreateIndex
CREATE INDEX "Purchase_licenseId_purchaseDate_idx" ON "Purchase"("licenseId", "purchaseDate");

-- CreateIndex
CREATE INDEX "Purchase_licenseId_supplierId_idx" ON "Purchase"("licenseId", "supplierId");

-- CreateIndex
CREATE INDEX "Purchase_isSynced_idx" ON "Purchase"("isSynced");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_licenseId_slNo_key" ON "Purchase"("licenseId", "slNo");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_lineNo_idx" ON "PurchaseItem"("purchaseId", "lineNo");

-- CreateIndex
CREATE INDEX "PurchaseItem_batchId_idx" ON "PurchaseItem"("batchId");

-- CreateIndex
CREATE INDEX "PurchaseItem_isSynced_idx" ON "PurchaseItem"("isSynced");

-- CreateIndex
CREATE INDEX "PurchaseReturn_licenseId_returnDate_idx" ON "PurchaseReturn"("licenseId", "returnDate");

-- CreateIndex
CREATE INDEX "PurchaseReturn_licenseId_supplierId_idx" ON "PurchaseReturn"("licenseId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_licenseId_slNo_key" ON "PurchaseReturn"("licenseId", "slNo");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_returnId_lineNo_idx" ON "PurchaseReturnItem"("returnId", "lineNo");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_batchId_idx" ON "PurchaseReturnItem"("batchId");

-- CreateIndex
CREATE INDEX "PurchaseHold_licenseId_createdAt_idx" ON "PurchaseHold"("licenseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseHold_licenseId_holdNo_key" ON "PurchaseHold"("licenseId", "holdNo");

-- CreateIndex
CREATE INDEX "PurchaseReturnHold_licenseId_createdAt_idx" ON "PurchaseReturnHold"("licenseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturnHold_licenseId_holdNo_key" ON "PurchaseReturnHold"("licenseId", "holdNo");

-- CreateIndex
CREATE INDEX "Sale_licenseId_saleDate_idx" ON "Sale"("licenseId", "saleDate");

-- CreateIndex
CREATE INDEX "Sale_licenseId_customerId_idx" ON "Sale"("licenseId", "customerId");

-- CreateIndex
CREATE INDEX "Sale_isSynced_idx" ON "Sale"("isSynced");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_licenseId_slNo_key" ON "Sale"("licenseId", "slNo");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_lineNo_idx" ON "SaleItem"("saleId", "lineNo");

-- CreateIndex
CREATE INDEX "SaleItem_batchId_idx" ON "SaleItem"("batchId");

-- CreateIndex
CREATE INDEX "SaleItem_isSynced_idx" ON "SaleItem"("isSynced");

-- CreateIndex
CREATE INDEX "SaleReturn_licenseId_returnDate_idx" ON "SaleReturn"("licenseId", "returnDate");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_licenseId_slNo_key" ON "SaleReturn"("licenseId", "slNo");

-- CreateIndex
CREATE INDEX "SaleReturnItem_returnId_lineNo_idx" ON "SaleReturnItem"("returnId", "lineNo");

-- CreateIndex
CREATE INDEX "SaleReturnItem_batchId_idx" ON "SaleReturnItem"("batchId");

-- CreateIndex
CREATE INDEX "SaleHold_licenseId_createdAt_idx" ON "SaleHold"("licenseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleHold_licenseId_holdNo_key" ON "SaleHold"("licenseId", "holdNo");

-- CreateIndex
CREATE INDEX "Supplier_licenseId_name_idx" ON "Supplier"("licenseId", "name");

-- CreateIndex
CREATE INDEX "Supplier_isSynced_idx" ON "Supplier"("isSynced");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_licenseId_code_key" ON "Supplier"("licenseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_licenseId_codeNumber_key" ON "Supplier"("licenseId", "codeNumber");

-- CreateIndex
CREATE INDEX "SupplierTransaction_licenseId_supplierId_date_idx" ON "SupplierTransaction"("licenseId", "supplierId", "date");

-- CreateIndex
CREATE INDEX "SupplierTransaction_licenseId_kind_refId_idx" ON "SupplierTransaction"("licenseId", "kind", "refId");

-- CreateIndex
CREATE INDEX "SupplierTransaction_isSynced_idx" ON "SupplierTransaction"("isSynced");

-- CreateIndex
CREATE INDEX "SupplierBillSettlement_licenseId_supplierId_idx" ON "SupplierBillSettlement"("licenseId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierBillSettlement_licenseId_purchaseId_idx" ON "SupplierBillSettlement"("licenseId", "purchaseId");

-- CreateIndex
CREATE INDEX "Customer_licenseId_name_idx" ON "Customer"("licenseId", "name");

-- CreateIndex
CREATE INDEX "Customer_isSynced_idx" ON "Customer"("isSynced");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_licenseId_code_key" ON "Customer"("licenseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_licenseId_codeNumber_key" ON "Customer"("licenseId", "codeNumber");

-- CreateIndex
CREATE INDEX "CustomerTransaction_licenseId_customerId_date_idx" ON "CustomerTransaction"("licenseId", "customerId", "date");

-- CreateIndex
CREATE INDEX "CustomerTransaction_isSynced_idx" ON "CustomerTransaction"("isSynced");

-- CreateIndex
CREATE INDEX "CashTransaction_licenseId_date_idx" ON "CashTransaction"("licenseId", "date");

-- CreateIndex
CREATE INDEX "CashTransaction_licenseId_kind_refId_idx" ON "CashTransaction"("licenseId", "kind", "refId");

-- CreateIndex
CREATE INDEX "CashTransaction_isSynced_idx" ON "CashTransaction"("isSynced");

-- CreateIndex
CREATE UNIQUE INDEX "AccountGroup_name_key" ON "AccountGroup"("name");

-- CreateIndex
CREATE INDEX "AccountGroup_section_sortOrder_idx" ON "AccountGroup"("section", "sortOrder");

-- CreateIndex
CREATE INDEX "Account_licenseId_name_idx" ON "Account"("licenseId", "name");

-- CreateIndex
CREATE INDEX "Account_groupId_idx" ON "Account"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_licenseId_name_key" ON "Account"("licenseId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_licenseId_code_key" ON "Account"("licenseId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_licenseId_date_idx" ON "JournalEntry"("licenseId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_licenseId_refType_refId_idx" ON "JournalEntry"("licenseId", "refType", "refId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_lineNo_idx" ON "JournalLine"("entryId", "lineNo");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "AccountOpeningBalance_accountId_fyStart_idx" ON "AccountOpeningBalance"("accountId", "fyStart");

-- CreateIndex
CREATE UNIQUE INDEX "AccountOpeningBalance_accountId_fyStart_key" ON "AccountOpeningBalance"("accountId", "fyStart");

-- CreateIndex
CREATE INDEX "AccountMeta_accountId_key_idx" ON "AccountMeta"("accountId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCategory_licenseId_code_key" ON "TaxCategory"("licenseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCategoryDefault_categoryId_key" ON "TaxCategoryDefault"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCodeMap_licenseId_productTaxCode_key" ON "TaxCodeMap"("licenseId", "productTaxCode");

-- CreateIndex
CREATE INDEX "units_licenseId_deletedAt_idx" ON "units"("licenseId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "units_licenseId_code_key" ON "units"("licenseId", "code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseRoleLimit" ADD CONSTRAINT "LicenseRoleLimit_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierTransaction" ADD CONSTRAINT "SupplierTransaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillSettlement" ADD CONSTRAINT "SupplierBillSettlement_paymentTxId_fkey" FOREIGN KEY ("paymentTxId") REFERENCES "SupplierTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillSettlement" ADD CONSTRAINT "SupplierBillSettlement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTransaction" ADD CONSTRAINT "CustomerTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountGroup" ADD CONSTRAINT "AccountGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccountGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccountGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountOpeningBalance" ADD CONSTRAINT "AccountOpeningBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMeta" ADD CONSTRAINT "AccountMeta_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryComponent" ADD CONSTRAINT "TaxCategoryComponent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_cessAccountId_fkey" FOREIGN KEY ("cessAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_inputCgstAccountId_fkey" FOREIGN KEY ("inputCgstAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_inputIgstAccountId_fkey" FOREIGN KEY ("inputIgstAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_inputSgstAccountId_fkey" FOREIGN KEY ("inputSgstAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_outputCgstAccountId_fkey" FOREIGN KEY ("outputCgstAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_outputIgstAccountId_fkey" FOREIGN KEY ("outputIgstAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_outputSgstAccountId_fkey" FOREIGN KEY ("outputSgstAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_purchaseAccountId_fkey" FOREIGN KEY ("purchaseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_purchaseReturnAccountId_fkey" FOREIGN KEY ("purchaseReturnAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_salesAccountId_fkey" FOREIGN KEY ("salesAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_salesReturnAccountId_fkey" FOREIGN KEY ("salesReturnAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategoryDefault" ADD CONSTRAINT "TaxCategoryDefault_singleTaxAccountId_fkey" FOREIGN KEY ("singleTaxAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCodeMap" ADD CONSTRAINT "TaxCodeMap_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelTemplateMapping" ADD CONSTRAINT "LabelTemplateMapping_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LabelTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
