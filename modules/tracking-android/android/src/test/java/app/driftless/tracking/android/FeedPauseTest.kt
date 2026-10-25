package app.driftless.tracking.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import app.driftless.tracking.core.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[35])
class FeedPauseTest {
    @Test fun breaksBypassesAndNotificationStateCannotCrossIncarnations() {
        val context=ApplicationProvider.getApplicationContext<Context>()
        val store=SqliteStore.get(context);val prefs=TrackingPrefs(context)
        store.selectScope("account:phase3-a")
        val day=store.account.date()
        prefs.feedState=FeedState(day,25,900000,800000,2)
        prefs.snooze("com.instagram.android",store.account.now()+300000)
        prefs.markSent(day,listOf("$day|views|100"))
        store.selectScope("account:phase3-b")
        assertEquals(FeedState(""),prefs.feedState)
        assertEquals(0,prefs.snoozesToday());assertEquals(0L,prefs.snoozedUntil("com.instagram.android"))
        assertTrue(prefs.sentAlerts(day).isEmpty())
        store.selectScope("guest:phase3-fresh")
        assertEquals(FeedState(""),prefs.feedState)
        store.selectScope("account:phase3-a")
        assertEquals(2,prefs.feedState.bypasses);assertEquals(1,prefs.snoozesToday())
        assertTrue(prefs.snoozedUntil("com.instagram.android")>store.account.now())
    }
    @Test fun settingsAndActiveBreakPersistAcrossPreferenceInstancesAndWipeClearsState() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = TrackingPrefs(context)
        prefs.blockConfig = BlockConfig(true, setOf("com.google.android.youtube"), null, emptyList(), true,
            FeedSettings(true, true, 25, 10, 0, 1, true))
        val state = FeedState("2026-10-21", 25, 900000, 0, 0)
        prefs.feedState = state
        val reopened = TrackingPrefs(context)
        assertEquals(prefs.blockConfig, reopened.blockConfig)
        assertEquals(state, reopened.feedState)
        prefs.clearFeedState()
        assertEquals(FeedState(""), reopened.feedState)
    }
    @Test fun overlayUpdatesDismissesAndCanBeShownAgain() {
        val controller = Robolectric.buildService(MemeTestService::class.java).create()
        val overlay = FeedPauseOverlay(controller.get())
        overlay.show(FeedReason.BREAK, 60000, 0, 5, true) {}
        assertTrue(overlay.isShowing)
        overlay.show(FeedReason.BREAK, 59000, 0, 5, true) {}
        assertTrue(overlay.isShowing)
        overlay.hide(); assertFalse(overlay.isShowing)
        overlay.show(FeedReason.DAILY_VIDEOS, 0, 1, 1, false) {}
        assertTrue(overlay.isShowing)
        overlay.hide(); controller.destroy()
    }
    @Test fun redesignedOverlayUpdatesCountdownAndUsesLatestBypassCallback() {
        val controller = Robolectric.buildService(MemeTestService::class.java).create()
        val overlay = FeedPauseOverlay(controller.get())
        var oldCalls = 0
        var newCalls = 0
        fun field(name: String) = FeedPauseOverlay::class.java.getDeclaredField(name).apply { isAccessible = true }.get(overlay)
        overlay.show(FeedReason.BREAK, 60000, 0, 5, true) { oldCalls++ }
        val bypass = field("bypass") as android.widget.Button
        assertFalse(bypass.isEnabled)
        assertTrue((field("summary") as android.widget.TextView).text.contains("1:00"))
        overlay.show(FeedReason.BREAK, 59000, 2, 5, false) { newCalls++ }
        assertTrue((field("summary") as android.widget.TextView).text.contains("0:59"))
        assertEquals(android.view.View.GONE, (field("detection") as android.view.View).visibility)
        assertTrue(bypass.isEnabled)
        bypass.performClick()
        assertEquals(0, oldCalls)
        assertEquals(1, newCalls)
        overlay.hide()
        assertNull(field("floatAnimation"))
        assertNull(field("mascot"))
        controller.destroy()
    }

}
