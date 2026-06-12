-- CreateEnum
CREATE TYPE "LeadServiceType" AS ENUM ('GARDIENNAGE_STATIQUE', 'PATROUILLE_MOBILE', 'PROTECTION_RAPPROCHEE', 'SECURITE_EVENEMENTIELLE', 'TRANSPORT_FONDS', 'TELESURVEILLANCE', 'CANINE', 'MIXTE');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NOUVEAU', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION', 'GAGNE', 'PERDU');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('SITE_WEB', 'APPEL_ENTRANT', 'RECOMMANDATION', 'SALON', 'DEMARCHAGE', 'RESEAU_SOCIAL', 'PARTENAIRE', 'AUTRE');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "companyName" TEXT,
    "clientId" TEXT,
    "assignedToId" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NOUVEAU',
    "source" "LeadSource" NOT NULL DEFAULT 'APPEL_ENTRANT',
    "priority" "LeadPriority" NOT NULL DEFAULT 'NORMALE',
    "serviceType" "LeadServiceType" NOT NULL DEFAULT 'GARDIENNAGE_STATIQUE',
    "siteAddress" TEXT,
    "siteCity" TEXT,
    "siteSurface" DOUBLE PRECISION,
    "nbAgentsEstimated" INTEGER NOT NULL DEFAULT 0,
    "nbShifts" INTEGER NOT NULL DEFAULT 1,
    "armedRequired" BOOLEAN NOT NULL DEFAULT false,
    "canineRequired" BOOLEAN NOT NULL DEFAULT false,
    "riskLevel" TEXT NOT NULL DEFAULT 'FAIBLE',
    "targetStartDate" DATE,
    "estimatedRevenue" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "probability" INTEGER NOT NULL DEFAULT 10,
    "notes" TEXT,
    "lostReason" TEXT,
    "wonDate" TIMESTAMP(3),
    "lostDate" TIMESTAMP(3),
    "nextActionDate" DATE,
    "nextActionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_leads_reference_key" ON "crm_leads"("reference");

-- CreateIndex
CREATE INDEX "crm_leads_stage_priority_idx" ON "crm_leads"("stage", "priority");

-- CreateIndex
CREATE INDEX "crm_leads_assignedToId_stage_idx" ON "crm_leads"("assignedToId", "stage");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_date_idx" ON "lead_activities"("leadId", "date");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
