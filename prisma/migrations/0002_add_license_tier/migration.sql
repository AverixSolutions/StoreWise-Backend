CREATE TYPE "LicenseTier" AS ENUM ('PRO', 'LITE', 'WEB');
ALTER TABLE "License" ADD COLUMN "tier" "LicenseTier" NOT NULL DEFAULT 'PRO';
