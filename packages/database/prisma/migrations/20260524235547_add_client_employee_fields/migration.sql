/*
  Warnings:

  - The `type` column on the `disciplinary_records` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('SANS_DIPLOME', 'CEPE', 'BEPC', 'BAC', 'BTS_DUT', 'LICENCE', 'MASTER', 'DOCTORAT', 'AUTRE');

-- CreateEnum
CREATE TYPE "EmploymentContractType" AS ENUM ('CDD', 'CDI', 'ESSAI', 'STAGE', 'JOURNALIER');

-- CreateEnum
CREATE TYPE "DisciplinaryType" AS ENUM ('FAUTE', 'AVERTISSEMENT', 'MISE_A_PIED', 'LICENCIEMENT');

-- CreateEnum
CREATE TYPE "IntegrationStepType" AS ENUM ('ENTRETIEN_EMBAUCHE', 'FORMATION_FCB', 'FORMATION_REGLEMENT', 'FORMATION_SERVICE_POSTE', 'SIGNATURE_CONTRAT', 'MISE_EN_SERVICE');

-- CreateEnum
CREATE TYPE "BehaviorRating" AS ENUM ('EXEMPLAIRE', 'BON', 'NORMAL', 'INDISCIPLINE');

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "behaviorRating" "BehaviorRating" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "cniNumber" TEXT,
ADD COLUMN     "contractType" "EmploymentContractType",
ADD COLUMN     "department" TEXT,
ADD COLUMN     "educationLevel" "EducationLevel",
ADD COLUMN     "emergencyRelation" TEXT;

-- AlterTable
ALTER TABLE "candidacies" ADD COLUMN     "cniNumber" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "cniNumber" TEXT,
ADD COLUMN     "contactFirstName" TEXT,
ADD COLUMN     "contactLastName" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "phone2" TEXT,
ADD COLUMN     "quartier" TEXT;

-- AlterTable
ALTER TABLE "disciplinary_records" ADD COLUMN     "documentUrl" TEXT,
ADD COLUMN     "faultNumber" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "type",
ADD COLUMN     "type" "DisciplinaryType" NOT NULL DEFAULT 'FAUTE';

-- CreateTable
CREATE TABLE "integration_steps" (
    "id" TEXT NOT NULL,
    "candidacyId" TEXT,
    "agentId" TEXT,
    "stepType" "IntegrationStepType" NOT NULL,
    "title" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "passed" BOOLEAN,
    "trainer" TEXT,
    "notes" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_steps_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "integration_steps" ADD CONSTRAINT "integration_steps_candidacyId_fkey" FOREIGN KEY ("candidacyId") REFERENCES "candidacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
