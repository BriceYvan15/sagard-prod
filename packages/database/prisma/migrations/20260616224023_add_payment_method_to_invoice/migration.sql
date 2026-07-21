-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CHEQUE', 'VIREMENT_BANCAIRE', 'MOBILE_MONEY', 'ESPECE');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paymentMethod" "PaymentMethod";
