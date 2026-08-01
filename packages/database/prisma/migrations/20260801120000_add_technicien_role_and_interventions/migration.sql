-- Add TECHNICIEN to Role enum
ALTER TYPE "Role" ADD VALUE 'TECHNICIEN';

-- Add userId column to clients table (links Client to User account)
ALTER TABLE "clients" ADD COLUMN "userId" TEXT;

-- Create unique index on clients.userId
CREATE UNIQUE INDEX "clients_userId_key" ON "clients"("userId");

-- Add foreign key constraint: clients.userId -> users.id
ALTER TABLE "clients" ADD CONSTRAINT "clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create InterventionType enum
CREATE TYPE "InterventionType" AS ENUM ('INSTALLATION_CAMERA', 'INSTALLATION_VIDEOSURVEILLANCE', 'MAINTENANCE_CAMERA', 'MAINTENANCE_VIDEOSURVEILLANCE', 'REPARATION', 'AUDIT_TECHNIQUE', 'AUTRE');

-- Create InterventionStatus enum
CREATE TYPE "InterventionStatus" AS ENUM ('PLANIFIEE', 'ASSIGNEE', 'EN_COURS', 'TERMINEE', 'ANNULEE', 'REPORTER');

-- Create interventions table
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "InterventionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "siteId" TEXT,
    "technicianId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "InterventionStatus" NOT NULL DEFAULT 'PLANIFIEE',
    "priority" TEXT NOT NULL DEFAULT 'NORMALE',
    "equipmentList" TEXT,
    "notes" TEXT,
    "beforePhotos" TEXT[],
    "afterPhotos" TEXT[],
    "report" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- Create unique index on interventions.reference
CREATE UNIQUE INDEX "interventions_reference_key" ON "interventions"("reference");

-- Add foreign key constraints for interventions
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
