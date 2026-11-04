package app.driftless.tracking.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LimitAlertsTest {
    private val d = "2026-10-18"
    private val limits = listOf(Limit("minutes", 30), Limit("views", 50))

    @Test fun nothingBelow50Percent() {
        assertTrue(LimitAlerts.due(limits, 14, 24, emptySet(), d).isEmpty())
    }

    @Test fun firesAt50Then80Then90Then100Once() {
        var sent = emptySet<String>()
        for ((views, percent) in listOf(25 to 50, 40 to 80, 45 to 90, 50 to 100)) {
            val a = LimitAlerts.due(limits, null, views, sent, d)
            assertEquals(listOf(percent), a.map { it.second.percent })
            sent = sent + a.map { it.first }
            assertTrue(LimitAlerts.due(limits, null, views, sent, d).isEmpty())
        }
        assertTrue(LimitAlerts.due(limits, null, 80, sent, d).isEmpty())
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
