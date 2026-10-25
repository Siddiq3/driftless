package app.driftless.tracking.core

import java.time.Instant
import java.time.ZoneId

/**
 * Drives one [ViewCounter] + [Recorder] per foreground session of a supported app.
 * Platform-free: the AccessibilityService feeds it classified observations and clock ticks.
 */
class Engine(
    private val store: TrackingStore,
    private val rules: RuleSet,
    private val ids: UuidV7 = UuidV7(),
    private val zone: () -> ZoneId = ZoneId::systemDefault,
) {
    private class Session(val pkg: String, val appVersion:String?, val counter: ViewCounter, val recorder: Recorder) {
        var lastRing: List<String> = counter.ringSnapshot()
    }

    private var active: Session? = null
    private var lastTime: Long? = null
    private fun accept(tMs: Long): Boolean {
        if(lastTime?.let { tMs<it }==true) return false
        lastTime=tMs
        return true
    }

    val activePackage: String? get() = active?.pkg

    fun isSupported(pkg: String): Boolean = rules.apps.containsKey(pkg)

    /** A classified snapshot of a supported app's foreground window. */
    @Synchronized
    fun onObservation(pkg: String, appVersion: String?, c: Classification, pagerScrolled: Boolean, tMs: Long) {
        if(!accept(tMs)) return
        if (!isSupported(pkg)) return onLeave(tMs)
        val s = active?.takeIf { it.pkg == pkg && it.appVersion==appVersion } ?: startSession(pkg, appVersion, tMs)
        val outputs = s.counter.observe(Observation(tMs, c.surface, c.fingerprint, c.isAd, pagerScrolled))
        s.recorder.apply(outputs)
        persistRingIfChanged(s, tMs)
    }

    /** The supported app is no longer in front (other app, launcher, screen off, service stop). */
    @Synchronized
    fun onLeave(tMs: Long) {
        if(!accept(tMs)) return
        val s = active ?: return
        s.recorder.apply(s.counter.observe(Observation(tMs, Surface.OTHER, null, isAd = false, pagerScrolled = false)))
        persistRingIfChanged(s, tMs, force = true)
        active = null
    }

    /** Periodic tick: credits dwell time so a view counts even without further UI events. */
    @Synchronized
    fun onTick(tMs: Long) {
        if(!accept(tMs)) return
        active?.let { it.recorder.apply(it.counter.flush(tMs)) }
        val at = Instant.ofEpochMilli(tMs).atZone(zone())
        val beat = at.toLocalDate().toString() to (at.hour * 60 + at.minute)
        if (beat != lastBeat) {
            store.heartbeat(beat.first, beat.second)
            lastBeat = beat
        }
    }

    private var lastBeat: Pair<String, Int>? = null

    private fun startSession(pkg: String, appVersion: String?, tMs: Long): Session {
        active?.let { onLeave(tMs) }
        val ring = store.loadRing(pkg, tMs, RING_MAX_AGE_MS)
        return Session(pkg, appVersion, ViewCounter(ring), Recorder(store, pkg, rules.version, appVersion, ids, zone)).also {
            active = it
        }
    }

    private fun persistRingIfChanged(s: Session, tMs: Long, force: Boolean = false) {
        val now = s.counter.ringSnapshot()
        if (force || now != s.lastRing) {
            store.saveRing(s.pkg, now, tMs)
            s.lastRing = now
        }
    }

    companion object {
        /** After this long away, previously seen items may be counted again. */
        const val RING_MAX_AGE_MS = 30 * 60_000L
    }
}
