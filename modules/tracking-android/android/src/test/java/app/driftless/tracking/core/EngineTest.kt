package app.driftless.tracking.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.SecureRandom
import java.time.ZoneId
import java.time.ZonedDateTime

class EngineTest {
    private val ig = "com.instagram.android"
    private val rules = RuleSet(
        1,
        mapOf(ig to AppRules(ig, "Instagram Reels", setOf("pager"), listOf(ItemPart("video", Field.CONTENT_DESC)), emptySet(), emptySet(), emptyList())),
    )
    private val kolkata = ZoneId.of("Asia/Kolkata")
    private fun at(h: Int, m: Int, sec: Int = 0, day: Int = 18) =
        ZonedDateTime.of(2026, 10, day, h, m, sec, 0, kolkata).toInstant().toEpochMilli()

    private fun video(fp: String) = Classification(Surface.SHORT_VIDEO, fp, isAd = false, nodesVisited = 3)

    @Test fun recordsEventsWithUniqueIdsAndMonotonicSequence() {
        val store = MemoryStore()
        val e = Engine(store, rules, zone = { kolkata })
        e.onObservation(ig, "400.0", video("a"), false, at(10, 0))
        e.onObservation(ig, "400.0", video("b"), true, at(10, 0, 5))
        e.onObservation(ig, "400.0", video("c"), true, at(10, 0, 10))
        e.onTick(at(10, 0, 15))
        val evs = store.eventsById.values.toList()
        assertEquals(3, evs.size)
        assertEquals(listOf(1, 2, 3), evs.map { it.seq })
        assertEquals(1, evs.map { it.sessionId }.toSet().size)
        assertEquals(3, evs.map { it.eventId }.toSet().size)
        assertEquals("400.0", evs.first().appVersion)
        assertEquals(3, store.daily("2026-10-18").single().views)
    }

    @Test fun replayingTheSameEventDoesNotDoubleCount() {
        val store = MemoryStore()
        val e = Engine(store, rules, zone = { kolkata })
        e.onObservation(ig, null, video("a"), false, at(10, 0))
        e.onTick(at(10, 0, 5))
        val ev = store.eventsById.values.single()
        assertFalse(store.recordView(ev))
        assertFalse(store.recordView(ev.copy(eventId = "other-id"))) // same (session, seq)
        assertEquals(1, store.daily("2026-10-18").single().views)
    }

    @Test fun serviceRestartWithinRingWindowDoesNotRecount() {
        val store = MemoryStore()
        Engine(store, rules, zone = { kolkata }).apply {
            onObservation(ig, null, video("a"), false, at(10, 0))
            onTick(at(10, 0, 5))
            onLeave(at(10, 0, 6))
        }
        val restarted = Engine(store, rules, zone = { kolkata })
        restarted.onObservation(ig, null, video("a"), false, at(10, 5))
        restarted.onTick(at(10, 5, 10))
        assertEquals(1, store.daily("2026-10-18").single().views)
    }

    @Test fun afterALongGapThePreviousItemMayCountAgain() {
        val store = MemoryStore()
        Engine(store, rules, zone = { kolkata }).apply {
            onObservation(ig, null, video("a"), false, at(10, 0))
            onTick(at(10, 0, 5))
            onLeave(at(10, 0, 6))
        }
        val rebooted = Engine(store, rules, zone = { kolkata })
        rebooted.onObservation(ig, null, video("a"), false, at(11, 0))
        rebooted.onTick(at(11, 0, 5))
        assertEquals(2, store.daily("2026-10-18").single().views)
    }

    @Test fun timeIsSplitAtLocalMidnight() {
        val store = MemoryStore()
        val e = Engine(store, rules, zone = { kolkata })
        e.onObservation(ig, null, video("a"), false, at(23, 59, 30))
        e.onTick(at(0, 0, 30, day = 19))
        assertEquals(30_000L, store.daily("2026-10-18").single().surfaceMs)
        assertEquals(30_000L, store.daily("2026-10-19").single().surfaceMs)
    }

    @Test fun timeZoneChangeUsesTheNewZoneForNewEvents() {
        val store = MemoryStore()
        var zone = kolkata
        val e = Engine(store, rules, zone = { zone })
        e.onObservation(ig, null, video("a"), false, at(1, 0, day = 19)) // 19 Oct 01:00 IST
        e.onTick(at(1, 0, 5, day = 19))
        zone = ZoneId.of("America/Los_Angeles") // same instant is still 18 Oct in LA
        e.onObservation(ig, null, video("b"), true, at(1, 0, 10, day = 19))
        e.onTick(at(1, 0, 20, day = 19))
        val evs = store.eventsById.values.toList()
        assertEquals("2026-10-19", evs[0].localDate)
        assertEquals("Asia/Kolkata", evs[0].tz)
        assertEquals("2026-10-18", evs[1].localDate)
        assertEquals("America/Los_Angeles", evs[1].tz)
    }

    @Test fun unsupportedPackageEndsTheSession() {
        val store = MemoryStore()
        val e = Engine(store, rules, zone = { kolkata })
        e.onObservation(ig, null, video("a"), false, at(10, 0))
        e.onObservation("com.example.other", null, video("x"), false, at(10, 0, 4))
        assertEquals(null, e.activePackage)
        e.onTick(at(10, 1))
        assertEquals(4_000L, store.daily("2026-10-18").single().surfaceMs)
    }

    @Test fun heartbeatsCountDistinctMinutes() {
        val store = MemoryStore()
        val e = Engine(store, rules, zone = { kolkata })
        for (sec in 0 until 180 step 2) e.onTick(at(9, 0) + sec * 1000L)
        assertEquals(3, store.heartbeatMinutes("2026-10-18"))
    }

    @Test fun uuidV7IsTimeOrderedAndVersioned() {
        var now = 1_000L
        val gen = UuidV7(SecureRandom(), clock = { now })
        val a = gen.next()
        val b = gen.next() // same millisecond
        now = 900L // clock went backwards
        val c = gen.next()
        assertEquals(7, a.version())
        assertEquals(2, a.variant())
        assertTrue(a.toString() < b.toString() && b.toString() < c.toString())
        assertNotEquals(a, b)
    }

    @Test fun fingerprintsAreSaltedAndNotPlaintext() {
        val s1 = Fingerprint.dailySalt(ByteArray(32) { 1 }, "2026-10-18")
        val s2 = Fingerprint.dailySalt(ByteArray(32) { 1 }, "2026-10-19")
        val a = Fingerprint.of(s1, listOf("Reel by someone"))
        assertEquals(a, Fingerprint.of(s1, listOf("Reel by someone")))
        assertNotEquals(a, Fingerprint.of(s2, listOf("Reel by someone")))
        assertNotEquals(Fingerprint.of(s1, listOf("ab", "c")), Fingerprint.of(s1, listOf("a", "bc")))
        assertFalse(a.contains("someone"))
        assertEquals(32, a.length)
    }
}
