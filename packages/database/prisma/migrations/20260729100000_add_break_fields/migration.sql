-- AlterTable
ALTER TABLE "pointages" ADD COLUMN "breakStart" TIMESTAMP(3);
ALTER TABLE "pointages" ADD COLUMN "breakEnd" TIMESTAMP(3);
ALTER TABLE "pointages" ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pointages" ADD COLUMN "onBreak" BOOLEAN NOT NULL DEFAULT false;
