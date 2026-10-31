import type { BlockingConfig, TrackingHealth } from 'tracking-android';
import { SUBSCRIPTIONS_REQUIRED } from '../config/access';

export type ProtectionStatus = { title: string; body: string; tone: 'info' | 'warn' };

/** Readiness of saved native rules, not proof that a particular feed is currently intercepted. */
export function protectionStatus(
  config: BlockingConfig,
  health: TrackingHealth,
  videoGoal: number | null,
): ProtectionStatus {
  const inactive = (body: string): ProtectionStatus => ({
    title: 'Protection inactive',
    body,
    tone: 'warn',
  });
  if (!config.enabled) return inactive('Limits are saved. Turn on App pauses to enforce them.');
  if (!health.implemented) return inactive('Tracking service unavailable in this build.');
  if (!health.disclosureAccepted || !health.serviceEnabled)
    return inactive('Permission required. Enable the counter through Accessibility setup.');
  if (!health.serviceRunning)
    return inactive('Tracking service unavailable. Review Accessibility settings.');
  const selected = health.apps.filter((app) => app.installed && config.apps.includes(app.package));
  if (!selected.length) return inactive('Select an installed app to protect.');
  if (!SUBSCRIPTIONS_REQUIRED && health.subscriptionRequired !== false)
    return inactive('Install the latest Android build to use focus features.');
  if (SUBSCRIPTIONS_REQUIRED && health.blockingEntitled !== true)
    return inactive('Current Pro verification required. Sign in and review your subscription.');
  const appRule = config.dailyMinutes !== null || config.schedules.length > 0;
  const videoRule = Boolean(config.enforceVideoGoal || config.breaksEnabled);
  if (!appRule && !videoRule)
    return inactive('Enable a minute limit, focus time, video goal or feed break.');
  const issues: string[] = [];
  if (config.enforceVideoGoal && videoGoal === null)
    issues.push('Save and enable a daily video goal.');
  if (appRule && config.dailyMinutes !== null && !health.usageAccessGranted)
    issues.push(
      'Usage Access is off; minute limits use observed feed time, not complete app minutes.',
    );
  const feedRule = videoRule || (appRule && config.feedOnly);
  if (feedRule) {
    if (!health.feedLimitsImplemented)
      issues.push('Feed protection requires an updated Android build.');
    if (selected.some((app) => app.videoDetectionImplemented === false))
      issues.push('Feed detection is unsupported for one or more selected apps.');
  }
  if (issues.length)
    return { title: 'Protection needs attention', body: issues.join(' '), tone: 'warn' };
  return {
    title: 'Protection active',
    body: 'Saved rules are ready to intervene when their conditions are met. System navigation and configured bypasses remain available.',
    tone: 'info',
  };
}
