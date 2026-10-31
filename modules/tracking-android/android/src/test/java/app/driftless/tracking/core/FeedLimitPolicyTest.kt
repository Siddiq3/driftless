package app.driftless.tracking.core

import org.junit.Assert.*
import org.junit.Test

class FeedLimitPolicyTest {
    private val day = "2026-10-21"
    private val cfg = FeedSettings(enforceGoal=true, breaksEnabled=true, everyViews=10, breakMinutes=5)
    private fun decide(count: Int, goal: Int? = 50, now: Long = 1000, state: FeedState = FeedState(day),
                       date: String = day, settings: FeedSettings = cfg, surface: Surface = Surface.SHORT_VIDEO,
                       pro: Boolean = true) =
        FeedLimitPolicy.evaluate(settings, state, date, now, count, goal, surface, pro)

    @Test fun repeatedExpiryAndRolloverAreIdempotent() {
        val active=decide(10)
        var state=active.state
        repeat(100) { state=decide(10,state=state,now=1001L+it).state }
        assertEquals(active.state,state)
        repeat(10) { assertNull(decide(10,state=state,now=state.breakUntilMs).reason) }
        state=decide(0,state=state,date="2026-10-22").state
        repeat(10) { assertEquals(state,decide(0,state=state,date="2026-10-22").state) }
    }
    @Test fun pausesAtTheNthVideoAndDailyCapSurvivesBreakExpiry() {
        assertNull(decide(49, settings=cfg.copy(breaksEnabled=false)).reason)
        assertEquals(FeedReason.DAILY_VIDEOS, decide(50).reason)
        assertEquals(FeedReason.DAILY_VIDEOS, decide(51, now=900_000).reason)
        assertNull(decide(0, date="2026-10-22", state=FeedState(day, breakUntilMs=999999)).reason)
    }
    @Test fun timedBreakIsPersistentAndOnlyTriggersOncePerMilestone() {
        assertNull(decide(9).reason)
        val first = decide(10)
        assertEquals(FeedReason.BREAK, first.reason)
        assertEquals(301000L, first.state.breakUntilMs)
        assertEquals(FeedReason.BREAK, decide(10, now=300999, state=first.state).reason)
        assertNull(decide(10, now=301000, state=first.state).reason)
        assertEquals(FeedReason.BREAK, decide(20, now=302000, state=first.state).reason)
    }
    @Test fun includedFeaturesStillRespectSurfaceAndDetectionGates() {
        for (surface in listOf(Surface.OTHER, Surface.UNKNOWN))
            assertNull(decide(100, surface=surface).reason)
        assertEquals(FeedReason.DAILY_VIDEOS, decide(100, pro=false).reason)
        assertNull(decide(100, goal=null, settings=cfg.copy(breaksEnabled=false)).reason)
        assertNull(decide(100, settings=FeedSettings()).reason)
    }
    @Test fun bypassBudgetAndExpiryApplyAcrossAppRestartsAndResetOnNewLocalDay() {
        var state = FeedState(day)
        repeat(3) { i ->
            state = FeedLimitPolicy.bypass(cfg, state, day, 1000L+i)!!
            assertEquals(i+1, state.bypasses)
        }
        assertNull(FeedLimitPolicy.bypass(cfg, state, day, 1004))
        assertNull(decide(100, state=state, now=state.bypassUntilMs-1).reason)
        assertEquals(FeedReason.DAILY_VIDEOS, decide(100, state=state, now=state.bypassUntilMs).reason)
        assertEquals(1, FeedLimitPolicy.bypass(cfg, state, "2026-10-22", 500000)!!.bypasses)
        assertNull(FeedLimitPolicy.bypass(cfg.copy(maxBypasses=0), FeedState(day), day, 1000))
    }
    @Test fun invalidDurationsAreBoundedAndNewDayDropsOldBreakAndBypass() {
        val changed = cfg.copy(breakMinutes=-1, bypassMinutes=100)
        assertEquals(61000L, decide(10, settings=changed).state.breakUntilMs)
        assertEquals(1801000L, FeedLimitPolicy.bypass(changed, FeedState(day), day, 1000)!!.bypassUntilMs)
        val old = FeedState(day, 100, 999999, 999999, 3)
        val next = decide(0, state=old, date="2026-10-22")
        assertEquals(FeedState("2026-10-22"), next.state)
        assertNull(next.reason)
    }
}
