/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `agent_deployments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `sites` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `agent_deployments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SiteType" AS ENUM ('VILLA', 'IMMEUBLE', 'ENTREPOT', 'USINE', 'BUREAU', 'COMMERCE', 'BANQUE', 'CHANTIER', 'AUTRE');

-- CreateEnum
CREATE TYPE "DeploymentRole" AS ENUM ('AGENT', 'CHEF_POSTE', 'SUPERVISEUR', 'CONTROLEUR', 'MAITRE_CHIEN', 'PROTECTION_RAPPROCHEE');

-- CreateEnum
CREATE TYPE "DeploymentShift" AS ENUM ('JOUR', 'NUIT', 'FULL');

-- CreateEnum
CREATE TYPE "DeploymentState" AS ENUM ('BROUILLON', 'ACTIF', 'REMPLACE', 'TERMINE');

-- CreateEnum
CREATE TYPE "PointingMethod" AS ENUM ('MANUEL', 'CONTROLEUR', 'MOBILE', 'BIOMETRIQUE');

-- CreateEnum
CREATE TYPE "PatrolRoundState" AS ENUM ('EN_COURS', 'TERMINEE', 'INCOMPLETE', 'INTERROMPUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PointageStatus" ADD VALUE 'PRESENT';
ALTER TYPE "PointageStatus" ADD VALUE 'JUSTIFIE';
ALTER TYPE "PointageStatus" ADD VALUE 'REMPLACE';
ALTER TYPE "PointageStatus" ADD VALUE 'CONGE';

-- AlterTable
ALTER TABLE "agent_deployments" ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "role" "DeploymentRole" NOT NULL DEFAULT 'AGENT',
ADD COLUMN     "shiftKind" "DeploymentShift" NOT NULL DEFAULT 'JOUR',
ADD COLUMN     "state" "DeploymentState" NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "pointages" ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "controllerId" TEXT,
ADD COLUMN     "deploymentId" TEXT,
ADD COLUMN     "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lateMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pointingMethod" "PointingMethod" NOT NULL DEFAULT 'CONTROLEUR',
ALTER COLUMN "checkInTime" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "code" TEXT,
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'Côte d''Ivoire',
ADD COLUMN     "hasArmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasCanine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nbAgentsRequired" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nbShifts" "ShiftCount" NOT NULL DEFAULT 'ONE',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "siteType" "SiteType" NOT NULL DEFAULT 'VILLA',
ADD COLUMN     "surface" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "patrol_points" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 10,
    "locationDescription" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "expectedIntervalMin" INTEGER NOT NULL DEFAULT 60,
    "instructions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patrol_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrol_rounds" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "dateStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEnd" TIMESTAMP(3),
    "durationMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "state" "PatrolRoundState" NOT NULL DEFAULT 'EN_COURS',
    "pointsTotal" INTEGER NOT NULL DEFAULT 0,
    "pointsDone" INTEGER NOT NULL DEFAULT 0,
    "completionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrol_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrol_checks" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "pointId" TEXT,
    "pointCode" TEXT,
    "checkTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "note" TEXT,
    "hasAnomaly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "patrol_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patrol_points_code_key" ON "patrol_points"("code");

-- CreateIndex
CREATE INDEX "patrol_points_siteId_sequence_idx" ON "patrol_points"("siteId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "patrol_rounds_reference_key" ON "patrol_rounds"("reference");

-- CreateIndex
CREATE INDEX "patrol_rounds_siteId_dateStart_idx" ON "patrol_rounds"("siteId", "dateStart");

-- CreateIndex
CREATE INDEX "patrol_rounds_agentId_dateStart_idx" ON "patrol_rounds"("agentId", "dateStart");

-- CreateIndex
CREATE INDEX "patrol_checks_roundId_checkTime_idx" ON "patrol_checks"("roundId", "checkTime");

-- CreateIndex
CREATE UNIQUE INDEX "agent_deployments_reference_key" ON "agent_deployments"("reference");

-- CreateIndex
CREATE INDEX "agent_deployments_agentId_state_idx" ON "agent_deployments"("agentId", "state");

-- CreateIndex
CREATE INDEX "agent_deployments_siteId_state_idx" ON "agent_deployments"("siteId", "state");

-- CreateIndex
CREATE INDEX "pointages_siteId_date_idx" ON "pointages"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_deployments" ADD CONSTRAINT "agent_deployments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "client_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_deployments" ADD CONSTRAINT "agent_deployments_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "agent_deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_points" ADD CONSTRAINT "patrol_points_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_rounds" ADD CONSTRAINT "patrol_rounds_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_rounds" ADD CONSTRAINT "patrol_rounds_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_checks" ADD CONSTRAINT "patrol_checks_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "patrol_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_checks" ADD CONSTRAINT "patrol_checks_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "patrol_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
