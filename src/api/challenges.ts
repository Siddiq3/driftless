import { z } from 'zod';
import { v1 } from '@siddiq3/driftless-contracts';

// Explicit additive bridge until the battle additions are published in the shared package.
export const BattleCreate = v1.ChallengeCreate.safeExtend({
  targetUserId: z.uuid().optional(),
  operationId: z.uuid().optional(),
  scoreConsent: z.literal(true).optional(),
}).refine(
  (c) =>
    !c.targetUserId || (c.maxMembers === 2 && Boolean(c.operationId) && c.scoreConsent === true),
  {
    message: 'Direct battles require two places, an operation ID and battle-only score consent',
    path: ['targetUserId'],
  },
);
const LeaderboardCount = z.intersection(
  v1.DailyFriendCount,
  z.object({ experimental: z.boolean().optional() }),
);
export const LeaderboardResponse = v1.FriendsDailyResponse.extend({
  self: LeaderboardCount,
  friends: z.array(v1.Friend.extend({ daily: LeaderboardCount })),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponse>;
export const BattleSummary = v1.ChallengeSummary.extend({
  ownerId: z.string().nullable(),
  targetUserId: z.uuid().optional(),
  invitationState: z
    .enum(['pending', 'accepted', 'declined', 'cancelled', 'expired', 'unavailable'])
    .optional(),
  ownerName: z.string().nullable().optional(),
  myScoreConsent: z.boolean().optional(),
});
export const BattleList = z.object({
  challenges: z.array(BattleSummary),
  invitations: z.array(BattleSummary).optional(),
});
export const BattleLeaderboard = v1.LeaderboardResponse.extend({
  participants: z
    .array(
      z.object({
        userId: z.string(),
        handle: z.string().nullable(),
        status: z.enum([
          'ready',
          'no_data',
          'sharing_off',
          'expired',
          'unavailable',
          'awaiting_opponent',
        ]),
        availableDays: z.int().min(0),
        expectedDays: z.int().min(0),
      }),
    )
    .max(50)
    .optional(),
});
export type Battle = z.infer<typeof BattleSummary>;
