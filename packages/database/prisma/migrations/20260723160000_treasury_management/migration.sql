-- AlterEnum: PaymentMethod — remplacer les anciennes valeurs par les nouvelles
-- Étape 1: créer le nouveau type
CREATE TYPE "PaymentMethod_new" AS ENUM ('CHEQUE_NSIA', 'VIREMENT_NSIA', 'CHEQUE_BOA', 'VIREMENT_BOA', 'CHEQUE_ECOBANK', 'VIREMENT_ECOBANK', 'WAVE', 'ORANGE_MONEY', 'DJAMO', 'ESPECE');

-- Étape 2: convertir la colonne en mappant les anciennes valeurs vers les nouvelles
ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING
  CASE "paymentMethod"::text
    WHEN 'CHEQUE' THEN 'CHEQUE_NSIA'::"PaymentMethod_new"
    WHEN 'VIREMENT_BANCAIRE' THEN 'VIREMENT_NSIA'::"PaymentMethod_new"
    WHEN 'MOBILE_MONEY' THEN 'WAVE'::"PaymentMethod_new"
    WHEN 'ESPECE' THEN 'ESPECE'::"PaymentMethod_new"
    ELSE 'ESPECE'::"PaymentMethod_new"
  END;

-- Étape 3: remplacer l'ancien type par le nouveau
DROP TYPE "PaymentMethod";
CREATE TYPE "PaymentMethod" AS ENUM ('CHEQUE_NSIA', 'VIREMENT_NSIA', 'CHEQUE_BOA', 'VIREMENT_BOA', 'CHEQUE_ECOBANK', 'VIREMENT_ECOBANK', 'WAVE', 'ORANGE_MONEY', 'DJAMO', 'ESPECE');
ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING "paymentMethod"::text::"PaymentMethod";
DROP TYPE "PaymentMethod_new";

-- CreateTable: treasury_accounts
CREATE TABLE "treasury_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "paymentMethods" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: treasury_transactions
CREATE TABLE "treasury_transactions" (
    "id" TEXT NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT,
    "paymentId" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_transactions_pkey" PRIMARY KEY ("id")
);

-- AddColumn: treasuryAccountId on payments
ALTER TABLE "payments" ADD COLUMN "treasuryAccountId" TEXT;

-- CreateIndex
CREATE INDEX "treasury_transactions_treasuryAccountId_createdAt_idx" ON "treasury_transactions"("treasuryAccountId", "createdAt");

-- CreateIndex: unique paymentId on treasury_transactions
CREATE UNIQUE INDEX "treasury_transactions_paymentId_key" ON "treasury_transactions"("paymentId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "treasury_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "treasury_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
