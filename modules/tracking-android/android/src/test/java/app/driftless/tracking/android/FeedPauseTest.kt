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
}
