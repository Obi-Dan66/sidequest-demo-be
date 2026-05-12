/**
 * Idempotent seed for local development.
 *
 *   yarn prisma:seed
 *
 * Seeds:
 *   - admin + a handful of demo users (varied XP/level/streak)
 *   - 6 quest categories covering the SideQuest pillars
 *   - 20+ realistic Prague quests across viewpoints / parks / cafés / hidden / geocache / history / food
 *   - a tiered achievement set (quest count, XP threshold, category explorer, social, streak, location visits)
 *
 * All operations use upsert-by-unique-key -> safe to re-run.
 */
import {
  AchievementType,
  Prisma,
  PrismaClient,
  QuestDifficulty,
  QuestStatus,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  bio?: string;
  avatarUrl?: string;
}

interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  colorHex: string;
  iconUrl?: string;
  coverImageUrl?: string;
}

interface SeedQuest {
  slug: string;
  title: string;
  summary: string;
  description: string;
  difficulty: QuestDifficulty;
  xpReward: number;
  estimatedDurationMin: number;
  categorySlug: string;
  imageUrl: string;
  coverImageUrl: string;
  locations: Array<{
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    radiusM?: number;
  }>;
}

/**
 * Achievement criteria payload. Shape is read by `AchievementsService.evaluate()`.
 * Typed loosely with optional keys so each type populates only the fields it needs.
 */
interface AchievementCriteriaSeed {
  minQuests?: number;
  minXp?: number;
  minLevel?: number;
  minLocations?: number;
  minFriends?: number;
  minStreakDays?: number;
  categorySlug?: string;
}

interface SeedAchievement {
  slug: string;
  name: string;
  description: string;
  iconUrl: string;
  type: AchievementType;
  criteria: AchievementCriteriaSeed;
  xpBonus: number;
}

function toJsonInput(value: AchievementCriteriaSeed): Prisma.InputJsonValue {
  const out: Record<string, number | string> = {};
  if (value.minQuests !== undefined) out.minQuests = value.minQuests;
  if (value.minXp !== undefined) out.minXp = value.minXp;
  if (value.minLevel !== undefined) out.minLevel = value.minLevel;
  if (value.minLocations !== undefined) out.minLocations = value.minLocations;
  if (value.minFriends !== undefined) out.minFriends = value.minFriends;
  if (value.minStreakDays !== undefined) out.minStreakDays = value.minStreakDays;
  if (value.categorySlug !== undefined) out.categorySlug = value.categorySlug;
  return out;
}

const USERS: SeedUser[] = [
  {
    email: 'admin@sidequest.dev',
    username: 'admin',
    password: 'AdminPass123!',
    displayName: 'SideQuest Admin',
    role: UserRole.ADMIN,
    bio: 'Keeps the Prague map honest.',
    avatarUrl: 'https://api.dicebear.com/8.x/thumbs/svg?seed=admin',
  },
  {
    email: 'wanderer@sidequest.dev',
    username: 'wanderer',
    password: 'UserPass123!',
    displayName: 'Prague Wanderer',
    role: UserRole.USER,
    bio: 'Sunset photos, hidden courtyards, and unreasonable amounts of trdelník.',
    avatarUrl: 'https://api.dicebear.com/8.x/thumbs/svg?seed=wanderer',
  },
  {
    email: 'foodie@sidequest.dev',
    username: 'foodie',
    password: 'UserPass123!',
    displayName: 'Foodie Explorer',
    role: UserRole.USER,
    bio: 'Café crawler. Specialty coffee snob.',
    avatarUrl: 'https://api.dicebear.com/8.x/thumbs/svg?seed=foodie',
  },
  {
    email: 'hiker@sidequest.dev',
    username: 'hiker',
    password: 'UserPass123!',
    displayName: 'Petřín Hiker',
    role: UserRole.USER,
    bio: 'If it has a viewpoint, I have already been there.',
    avatarUrl: 'https://api.dicebear.com/8.x/thumbs/svg?seed=hiker',
  },
  {
    email: 'cacher@sidequest.dev',
    username: 'cacher',
    password: 'UserPass123!',
    displayName: 'Geocacher',
    role: UserRole.USER,
    bio: 'Carries a flashlight, always.',
    avatarUrl: 'https://api.dicebear.com/8.x/thumbs/svg?seed=cacher',
  },
];

const CATEGORIES: SeedCategory[] = [
  {
    slug: 'viewpoints',
    name: 'Viewpoints',
    description: 'Climb high, breathe deep, look around.',
    colorHex: '#2D9CDB',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2519/2519393.png',
    coverImageUrl: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200',
  },
  {
    slug: 'parks',
    name: 'Parks & Gardens',
    description: 'Green pockets between cobblestones.',
    colorHex: '#27AE60',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2913/2913136.png',
    coverImageUrl: 'https://images.unsplash.com/photo-1572276596237-5db2c3e16c5d?w=1200',
  },
  {
    slug: 'cafes',
    name: 'Cafés & Bakeries',
    description: 'Slow mornings, specialty coffee, warm pastries.',
    colorHex: '#F2994A',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/924/924514.png',
    coverImageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200',
  },
  {
    slug: 'hidden',
    name: 'Hidden Places',
    description: 'Courtyards, alleys, and stories most tourists miss.',
    colorHex: '#7B2CBF',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2784/2784065.png',
    coverImageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1200',
  },
  {
    slug: 'geocache',
    name: 'Geocache',
    description: 'Tiny mysteries hidden in plain sight.',
    colorHex: '#EB5757',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    coverImageUrl: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1200',
  },
  {
    slug: 'history',
    name: 'History',
    description: 'A thousand years in walking distance.',
    colorHex: '#8B5E3C',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2942/2942035.png',
    coverImageUrl: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200',
  },
];

const QUESTS: SeedQuest[] = [
  // -------------------- Viewpoints --------------------
  {
    slug: 'petrin-summit',
    title: 'Petřín Summit',
    summary: 'Climb the green hill above the city and crown it with the lookout tower.',
    description:
      "Cross the river, hop on the funicular (or hike up if you're brave), and reach the top of Petřín Hill. Pause at the rose garden, then ascend the Petřín Lookout Tower — Prague's mini Eiffel — for the best panoramic view of the city.",
    difficulty: QuestDifficulty.MEDIUM,
    xpReward: 200,
    estimatedDurationMin: 90,
    categorySlug: 'viewpoints',
    imageUrl: 'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=1600',
    locations: [
      { name: 'Petřín Funicular - Újezd', latitude: 50.0817, longitude: 14.4047 },
      { name: 'Petřín Rose Garden', latitude: 50.0834, longitude: 14.397 },
      { name: 'Petřín Lookout Tower', latitude: 50.0837, longitude: 14.3954, radiusM: 80 },
    ],
  },
  {
    slug: 'vysehrad-skyline',
    title: 'Vyšehrad Skyline',
    summary: "Prague's other castle, with a view nobody talks about.",
    description:
      'Walk the ancient ramparts of Vyšehrad, peek inside the Basilica of Saints Peter and Paul, and finish at the cliffs overlooking the Vltava with the city stretching to the horizon.',
    difficulty: QuestDifficulty.EASY,
    xpReward: 120,
    estimatedDurationMin: 60,
    categorySlug: 'viewpoints',
    imageUrl: 'https://images.unsplash.com/photo-1601233749202-95d04d5b3c00?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1601233749202-95d04d5b3c00?w=1600',
    locations: [
      { name: 'Vyšehrad Gate', latitude: 50.0648, longitude: 14.4216 },
      { name: 'Basilica of Sts. Peter & Paul', latitude: 50.0641, longitude: 14.4187 },
      { name: 'Vyšehrad Cliffside Lookout', latitude: 50.0631, longitude: 14.4186 },
    ],
  },
  {
    slug: 'letna-beer-garden',
    title: 'Letná Beer Garden Sunset',
    summary: 'Beer, sunsets, and a postcard skyline.',
    description:
      'Climb to Letná Park, grab a beer at the open-air garden, and catch the sun setting behind Prague Castle from the metronome plateau.',
    difficulty: QuestDifficulty.EASY,
    xpReward: 100,
    estimatedDurationMin: 75,
    categorySlug: 'viewpoints',
    imageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1600',
    locations: [
      { name: 'Letná Beer Garden', latitude: 50.0945, longitude: 14.4174 },
      { name: 'Prague Metronome', latitude: 50.0922, longitude: 14.4163 },
    ],
  },
  {
    slug: 'riegrovy-sady-panorama',
    title: 'Riegrovy Sady Panorama',
    summary: 'The locals-only sunset spot.',
    description:
      'Wander up through Riegrovy Sady to the grassy slope where Praguers come to drink wine and watch the spires light up at dusk.',
    difficulty: QuestDifficulty.EASY,
    xpReward: 80,
    estimatedDurationMin: 45,
    categorySlug: 'viewpoints',
    imageUrl: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1600',
    locations: [{ name: 'Riegrovy Sady Hillside', latitude: 50.0795, longitude: 14.4439 }],
  },

  // -------------------- Parks & Gardens --------------------
  {
    slug: 'wallenstein-secrets',
    title: 'Wallenstein Garden Secrets',
    summary: 'A baroque palace garden hiding peacocks and a grotto.',
    description:
      "Step into Wallenstein Garden behind the Senate. Look for the artificial dripstone wall full of grotesque faces, the small aviary, and don't miss the peacocks on the lawn.",
    difficulty: QuestDifficulty.EASY,
    xpReward: 90,
    estimatedDurationMin: 40,
    categorySlug: 'parks',
    imageUrl: 'https://images.unsplash.com/photo-1572276596237-5db2c3e16c5d?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1572276596237-5db2c3e16c5d?w=1600',
    locations: [
      { name: 'Wallenstein Garden Entrance', latitude: 50.0904, longitude: 14.4053 },
      { name: 'Wallenstein Grotto Wall', latitude: 50.0908, longitude: 14.4055 },
    ],
  },
  {
    slug: 'kampa-island-loop',
    title: 'Kampa Island Loop',
    summary: 'A tiny island, a giant waterwheel, and the Lennon Wall.',
    description:
      "Cross to Kampa Island via Charles Bridge and trace the loop past the giant waterwheel, the Devil's Stream, and the ever-changing John Lennon Wall.",
    difficulty: QuestDifficulty.EASY,
    xpReward: 80,
    estimatedDurationMin: 45,
    categorySlug: 'parks',
    imageUrl: 'https://images.unsplash.com/photo-1530841344095-c7e6a2b1bdbf?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1530841344095-c7e6a2b1bdbf?w=1600',
    locations: [
      { name: 'Kampa Waterwheel', latitude: 50.0852, longitude: 14.4081 },
      { name: 'Lennon Wall', latitude: 50.0866, longitude: 14.4068 },
      { name: 'Kampa Park Lawn', latitude: 50.0838, longitude: 14.408 },
    ],
  },
  {
    slug: 'stromovka-stroll',
    title: 'Stromovka Royal Stroll',
    summary: "Prague's biggest park, once a royal hunting ground.",
    description:
      'Loop through Stromovka, the former royal hunting park: ponds, allées of old trees, and a quiet planetarium in the middle.',
    difficulty: QuestDifficulty.MEDIUM,
    xpReward: 140,
    estimatedDurationMin: 90,
    categorySlug: 'parks',
    imageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1600',
    locations: [
      { name: 'Stromovka North Pond', latitude: 50.1075, longitude: 14.4129 },
      { name: 'Stromovka Avenue', latitude: 50.1063, longitude: 14.4185 },
      { name: 'Planetárium Praha', latitude: 50.1054, longitude: 14.4253 },
    ],
  },

  // -------------------- Cafés --------------------
  {
    slug: 'specialty-coffee-crawl',
    title: 'Specialty Coffee Crawl',
    summary: "Three of Prague's best independent roasters in one walk.",
    description:
      'Start at EMA, slide to Kavárna Místo, finish at Café Letka. Try a single origin pour-over at each and rate them in the proof field.',
    difficulty: QuestDifficulty.EASY,
    xpReward: 110,
    estimatedDurationMin: 90,
    categorySlug: 'cafes',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600',
    locations: [
      { name: 'EMA Espresso Bar', latitude: 50.0856, longitude: 14.4326 },
      { name: 'Kavárna Místo', latitude: 50.1043, longitude: 14.4234 },
      { name: 'Café Letka', latitude: 50.0989, longitude: 14.4378 },
    ],
  },
  {
    slug: 'art-nouveau-cafe-tour',
    title: 'Art Nouveau Café Tour',
    summary: 'Crystal chandeliers, marble tables, time-travel vibes.',
    description:
      'Visit three legendary art-nouveau cafés: Café Imperial, Café Louvre, and Grand Café Orient — the cubist one above the House of the Black Madonna.',
    difficulty: QuestDifficulty.MEDIUM,
    xpReward: 180,
    estimatedDurationMin: 120,
    categorySlug: 'cafes',
    imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1600',
    locations: [
      { name: 'Café Imperial', latitude: 50.0884, longitude: 14.4308 },
      { name: 'Café Louvre', latitude: 50.0824, longitude: 14.4178 },
      { name: 'Grand Café Orient', latitude: 50.0876, longitude: 14.4254 },
    ],
  },
  {
    slug: 'trdelnik-trail',
    title: 'Trdelník Trail',
    summary: 'Find the best chimney cake in the Old Town.',
    description:
      "Visit three iconic trdelník stalls between Old Town Square and Charles Bridge. Rate each one — you'll know the winner.",
    difficulty: QuestDifficulty.EASY,
    xpReward: 60,
    estimatedDurationMin: 45,
    categorySlug: 'cafes',
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=1600',
    locations: [
      { name: 'Trdelník Old Town A', latitude: 50.0866, longitude: 14.4193 },
      { name: 'Trdelník Old Town B', latitude: 50.0858, longitude: 14.4173 },
      { name: 'Trdelník near Charles Bridge', latitude: 50.0866, longitude: 14.4124 },
    ],
  },

  // -------------------- Hidden Places --------------------
  {
    slug: 'narrowest-street',
    title: 'The Narrowest Street',
    summary: 'A street with its own traffic light.',
    description:
      "Find Vinárna Čertovka — a passage so narrow it has pedestrian traffic lights at both ends. You'll need to wait your turn.",
    difficulty: QuestDifficulty.EASY,
    xpReward: 70,
    estimatedDurationMin: 20,
    categorySlug: 'hidden',
    imageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1600',
    locations: [
      { name: 'Vinárna Čertovka Alley', latitude: 50.0866, longitude: 14.4082, radiusM: 25 },
    ],
  },
  {
    slug: 'speculum-alchemiae',
    title: 'Speculum Alchemiae',
    summary: "An alchemist's lab found by accident under a Jewish Quarter cellar.",
    description:
      "Discovered after the 2002 floods, this hidden alchemy lab from Rudolf II's era is one of Prague's strangest museums. Tucked beneath a former pharmacy.",
    difficulty: QuestDifficulty.MEDIUM,
    xpReward: 150,
    estimatedDurationMin: 40,
    categorySlug: 'hidden',
    imageUrl: 'https://images.unsplash.com/photo-1577083553180-3d2c0ad6f835?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1577083553180-3d2c0ad6f835?w=1600',
    locations: [{ name: 'Speculum Alchemiae', latitude: 50.0916, longitude: 14.4188 }],
  },
  {
    slug: 'kafka-rotating-head',
    title: 'The Rotating Kafka Head',
    summary: 'A surreal sculpture that keeps reassembling itself.',
    description:
      "David Černý's 11-meter mirrored sculpture of Kafka's head rotates in slow motion, breaking and reforming his face. Outside the Quadrio shopping centre.",
    difficulty: QuestDifficulty.EASY,
    xpReward: 60,
    estimatedDurationMin: 20,
    categorySlug: 'hidden',
    imageUrl: 'https://images.unsplash.com/photo-1605108042842-7b6a52a07b8d?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1605108042842-7b6a52a07b8d?w=1600',
    locations: [{ name: "Černý's Rotating Kafka Head", latitude: 50.0826, longitude: 14.4222 }],
  },
  {
    slug: 'wallenstein-owl',
    title: 'The Wallenstein Owl',
    summary: 'A tiny detail almost nobody notices.',
    description:
      "On a wall of Wallenstein Palace you'll find a stone owl, easy to miss. Locals swear it watches everyone who crosses the courtyard.",
    difficulty: QuestDifficulty.HARD,
    xpReward: 220,
    estimatedDurationMin: 30,
    categorySlug: 'hidden',
    imageUrl: 'https://images.unsplash.com/photo-1499415479124-43c32433a620?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1499415479124-43c32433a620?w=1600',
    locations: [
      { name: 'Wallenstein Palace Courtyard', latitude: 50.0903, longitude: 14.4059, radiusM: 30 },
    ],
  },

  // -------------------- Geocache --------------------
  {
    slug: 'cache-old-town-cellar',
    title: 'Geocache: Old Town Cellar Whispers',
    summary: 'A magnetic micro-cache tucked near a medieval cellar window.',
    description:
      "Find the magnetic nano cache attached behind a metal cellar grate on Týnská street. Coordinates accurate to within 5m. Bring a flashlight; don't disturb the locals.",
    difficulty: QuestDifficulty.HARD,
    xpReward: 250,
    estimatedDurationMin: 30,
    categorySlug: 'geocache',
    imageUrl: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1600',
    locations: [
      { name: 'Týnská Cellar Cache', latitude: 50.0881, longitude: 14.4236, radiusM: 15 },
    ],
  },
  {
    slug: 'cache-vysehrad-cliff',
    title: 'Geocache: Vyšehrad Cliff Edge',
    summary: 'A tougher one — the cache hangs off a cliff bench.',
    description:
      "Below the Vyšehrad cliff lookout there's a small bench. The cache is taped under a specific slat. Don't lean over the railing.",
    difficulty: QuestDifficulty.HARD,
    xpReward: 220,
    estimatedDurationMin: 40,
    categorySlug: 'geocache',
    imageUrl: 'https://images.unsplash.com/photo-1601233749202-95d04d5b3c00?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1601233749202-95d04d5b3c00?w=1600',
    locations: [
      { name: 'Vyšehrad Cliff Cache', latitude: 50.0628, longitude: 14.419, radiusM: 20 },
    ],
  },
  {
    slug: 'cache-letna-shipping-pin',
    title: 'Geocache: Letná Hidden Pin',
    summary: 'Pin-sized cache on a Letná park lamppost.',
    description:
      'A magnetic capsule attached to a specific lamppost behind the Hanavský Pavilion. Logbook is rolled inside — bring your own pen.',
    difficulty: QuestDifficulty.MEDIUM,
    xpReward: 150,
    estimatedDurationMin: 30,
    categorySlug: 'geocache',
    imageUrl: 'https://images.unsplash.com/photo-1496718650817-d83f06bdc1f7?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1496718650817-d83f06bdc1f7?w=1600',
    locations: [
      { name: 'Hanavský Pavilion Lamp', latitude: 50.0951, longitude: 14.4135, radiusM: 25 },
    ],
  },
  {
    slug: 'cache-zizkov-rabbit-hole',
    title: 'Geocache: Žižkov Rabbit Hole',
    summary: 'A urban geocache near the Žižkov TV tower.',
    description:
      "Three steps from the TV tower's eastern pillar — under the cobblestone bench. EPIC difficulty because of the foot traffic; muggle stealth required.",
    difficulty: QuestDifficulty.EPIC,
    xpReward: 350,
    estimatedDurationMin: 45,
    categorySlug: 'geocache',
    imageUrl: 'https://images.unsplash.com/photo-1604588832412-fa46f5b54df7?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1604588832412-fa46f5b54df7?w=1600',
    locations: [
      { name: 'Žižkov TV Tower East', latitude: 50.0808, longitude: 14.4406, radiusM: 20 },
    ],
  },

  // -------------------- History --------------------
  {
    slug: 'old-town-square-mysteries',
    title: 'Old Town Square Mysteries',
    summary: '1000 years of Prague history in 4 stops.',
    description:
      'Start at the Astronomical Clock, decode the symbols, then visit Týn Church, the Old Town Hall, and finally the Jan Hus monument. Read each plaque carefully.',
    difficulty: QuestDifficulty.EASY,
    xpReward: 130,
    estimatedDurationMin: 60,
    categorySlug: 'history',
    imageUrl: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=1600',
    locations: [
      { name: 'Astronomical Clock', latitude: 50.087, longitude: 14.4208 },
      { name: 'Týn Church', latitude: 50.0879, longitude: 14.4222 },
      { name: 'Old Town Hall', latitude: 50.0872, longitude: 14.4205 },
      { name: 'Jan Hus Monument', latitude: 50.0876, longitude: 14.4213 },
    ],
  },
  {
    slug: 'prague-castle-circuit',
    title: 'Prague Castle Circuit',
    summary: 'The largest ancient castle complex in the world.',
    description:
      'Cross the Charles Bridge, ascend to Prague Castle, and walk the full perimeter: St. Vitus Cathedral, Golden Lane, the Royal Garden, and the South Gardens.',
    difficulty: QuestDifficulty.HARD,
    xpReward: 320,
    estimatedDurationMin: 180,
    categorySlug: 'history',
    imageUrl: 'https://images.unsplash.com/photo-1542856204-00101eb6def4?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1542856204-00101eb6def4?w=1600',
    locations: [
      { name: 'Charles Bridge', latitude: 50.0865, longitude: 14.4114 },
      { name: 'St. Vitus Cathedral', latitude: 50.0905, longitude: 14.4008 },
      { name: 'Golden Lane', latitude: 50.0917, longitude: 14.4039 },
      { name: 'Castle South Gardens', latitude: 50.0894, longitude: 14.402 },
    ],
  },
  {
    slug: 'jewish-quarter-walk',
    title: 'Jewish Quarter Walk',
    summary: 'Six synagogues and the old cemetery in one route.',
    description:
      'Walk Josefov: start at the Old-New Synagogue, then the Jewish Town Hall, Pinkas, Klausen, Spanish, and the Old Jewish Cemetery.',
    difficulty: QuestDifficulty.MEDIUM,
    xpReward: 200,
    estimatedDurationMin: 120,
    categorySlug: 'history',
    imageUrl: 'https://images.unsplash.com/photo-1577083553180-3d2c0ad6f835?w=800',
    coverImageUrl: 'https://images.unsplash.com/photo-1577083553180-3d2c0ad6f835?w=1600',
    locations: [
      { name: 'Old-New Synagogue', latitude: 50.0902, longitude: 14.4185 },
      { name: 'Jewish Town Hall', latitude: 50.0903, longitude: 14.4179 },
      { name: 'Old Jewish Cemetery', latitude: 50.0892, longitude: 14.4179 },
      { name: 'Spanish Synagogue', latitude: 50.0901, longitude: 14.4216 },
    ],
  },
];

const ACHIEVEMENTS: SeedAchievement[] = [
  {
    slug: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first quest.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2583/2583344.png',
    type: AchievementType.QUEST_COUNT,
    criteria: { minQuests: 1 },
    xpBonus: 50,
  },
  {
    slug: 'explorer-novice',
    name: 'Novice Explorer',
    description: 'Complete 5 quests.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2583/2583319.png',
    type: AchievementType.QUEST_COUNT,
    criteria: { minQuests: 5 },
    xpBonus: 150,
  },
  {
    slug: 'explorer-adept',
    name: 'Adept Explorer',
    description: 'Complete 15 quests.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2583/2583373.png',
    type: AchievementType.QUEST_COUNT,
    criteria: { minQuests: 15 },
    xpBonus: 300,
  },
  {
    slug: 'explorer-veteran',
    name: 'Veteran Explorer',
    description: 'Complete 25 quests.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2583/2583370.png',
    type: AchievementType.QUEST_COUNT,
    criteria: { minQuests: 25 },
    xpBonus: 600,
  },
  {
    slug: 'rising-hero',
    name: 'Rising Hero',
    description: 'Reach Level 5.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2583/2583361.png',
    type: AchievementType.XP_THRESHOLD,
    criteria: { minLevel: 5 },
    xpBonus: 200,
  },
  {
    slug: 'legend-of-prague',
    name: 'Legend of Prague',
    description: 'Reach Level 10.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2583/2583365.png',
    type: AchievementType.XP_THRESHOLD,
    criteria: { minLevel: 10 },
    xpBonus: 500,
  },
  {
    slug: 'view-collector',
    name: 'View Collector',
    description: 'Complete 3 Viewpoint quests.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2519/2519393.png',
    type: AchievementType.CATEGORY_EXPLORER,
    criteria: { categorySlug: 'viewpoints', minQuests: 3 },
    xpBonus: 200,
  },
  {
    slug: 'caffeine-connoisseur',
    name: 'Caffeine Connoisseur',
    description: 'Complete 3 Café quests.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/924/924514.png',
    type: AchievementType.CATEGORY_EXPLORER,
    criteria: { categorySlug: 'cafes', minQuests: 3 },
    xpBonus: 200,
  },
  {
    slug: 'urban-archaeologist',
    name: 'Urban Archaeologist',
    description: 'Complete 3 Hidden Places quests.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2784/2784065.png',
    type: AchievementType.CATEGORY_EXPLORER,
    criteria: { categorySlug: 'hidden', minQuests: 3 },
    xpBonus: 250,
  },
  {
    slug: 'cache-hunter',
    name: 'Cache Hunter',
    description: 'Crack 3 Geocaches.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    type: AchievementType.CATEGORY_EXPLORER,
    criteria: { categorySlug: 'geocache', minQuests: 3 },
    xpBonus: 350,
  },
  {
    slug: 'cartographer',
    name: 'Cartographer',
    description: 'Visit 25 distinct quest locations.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684809.png',
    type: AchievementType.LOCATION_VISITS,
    criteria: { minLocations: 25 },
    xpBonus: 400,
  },
  {
    slug: 'social-butterfly',
    name: 'Social Butterfly',
    description: 'Make 3 friends.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/921/921347.png',
    type: AchievementType.SOCIAL,
    criteria: { minFriends: 3 },
    xpBonus: 150,
  },
  {
    slug: 'inner-circle',
    name: 'Inner Circle',
    description: 'Make 10 friends.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/921/921120.png',
    type: AchievementType.SOCIAL,
    criteria: { minFriends: 10 },
    xpBonus: 350,
  },
  {
    slug: 'streak-three',
    name: 'On a Roll',
    description: 'Maintain a 3-day quest streak.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/785/785116.png',
    type: AchievementType.STREAK,
    criteria: { minStreakDays: 3 },
    xpBonus: 150,
  },
  {
    slug: 'streak-seven',
    name: 'Unstoppable',
    description: 'Maintain a 7-day quest streak.',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/785/785116.png',
    type: AchievementType.STREAK,
    criteria: { minStreakDays: 7 },
    xpBonus: 400,
  },
];

async function seedUsers(): Promise<Map<string, string>> {
  const idByEmail = new Map<string, string>();
  for (const u of USERS) {
    const passwordHash = await argon2.hash(u.password);
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        displayName: u.displayName,
        bio: u.bio,
        avatarUrl: u.avatarUrl,
        role: u.role,
      },
      create: {
        email: u.email,
        username: u.username,
        passwordHash,
        displayName: u.displayName,
        bio: u.bio,
        avatarUrl: u.avatarUrl,
        role: u.role,
      },
    });
    idByEmail.set(u.email, row.id);
  }
  return idByEmail;
}

async function seedCategories(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.questCategory.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        colorHex: c.colorHex,
        iconUrl: c.iconUrl,
        coverImageUrl: c.coverImageUrl,
      },
      create: c,
    });
    idBySlug.set(c.slug, row.id);
  }
  return idBySlug;
}

async function seedQuests(authorId: string, categoryIdBySlug: Map<string, string>): Promise<void> {
  for (const q of QUESTS) {
    const categoryId = categoryIdBySlug.get(q.categorySlug);
    if (!categoryId) throw new Error(`Missing category ${q.categorySlug} for quest ${q.slug}`);

    await prisma.quest.upsert({
      where: { slug: q.slug },
      update: {
        title: q.title,
        summary: q.summary,
        description: q.description,
        difficulty: q.difficulty,
        xpReward: q.xpReward,
        estimatedDurationMin: q.estimatedDurationMin,
        imageUrl: q.imageUrl,
        coverImageUrl: q.coverImageUrl,
        status: QuestStatus.PUBLISHED,
        category: { connect: { id: categoryId } },
      },
      create: {
        slug: q.slug,
        title: q.title,
        summary: q.summary,
        description: q.description,
        difficulty: q.difficulty,
        xpReward: q.xpReward,
        estimatedDurationMin: q.estimatedDurationMin,
        imageUrl: q.imageUrl,
        coverImageUrl: q.coverImageUrl,
        status: QuestStatus.PUBLISHED,
        publishedAt: new Date(),
        author: { connect: { id: authorId } },
        category: { connect: { id: categoryId } },
        locations: {
          create: q.locations.map((loc, idx) => ({
            name: loc.name,
            address: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude,
            radiusM: loc.radiusM ?? 50,
            orderIndex: idx,
          })),
        },
      },
    });
  }
}

async function seedAchievements(): Promise<void> {
  for (const a of ACHIEVEMENTS) {
    const criteria = toJsonInput(a.criteria);
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      update: {
        name: a.name,
        description: a.description,
        iconUrl: a.iconUrl,
        type: a.type,
        criteria,
        xpBonus: a.xpBonus,
      },
      create: {
        slug: a.slug,
        name: a.name,
        description: a.description,
        iconUrl: a.iconUrl,
        type: a.type,
        criteria,
        xpBonus: a.xpBonus,
      },
    });
  }
}

async function seedFriendships(idByEmail: Map<string, string>): Promise<void> {
  const wanderer = idByEmail.get('wanderer@sidequest.dev');
  const foodie = idByEmail.get('foodie@sidequest.dev');
  const hiker = idByEmail.get('hiker@sidequest.dev');
  const cacher = idByEmail.get('cacher@sidequest.dev');
  if (!wanderer || !foodie || !hiker || !cacher) return;

  const pairs: Array<{ a: string; b: string; status: 'ACCEPTED' | 'PENDING' }> = [
    { a: wanderer, b: foodie, status: 'ACCEPTED' },
    { a: wanderer, b: hiker, status: 'ACCEPTED' },
    { a: foodie, b: hiker, status: 'ACCEPTED' },
    { a: cacher, b: wanderer, status: 'PENDING' },
  ];

  for (const p of pairs) {
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: p.a, addresseeId: p.b },
          { requesterId: p.b, addresseeId: p.a },
        ],
      },
    });
    if (existing) continue;
    await prisma.friendship.create({
      data: {
        requesterId: p.a,
        addresseeId: p.b,
        status: p.status,
        respondedAt: p.status === 'ACCEPTED' ? new Date() : null,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log('Seeding SideQuest database...');
  try {
    const userIdByEmail = await seedUsers();
    const adminId = userIdByEmail.get('admin@sidequest.dev');
    if (!adminId) throw new Error('Admin user not seeded');

    const categoryIdBySlug = await seedCategories();
    await seedQuests(adminId, categoryIdBySlug);
    await seedAchievements();
    await seedFriendships(userIdByEmail);

    console.log(
      `Seed complete: ${USERS.length} users, ${CATEGORIES.length} categories, ` +
        `${QUESTS.length} quests, ${ACHIEVEMENTS.length} achievements.`,
    );
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
