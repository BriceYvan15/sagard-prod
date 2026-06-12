-- CreateEnum
CREATE TYPE "BillingRunState" AS ENUM ('BROUILLON', 'EXECUTE', 'ANNULE');

-- AlterTable
ALTER TABLE "client_contracts" ADD COLUMN     "assignedUserId" TEXT,
ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "email" TEXT,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "street2" TEXT,
ADD COLUMN     "vat" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "zip" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "billingRunId" TEXT;

-- CreateTable
CREATE TABLE "billing_runs" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "invoicingFrequency" "InvoicingFrequency" NOT NULL DEFAULT 'MENSUELLE',
    "state" "BillingRunState" NOT NULL DEFAULT 'BROUILLON',
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_runs_reference_key" ON "billing_runs"("reference");

-- AddForeignKey
ALTER TABLE "client_contracts" ADD CONSTRAINT "client_contracts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billingRunId_fkey" FOREIGN KEY ("billingRunId") REFERENCES "billing_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
