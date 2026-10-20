package app.driftless.tracking.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BlockPolicyTest {
    private val ig = "com.instagram.android"
    private val now = 1_000_000L
    private val pro = CachedEntitlement(pro = true, validUntilMs = now + 1)
    private val cfg = BlockConfig(enabled = true, apps = setOf(ig), dailyMinutes = 30, schedules = emptyList())
    private fun d(
        c: BlockConfig = cfg,
        e: CachedEntitlement = pro,
        minutes: Int? = 10,
        dow: Int = 3,
        mod: Int = 12 * 60,
        snooze: Long = 0,
        pkg: String = ig,
    ) = BlockPolicy.decide(pkg, c, e, minutes, dow, mod, snooze, now)

    @Test fun blocksAtTheDailyLimit() {
        assertFalse(d(minutes = 29).block)
        assertEquals(BlockDecision(true, BlockReason.LIMIT), d(minutes = 30))
    }

    @Test fun neverBlocksWithoutVerifiedPro() {
        assertFalse(d(e = CachedEntitlement(false, null), minutes = 999).block)
    }

    @Test fun expiredCachedEntitlementFailsOpen() {
        assertFalse(d(e = CachedEntitlement(true, now), minutes = 999).block)
    }

    @Test fun unknownMinutesNeverBlockOnTheLimit() {
        assertFalse(d(minutes = null).block)
    }

    @Test fun onlySelectedAppsAndOnlyWhenEnabled() {
        assertFalse(d(pkg = "com.google.android.youtube", minutes = 999).block)
        assertFalse(d(c = cfg.copy(enabled = false), minutes = 999).block)
    }

    @Test fun snoozeAllowsTemporarily() {
        assertFalse(d(minutes = 999, snooze = now + 1).block)
        assertTrue(d(minutes = 999, snooze = now).block)
    }

    @Test fun schedulesBlockInsideTheWindow() {
        val weekdays9to5 = cfg.copy(dailyMinutes = null, schedules = listOf(Schedule((1..5).toSet(), 9 * 60, 17 * 60)))
        assertEquals(BlockReason.SCHEDULE, d(c = weekdays9to5, dow = 2, mod = 10 * 60).reason)
        assertFalse(d(c = weekdays9to5, dow = 2, mod = 17 * 60).block) // end is exclusive
        assertFalse(d(c = weekdays9to5, dow = 6, mod = 10 * 60).block) // Saturday
    }

    @Test fun overnightSchedulesWrapIntoTheNextDay() {
        val bedtime = Schedule(setOf(5), 22 * 60, 7 * 60) // Friday 22:00 → Saturday 07:00
        assertTrue(bedtime.contains(5, 23 * 60))
        assertTrue(bedtime.contains(6, 6 * 60))
        assertFalse(bedtime.contains(6, 23 * 60))
        assertFalse(bedtime.contains(5, 6 * 60))
        assertTrue(Schedule(setOf(7), 23 * 60, 1 * 60).contains(1, 30)) // Sunday night → Monday
    }

    @Test fun emptyWindowNeverBlocks() {
        assertFalse(Schedule((1..7).toSet(), 600, 600).contains(1, 600))
    }

    @Test fun cachedEntitlementIsCappedByOfflineGrace() {
        assertEquals(500L + BlockPolicy.OFFLINE_GRACE_MS, BlockPolicy.validUntil(null, 500))
        assertEquals(700L, BlockPolicy.validUntil(700, 500))
    }

    @Test fun capabilityEntitlementUsesEnforcementExpiryBoundary() {
        assertTrue(BlockPolicy.entitled(CachedEntitlement(true, 101L), 100L))
        assertFalse(BlockPolicy.entitled(CachedEntitlement(true, 100L), 100L))
        assertFalse(BlockPolicy.entitled(CachedEntitlement(true, 99L), 100L))
        assertFalse(BlockPolicy.entitled(CachedEntitlement(false, 101L), 100L))
        assertTrue(BlockPolicy.entitled(CachedEntitlement(true, null), 100L))
    }
}
