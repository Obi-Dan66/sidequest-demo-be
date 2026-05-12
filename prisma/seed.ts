/**
 * Idempotent seed for local development.
 *
 *   npm run prisma:seed
 *
 * Seeds:
 *   - 1 admin + 2 regular users
 *   - Quest categories (history, food, nature, mystery)
 *   - Sample published Prague quests with locations
 *   - Sample achievements (QUEST_COUNT family)
 *
 * All operations use upsert-by-unique-slug-or-email -> safe to re-run.
 */
import {
  AchievementType,
  PrismaClient,
  QuestDifficulty,
  QuestStatus,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seedUsers(): Promise<void> {
  const adminHash = await argon2.hash('AdminPass123!');
  const userHash = await argon2.hash('UserPass123!');

  await prisma.user.upsert({
    where: { email: 'admin@sidequest.dev' },
    update: {},
    create: {
      email: 'admin@sidequest.dev',
      username: 'admin',
      passwordHash: adminHash,
      displayName: 'SideQuest Admin',
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'wanderer@sidequest.dev' },
    update: {},
    create: {
      email: 'wanderer@sidequest.dev',
      username: 'wanderer',
      passwordHash: userHash,
      displayName: 'Prague Wanderer',
      role: UserRole.USER,
    },
  });

  await prisma.user.upsert({
    where: { email: 'foodie@sidequest.dev' },
    update: {},
    create: {
      email: 'foodie@sidequest.dev',
      username: 'foodie',
      passwordHash: userHash,
      displayName: 'Foodie Explorer',
      role: UserRole.USER,
    },
  });
}

async function seedCategories(): Promise<Record<string, string>> {
  const categories = [
    { slug: 'history', name: 'History', colorHex: '#8B5E3C' },
    { slug: 'food', name: 'Food & Drink', colorHex: '#F2994A' },
    { slug: 'nature', name: 'Nature', colorHex: '#27AE60' },
    { slug: 'mystery', name: 'Mystery', colorHex: '#7B2CBF' },
  ];

  const idBySlug: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.questCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, colorHex: c.colorHex },
      create: c,
    });
    idBySlug[c.slug] = row.id;
  }
  return idBySlug;
}

async function seedQuests(categoryIdBySlug: Record<string, string>): Promise<void> {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@sidequest.dev' } });
  if (!admin) throw new Error('Admin user not seeded');

  const quests = [
    {
      slug: 'old-town-square-mysteries',
      title: 'Old Town Square Mysteries',
      summary: 'Walk through 1000 years of Prague history.',
      description:
        'Start at the Astronomical Clock and uncover hidden symbols around the Old Town Square. Find 4 historical markers to complete the quest.',
      difficulty: QuestDifficulty.EASY,
      xpReward: 100,
      categorySlug: 'history',
      locations: [
        { name: 'Astronomical Clock', latitude: 50.087, longitude: 14.4208, orderIndex: 0 },
        { name: 'Týn Church', latitude: 50.0879, longitude: 14.4222, orderIndex: 1 },
        { name: 'Old Town Hall', latitude: 50.0872, longitude: 14.4205, orderIndex: 2 },
      ],
    },
    {
      slug: 'prague-castle-circuit',
      title: 'Prague Castle Circuit',
      summary: 'Conquer the largest ancient castle complex in the world.',
      description:
        'Cross the Charles Bridge and ascend to Prague Castle. Visit St. Vitus Cathedral, Golden Lane, and the Royal Garden.',
      difficulty: QuestDifficulty.MEDIUM,
      xpReward: 250,
      categorySlug: 'history',
      locations: [
        { name: 'Charles Bridge', latitude: 50.0865, longitude: 14.4114, orderIndex: 0 },
        { name: 'St. Vitus Cathedral', latitude: 50.0905, longitude: 14.4008, orderIndex: 1 },
        { name: 'Golden Lane', latitude: 50.0917, longitude: 14.4039, orderIndex: 2 },
      ],
    },
    {
      slug: 'trdelnik-trail',
      title: 'Trdelník Trail',
      summary: 'Find the best trdelník in town.',
      description: 'Visit three iconic Prague pastry stalls and rate each one.',
      difficulty: QuestDifficulty.EASY,
      xpReward: 75,
      categorySlug: 'food',
      locations: [
        { name: 'Trdelnik Stop A', latitude: 50.0866, longitude: 14.4193, orderIndex: 0 },
        { name: 'Trdelnik Stop B', latitude: 50.0858, longitude: 14.4173, orderIndex: 1 },
      ],
    },
    {
      slug: 'petrin-summit',
      title: 'Petřín Summit',
      summary: 'Climb the green hill above the city.',
      description:
        'Reach the top of Petřín Hill and snap a photo at the Petřín Lookout Tower (mini-Eiffel).',
      difficulty: QuestDifficulty.HARD,
      xpReward: 200,
      categorySlug: 'nature',
      locations: [{ name: 'Petřín Tower', latitude: 50.0837, longitude: 14.3954, orderIndex: 0 }],
    },
  ];

  for (const q of quests) {
    const categoryId = categoryIdBySlug[q.categorySlug];
    await prisma.quest.upsert({
      where: { slug: q.slug },
      update: {},
      create: {
        slug: q.slug,
        title: q.title,
        summary: q.summary,
        description: q.description,
        difficulty: q.difficulty,
        xpReward: q.xpReward,
        status: QuestStatus.PUBLISHED,
        publishedAt: new Date(),
        author: { connect: { id: admin.id } },
        category: { connect: { id: categoryId } },
        locations: {
          create: q.locations.map((loc) => ({
            name: loc.name,
            latitude: loc.latitude,
            longitude: loc.longitude,
            radiusM: 50,
            orderIndex: loc.orderIndex,
          })),
        },
      },
    });
  }
}

async function seedAchievements(): Promise<void> {
  const list = [
    {
      slug: 'first-steps',
      name: 'First Steps',
      description: 'Complete your first quest.',
      type: AchievementType.QUEST_COUNT,
      criteria: { minQuests: 1 },
      xpBonus: 50,
    },
    {
      slug: 'explorer-novice',
      name: 'Novice Explorer',
      description: 'Complete 5 quests.',
      type: AchievementType.QUEST_COUNT,
      criteria: { minQuests: 5 },
      xpBonus: 100,
    },
    {
      slug: 'explorer-veteran',
      name: 'Veteran Explorer',
      description: 'Complete 25 quests.',
      type: AchievementType.QUEST_COUNT,
      criteria: { minQuests: 25 },
      xpBonus: 500,
    },
  ];

  for (const a of list) {
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      update: {},
      create: a,
    });
  }
}

async function main(): Promise<void> {
  console.log('Seeding SideQuest database...');
  try {
    await seedUsers();
    const categories = await seedCategories();
    await seedQuests(categories);
    await seedAchievements();
    console.log('Seed completed.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
