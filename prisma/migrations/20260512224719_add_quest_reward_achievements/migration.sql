-- CreateTable
CREATE TABLE "QuestRewardAchievement" (
    "questId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,

    CONSTRAINT "QuestRewardAchievement_pkey" PRIMARY KEY ("questId","achievementId")
);

-- AddForeignKey
ALTER TABLE "QuestRewardAchievement" ADD CONSTRAINT "QuestRewardAchievement_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestRewardAchievement" ADD CONSTRAINT "QuestRewardAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
