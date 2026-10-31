package app.driftless.tracking.core

import java.time.LocalDate
import java.time.ZoneId

/** A foreground transition reported by Android UsageStats (ACTIVITY_RESUMED / ACTIVITY_PAUSED). */
data class UsageTransition(val tMs: Long, val pkg: String, val resumed: Boolean)

/**
 * Foreground time per package inside [startMs, endMs), from raw transitions. Pure, so it is unit-tested.
 *
 * - A package already in front at [startMs] shows up as a PAUSE without a preceding RESUME:
 *   it is counted from [startMs].
 * - A package still in front at the end is counted up to min(endMs, nowMs).
 * - Overlapping RESUMEs for the same package (multi-window, activity switches) are merged.
 */
object UsageMath {
    fun foregroundMs(
        transitions: List<UsageTransition>,
        packages: Set<String>,
        startMs: Long,
        endMs: Long,
        nowMs: Long,
    ): Map<String, Long> {
        val stop = minOf(endMs, nowMs)
        if (stop <= startMs) return packages.associateWith { 0L }
        val total = HashMap<String, Long>()
        val openSince = HashMap<String, Long>()
        val seen = HashSet<String>()
        for (t in transitions.sortedBy { it.tMs }) {
            if (t.pkg !in packages || t.tMs >= stop) continue
            val at = t.tMs.coerceAtLeast(startMs)
            if (t.resumed) {
                openSince.putIfAbsent(t.pkg, at)
            } else {
                val since = openSince.remove(t.pkg) ?: if (t.pkg !in seen) startMs else null
                if (since != null && at > since) total.merge(t.pkg, at - since, Long::plus)
            }
            seen += t.pkg
        }
        for ((pkg, since) in openSince) if (stop > since) total.merge(pkg, stop - since, Long::plus)
        return packages.associateWith { total[it] ?: 0L }
    }

    /** [start, end) of a local calendar day in epoch ms (DST-aware). */
    fun dayBounds(localDate: String, zone: ZoneId): Pair<Long, Long> {
        val d = LocalDate.parse(localDate)
        return d.atStartOfDay(zone).toInstant().toEpochMilli() to d.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
    }
}
