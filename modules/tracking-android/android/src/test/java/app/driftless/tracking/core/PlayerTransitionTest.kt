package app.driftless.tracking.core

import org.junit.Assert.*
import org.junit.Test

class PlayerTransitionTest {
    private fun metadata(key: String, channel: String = "channel", ad: Boolean = false) =
        Classification(Surface.SHORT_VIDEO, key, ad, 10, true, setOf(channel, key))

    @Test fun persistentPlayerCountsThreeSettledIdentitiesAndDedupesRepeatedEvents() {
        val transition = PlayerTransition()
        val counter = ViewCounter()
        val outputs = mutableListOf<CounterOutput>()
        fun observe(now: Long, key: String) {
            val c = metadata(key)
            outputs += counter.observe(Observation(now, c.surface, c.fingerprint, c.isAd,
                transition.observe("yt", c, now)))
        }
        observe(0, "a"); outputs += counter.flush(2000)
        for ((start, key) in listOf(3000L to "b", 6000L to "c")) {
            observe(start, key)
            observe(start + 399, key)
            observe(start + 400, key)
            repeat(10) { observe(start + 450 + it * 10, key) }
            outputs += counter.flush(start + 2000)
        }
        assertEquals(3, outputs.count { it is CounterOutput.Counted })
    }

    @Test fun leavingResetsCandidateButKeepsEngineRecentItemDedupeIncludingAppReopen() {
        val transition = PlayerTransition()
        val store = MemoryStore()
        val rules = AppRules("yt", "Shorts", emptySet(), emptyList(), emptySet(), emptySet(), emptyList())
        val engine = Engine(store, RuleSet(1, mapOf("yt" to rules)))
        fun observe(now: Long, c: Classification) =
            engine.onObservation("yt", "1", c, transition.observe("yt", c, now), now)
        observe(0, metadata("a")); engine.onTick(2000)
        observe(2100, metadata("b"))
        observe(2200, frame(false, surface = Surface.OTHER))
        assertFalse(transition.awaitingIdentity)
        observe(2300, metadata("c")); engine.onTick(4300)
        engine.onLeave(4400); transition.reset()
        observe(4500, metadata("c")); engine.onTick(6500)
        assertEquals(2, store.events(0).size)
    }

    @Test fun unstablePartialAndSingleSignalMetadataNeverAuthorizesAReplacement() {
        val t = PlayerTransition()
        t.observe("yt", metadata("a"), 0)
        assertFalse(t.observe("yt", metadata("b"), 100))
        assertFalse(t.observe("yt", metadata("c"), 400))
        assertFalse(t.observe("yt", metadata("c"), 799))
        assertTrue(t.observe("yt", metadata("c"), 800))
        assertFalse(t.observe("yt", metadata("d").copy(identitySignals = setOf("d")), 1000))
        assertFalse(t.observe("yt", metadata("d").copy(identitySignals = setOf("d")), 1600))
    }

    @Test fun partialReplacementMetadataDoesNotEraseTheLastCompleteIdentity() {
        val t = PlayerTransition()
        val counter = ViewCounter()
        val out = mutableListOf<CounterOutput>()
        fun observe(now:Long,c:Classification) {
            out += counter.observe(Observation(now,c.surface,c.fingerprint,c.isAd,t.observe("yt",c,now)))
        }
        observe(0,metadata("a"));out += counter.flush(2000)
        observe(2100,frame(false))
        observe(2200,metadata("partial").copy(identitySignals=setOf("channel-b")))
        observe(2500,metadata("b","channel-b"))
        observe(2900,metadata("b","channel-b"));out += counter.flush(5000)
        assertEquals(2,out.count { it is CounterOutput.Counted })
    }

    @Test fun persistentReplacementKeepsAdsSeparateAndNeverCountsARapidIntermediateShort() {
        val t = PlayerTransition()
        val counter = ViewCounter()
        val out = mutableListOf<CounterOutput>()
        fun observe(now: Long, key: String, ad: Boolean = false) {
            val c = metadata(key, ad = ad)
            out += counter.observe(Observation(now, c.surface, key, ad, t.observe("yt", c, now)))
        }
        observe(0, "a"); out += counter.flush(2000)
        observe(2100, "skip"); observe(2300, "ad", true); observe(2700, "ad", true)
        out += counter.flush(4700)
        assertEquals(listOf(ViewKind.VIEW, ViewKind.AD_VIEW), out.filterIsInstance<CounterOutput.Counted>().map { it.kind })
    }

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
