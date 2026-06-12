-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "crm_leads_createdById_idx" ON "crm_leads"("createdById");
