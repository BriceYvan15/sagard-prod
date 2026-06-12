-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClientSegment" ADD VALUE 'PARTICULIER';
ALTER TYPE "ClientSegment" ADD VALUE 'ENTREPRISE_PRIVEE';
ALTER TYPE "ClientSegment" ADD VALUE 'INSTITUTION_PUBLIQUE';
ALTER TYPE "ClientSegment" ADD VALUE 'ONG';
ALTER TYPE "ClientSegment" ADD VALUE 'AMBASSADE';

-- AlterEnum
ALTER TYPE "LeadServiceType" ADD VALUE 'INSTALLATION_CAMERAS';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMMERCIAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VisitPurpose" ADD VALUE 'CANDIDATURE';
ALTER TYPE "VisitPurpose" ADD VALUE 'ENTRETIEN';

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitPrice" DECIMAL(15,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_code_key" ON "service_catalog"("code");
