import { z } from 'zod';
export const BattleInvitePreviewSchema = z.object({
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/),
  isSelf: z.boolean(),
  expiresAt: z.iso.datetime(),
});
export type BattleInvitePreview = z.infer<typeof BattleInvitePreviewSchema>;
