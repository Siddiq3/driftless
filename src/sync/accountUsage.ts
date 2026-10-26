import { Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Tracking } from 'tracking-android';
import { getDb } from '@/db';
import { scopeOf, storageScope, publishLocalChange } from '@/db/scope';
import type { UsageResponse } from '@/api/accountUsage';
import type { ApiClient } from '@/api/client';
import { deviceId } from './sqliteRepo';
import { loadBlocking } from '@/billing/blocking';

const setting = (name: string, scope: string) => `account_usage:${scope}:${name}`;
export async function installAccountUsage(
  response: UsageResponse,
  incarnation: string,
  allowed: () => boolean,
) {
  const scope = `account:${incarnation}`;
  if (!allowed() || storageScope() !== scope || response.policy?.incarnation !== incarnation)
    throw new Error('Account usage synchronization cancelled');
  const db = await getDb();
  Tracking.installAccountUsage(JSON.stringify(response), scope);
  await db.runAsync(
    'INSERT OR REPLACE INTO settings VALUES (?,?)',
    setting('policy', scope),
    JSON.stringify(response),
  );
  if (!allowed()) throw new Error('Account usage synchronization cancelled');
  publishLocalChange();
}
const stable = (limits: Record<string, number>) =>
  JSON.stringify(Object.fromEntries(Object.entries(limits).sort(([a], [b]) => a.localeCompare(b))));

/** Foreground coordinator only. Accounting batches/receipts survive display reset and retain
 * their original incarnation, period, payload and operation key until acknowledged. */
export async function syncAccountUsage(api: ApiClient, allowed: () => boolean): Promise<string> {
  const db = await getDb(),
    scope = scopeOf(db),
    incarnation = api.incarnation;
  if (!incarnation || scope !== `account:${incarnation}`)
    throw new Error('Account usage scope mismatch');
  const check = () => {
    if (!allowed() || storageScope() !== scope)
      throw new Error('Account usage synchronization cancelled');
  };
  const read = async (name: string) =>
    (
      await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key=?',
        setting(name, scope),
      )
    )?.value;
  const save = async (name: string, value: string) => {
    check();
    await db.runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', setting(name, scope), value);
    check();
  };
  const clear = async (name: string) => {
    check();
    await db.runAsync('DELETE FROM settings WHERE key=?', setting(name, scope));
    check();
  };
  const device = await deviceId(db, randomUUID);
  check();
  Tracking.setSourceDevice(device);
  let response = await api.getAccountUsage(allowed);
  check();
  if (!response.policy)
    throw new Error('Confirm your fixed account timezone before backing up account usage');
  // Screen Time data stays on iPhone. Do not reserve Android accounting credit or
  // rewrite an account's shared limits from this device's Screen Time preferences.
  if (Platform.OS === 'ios')
    return 'iPhone Screen Time activity stays on this device; Android account limits do not apply here.';
  const registered = Number(await read('registered_at'));
  if (
    !registered ||
    response.serverTimeMs - registered >= 86400000 ||
    response.serverTimeMs < registered
  ) {
    await api.registerDevice(device);
    check();
    await save('registered_at', String(response.serverTimeMs));
  }
  await installAccountUsage(response, incarnation, allowed);
  const { goals } = await api.getGoals(allowed);
  check();
  const local: Record<string, number> = {};
  for (const goal of goals.filter((g) => g.enabled)) {
    const value = goal.dailyLimit * (goal.metric === 'minutes' ? 60000 : 1);
    local[goal.metric] = Math.min(local[goal.metric] ?? Infinity, value);
  }
  const dirty = await read('limits_dirty');
  const plans = response.policy.policies;
  const pending = plans[plans.length - 1]?.limits ?? {};
  if (dirty) {
    const config = await loadBlocking(db);
    if (config.enabled && config.dailyMinutes)
      for (const pkg of config.apps) local[`minutes:${pkg}`] = config.dailyMinutes * 60000;
  } else for (const [k, v] of Object.entries(pending)) if (k.includes(':')) local[k] = v;
  const signature = stable(local);
  if (signature !== stable(pending)) {
    response = await api.configureAccountUsage(
      { tz: response.policy.tz, limits: local, expectedRev: response.policy.rev },
      allowed,
    );
    check();
    await installAccountUsage(response, incarnation, allowed);
  }
  if (dirty && (await read('limits_dirty')) === dirty) await clear('limits_dirty');
  Tracking.refreshUsage(7);
  let frozen = await read('batch');
  if (!frozen) {
    const contributions = Tracking.accountUsageContributions(device);
    if (contributions.length) {
      frozen = JSON.stringify({ key: randomUUID(), body: { contributions } });
      await save('batch', frozen);
    }
  }
  if (frozen) {
    const batch = JSON.parse(frozen);
    const accepted = await api
      .reconcileAccountUsage(batch.body, batch.key, allowed)
      .catch(async (error) => {
        if (error?.code === 'device_not_registered') await clear('registered_at');
        throw error;
      });
    check();
    for (const sent of batch.body.contributions) {
      const result = accepted.results.find(
        (r) => r.periodId === sent.periodId && r.deviceId === sent.deviceId,
      );
      if (result && result.rev >= sent.rev) Tracking.ackAccountUsage(sent.localDate, sent.rev);
    }
    if (
      batch.body.contributions.every((sent: { periodId: string; deviceId: string; rev: number }) =>
        accepted.results.some(
          (r) => r.periodId === sent.periodId && r.deviceId === sent.deviceId && r.rev >= sent.rev,
        ),
      )
    )
      await clear('batch');
    response = await api.getAccountUsage(allowed);
    check();
    await installAccountUsage(response, incarnation, allowed);
  }
  let reservation = await read('reservation');
  const snapshot = response.snapshot;
  if (snapshot) {
    // Old period requests stay frozen but can never be issued against this period's allowance.
    if (reservation && JSON.parse(reservation).periodId !== snapshot.periodId) {
      await clear('reservation');
      reservation = undefined;
    }
    if (!reservation) {
      const mine = snapshot.devices[device];
      const requested: Record<string, number> = {};
      for (const [k, limit] of Object.entries(snapshot.limits)) {
        const chunk = Math.min(limit, k.startsWith('minutes') ? 300000 : 10);
        if (
          (mine?.granted[k] ?? 0) - (mine?.used[k] ?? 0) <= chunk / 2 &&
          (snapshot.allocated[k] ?? 0) < limit
        )
          requested[k] = chunk;
      }
      if (Object.keys(requested).length) {
        reservation = JSON.stringify({
          incarnation,
          periodId: snapshot.periodId,
          deviceId: device,
          operationId: randomUUID(),
          requested,
        });
        await save('reservation', reservation);
      }
    }
    if (reservation) {
      const granted = await api
        .reserveAccountUsage(JSON.parse(reservation), allowed)
        .catch(async (error) => {
          if (error?.code === 'device_not_registered') await clear('registered_at');
          throw error;
        });
      check();
      await installAccountUsage(granted, incarnation, allowed);
      await clear('reservation');
    }
  }
  const info = Tracking.accountUsageInfo();
  return info.active
    ? `Account allowance: ${info.status.replaceAll('_', ' ')}. Minutes add across devices. Offline use is limited to reserved credit.`
    : `Account-wide limits start at the next midnight in ${response.policy!.tz}. Existing local rules apply until then.`;
}
