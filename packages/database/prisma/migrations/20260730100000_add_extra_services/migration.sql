-- CreateEnum
CREATE TYPE "ExtraServiceStatus" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "extra_services" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 2500,
    "description" TEXT,
    "assignedById" TEXT,
    "assignedByName" TEXT,
    "status" "ExtraServiceStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extra_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extra_services_agentId_date_idx" ON "extra_services"("agentId", "date");

-- AddForeignKey
ALTER TABLE "extra_services" ADD CONSTRAINT "extra_services_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
