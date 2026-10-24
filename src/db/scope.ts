import type { SQLiteDatabase } from 'expo-sqlite';
let active = 'legacy';
let revision = 0;
const listeners = new Set<() => void>();
export const storageScope = () => active;
export const storageGeneration = () => revision;
export const scopeOf = (db: SQLiteDatabase): string =>
  (db as SQLiteDatabase & { storageScope?: string }).storageScope ?? 'legacy';
export function publishLocalChange() {
  revision++;
  for (const fn of listeners) fn();
}
export function selectStorageScope(scope: string) {
  if (scope !== active) {
    active = scope;
    publishLocalChange();
  }
}
export function observeStorage(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function scopedDatabase(db: SQLiteDatabase, scope: string): SQLiteDatabase {
  const check = () => {
    if (storageScope() !== scope)
      throw new Error('The local account changed. Retry in the current account.');
  };
  return new Proxy(db, {
    get(target, key) {
      if (key === 'storageScope') return scope;
      if (key === 'withExclusiveTransactionAsync')
        return async (fn: (tx: SQLiteDatabase) => Promise<void>) => {
          check();
          return target.withExclusiveTransactionAsync(async (tx) => {
            check();
            await fn(scopedDatabase(tx, scope));
            check();
          });
        };
      const value = Reflect.get(target, key);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        check();
        const result = await value.apply(target, args);
        check();
        return result;
      };
    },
  });
}
