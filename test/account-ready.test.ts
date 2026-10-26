jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
import { sqlite } from './helpers/sqlite';
import { migrate } from '@/db/migrations';
import { scopedDatabase, selectStorageScope } from '@/db/scope';
import { accountReady, markAccountReady } from '@/data/accountReady';
it('requires completed restore, hydration and verified imports for the same incarnation', async () => {
  const { db, close } = sqlite();
  const scope = 'account:one';
  selectStorageScope(scope);
  try {
    await migrate(db);
    await db.runAsync('INSERT INTO data_scopes(scope) VALUES (?)', scope);
    const account = scopedDatabase(db, scope);
    expect(await accountReady(account, () => true)).toBe(false);
    await markAccountReady(account, () => true);
    expect(await accountReady(account, () => true)).toBe(false);
    await db.runAsync('UPDATE data_scopes SET hydrated_at=123 WHERE scope=?', scope);
    expect(await accountReady(account, () => true)).toBe(true);
    await db.runAsync(
      'INSERT INTO guest_imports(source_scope,target_scope) VALUES (?,?)',
      'guest:one',
      scope,
    );
    expect(await accountReady(account, () => true)).toBe(false);
    await db.runAsync("UPDATE guest_imports SET state='verified'");
    expect(await accountReady(account, () => true)).toBe(true);
    selectStorageScope('account:two');
    expect(await accountReady(scopedDatabase(db, 'account:two'), () => true)).toBe(false);
    await expect(markAccountReady(account, () => false)).rejects.toThrow('cancelled');
  } finally {
    close();
    selectStorageScope('legacy');
  }
});
