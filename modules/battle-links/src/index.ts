import { requireOptionalNativeModule } from 'expo';
const native = requireOptionalNativeModule<{ installReferrer(): Promise<string | null> }>(
  'BattleLinks',
);
export const installReferrer = () => native?.installReferrer() ?? Promise.resolve(null);

export const installReferrerSupported = () => native !== null;
