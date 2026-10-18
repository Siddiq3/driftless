package app.driftless.tracking.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LimitAlertsTest {
    private val d = "2026-10-18"
    private val limits = listOf(Limit("minutes", 30), Limit("views", 50))

    @Test fun nothingBelow80Percent() {
        assertTrue(LimitAlerts.due(limits, 23, 39, emptySet(), d).isEmpty())
    }

    @Test fun firesAt80ThenAt100Once() {
        val a = LimitAlerts.due(limits, 24, null, emptySet(), d)
        assertEquals(listOf(80), a.map { it.second.percent })
        val sent = a.map { it.first }.toSet()
        assertTrue(LimitAlerts.due(limits, 25, null, sent, d).isEmpty())
        val b = LimitAlerts.due(limits, 30, null, sent, d)
        assertEquals(listOf(100), b.map { it.second.percent })
        assertTrue(LimitAlerts.due(limits, 45, null, sent + b.map { it.first }, d).isEmpty())
    }

    @Test fun jumpingStraightPast100SendsOnlyTheHigherAlert() {
        assertEquals(listOf(100), LimitAlerts.due(limits, 40, null, emptySet(), d).map { it.second.percent })
    }

    @Test fun unknownUsageNeverAlerts() {
        assertTrue(LimitAlerts.due(limits, null, null, emptySet(), d).isEmpty())
    }

    @Test fun keysAreScopedToTheDay() {
        val sent = LimitAlerts.due(limits, 30, null, emptySet(), d).map { it.first }.toSet()
        assertEquals(1, LimitAlerts.due(limits, 30, null, sent, "2026-10-19").size)
    }
}
