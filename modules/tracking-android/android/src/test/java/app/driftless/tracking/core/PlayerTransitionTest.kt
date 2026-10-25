package app.driftless.tracking.core

import org.junit.Assert.*
import org.junit.Test

class PlayerTransitionTest {
    private fun frame(container: Boolean, identity: String? = null, surface: Surface = Surface.SHORT_VIDEO) =
        Classification(surface, identity, false, 10, container)
    @Test fun staleFrameCannotArmOrConsumeANewReplacement() {
        val t=PlayerTransition()
        t.observe("yt",frame(true,"a"),1000)
        t.observe("yt",frame(true,"a"),2000)
        assertFalse(t.observe("yt",frame(false),1500))
        assertFalse(t.observe("yt",frame(true,"caption-edit"),2100))
    }
    @Test fun disconnectClearsAnUnconsumedPlayerReplacement() {
        val t=PlayerTransition();t.observe("yt",frame(true,"a"),1000);t.observe("yt",frame(false),1100)
        t.reset();assertFalse(t.observe("yt",frame(true,"b"),1200))
    }
    @Test fun replacementIsOneStructuralSignalWithoutScrollEvents() {
        val t = PlayerTransition()
        assertFalse(t.observe("yt", frame(true, "a"), 0))
        assertFalse(t.observe("yt", frame(false), 100))
        assertFalse(t.observe("yt", frame(false), 200))
        assertTrue(t.observe("yt", frame(true, "b"), 300))
        assertFalse(t.observe("yt", frame(true, "b"), 400))
    }
    @Test fun captionLossEditsAndStaleOrCrossAppReplacementsDoNotAuthorizeCounts() {
        val t = PlayerTransition()
        t.observe("yt", frame(true, "a"), 0)
        assertFalse(t.observe("yt", frame(true), 100))
        assertFalse(t.observe("yt", frame(true, "edit"), 300))
        t.observe("yt", frame(false), 400)
        assertFalse(t.observe("yt", frame(true, "b"), 2000))
        t.observe("yt", frame(false), 2100)
        assertFalse(t.observe("ig", frame(true, "c"), 2200))
        t.observe("ig", frame(false), 2300)
        t.observe("ig", frame(false, surface=Surface.OTHER), 2400)
        assertFalse(t.observe("ig", frame(true, "d"), 2500))
    }
    @Test fun replacementsKeepDwellDeduplicationAndRapidSwipeRules() {
        val t = PlayerTransition()
        val counter = ViewCounter()
        val outputs = mutableListOf<CounterOutput>()
        fun observe(time: Long, container: Boolean, identity: String?) {
            val c = frame(container, identity)
            outputs += counter.observe(Observation(time, c.surface, identity, false, t.observe("yt", c, time)))
        }
        observe(0, true, "a")
        outputs += counter.flush(2000)
        observe(3000, false, null); observe(3300, true, "b")
        outputs += counter.flush(5000)
        observe(6000, false, null); observe(6300, true, "b")
        outputs += counter.flush(8000)
        observe(9000, false, null); observe(9200, true, "skip")
        observe(9500, false, null); observe(9700, true, "c")
        outputs += counter.flush(12000)
        assertEquals(3, outputs.count { it is CounterOutput.Counted })
    }
}
