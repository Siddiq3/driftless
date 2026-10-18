import { MIGRATIONS, migrate, type Migration, type SqlDb } from '../src/db/migrations';

function fakeDb(start = 0, failOn?: string) {
  let version = start;
  const executed: string[] = [];
  const db: SqlDb = {
    async execAsync(sql) {
      if (failOn && sql.includes(failOn)) throw new Error('boom');
      const m = /PRAGMA user_version = (\d+)/.exec(sql);
      if (m) version = Number(m[1]);
      executed.push(sql.trim());
    },
    async getFirstAsync<T>() {
      return { user_version: version } as T;
    },
    async withExclusiveTransactionAsync(fn) {
      const before = version;
      const n = executed.length;
      try {
        await fn(db);
      } catch (e) {
        version = before; // rollback
        executed.length = n;
        throw e;
      }
    },
  };
  return { db, executed, version: () => version };
}

const m = (version: number, sql = `SELECT ${version}`): Migration => ({
  version,
  name: `m${version}`,
  sql,
});

describe('migrate', () => {
  it('applies the real schema from an empty database', async () => {
    const f = fakeDb();
    expect(await migrate(f.db)).toEqual(MIGRATIONS.map((x) => x.version));
    expect(f.version()).toBe(MIGRATIONS.length);
    expect(f.executed.join('\n')).toContain('CREATE TABLE IF NOT EXISTS outbox');
  });

  it('is a no-op when up to date', async () => {
    const f = fakeDb(2);
    expect(await migrate(f.db, [m(1), m(2)])).toEqual([]);
  });

  it('applies only pending migrations, in order', async () => {
    const f = fakeDb(1);
    expect(await migrate(f.db, [m(3), m(1), m(2)])).toEqual([2, 3]);
    expect(f.version()).toBe(3);
  });

  it('rolls back a failing migration and leaves the version unchanged', async () => {
    const f = fakeDb(0, 'BAD');
    await expect(migrate(f.db, [m(1), m(2, 'BAD')])).rejects.toThrow('boom');
    expect(f.version()).toBe(1);
  });

  it('refuses to downgrade', async () => {
    await expect(migrate(fakeDb(5).db, [m(1)])).rejects.toThrow(/newer/);
  });

  it('rejects gaps in version numbers', async () => {
    await expect(migrate(fakeDb().db, [m(1), m(3)])).rejects.toThrow(/contiguous/);
  });

  it('schema stores no raw observation text (privacy)', () => {
    const sql = MIGRATIONS.map((x) => x.sql)
      .join('\n')
      .toLowerCase();
    for (const forbidden of ['node_text', 'content_description', 'screenshot', 'caption', 'url']) {
      expect(sql).not.toContain(forbidden);
    }
  });
});
