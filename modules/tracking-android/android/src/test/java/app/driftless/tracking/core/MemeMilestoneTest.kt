package app.driftless.tracking.core
import org.junit.Assert.*
import org.junit.Test
class MemeMilestoneTest {
    private val date="2026-10-19"
    @Test fun newFiftyCrossingsOnly() {
        assertNull(nextMemeMilestone(date,48,date,49,0))
        assertEquals(50,nextMemeMilestone(date,49,date,50,0))
        assertNull(nextMemeMilestone(date,50,date,50,50))
        assertNull(nextMemeMilestone(date,50,date,51,50))
        assertEquals(100,nextMemeMilestone(date,99,date,100,50))
        assertEquals(150,nextMemeMilestone(date,149,date,150,100))
    }
    @Test fun noReplayAfterReconnectDateChangeOrCorrection() {
        assertNull(nextMemeMilestone(null,null,date,100,0))
        assertNull(nextMemeMilestone("2026-10-18",149,date,50,0))
        assertEquals(50,nextMemeMilestone(date,49,date,50,0))
        assertNull(nextMemeMilestone(date,49,date,50,50))
        assertNull(nextMemeMilestone(date,51,date,49,0))
    }
    @Test fun delayedWritesShowOnlyLatestMilestone() {
        assertEquals(150,nextMemeMilestone(date,49,date,151,0))
        assertNull(nextMemeMilestone(date,151,date,152,150))
    }
    @Test fun automaticallyUsesConfiguredLanguageWithEnglishFallback() {
        assertEquals("te",MemeLanguages.resolve(listOf("te-IN")))
        assertEquals("te",MemeLanguages.resolve(listOf("en-IN", "te-IN")))
        assertEquals("ta",MemeLanguages.resolve(listOf("en", "ta", "te")))
        assertEquals("en",MemeLanguages.resolve(listOf("fr", "en-IN")))
        assertEquals("en",MemeLanguages.resolve(emptyList()))
        assertEquals("en",MemeLanguages.resolve(listOf("en-IN")))
        for (language in MemeLanguages.supported) {
            val copy=memeCopy(language,50)
            assertTrue(copy.caption.isNotBlank()); assertTrue(copy.pause.isNotBlank())
            assertTrue(copy.continueWatching.isNotBlank()); assertTrue(copy.close.isNotBlank())
            assertNotEquals(copy.caption,memeCopy(language,100).caption)
        }
        assertTrue(memeCopy("te",50).caption.contains("50"))
        assertNotEquals(memeCopy("en",50),memeCopy("te",50))
    }
}
