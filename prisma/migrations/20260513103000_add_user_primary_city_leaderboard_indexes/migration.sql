-- Feature 10: city-scoped leaderboards + faster period aggregates
ALTER TABLE "User" ADD COLUMN "primaryCity" TEXT NOT NULL DEFAULT 'prague';

CREATE INDEX "User_status_primaryCity_idx" ON "User" ("status", "primaryCity");

CREATE INDEX "QuestCompletion_status_completedAt_idx" ON "QuestCompletion" ("status", "completedAt");
