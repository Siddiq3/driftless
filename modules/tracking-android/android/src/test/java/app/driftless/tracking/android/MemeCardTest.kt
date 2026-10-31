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
    @Test fun selectedMemeLanguageHistoryPersists() {
        val controller=Robolectric.buildService(MemeTestService::class.java).create()
        val context=controller.get();val prefs=TrackingPrefs(context);prefs.clearMemeHistory()
        val card=MemeMilestoneCard(context)
        try {
            assertTrue(card.show(CountBadgeValue("50","On this phone"),50,"te") {})
            val recreated=TrackingPrefs(context)
            val reaction=recreated.lastMemeReaction()!!
            assertTrue(recreated.usedMemeReactions("te").contains(reaction))
            assertTrue(recreated.previousMemeCaption(reaction)>=0)
            val saved=context.getSharedPreferences("driftless_tracking",0).all
            assertFalse(saved.containsKey("meme_language"))
        } finally {card.hide();prefs.clearMemeHistory();controller.destroy()}
    }

    @Test fun languageCyclesPersistIndependentlyAndWipeClearsAllPools() {
        val prefs=TrackingPrefs(ApplicationProvider.getApplicationContext<Context>())
        prefs.clearMemeHistory()
        prefs.rememberMemeReaction("te-a",35,setOf("te-a","te-b"),"te")
        prefs.rememberMemeReaction("hi-a",47,setOf("hi-a","hi-b"),"hi")
        val recreated=TrackingPrefs(ApplicationProvider.getApplicationContext<Context>())
        assertEquals(setOf("te-a"),recreated.usedMemeReactions("te"))
        assertEquals(setOf("hi-a"),recreated.usedMemeReactions("hi"))
        assertEquals(35,recreated.previousMemeCaption("te-a"))
        recreated.rememberMemeReaction("te-b",2,setOf("te-a","te-b"),"te")
        recreated.rememberMemeReaction("te-a",3,setOf("te-a","te-b"),"te")
        assertEquals(setOf("te-a"),recreated.usedMemeReactions("te"))
        assertEquals(setOf("hi-a"),recreated.usedMemeReactions("hi"))
        recreated.clearMemeHistory()
        assertTrue(recreated.usedMemeReactions("te").isEmpty())
        assertTrue(recreated.usedMemeReactions("hi").isEmpty())
    }

    @Test fun displayedCaptionAndButtonsFollowSelectedReactionIncludingMissingLanguageFallback() {
        val controller=Robolectric.buildService(MemeTestService::class.java).create()
        val prefs=TrackingPrefs(controller.get());prefs.clearMemeHistory()
        val card=MemeMilestoneCard(controller.get())
        fun descendants(view: android.view.View): List<android.view.View> = listOf(view) +
            if(view is android.view.ViewGroup) (0 until view.childCount).flatMap {descendants(view.getChildAt(it))} else emptyList()
        try {
            for(language in listOf("te","hi","kn")) {
                assertTrue(card.show(CountBadgeValue("50","On this phone"),50,language) {})
                val chosen=app.driftless.tracking.core.MemeCollection.all.single{it.id==prefs.lastMemeReaction()}
                if(language!="kn") assertEquals(language,chosen.language)
                val root=MemeMilestoneCard::class.java.getDeclaredField("root").apply {isAccessible=true}.get(card) as android.view.View
                val nodes=descendants(root)
                val copy=app.driftless.tracking.core.memeCopy(chosen.language,50)
                val buttons=nodes.filterIsInstance<android.widget.Button>().map {it.text.toString()}
                assertTrue(copy.pause in buttons);assertTrue(copy.continueWatching in buttons)
                assertTrue(nodes.any{it.contentDescription==copy.close})
                val expected=chosen.caption(prefs.previousMemeCaption(chosen.id),50,false)
                assertTrue(nodes.filterIsInstance<android.widget.TextView>().any{it.text.toString()==expected})
                card.hide()
            }
        } finally {card.hide();prefs.clearMemeHistory();controller.destroy()}
    }

}
