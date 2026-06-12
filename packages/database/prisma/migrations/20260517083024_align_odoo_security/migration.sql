/*
  Warnings:

  - The values [RENOUVELLEMENT] on the enum `ContractStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[code]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('GARDIENNAGE_STATIQUE', 'PATROUILLE_MOBILE', 'PROTECTION_RAPPROCHEE', 'SECURITE_EVENEMENTIELLE', 'TRANSPORT_FONDS', 'TELESURVEILLANCE', 'MIXTE');

-- CreateEnum
CREATE TYPE "InvoicingFrequency" AS ENUM ('MENSUELLE', 'TRIMESTRIELLE', 'SEMESTRIELLE', 'ANNUELLE');

-- CreateEnum
CREATE TYPE "ClientSegment" AS ENUM ('RESIDENTIEL', 'COMMERCIAL', 'INDUSTRIEL', 'BANQUE_FINANCE', 'AMBASSADE_DIPLOMATIQUE', 'EVENEMENTIEL', 'ADMINISTRATION_PUBLIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "ShiftCount" AS ENUM ('ONE', 'TWO', 'THREE');

-- AlterEnum
BEGIN;
CREATE TYPE "ContractStatus_new" AS ENUM ('BROUILLON', 'DEVIS', 'PROFORMA', 'CONFIRME', 'ACTIF', 'SUSPENDU', 'RESILIE', 'EXPIRE');
ALTER TABLE "client_contracts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "client_contracts" ALTER COLUMN "status" TYPE "ContractStatus_new" USING ("status"::text::"ContractStatus_new");
ALTER TYPE "ContractStatus" RENAME TO "ContractStatus_old";
ALTER TYPE "ContractStatus_new" RENAME TO "ContractStatus";
DROP TYPE "ContractStatus_old";
ALTER TABLE "client_contracts" ALTER COLUMN "status" SET DEFAULT 'BROUILLON';
COMMIT;

-- AlterTable
ALTER TABLE "client_contracts" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contractType" "ContractType" NOT NULL DEFAULT 'GARDIENNAGE_STATIQUE',
ADD COLUMN     "durationMonths" INTEGER,
ADD COLUMN     "invoicingFrequency" "InvoicingFrequency" NOT NULL DEFAULT 'MENSUELLE',
ADD COLUMN     "nbHoursMonth" DOUBLE PRECISION,
ADD COLUMN     "nbShifts" "ShiftCount" NOT NULL DEFAULT 'ONE',
ADD COLUMN     "noticeDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "setupAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "signatureDate" TIMESTAMP(3),
ADD COLUMN     "title" TEXT,
ALTER COLUMN "type" DROP NOT NULL;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "code" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'Côte d''Ivoire',
ADD COLUMN     "segment" "ClientSegment" NOT NULL DEFAULT 'AUTRE',
ALTER COLUMN "sector" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");
