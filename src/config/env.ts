import Constants from 'expo-constants';
import { z } from 'zod';

const EnvSchema = z.object({
  apiUrl: z.url().startsWith('https://'),
  googleWebClientId: z.string().regex(/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/),
});
export type Env = z.infer<typeof EnvSchema>;

/** Returns null until the backend has been deployed and configured (no deploy in Phase 1). */
export function readEnv(): Env | null {
  const r = EnvSchema.safeParse(Constants.expoConfig?.extra ?? {});
  return r.success ? r.data : null;
}

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
