/**
 * Strongly-typed domain event names.
 * Keep the surface intentional - cross-module side effects flow through these.
 */
export const AppEvents = {
  UserRegistered: 'user.registered',
  QuestStarted: 'quest.started',
  /** Emitted after a new waypoint check-in is persisted (not duplicate visits). */
  QuestLocationCheckedIn: 'quest.location.checked_in',
  QuestCompleted: 'quest.completed',
  AchievementUnlocked: 'achievement.unlocked',
  FriendRequestSent: 'friend.request.sent',
  FriendRequestAccepted: 'friend.request.accepted',
  /** Emitted when a user crosses a level boundary (quest XP, achievement XP, etc.). */
  LevelUp: 'user.level.up',
  /**
   * Reserved for business-owned quest moderation: emit from the businesses/moderation flow
   * when a draft quest becomes visible to the owner (not wired in MVP).
   */
  BusinessQuestApproved: 'business.quest.approved',
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

export interface QuestLocationCheckedInEvent {
  userId: string;
  questId: string;
  locationId: string;
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
  friendshipId: string;
}

export interface FriendRequestAcceptedEvent {
  requesterId: string;
  addresseeId: string;
  friendshipId: string;
}

export interface LevelUpEvent {
  userId: string;
  previousLevel: number;
  newLevel: number;
}

export interface BusinessQuestApprovedEvent {
  userId: string;
  questId: string;
}
