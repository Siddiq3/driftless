package app.driftless.tracking.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReminderCopyTest {
    @Test fun everyLevelAndSeedFillsTheRealCount() {
        for (percent in listOf(50, 80, 90, 100)) for (seed in 0..5) {
            val (title, text) = ReminderCopy.pick(percent, 8, 10, "reels", seed)
            assertTrue(text, text.startsWith("8 of 10"))
            assertFalse(title + text, (title + text).contains("{"))
        }
    }

    @Test fun seedRotatesTheLine() {
        assertFalse(ReminderCopy.pick(80, 8, 10, "reels", 0) == ReminderCopy.pick(80, 8, 10, "reels", 1))
        assertEquals(ReminderCopy.pick(80, 8, 10, "reels", 0), ReminderCopy.pick(80, 8, 10, "reels", 3))
    }

    @Test fun leftNeverGoesNegative() {
        val (_, text) = ReminderCopy.pick(80, 12, 10, "reels", 0)
        assertFalse(text, text.contains("-"))
    }
}
