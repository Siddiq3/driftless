import { openDatabaseSync } from 'expo-sqlite';
import { createIOSTracking } from './iosAdapter';
import { ScreenTime } from '../../screen-time/src';
export type * from './types';

let database: ReturnType<typeof openDatabaseSync> | undefined;
function stateDb() {
  if (!database) {
    const opened = openDatabaseSync('scrollsnooze-ios-state.db');
    opened.execSync('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    database = opened;
  }
  return database;
}
export const Tracking = createIOSTracking(
  {
    get: (key) =>
      stateDb().getFirstSync<{ value: string }>('SELECT value FROM state WHERE key=?', key)
        ?.value ?? null,
    set: (key, value) => {
      stateDb().runSync('INSERT OR REPLACE INTO state VALUES (?,?)', key, value);
    },
  },
  {
    selectScope: (scope) => ScreenTime.selectScope(scope),
    reset: () => ScreenTime.reset(),
  },
);
