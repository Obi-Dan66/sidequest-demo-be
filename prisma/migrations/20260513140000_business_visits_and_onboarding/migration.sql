-- Feature 12: business visits + partner portal onboarding flag
CREATE TYPE "VisitSource" AS ENUM ('QUEST', 'QR', 'DIRECT', 'REFERRAL');

CREATE TABLE "BusinessVisit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "questId" TEXT,
    "userId" TEXT,
    "source" "VisitSource" NOT NULL DEFAULT 'QUEST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessVisit_businessId_createdAt_idx" ON "BusinessVisit"("businessId", "createdAt");

ALTER TABLE "BusinessVisit" ADD CONSTRAINT "BusinessVisit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessVisit" ADD CONSTRAINT "BusinessVisit_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessVisit" ADD CONSTRAINT "BusinessVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Business" ADD COLUMN "onboardingStartedAt" TIMESTAMP(3);
