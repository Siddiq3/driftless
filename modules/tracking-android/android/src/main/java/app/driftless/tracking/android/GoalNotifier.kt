package app.driftless.tracking.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import app.driftless.tracking.core.Alert
import app.driftless.tracking.core.LimitAlerts
import app.driftless.tracking.core.Recorder
import app.driftless.tracking.core.isValidatedVersion
import java.time.ZoneId

/**
 * Sends goal notifications from the native side, so they work while the app is closed.
 * Minutes come from Usage Access when granted, otherwise from the counter. Video counts are used
 * only for accuracy-validated app versions.
 */
object GoalNotifier {
    private const val CHANNEL = "goal_alerts"

    fun check(context: Context, store: SqliteStore, prefs: TrackingPrefs, nowMs: Long = System.currentTimeMillis()) {
        val limits = prefs.limits
        // Minute protection must stay fresh even with no goals or notification permission.
        val zone = ZoneId.systemDefault()
        val rules = RulesLoader.load(context)
        val block = prefs.blockConfig
        if ((limits.isNotEmpty() || (block.enabled && block.dailyMinutes != null && block.apps.isNotEmpty())) && UsageReader.granted(context)) {
            UsageReader.refresh(context, store, rules.apps.keys, 1, zone)
        }
        if (limits.isEmpty()) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return

        val today = Recorder.localDate(nowMs, zone)
        val rows = store.daily(today)
        val minutes = if (UsageReader.granted(context)) {
            (rows.sumOf { it.usageMs } / 60_000L).toInt()
        } else if (store.heartbeatMinutes(today) > 0) {
            (rows.sumOf { it.surfaceMs + it.unknownMs } / 60_000L).toInt()
        } else {
            null
        }
        val validated = rules.apps.values.filter { isValidatedVersion(it, Health.appVersion(context, it.pkg)) }.map { it.pkg }.toSet()
        val views = if (validated.isEmpty()) null else rows.filter { it.pkg in validated }.sumOf { it.views }

        val due = LimitAlerts.due(limits, minutes, views, prefs.sentAlerts(today), today)
        if (due.isEmpty()) return
        ensureChannel(nm)
        for ((_, a) in due) nm.notify(a.metric.hashCode() + a.percent, build(context, a))
        prefs.markSent(today, due.map { it.first })
    }

    private fun ensureChannel(nm: NotificationManager) {
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Goal reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "When you get close to or reach a daily goal"
                },
            )
        }
    }

    private fun build(context: Context, a: Alert): android.app.Notification {
        val unit = if (a.metric == "minutes") "minutes" else "videos"
        val title = if (a.percent >= 100) "You've reached today's goal" else "Nearly at today's goal"
        val text = "${a.used} of ${a.limit} $unit. Wick is still glowing — maybe a good moment for a break."
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pi = launch?.let { PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE) }
        val b = if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(context, CHANNEL) else {
            @Suppress("DEPRECATION")
            android.app.Notification.Builder(context)
        }
        return b.setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .apply { if (pi != null) setContentIntent(pi) }
            .build()
    }
}
