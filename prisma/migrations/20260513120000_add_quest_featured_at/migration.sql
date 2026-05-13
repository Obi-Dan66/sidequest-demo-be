-- Feature 11: editorial featured quest for public stats / landing
ALTER TABLE "Quest" ADD COLUMN "featuredAt" TIMESTAMP(3);

CREATE INDEX "Quest_status_featuredAt_idx" ON "Quest" ("status", "featuredAt");
