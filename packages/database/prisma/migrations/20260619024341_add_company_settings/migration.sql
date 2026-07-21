-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'SAGARD SÉCURITÉ',
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT NOT NULL DEFAULT 'Abidjan, Côte d''Ivoire',
    "rccm" TEXT,
    "ncc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);
