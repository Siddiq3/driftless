package app.driftless.tracking.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class ViewEvent(
    val eventId: String,
    val sessionId: String,
    /** Monotonic within a session, starting at 1. (sessionId, seq) is unique. */
    val seq: Int,
    val pkg: String,
    val kind: ViewKind,
    val itemStartMs: Long,
    val countedAtMs: Long,
    val localDate: String,
    val tz: String,
    val ruleVersion: Int,
    val appVersion: String?,
)

data class DailyRow(
    val localDate: String,
    val pkg: String,
    val views: Int,
    val adViews: Int,
    val surfaceMs: Long,
    val unknownMs: Long,
    /** Foreground time from Android UsageStats (works without the accessibility service). */
    val usageMs: Long = 0,
)

/** Durable storage contract. The Android implementation is SQLite; tests use [MemoryStore]. */
interface TrackingStore {
    /** Inserts the event and bumps the day aggregate atomically. Returns false if it already existed. */
    fun recordView(e: ViewEvent): Boolean
    fun addTime(localDate: String, pkg: String, surfaceMs: Long, unknownMs: Long)
    /** Overwrites the UsageStats foreground time for a day (recomputed from the OS, so idempotent). */
    fun setUsage(localDate: String, pkg: String, usageMs: Long)
    fun saveRing(pkg: String, ring: List<String>, savedAtMs: Long)
    /** Ring buffer saved within [maxAgeMs] of [nowMs], else empty (stale after a long gap). */
    fun loadRing(pkg: String, nowMs: Long, maxAgeMs: Long): List<String>
    /** A video-countable app is open: account accounting may mark the day as observed. Stores no history. */
    fun onCountableAppActive(localDate: String) {}
    fun daily(localDate: String): List<DailyRow>
    fun events(sinceMs: Long): List<ViewEvent>
}

/**
 * Applies [CounterOutput]s for one supported app to the store.
 * One Recorder per foreground session of that app; a new session gets a new id and seq restarts.
 */
class Recorder(
    private val store: TrackingStore,
    private val pkg: String,
    private val ruleVersion: Int,
    private val appVersion: String?,
    private val ids: UuidV7,
    private val zone: () -> ZoneId = ZoneId::systemDefault,
) {
    val sessionId: String = ids.next().toString()
    private var seq = 0

    fun apply(outputs: List<CounterOutput>) {
        for (o in outputs) when (o) {
            is CounterOutput.Counted -> {
                val z = zone()
                seq += 1
                store.recordView(
                    ViewEvent(
                        eventId = ids.next().toString(),
                        sessionId = sessionId,
                        seq = seq,
                        pkg = pkg,
                        kind = o.kind,
                        itemStartMs = o.itemStartMs,
                        countedAtMs = o.countedAtMs,
                        localDate = localDate(o.countedAtMs, z),
                        tz = z.id,
                        ruleVersion = ruleVersion,
                        appVersion = appVersion,
                    ),
                )
            }
            is CounterOutput.Time -> for ((date, ms) in splitByLocalDay(o.fromMs, o.toMs, zone())) {
                if (o.known) store.addTime(date, pkg, ms, 0) else store.addTime(date, pkg, 0, ms)
            }
        }
    }

    companion object {
        fun localDate(ms: Long, z: ZoneId): String = Instant.ofEpochMilli(ms).atZone(z).toLocalDate().toString()

        /** Splits [fromMs, toMs) at local midnights (DST-aware via java.time). */
        fun splitByLocalDay(fromMs: Long, toMs: Long, z: ZoneId): List<Pair<String, Long>> {
            if (toMs <= fromMs) return emptyList()
            val out = mutableListOf<Pair<String, Long>>()
            var t = fromMs
            while (t < toMs) {
                val d: LocalDate = Instant.ofEpochMilli(t).atZone(z).toLocalDate()
                val nextMidnight = d.plusDays(1).atStartOfDay(z).toInstant().toEpochMilli()
                val end = minOf(nextMidnight, toMs)
                out += d.toString() to (end - t)
                t = end
            }
            return out
        }
    }
}

/** In-memory store with the same semantics as the SQLite one (used by JVM tests). */
class MemoryStore : TrackingStore {
    val eventsById = LinkedHashMap<String, ViewEvent>()
    private val sessionSeq = HashSet<Pair<String, Int>>()
    private val agg = HashMap<Pair<String, String>, DailyRow>()
    private val rings = HashMap<String, Pair<List<String>, Long>>()

    private fun row(d: String, p: String) = agg[d to p] ?: DailyRow(d, p, 0, 0, 0, 0)

    @Synchronized
    override fun recordView(e: ViewEvent): Boolean {
        if (eventsById.containsKey(e.eventId) || !sessionSeq.add(e.sessionId to e.seq)) return false
        eventsById[e.eventId] = e
        val r = row(e.localDate, e.pkg)
        agg[e.localDate to e.pkg] =
            if (e.kind == ViewKind.VIEW) r.copy(views = r.views + 1) else r.copy(adViews = r.adViews + 1)
        return true
    }

    @Synchronized
    override fun addTime(localDate: String, pkg: String, surfaceMs: Long, unknownMs: Long) {
        val r = row(localDate, pkg)
        agg[localDate to pkg] = r.copy(surfaceMs = r.surfaceMs + surfaceMs, unknownMs = r.unknownMs + unknownMs)
    }

    @Synchronized
    override fun setUsage(localDate: String, pkg: String, usageMs: Long) {
        agg[localDate to pkg] = row(localDate, pkg).copy(usageMs = usageMs)
    }

    override fun saveRing(pkg: String, ring: List<String>, savedAtMs: Long) {
        rings[pkg] = ring to savedAtMs
    }

    override fun loadRing(pkg: String, nowMs: Long, maxAgeMs: Long): List<String> {
        val (r, at) = rings[pkg] ?: return emptyList()
        return if (nowMs - at <= maxAgeMs) r else emptyList()
    }

    override fun daily(localDate: String): List<DailyRow> = agg.values.filter { it.localDate == localDate }.sortedBy { it.pkg }

    override fun events(sinceMs: Long): List<ViewEvent> = eventsById.values.filter { it.countedAtMs >= sinceMs }
}

