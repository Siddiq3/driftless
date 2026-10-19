package app.driftless.tracking.core

/**
 * Kotlin port of the reference counting rule (DECISIONS D-007, `@siddiq3/driftless-contracts/domain`
 * view-rules.ts). Both implementations are tested against the same scenarios; they must agree.
 *
 *  - candidate surface: observation with surface == SHORT_VIDEO
 *  - confirmed transition: structural signal (pager scroll, or entering the surface) AND a
 *    fingerprint not in the recent ring buffer
 *  - counted view: a confirmed transition whose item stays in the foreground >= DWELL_MS
 *  - unknown content: short-video surface without a fingerprint -> time only, never a view
 *
 * Pure Kotlin, no Android dependencies, so it runs in JVM unit tests.
 */
enum class Surface { SHORT_VIDEO, OTHER, UNKNOWN }

data class Observation(
    val tMs: Long,
    val surface: Surface,
    /** Salted hash of stable item attributes; null when identity can't be established. */
    val fingerprint: String?,
    val isAd: Boolean,
    /** A pager/scroll event was observed since the previous observation. */
    val pagerScrolled: Boolean,
)

enum class ViewKind { VIEW, AD_VIEW }

/** Something the counter decided; the recorder turns these into durable rows. */
sealed interface CounterOutput {
    data class Counted(val kind: ViewKind, val itemStartMs: Long, val countedAtMs: Long) : CounterOutput
    /** Time spent between [fromMs, toMs) on the surface; `known` = item identity was known. */
    data class Time(val fromMs: Long, val toMs: Long, val known: Boolean) : CounterOutput
}

class ViewCounter(initialRing: List<String> = emptyList()) {
    private val ring = ArrayDeque<String>(initialRing.takeLast(RING_SIZE))
    private var cur: Current? = null
    private var lastT: Long? = null
    private var lastSurface = Surface.OTHER
    private var lastFpNull = false
    private var transitionUntil: Long? = null

    private class Current(val fp: String, val since: Long, val isAd: Boolean, var pending: Boolean) {
        var dwellMs = 0L
    }

    /** Snapshot of the ring buffer, persisted so a service restart doesn't recount the same item. */
    fun ringSnapshot(): List<String> = ring.toList()

    /** Feed observations in non-decreasing time order; out-of-order input is ignored. */
    fun observe(o: Observation): List<CounterOutput> {
        val last = lastT
        if (last != null && o.tMs < last) return emptyList()
        val out = advance(o.tMs)

        val entering = o.surface == Surface.SHORT_VIDEO && lastSurface != Surface.SHORT_VIDEO
        lastSurface = o.surface
        lastFpNull = o.surface == Surface.SHORT_VIDEO && o.fingerprint == null
        if (o.surface != Surface.SHORT_VIDEO) transitionUntil = null
        else if (entering || o.pagerScrolled) transitionUntil = o.tMs + IDENTITY_SETTLE_MS
        if (transitionUntil?.let { o.tMs > it } == true) transitionUntil = null

        if (o.surface != Surface.SHORT_VIDEO || o.fingerprint == null) {
            cur = null // left the feed, or identity unknown; ring buffer is kept
            return out
        }
        if (cur?.fp == o.fingerprint) return out // repeated callback for the same item

        val novel = !ring.contains(o.fingerprint)
        val structural = transitionUntil != null
        if (structural) transitionUntil = null
        remember(o.fingerprint)
        cur = Current(o.fingerprint, o.tMs, o.isAd, pending = novel && structural)
        return out
    }

    /** Account for elapsed time up to [tMs] (periodic tick, leaving, end of day). */
    fun flush(tMs: Long): List<CounterOutput> {
        val last = lastT
        return if (last == null || tMs >= last) advance(tMs) else emptyList()
    }

    private fun advance(tMs: Long): List<CounterOutput> {
        val out = mutableListOf<CounterOutput>()
        val last = lastT
        if (last != null && tMs > last && lastSurface == Surface.SHORT_VIDEO) {
            val c = cur
            if (lastFpNull) {
                out += CounterOutput.Time(last, tMs, known = false)
            } else if (c != null) {
                out += CounterOutput.Time(last, tMs, known = true)
                c.dwellMs += tMs - last
                if (c.pending && c.dwellMs >= DWELL_MS) {
                    c.pending = false
                    out += CounterOutput.Counted(if (c.isAd) ViewKind.AD_VIEW else ViewKind.VIEW, c.since, tMs)
                }
            }
        }
        lastT = tMs
        return out
    }

    private fun remember(fp: String) {
        ring.remove(fp)
        ring.addLast(fp)
        while (ring.size > RING_SIZE) ring.removeFirst()
    }

    companion object {
        const val DWELL_MS = 1_500L
        /** Match a delayed identity to one recent transition, never to arbitrary later text edits. */
        const val IDENTITY_SETTLE_MS = 1_200L
        const val RING_SIZE = 8
    }
}
