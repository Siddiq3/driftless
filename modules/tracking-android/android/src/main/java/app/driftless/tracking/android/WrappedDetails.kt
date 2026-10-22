package app.driftless.tracking.android

import android.content.Context
import app.driftless.tracking.core.ViewKind
import app.driftless.tracking.core.isValidatedVersion
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/** Local-only derived statistics. No video labels, fingerprints, raw IDs or timestamps are synced. */
object WrappedDetails {
    /** Recaps retain the existing accuracy gate. */
    fun read(context: Context, from: String, to: String): Map<String, Any> =
        read(context, from, to, localActivity = false)

    /** Local chart data only; never a source for synced aggregates or competitive scores. */
    fun readLocalActivity(context: Context, from: String, to: String): Map<String, Any> =
        read(context, from, to, localActivity = true)

    private fun read(context: Context, from: String, to: String, localActivity: Boolean): Map<String, Any> {
        val first = LocalDate.parse(from)
        val last = LocalDate.parse(to)
        require(!last.isBefore(first) && ChronoUnit.DAYS.between(first, last) < 14) { "Invalid recap range" }
        val rules = RulesLoader.load(context)
        // Local day tags are authoritative; use a generous UTC bound for time-zone travel.
        val since = first.minusDays(1).atStartOfDay(ZoneId.of("UTC")).toInstant().toEpochMilli()
        val events = SqliteStore.get(context).events(since).filter { e ->
            e.localDate >= from && e.localDate <= to && e.kind == ViewKind.VIEW &&
                (localActivity || e.ruleVersion == rules.version) && rules.apps[e.pkg]?.let {
                    localActivity || isValidatedVersion(it, e.appVersion)
                } == true
        }
        val days = events.groupBy { it.localDate }.map { (date, rows) ->
            val hours = IntArray(24)
            rows.forEach { e -> hours[Instant.ofEpochMilli(e.countedAtMs).atZone(ZoneId.of(e.tz)).hour]++ }
            val sessions = rows.groupBy { it.sessionId }.values.flatMap { group ->
                val sorted = group.sortedBy { it.countedAtMs }
                val runs = mutableListOf<MutableList<app.driftless.tracking.core.ViewEvent>>()
                for (e in sorted) {
                    // Time away from the short-video player must not inflate an observed streak.
                    if (runs.isEmpty() || e.itemStartMs - runs.last().last().countedAtMs > 90_000) runs.add(mutableListOf())
                    runs.last().add(e)
                }
                runs.map { run ->
                    val a = run.first(); val b = run.last(); val zone = ZoneId.of(a.tz)
                    val midnight = LocalDate.parse(date).atStartOfDay(zone).toInstant().toEpochMilli()
                    val start = maxOf(a.itemStartMs, midnight)
                    val finish = maxOf(start, b.countedAtMs)
                    val localStart = Instant.ofEpochMilli(start).atZone(zone)
                    val localEnd = Instant.ofEpochMilli(finish).atZone(zone)
                    mapOf("package" to a.pkg, "startMs" to start.toDouble(), "endMs" to finish.toDouble(),
                        "startMinute" to localStart.hour * 60 + localStart.minute,
                        "endMinute" to localEnd.hour * 60 + localEnd.minute, "views" to run.size)
                }
            }
            mapOf("localDate" to date, "hourlyViews" to hours.toList(), "sessions" to sessions)
        }
        return mapOf("available" to true, "days" to days)
    }
}
