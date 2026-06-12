/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `controller_patrols` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `controller_patrols` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ControlVisitType" AS ENUM ('ROUTINE', 'INOPINEE', 'ALERTE', 'RELEVE', 'ESCORTE');

-- CreateEnum
CREATE TYPE "ControlVisitState" AS ENUM ('BROUILLON', 'EFFECTUEE', 'REPORTEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "DailyReportShift" AS ENUM ('JOUR', 'NUIT', 'FULL');

-- CreateEnum
CREATE TYPE "DailyReportState" AS ENUM ('BROUILLON', 'SOUMIS', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "WeatherCondition" AS ENUM ('DEGAGE', 'NUAGEUX', 'PLUVIEUX', 'ORAGEUX', 'BROUILLARD');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('INTRUSION', 'VOL', 'AGRESSION', 'INCENDIE', 'VANDALISME', 'MEDICAL', 'TECHNIQUE', 'FAUTE_AGENT', 'FAUSSE_ALERTE', 'AUTRE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "IncidentState" AS ENUM ('OUVERT', 'INVESTIGATION', 'RESOLU', 'CLOS');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('SOS', 'INTRUSION', 'INCENDIE', 'MEDICAL', 'RENFORT', 'TECHNIQUE', 'TEST');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "AlertState" AS ENUM ('NOUVELLE', 'PRISE_EN_COMPTE', 'INTERVENTION', 'RESOLUE', 'FAUSSE');

-- AlterTable
ALTER TABLE "controller_patrols" ADD COLUMN     "actionsTaken" TEXT,
ADD COLUMN     "agentsExpected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "equipmentOk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "postureOk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "registerOk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" "ControlVisitState" NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN     "uniformOk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "visitDatetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "visitType" "ControlVisitType" NOT NULL DEFAULT 'ROUTINE',
ALTER COLUMN "arrivedAt" DROP NOT NULL;

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "siteId" TEXT NOT NULL,
    "contractId" TEXT,
    "shift" "DailyReportShift" NOT NULL DEFAULT 'JOUR',
    "chiefAgentId" TEXT,
    "agentsExpected" INTEGER NOT NULL DEFAULT 0,
    "agentCount" INTEGER NOT NULL DEFAULT 0,
    "state" "DailyReportState" NOT NULL DEFAULT 'BROUILLON',
    "weather" "WeatherCondition",
    "visitorsCount" INTEGER NOT NULL DEFAULT 0,
    "vehiclesInCount" INTEGER NOT NULL DEFAULT 0,
    "vehiclesOutCount" INTEGER NOT NULL DEFAULT 0,
    "roundsDone" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "activities" TEXT,
    "handoverTo" TEXT,
    "keysCount" INTEGER NOT NULL DEFAULT 0,
    "nextShiftNotes" TEXT,
    "validatorId" TEXT,
    "validationDate" TIMESTAMP(3),
    "submittedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_report_agents" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_report_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "incidentDatetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "incidentType" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'FAIBLE',
    "state" "IncidentState" NOT NULL DEFAULT 'OUVERT',
    "reporterId" TEXT,
    "dailyReportId" TEXT,
    "controlVisitId" TEXT,
    "description" TEXT NOT NULL,
    "actionsTaken" TEXT,
    "resolution" TEXT,
    "policeCalled" BOOLEAN NOT NULL DEFAULT false,
    "clientNotified" BOOLEAN NOT NULL DEFAULT false,
    "estimatedDamage" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_agents" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "siteId" TEXT,
    "agentId" TEXT,
    "alertType" "AlertType" NOT NULL DEFAULT 'SOS',
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "message" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "state" "AlertState" NOT NULL DEFAULT 'NOUVELLE',
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "responseTimeMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "incidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_reference_key" ON "daily_reports"("reference");

-- CreateIndex
CREATE INDEX "daily_reports_siteId_date_idx" ON "daily_reports"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_siteId_date_shift_key" ON "daily_reports"("siteId", "date", "shift");

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_agents_reportId_agentId_key" ON "daily_report_agents"("reportId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_reference_key" ON "incidents"("reference");

-- CreateIndex
CREATE INDEX "incidents_siteId_incidentDatetime_idx" ON "incidents"("siteId", "incidentDatetime");

-- CreateIndex
CREATE INDEX "incidents_state_severity_idx" ON "incidents"("state", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "incident_agents_incidentId_agentId_key" ON "incident_agents"("incidentId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_reference_key" ON "alerts"("reference");

-- CreateIndex
CREATE INDEX "alerts_state_createdAt_idx" ON "alerts"("state", "createdAt");

-- CreateIndex
CREATE INDEX "alerts_siteId_createdAt_idx" ON "alerts"("siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "controller_patrols_reference_key" ON "controller_patrols"("reference");

-- CreateIndex
CREATE INDEX "controller_patrols_siteId_visitDatetime_idx" ON "controller_patrols"("siteId", "visitDatetime");

-- CreateIndex
CREATE INDEX "controller_patrols_controllerId_visitDatetime_idx" ON "controller_patrols"("controllerId", "visitDatetime");

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_agents" ADD CONSTRAINT "daily_report_agents_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_controlVisitId_fkey" FOREIGN KEY ("controlVisitId") REFERENCES "controller_patrols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_agents" ADD CONSTRAINT "incident_agents_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
