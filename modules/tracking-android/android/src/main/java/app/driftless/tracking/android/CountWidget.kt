package app.driftless.tracking.android

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import app.driftless.tracking.R
import app.driftless.tracking.core.isValidatedVersion
import java.time.LocalDate

/** Same validation/unknown rules as the app; no login or network required. */
class CountWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = update(context)
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == Intent.ACTION_DATE_CHANGED || intent.action == Intent.ACTION_TIMEZONE_CHANGED || intent.action == Intent.ACTION_TIME_CHANGED) update(context)
    }
    companion object {
        fun supported(context: Context): Boolean = Build.VERSION.SDK_INT >= 26 && AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
        fun request(context: Context): Boolean {
            if (!supported(context)) return false
            return AppWidgetManager.getInstance(context).requestPinAppWidget(ComponentName(context, CountWidget::class.java), null, null)
        }
        fun update(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, CountWidget::class.java))
            if (ids.isEmpty()) return
            val store = SqliteStore.get(context)
            val date = LocalDate.now().toString()
            val validated = RulesLoader.load(context).apps.values.filter { isValidatedVersion(it, Health.appVersion(context, it.pkg)) }.map { it.pkg }.toSet()
            val known = validated.isNotEmpty() && store.heartbeatMinutes(date) > 0
            val count = if (known) store.daily(date).filter { it.pkg in validated }.sumOf { it.views }.coerceAtMost(5000).toString() else "—"
            val active = TrackingPrefs(context).disclosureAccepted && Health.serviceEnabled(context) && DriftlessAccessibilityService.current != null
            val view = RemoteViews(context.packageName, R.layout.driftless_count_widget).apply {
                setTextViewText(R.id.count_widget_value, count)
                setTextViewText(R.id.count_widget_status, if (!active) "Counting is off · tap to set up" else if (!known) "Count not confirmed · tap for details" else "Updated ${java.time.LocalTime.now().withSecond(0).withNano(0)}")
                context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
                    setOnClickPendingIntent(R.id.count_widget_root, PendingIntent.getActivity(context, 1701, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                }
            }
            ids.forEach { manager.updateAppWidget(it, view) }
        }
    }
}
