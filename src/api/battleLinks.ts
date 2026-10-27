import { z } from 'zod';
export const BattleInvitePreviewSchema = z.object({
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/),
  inviterName: z.string(),
  inviterUserId: z.string(),
  isSelf: z.boolean(),
  expiresAt: z.iso.datetime(),
});
export type BattleInvitePreview = z.infer<typeof BattleInvitePreviewSchema>;
