-- AlterTable
ALTER TABLE "QuestCompletion" ADD COLUMN     "checkedInLocationIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "QuestLocationCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestLocationCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestLocationCheckIn_userId_questId_idx" ON "QuestLocationCheckIn"("userId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestLocationCheckIn_userId_locationId_key" ON "QuestLocationCheckIn"("userId", "locationId");

-- AddForeignKey
ALTER TABLE "QuestLocationCheckIn" ADD CONSTRAINT "QuestLocationCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestLocationCheckIn" ADD CONSTRAINT "QuestLocationCheckIn_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestLocationCheckIn" ADD CONSTRAINT "QuestLocationCheckIn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "QuestLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
