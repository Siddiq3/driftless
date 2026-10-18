package app.driftless.tracking.core

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.ZoneId

class UsageMathTest {
    private val ig = "com.instagram.android"
    private val yt = "com.google.android.youtube"
    private val pkgs = setOf(ig, yt)
    private fun r(t: Long, p: String = ig) = UsageTransition(t, p, resumed = true)
    private fun p(t: Long, p: String = ig) = UsageTransition(t, p, resumed = false)

    @Test fun sumsResumePausePairsPerPackage() {
        val m = UsageMath.foregroundMs(listOf(r(100), p(400), r(1000, yt), p(1500, yt), r(2000), p(2100)), pkgs, 0, 10_000, 10_000)
        assertEquals(400L, m[ig])
        assertEquals(500L, m[yt])
    }

    @Test fun appAlreadyOpenAtStartIsCountedFromStart() {
        assertEquals(300L, UsageMath.foregroundMs(listOf(p(300)), pkgs, 0, 10_000, 10_000)[ig])
    }

    @Test fun appStillOpenIsCountedUntilNowNotEndOfDay() {
        assertEquals(400L, UsageMath.foregroundMs(listOf(r(100)), pkgs, 0, 10_000, 500)[ig])
    }

    @Test fun duplicateResumesAreMerged() {
        assertEquals(300L, UsageMath.foregroundMs(listOf(r(100), r(200), p(400)), pkgs, 0, 10_000, 10_000)[ig])
    }

    @Test fun unpairedPauseAfterPairIsIgnored() {
        assertEquals(100L, UsageMath.foregroundMs(listOf(r(100), p(200), p(300)), pkgs, 0, 10_000, 10_000)[ig])
    }

    @Test fun transitionsOutsideWindowAreClipped() {
        assertEquals(500L, UsageMath.foregroundMs(listOf(r(-1_000), p(500)), pkgs, 0, 10_000, 10_000)[ig])
        assertEquals(0L, UsageMath.foregroundMs(listOf(r(20_000), p(30_000)), pkgs, 0, 10_000, 40_000)[ig])
    }

    @Test fun otherPackagesAreIgnoredAndMissingOnesAreZero() {
        val m = UsageMath.foregroundMs(listOf(r(0, "com.example"), p(100, "com.example")), pkgs, 0, 1_000, 1_000)
        assertEquals(mapOf(ig to 0L, yt to 0L), m)
    }

    @Test fun dayBoundsAreDstAware() {
        val (s, e) = UsageMath.dayBounds("2026-03-08", ZoneId.of("America/New_York"))
        assertEquals(23 * 3_600_000L, e - s)
    }

    @Test fun coverageUsesElapsedMinutesForToday() {
        val z = ZoneId.of("UTC")
        val (s, _) = UsageMath.dayBounds("2026-10-18", z)
        assertEquals(0.5, UsageMath.coverage(30, "2026-10-18", z, s + 60 * 60_000L), 1e-9)
        assertEquals(1.0, UsageMath.coverage(1440, "2026-10-17", z, s), 1e-9)
        assertEquals(0.0, UsageMath.coverage(10, "2026-10-19", z, s), 1e-9)
    }
}
