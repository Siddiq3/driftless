package app.driftless.tracking.core

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Same scenarios as the TS reference (driftless-backend packages/contracts/test/domain/view-rules.test.ts).
 * If one implementation changes, both must change.
 */
class ViewCounterTest {
    private val s = 1000L

    private fun o(t: Long, fp: String?, scrolled: Boolean = true, ad: Boolean = false, surface: Surface = Surface.SHORT_VIDEO) =
        Observation(t, surface, fp, ad, scrolled)

    private fun leave(t: Long) = o(t, null, scrolled = false, surface = Surface.OTHER)

    private data class Tally(var views: Int = 0, var adViews: Int = 0, var surfaceMs: Long = 0, var unknownMs: Long = 0)

    private fun run(obs: List<Observation>, end: Long, counter: ViewCounter = ViewCounter()): Tally {
        val t = Tally()
        val outs = obs.flatMap { counter.observe(it) } + counter.flush(end)
        for (x in outs) when (x) {
            is CounterOutput.Counted -> if (x.kind == ViewKind.VIEW) t.views++ else t.adViews++
            is CounterOutput.Time -> if (x.known) t.surfaceMs += x.toMs - x.fromMs else t.unknownMs += x.toMs - x.fromMs
        }
        return t
    }

    @Test fun countsNormalSequence() {
        val t = run(listOf(o(0, "a", scrolled = false), o(10 * s, "b"), o(20 * s, "c")), 30 * s)
        assertEquals(3, t.views)
        assertEquals(30 * s, t.surfaceMs)
    }

    @Test fun repeatedCallbacksForSameItemCountOnce() {
        val obs = listOf(o(0, "a", scrolled = false)) + (1..50).map { o(100L * it, "a") }
        assertEquals(1, run(obs, 10 * s).views)
    }

    @Test fun fastScrollingBelowDwellIsNotCounted() {
        val t = run(listOf(o(0, "a", scrolled = false), o(300, "b"), o(600, "c"), o(900, "d")), 900 + ViewCounter.DWELL_MS)
        assertEquals(1, t.views)
        assertEquals(900 + ViewCounter.DWELL_MS, t.surfaceMs)
    }

    @Test fun returningToPreviousItemIsNotRecounted() {
        assertEquals(2, run(listOf(o(0, "a", scrolled = false), o(5 * s, "b"), o(10 * s, "a"), o(15 * s, "b")), 20 * s).views)
    }

    @Test fun commentsOrProfileAndBackIsNoNewView() {
        val t = run(listOf(o(0, "a", scrolled = false), leave(3 * s), o(9 * s, "a", scrolled = false)), 12 * s)
        assertEquals(1, t.views)
        assertEquals(6 * s, t.surfaceMs)
    }

    @Test fun adsCountSeparately() {
        val t = run(listOf(o(0, "a", scrolled = false), o(5 * s, "ad1", ad = true), o(10 * s, "b")), 15 * s)
        assertEquals(2, t.views)
        assertEquals(1, t.adViews)
    }

    @Test fun appSwitchAndBackToSameItemIsNotRecounted() {
        assertEquals(1, run(listOf(o(0, "a", scrolled = false), leave(4 * s), o(60 * s, "a", scrolled = false)), 70 * s).views)
    }

    @Test fun enteringSurfaceCountsFirstItem() {
        assertEquals(1, run(listOf(o(0, "a", scrolled = false)), 5 * s).views)
    }

    @Test fun contentChangeWithoutStructuralSignalIsNotATransition() {
        assertEquals(1, run(listOf(o(0, "a", scrolled = false), o(5 * s, "b", scrolled = false)), 10 * s).views)
    }

    @Test fun unknownContentIsTimeOnly() {
        val t = run(listOf(o(0, null), o(10 * s, null)), 20 * s)
        assertEquals(0, t.views)
        assertEquals(20 * s, t.unknownMs)
        assertEquals(0, t.surfaceMs)
    }

    @Test fun itemsOlderThanRingCanCountAgain() {
        val ids = (0..ViewCounter.RING_SIZE).map { "i$it" }
        val obs = ids.mapIndexed { i, id -> o(i * 5 * s, id, scrolled = i > 0) } + o(ids.size * 5 * s, "i0")
        assertEquals(ViewCounter.RING_SIZE + 2, run(obs, (ids.size + 1) * 5 * s).views)
    }

    @Test fun outOfOrderObservationsAreIgnored() {
        val c = ViewCounter()
        val outs = c.observe(o(10 * s, "a", scrolled = false)) + c.observe(o(5 * s, "b")) + c.flush(20 * s)
        assertEquals(1, outs.count { it is CounterOutput.Counted })
    }

    @Test fun restoredRingPreventsRecountAfterServiceRestart() {
        val first = ViewCounter()
        first.observe(o(0, "a", scrolled = false))
        first.flush(5 * s)
        val restarted = ViewCounter(first.ringSnapshot())
        assertEquals(0, run(listOf(o(10 * s, "a", scrolled = false)), 20 * s, restarted).views)
    }
    @Test fun delayedCaptionAfterUnknownEntryStillCounts() {
        val t = run(listOf(o(0,null,scrolled=false),o(300,"a",scrolled=false)),2500)
        assertEquals(1,t.views)
        assertEquals(300L,t.unknownMs)
    }
    @Test fun swipeBeforeCaptionArrivesStillCountsTheNextVideoOnce() {
        val obs=listOf(o(0,"a",scrolled=false),o(3000,"a"),o(3300,null,scrolled=false),o(3600,"b",scrolled=false),o(3800,"b",scrolled=false))
        assertEquals(2,run(obs,6000).views)
    }
    @Test fun delayedIdentityCannotBorrowExpiredOrConsumedSwipe() {
        assertEquals(1,run(listOf(o(0,"a",scrolled=false),o(3000,"a"),o(4500,"edit",scrolled=false)),7000).views)
        assertEquals(1,run(listOf(o(0,"a",scrolled=false),o(3000,"b"),o(3300,"edit",scrolled=false)),6000).views)
    }
    @Test fun leavingClearsPendingIdentityAndSkippedItemDoesNotCount() {
        assertEquals(0,run(listOf(o(0,null),leave(300),o(600,null,scrolled=false),o(2000,"late",scrolled=false)),5000).views)
        assertEquals(1,run(listOf(o(0,null),o(300,"skip",scrolled=false),o(600,"watched")),3000).views)
    }

}
