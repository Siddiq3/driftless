package app.driftless.tracking.android

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process
import app.driftless.tracking.core.TrackingStore
import app.driftless.tracking.core.UsageMath
import app.driftless.tracking.core.UsageTransition
import java.time.LocalDate
import java.time.ZoneId

/**
 * Minutes in the supported apps from Android's Usage Access (UsageStatsManager).
 * Independent of the accessibility service, so it also works where that is unavailable
 * (e.g. Advanced Protection). Reads only foreground transitions of the supported packages.
 */
object UsageReader {
    fun granted(context: Context): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= 29) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun transitions(context: Context, packages: Set<String>, startMs: Long, endMs: Long): List<UsageTransition>? {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = usm.queryEvents(startMs, endMs) ?: return null
        val out = ArrayList<UsageTransition>()
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            val pkg = e.packageName ?: continue
            if (pkg !in packages) continue
            when (e.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> out += UsageTransition(e.timeStamp, pkg, resumed = true)
                UsageEvents.Event.ACTIVITY_PAUSED -> out += UsageTransition(e.timeStamp, pkg, resumed = false)
            }
        }
        return out
    }

    /**
     * Recomputes foreground time for the last [days] local days and stores it. Android keeps
     * event-level history only for a limited time, so older days keep their last stored value.
     */
    fun refresh(context: Context, store: TrackingStore, packages: Set<String>, days: Int, zone: ZoneId = ZoneId.systemDefault()): Int = synchronized(store) {
        refreshLocked(context, store, packages, days, if(store is SqliteStore) store.account.zone() else zone)
    }

    private fun refreshLocked(context: Context, store: TrackingStore, packages: Set<String>, days: Int, zone: ZoneId): Int {
        if (!granted(context)) return 0
        val now = if(store is SqliteStore) store.account.now() else System.currentTimeMillis()
        val today = java.time.Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        if(store is SqliteStore && store.account.active() && kotlin.math.abs(System.currentTimeMillis()-now)>60_000) { store.account.markClockUncertain(); return 0 }
        var written = 0
        for (i in 0 until days.coerceIn(1, 7)) {
            val date = today.minusDays(i.toLong()).toString()
            val (start, end) = UsageMath.dayBounds(date, zone)
            val accountStart=if(store is SqliteStore && store.account.active()) store.account.policy()?.getLong("activeFromMs") ?: start else start
            val intervals = if (store is SqliteStore && store.account.active()) store.accountingIntervals(maxOf(start,accountStart), minOf(end, now)) else if (store is SqliteStore) store.usageIntervals(start, minOf(end, now)) else listOf(start to minOf(end, now))
            val ms = mutableMapOf<String, Long>()
            var available=true
            for ((a,b) in intervals) {
                val events=transitions(context, packages,a,b)
                if(events==null) { available=false; break }
                val piece = UsageMath.foregroundMs(events, packages, a, b, b)
                for((pkg,value) in piece) ms[pkg] = (ms[pkg] ?: 0L) + value
            }
            if(!available) continue
            if(store is SqliteStore) for((pkg,v) in ms) store.setAccountUsage(date,pkg,v)
            // Visible history after reset uses only post-cutoff intervals. Accounting above
            // keeps the full period total and cannot be replenished by the reset.
            val cutoff=if(store is SqliteStore) store.account.cutoff() else 0L
            val visibleIntervals=if(store is SqliteStore) store.usageIntervals(start,minOf(end,now)) else intervals
            val visible=mutableMapOf<String,Long>()
            var visibleAvailable=true
            for((a,b) in visibleIntervals) {
                val lo=maxOf(a,cutoff); if(lo>=b) continue
                val events=transitions(context,packages,lo,b)
                if(events==null) {visibleAvailable=false;break}
                for((pkg,v) in UsageMath.foregroundMs(events,packages,lo,b,b)) visible[pkg]=(visible[pkg] ?: 0L)+v
            }
            if(!visibleAvailable) continue
            for ((pkg, v) in visible) {
                store.setUsage(date, pkg, v)
                written++
            }
        }
        return written
    }
}
