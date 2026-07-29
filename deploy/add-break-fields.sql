-- Add break/pause fields to pointages table
ALTER TABLE "pointages" ADD COLUMN IF NOT EXISTS "breakStart" TIMESTAMP(3);
ALTER TABLE "pointages" ADD COLUMN IF NOT EXISTS "breakEnd" TIMESTAMP(3);
ALTER TABLE "pointages" ADD COLUMN IF NOT EXISTS "breakMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pointages" ADD COLUMN IF NOT EXISTS "onBreak" BOOLEAN NOT NULL DEFAULT false;
