package app.driftless.tracking.android

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.ZoneId

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class BlockingUsageRefreshTest {
    @Test fun minuteProtectionRefreshesUsageWithoutGoalsOrNotificationPermission() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val pkg = "com.google.android.youtube"
        val now = System.currentTimeMillis()
        val prefs = TrackingPrefs(ctx)
        prefs.limits = emptyList()
        prefs.blockConfig = BlockConfig(true, setOf(pkg), 1, emptyList())
        prefs.entitlement = CachedEntitlement(true, now + 60000)
        shadowOf(ctx.getSystemService(AppOpsManager::class.java)).setMode(
            AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName, AppOpsManager.MODE_ALLOWED)
        shadowOf(ctx.getSystemService(android.app.NotificationManager::class.java)).setNotificationsEnabled(false)
        val usage = shadowOf(ctx.getSystemService(UsageStatsManager::class.java))
        val start = java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        usage.addEvent(pkg, start + 1000, UsageEvents.Event.ACTIVITY_RESUMED)
        usage.addEvent(pkg, start + 121000, UsageEvents.Event.ACTIVITY_PAUSED)
        val at = maxOf(now, start + 122000)
        val store = SqliteStore(ctx, "usage-protection-test.db")
        try {
            // Create the test guest interval before the synthetic app-use timestamps.
            store.writableDatabase.execSQL("UPDATE scope_intervals SET start_ms=?", arrayOf(start))
            GoalNotifier.check(ctx, store, prefs, at)
            val minutes = store.daily(Recorder.localDate(at, ZoneId.systemDefault())).firstOrNull { it.pkg == pkg }?.usageMs ?: 0
            assertEquals(120000L, minutes)
            assertTrue(BlockPolicy.decide(pkg, prefs.blockConfig, prefs.entitlement,
                (minutes / 60000).toInt(), 1, 0, 0, now).block)
        } finally { store.close(); ctx.deleteDatabase("usage-protection-test.db") }
    }
}
