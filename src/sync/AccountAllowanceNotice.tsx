import { Tracking } from 'tracking-android';
import { storageScope } from '@/db/scope';
import { Notice } from '@/ui/kit';

/** Read alongside the existing live screens; no additional scheduler or network request. */
export function AccountAllowanceNotice() {
  if (!storageScope().startsWith('account:')) return null;
  let info: ReturnType<typeof Tracking.accountUsageInfo>;
  let apps: ReturnType<typeof Tracking.health>['apps'];
  try {
    info = Tracking.accountUsageInfo();
    apps = Tracking.health().apps;
  } catch {
    return null;
  }
  if (!info.active)
    return (
      <Notice
        title="Account allowance transition"
        body={`Account-wide limits begin at the next midnight in ${info.accountTz ?? info.tz}. Existing local rules apply until then.`}
      />
    );
  const values = Object.entries(info.limits ?? {})
    .map(([key, limit]) => {
      const [metric, pkg] = key.split(':');
      const label = pkg
        ? `${apps.find((a) => a.package === pkg)?.label ?? 'App'} minutes`
        : metric === 'minutes'
          ? 'Minutes'
          : 'Videos';
      const used = info.used?.[key];
      const amount =
        used == null
          ? 'unavailable'
          : metric === 'minutes'
            ? used > 0 && used < 60000
              ? '<1'
              : String(Math.floor(used / 60000))
            : String(used);
      const credit = info.remaining?.[key];
      const remaining =
        credit == null
          ? 'unavailable'
          : metric === 'minutes'
            ? credit > 0 && credit < 60000
              ? '<1'
              : String(Math.floor(credit / 60000))
            : String(credit);
      return `${label}: ${amount} / ${metric === 'minutes' ? limit / 60000 : limit}${info.remaining ? `; reserved on this phone: ${remaining}` : ''}`;
    })
    .join('. ');
  const status =
    info.status === 'reserved_stale'
      ? 'Snapshot is stale; only this phone’s reserved credit remains usable.'
      : info.status === 'reserved'
        ? 'Using verified reserved credit.'
        : info.status.replaceAll('_', ' ');
  return (
    <Notice
      title="Today’s account allowance"
      body={`${values || (info.limits ? 'Last verified policy has no daily account limit' : 'Allowance details unavailable')}. ${status} Fixed timezone: ${info.tz}. Changes apply next account day after synchronization. Minutes add across devices; offline devices may hold part of the allowance.`}
    />
  );
}
