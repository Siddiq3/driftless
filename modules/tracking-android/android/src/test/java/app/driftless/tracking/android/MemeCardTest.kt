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
