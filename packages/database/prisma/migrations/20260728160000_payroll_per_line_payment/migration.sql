-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('BROUILLON', 'VALIDE', 'PAYE', 'BLOQUE');

-- AlterTable: add per-line payment tracking fields
ALTER TABLE "payroll_lines" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'BROUILLON';
ALTER TABLE "payroll_lines" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "payroll_lines" ADD COLUMN "treasuryAccountId" TEXT;

-- Migrate existing data: set paymentStatus based on paidAt
UPDATE "payroll_lines" SET "paymentStatus" = 'PAYE' WHERE "paidAt" IS NOT NULL;
UPDATE "payroll_lines" SET "paymentStatus" = 'BLOQUE' WHERE "blocked" = true;
