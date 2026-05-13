import { Prisma, QuestStatus } from '@prisma/client';

export const questCategoryPublishedCountInclude = {
  _count: {
    select: {
      quests: { where: { status: QuestStatus.PUBLISHED } },
    },
  },
} satisfies Prisma.QuestCategoryInclude;

const questCategoryWithPublishedCountArgs = {
  include: questCategoryPublishedCountInclude,
} satisfies Prisma.QuestCategoryDefaultArgs;

export type QuestCategoryWithPublishedCount = Prisma.QuestCategoryGetPayload<
  typeof questCategoryWithPublishedCountArgs
>;
