/**
 * Strongly-typed domain event names.
 * Keep the surface intentional - cross-module side effects flow through these.
 */
export const AppEvents = {
  UserRegistered: 'user.registered',
  QuestStarted: 'quest.started',
  QuestCompleted: 'quest.completed',
  AchievementUnlocked: 'achievement.unlocked',
  FriendRequestSent: 'friend.request.sent',
  FriendRequestAccepted: 'friend.request.accepted',
} as const;

export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  username: string;
}

export interface QuestStartedEvent {
  userId: string;
  questId: string;
}

export interface QuestCompletedEvent {
  userId: string;
  questId: string;
  xpAwarded: number;
  completedAt: Date;
}

export interface AchievementUnlockedEvent {
  userId: string;
  achievementId: string;
  achievementSlug: string;
}

export interface FriendRequestSentEvent {
  requesterId: string;
  addresseeId: string;
}

export interface FriendRequestAcceptedEvent {
  requesterId: string;
  addresseeId: string;
}
