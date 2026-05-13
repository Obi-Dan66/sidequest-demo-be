-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "ratingAvg" DOUBLE PRECISION,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "QuestRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestRating_questId_idx" ON "QuestRating"("questId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestRating_userId_questId_key" ON "QuestRating"("userId", "questId");

-- AddForeignKey
ALTER TABLE "QuestRating" ADD CONSTRAINT "QuestRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestRating" ADD CONSTRAINT "QuestRating_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
