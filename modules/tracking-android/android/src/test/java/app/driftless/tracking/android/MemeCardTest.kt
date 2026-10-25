package app.driftless.tracking.android

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import androidx.test.core.app.ApplicationProvider
import android.content.Context
import app.driftless.tracking.core.CountBadgeValue
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

class MemeTestService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[35])
class MemeCardTest {
    @Test fun rotationDoesNotCrossAccountIncarnations() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val store=SqliteStore.get(context)
        val original=store.activeScope()
        val prefs=TrackingPrefs(context)
        try {
            prefs.clearMemeHistory()
            store.selectScope("account:meme-old")
            prefs.rememberMemeReaction("a", 1, setOf("a", "b"))
            store.selectScope("account:meme-fresh")
            assertTrue(prefs.usedMemeReactions().isEmpty())
            assertNull(prefs.lastMemeReaction())
            assertEquals(-1, prefs.previousMemeCaption("a"))
            store.selectScope("account:meme-old")
            assertEquals(setOf("a"), prefs.usedMemeReactions())
            assertEquals(1, prefs.previousMemeCaption("a"))
        } finally {
            prefs.clearMemeHistory()
            store.selectScope(original)
        }
    }

    @Test fun everyBundledMemeHasACatalogEntryAndValidGifHeader() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val assets=context.assets.list("memes")!!.toList()
        assertTrue(assets.size >= 19)
        val ids=app.driftless.tracking.core.MemeCollection.all.map { "${it.id}.gif" }.toSet()
        assets.forEach { file ->
            assertTrue(file in ids)
            context.assets.open("memes/$file").use {
                val header=ByteArray(6)
                assertEquals(6, it.read(header))
                assertTrue(String(header) in setOf("GIF87a", "GIF89a"))
            }
        }
    }

    @Test fun rotationSurvivesRecreationAndWipeClearsCaptionHistory() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val prefs=TrackingPrefs(context)
        prefs.clearMemeHistory()
        prefs.rememberMemeReaction("a", 1, setOf("a", "b"))
        val reread=TrackingPrefs(context)
        assertEquals(setOf("a"), reread.usedMemeReactions())
        assertEquals("a", reread.lastMemeReaction())
        assertEquals(1, reread.previousMemeCaption("a"))
        reread.rememberMemeReaction("b", 0, setOf("a", "b"))
        reread.rememberMemeReaction("a", 2, setOf("a", "b"))
        assertEquals(setOf("a"), reread.usedMemeReactions())
        reread.clearMemeHistory()
        assertTrue(reread.usedMemeReactions().isEmpty())
        assertNull(reread.lastMemeReaction())
        assertEquals(-1, reread.previousMemeCaption("a"))
    }

    @Test fun persistsDeduplicationWithoutLoginAndClearsOnWipe() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val prefs=TrackingPrefs(context)
        prefs.clearMemeHistory()
        assertTrue(prefs.memeCardsEnabled)
        prefs.memeCardsEnabled=false
        prefs.markMemeMilestone("2026-10-19",50)
        val reread=TrackingPrefs(context)
        assertFalse(reread.memeCardsEnabled)
        assertEquals(50,reread.shownMemeMilestone("2026-10-19"))
        assertEquals(0,reread.shownMemeMilestone("2026-10-20"))
        prefs.clearMemeHistory()
        assertEquals(0,reread.shownMemeMilestone("2026-10-19"))
    }
    @Test fun attachesOnlyOneCardAndCanDismissAndShowNextMilestone() {
        val controller=Robolectric.buildService(MemeTestService::class.java).create()
        val card=MemeMilestoneCard(controller.get())
        assertTrue(card.show(CountBadgeValue("~50","On this phone"),50,"te") {})
        assertTrue(card.isShowing)
        assertFalse(card.show(CountBadgeValue("~50","On this phone"),50,"te") {})
        card.hide(); assertFalse(card.isShowing)
        assertTrue(card.show(CountBadgeValue("~100","On this phone"),100,"en") {})
        card.hide(); controller.destroy()
    }
}
