/*
  Warnings:

  - The `progress` column on the `UserAchievement` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "targetValue" INTEGER;

-- AlterTable
ALTER TABLE "UserAchievement" ALTER COLUMN "unlockedAt" DROP NOT NULL,
ALTER COLUMN "unlockedAt" DROP DEFAULT,
DROP COLUMN "progress",
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;
