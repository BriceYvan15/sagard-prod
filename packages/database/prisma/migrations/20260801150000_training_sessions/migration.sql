-- Add FORMATION to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'FORMATION';

-- Create TrainingType enum
CREATE TYPE "TrainingType" AS ENUM ('QCM', 'LECTURE', 'VIDEO', 'PRATIQUE');

-- Create TrainingSessionStatus enum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('BROUILLON', 'PUBLIEE', 'CLOTUREE');

-- Create TrainingParticipantStatus enum
CREATE TYPE "TrainingParticipantStatus" AS ENUM ('ASSIGNEE', 'EN_COURS', 'TERMINE', 'REUSSI', 'ECHOUE');

-- Create training_sessions table
CREATE TABLE "training_sessions" (
    "id"            TEXT                  NOT NULL,
    "title"         TEXT                  NOT NULL,
    "description"   TEXT,
    "type"          "TrainingType"        NOT NULL,
    "status"        "TrainingSessionStatus" NOT NULL DEFAULT 'BROUILLON',
    "trainer"       TEXT,
    "location"      TEXT,
    "startDate"     TIMESTAMP(3),
    "endDate"       TIMESTAMP(3),
    "passingScore"  INTEGER               NOT NULL DEFAULT 70,
    "content"       TEXT,
    "videoUrl"      TEXT,
    "createdById"   TEXT,
    "createdAt"     TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)         NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- Add foreign key: training_sessions.createdById -> users.id
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create training_questions table
CREATE TABLE "training_questions" (
    "id"           TEXT            NOT NULL,
    "sessionId"    TEXT            NOT NULL,
    "question"     TEXT            NOT NULL,
    "options"      TEXT[]          NOT NULL,
    "correctIndex" INTEGER         NOT NULL,
    "points"       INTEGER         NOT NULL DEFAULT 1,
    "createdAt"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_questions_pkey" PRIMARY KEY ("id")
);

-- Add foreign key: training_questions.sessionId -> training_sessions.id (CASCADE)
ALTER TABLE "training_questions" ADD CONSTRAINT "training_questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create training_participants table
CREATE TABLE "training_participants" (
    "id"                TEXT                       NOT NULL,
    "sessionId"         TEXT                       NOT NULL,
    "agentId"           TEXT                       NOT NULL,
    "status"            "TrainingParticipantStatus" NOT NULL DEFAULT 'ASSIGNEE',
    "score"             INTEGER,
    "answers"           JSONB,
    "startedAt"         TIMESTAMP(3),
    "completedAt"       TIMESTAMP(3),
    "integrationStepId" TEXT,
    "createdAt"         TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)               NOT NULL,

    CONSTRAINT "training_participants_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one participant per session per agent
CREATE UNIQUE INDEX "training_participants_sessionId_agentId_key" ON "training_participants"("sessionId", "agentId");

-- Index on agentId for quick lookup
CREATE INDEX "training_participants_agentId_idx" ON "training_participants"("agentId");

-- Add foreign keys for training_participants
ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_participants" ADD CONSTRAINT "training_participants_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
