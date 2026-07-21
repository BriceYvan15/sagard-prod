-- Add RENVOYE to AgentStatus enum
ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'RENVOYE';

-- Add termination fields to agents table
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "terminationReason" TEXT;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMP(3);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "terminatedById" TEXT;

-- Add foreign key for terminatedById -> users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agents_terminatedById_fkey'
  ) THEN
    ALTER TABLE "agents" ADD CONSTRAINT "agents_terminatedById_fkey"
      FOREIGN KEY ("terminatedById") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END$$;
